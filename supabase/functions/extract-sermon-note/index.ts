// Supabase Edge Function: 설교노트 이미지 -> 비전 LLM -> 구조화된 JSON
//
// 기획문서 6절: 프롬프트는 특정 레이아웃에 고정하지 않고 "본문 해설 + 번호가 매겨진
// 나눔 질문(해설/예시답변이 딸려있을 수 있음)"이라는 일반적인 패턴으로 지시한다.
// 구조화가 실패해도 raw_extracted_text는 항상 보존한다.
//
// 비전 LLM 제공자/모델은 기획문서 9절 기준 미확정. 여기서는 Anthropic Claude를
// 기본값으로 두되, 환경변수만 바꾸면 다른 제공자로 교체할 수 있도록 분리했다.
// 배포 전 Supabase 프로젝트에 ANTHROPIC_API_KEY 시크릿 등록이 필요하다.
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

interface ExtractRequestBody {
  imageUrls: string[]
}

interface ExtractedQuestion {
  question: string
  guide_text: string | null
}

interface ExtractedResult {
  raw_extracted_text: string
  sermon_note_text: string | null
  questions: ExtractedQuestion[]
}

const SYSTEM_PROMPT = `당신은 교회 설교노트 이미지를 텍스트로 옮기는 보조자입니다.
이미지에는 보통 다음 두 부분이 섞여 있습니다:
1) 설교 본문 해설 (자유 서술형 텍스트)
2) 번호가 매겨진 나눔 질문 목록 (질문마다 해설이나 예시답변이 함께 적혀 있을 수도, 없을 수도 있음)

레이아웃(번호 스타일, 단 구성 등)은 매번 다를 수 있으므로 특정 형식에 얽매이지 말고
내용의 성격으로 구분하세요. 반드시 아래 JSON 스키마로만 응답하세요:

{
  "raw_extracted_text": "이미지에서 읽은 원문 텍스트 그대로 (요약/가공 없이)",
  "sermon_note_text": "본문 해설 부분만 정리한 텍스트 (읽기 좋게 문단 정리, 없으면 null)",
  "questions": [
    { "question": "질문 텍스트", "guide_text": "질문에 딸린 해설/예시답변 또는 null" }
  ]
}

구조화가 애매하면 questions는 빈 배열로 두어도 되지만, raw_extracted_text는 항상 채우세요.`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { imageUrls } = (await req.json()) as ExtractRequestBody
    if (!imageUrls || imageUrls.length === 0) {
      return new Response(JSON.stringify({ error: 'imageUrls가 필요합니다.' }), { status: 400 })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }), {
        status: 500,
      })
    }

    const imageContents = await Promise.all(
      imageUrls.map(async (url) => {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        const mediaType = res.headers.get('content-type') ?? 'image/jpeg'
        return {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        }
      }),
    )

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              ...imageContents,
              { type: 'text', text: '위 설교노트 이미지들을 JSON 스키마에 맞춰 추출해주세요.' },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return new Response(JSON.stringify({ error: `LLM 호출 실패: ${text}` }), { status: 502 })
    }

    const data = await response.json()
    const textBlock = data.content?.find((c: { type: string }) => c.type === 'text')
    const parsed = JSON.parse(textBlock?.text ?? '{}') as ExtractedResult

    return new Response(JSON.stringify(parsed), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
