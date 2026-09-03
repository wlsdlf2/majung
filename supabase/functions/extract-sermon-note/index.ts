// Supabase Edge Function: 설교노트 이미지 -> 비전 LLM -> 구조화된 JSON
//
// 여러 장의 이미지를 받아 Gemini(비전)에게 전달하고, raw_extracted_text /
// sermon_note_text / questions로 구조화된 결과를 리턴한다. 구조화가 실패해도
// raw_extracted_text는 항상 보존한다 (기획문서 6절).
//
// 배포 전 Supabase 프로젝트에 GEMINI_API_KEY 시크릿 등록이 필요하다.
//   supabase secrets set GEMINI_API_KEY=AIza...

const GEMINI_MODEL = 'gemini-2.5-pro'

interface ExtractRequestBody {
  imageUrls: string[]
}

interface ExtractedQuestion {
  question: string
  guide_text: string | null
}

interface ExtractedResult {
  raw_extracted_text: string
  sermon_note_text: string
  questions: ExtractedQuestion[]
}

const SYSTEM_PROMPT = `당신은 교회 설교노트 이미지에서 내용을 추출하는 도우미입니다.
입력으로 1장 이상의 이미지가 주어지며, 이미지 순서는 신뢰할 수 없습니다
(업로드 순서가 실제 페이지 순서와 다를 수 있음). 각 이미지의 내용 자체를
보고 성격을 판단하세요.

설교노트는 보통 다음 두 가지 성격의 페이지로 구성됩니다:
1. 해설 페이지: 소제목 + 문단으로 구성된 본문 해설
2. 질문 페이지: 번호가 매겨진 나눔 질문 목록 (번호 스타일은 O1, Q1, 1),
   질문1 등 다양할 수 있음). 각 질문 아래에 해설자가 미리 풀어준 해설이나
   예시 답변 문단이 함께 있을 수도, 없을 수도 있습니다.

다음 순서로 작업하세요.
1. 모든 이미지에서 텍스트를 읽어 원문 그대로 raw_extracted_text에 담습니다.
   (페이지 구분은 "--- 다음 페이지 ---"로 표시, 손실 없이 전체 보존)
2. 해설 페이지 내용을 정리해 sermon_note_text에 담습니다.
   - 날짜, 시리즈명, 로고, 페이지 번호 등 부가 정보는 제외
   - 문단 구분은 유지하되 어색한 줄바꿈은 자연스럽게 정리
3. 질문 페이지에서 각 질문을 questions 배열로 추출합니다.
   - question: 질문 문장 자체만 (번호 제거)
   - guide_text: 질문 아래 딸린 해설/예시답변 문단이 있으면 그대로,
     없으면 null
   - 순서는 원본의 번호 순서를 따름

이미지 화질이 낮거나 일부가 불확실해도 최선을 다해 구조화하고,
정말 판단이 안 서는 내용은 sermon_note_text 끝에 그대로 남겨두세요.
절대 내용을 요약하거나 생략하지 말고, 반드시 유효한 JSON만 출력하세요.

응답 JSON 스키마
{
  "raw_extracted_text": "string",
  "sermon_note_text": "string",
  "questions": [
    { "question": "string", "guide_text": "string | null" }
  ]
}`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

// responseMimeType: "application/json"으로 요청하지만, 혹시 모델이 코드펜스로
// 감싸 응답하는 경우까지 대비한 방어적 파싱.
function parseModelJson(text: string): ExtractedResult {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonText = fencedMatch ? fencedMatch[1] : text
  const parsed = JSON.parse(jsonText.trim())

  return {
    raw_extracted_text: String(parsed.raw_extracted_text ?? ''),
    sermon_note_text: String(parsed.sermon_note_text ?? ''),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.map((q: { question?: unknown; guide_text?: unknown }) => ({
          question: String(q.question ?? ''),
          guide_text: q.guide_text == null ? null : String(q.guide_text),
        }))
      : [],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  }

  try {
    const { imageUrls } = (await req.json()) as ExtractRequestBody
    if (!imageUrls || imageUrls.length === 0) {
      return jsonResponse({ error: 'imageUrls가 필요합니다.' }, 400)
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, 500)
    }

    const imageParts = await Promise.all(
      imageUrls.map(async (url) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`이미지를 불러오지 못했습니다: ${url}`)
        const buf = await res.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
        return { inline_data: { mime_type: mimeType, data: base64 } }
      }),
    )

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                ...imageParts,
                { text: '위 설교노트 이미지들을 JSON 스키마에 맞춰 추출해주세요.' },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      return jsonResponse({ error: `LLM 호출 실패: ${text}` }, 502)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return jsonResponse({ error: 'LLM 응답에서 텍스트를 찾지 못했습니다.' }, 502)
    }

    let parsed: ExtractedResult
    try {
      parsed = parseModelJson(text)
    } catch {
      // 구조화 파싱이 실패해도 원문은 그대로 보존해서 리턴한다.
      return jsonResponse({
        raw_extracted_text: text,
        sermon_note_text: '',
        questions: [],
      })
    }

    return jsonResponse(parsed)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
