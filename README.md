# 마중 (majung)

예배 전 미리 묵상하고 나눔을 준비하는 CM 서비스.

기획 문서: `CM_예배전준비서비스_기획문서.md`

## 스택

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage + Edge Function)

## 현재 상태

- Supabase 프로젝트(`majung`, ap-northeast-2) 생성 완료, GitHub(`wlsdlf2/majung`) 연동 완료
- `0001_init.sql` ~ `0003_ondelete_policy.sql` 마이그레이션 적용 완료
- 회원가입 → 로그인 → "이번 주" 화면 로딩까지 동작 확인 완료
- Cloudflare Pages 배포 완료: https://majung.pages.dev (GitHub `main` 브랜치 push 시 자동 재배포)

## 배포 (Cloudflare Pages)

Workers & Pages → Import an existing Git repository → `wlsdlf2/majung` 선택. 설정값:

- Framework preset: `React (Vite)`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production/Preview 둘 다)

`public/_redirects`에 `/* /index.html 200`을 넣어뒀다 — React Router로 클라이언트 라우팅을 하기 때문에, 이게 없으면 `/history`처럼 `/` 이외의 경로를 새로고침하거나 직접 접속할 때 Cloudflare가 404를 반환한다.

## 로컬 개발 준비

1. Supabase 프로젝트 생성 후 `supabase/migrations/`의 SQL 파일들을 순서대로 SQL Editor(또는 `supabase db push`)로 적용
   - 프로젝트 생성 시 Security의 "Automatically expose new tables"를 끄고 만들었다면 `0002_grants.sql`(GRANT 문)까지 반드시 적용해야 한다. 이 옵션을 끄면 RLS 정책과 별개로 테이블 자체에 대한 기본 권한이 없어서 모든 쿼리가 `permission denied`로 막힌다.
   - Auth > Sign In / Providers에서 **Confirm email을 꺼야 한다.** 이 앱은 실제 수신 불가능한 가짜 이메일(`${username}@majung.com`)로 가입하므로, 이메일 확인이 켜져 있으면 확인 메일 발송 단계에서 막히거나(`email rate limit exceeded`) 존재하지 않는 도메인이라 거부된다(`Email address ... is invalid`).
2. `.env.example`을 `.env.local`로 복사하고 프로젝트의 URL / publishable(anon) key 입력
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
3. 설치 및 실행
   ```
   npm install
   npm run dev
   ```
4. 첫 계정을 만들면 `public.users.role`이 기본값 `MEMBER`로 생성됩니다. 콘텐츠 등록 권한을 주려면 Supabase SQL Editor에서 직접 role을 `CONTENT_MANAGER`로 변경하세요:
   ```sql
   update public.users set role = 'CONTENT_MANAGER' where username = '아이디';
   ```

## 인증 방식 참고

기획문서는 "아이디+비밀번호" 인증을 요구하지만 Supabase Auth는 이메일 기반이 기본입니다.
`src/context/AuthContext.tsx`에서 입력한 아이디를 `${username}@majung.com` 형태의 내부용 이메일로 변환해
Supabase Auth에 그대로 위임하는 방식으로 구현했습니다. 실제 이메일이 필요 없는 가짜 계정입니다.
(`.local` 등 예약 TLD는 이메일 형식 검증에서 거부되어 `.com`을 사용하며, Confirm email을 꺼서 가입 즉시 자동 승인되게 했습니다.)

## 아직 안 된 것

- 카카오 소셜로그인
- 커스텀 도메인 연결 (지금은 `majung.pages.dev` 기본 도메인만 사용)

## 설교노트 이미지 AI 추출 참고

`supabase/functions/extract-sermon-note`가 Google Gemini(`gemini-3.6-flash`) 비전 API로 이미지를 구조화한다. 배포 전 Supabase 프로젝트에 `GEMINI_API_KEY` 시크릿 등록이 필요하다.

- Gemini REST API는 필드명이 camelCase(`inlineData`, `mimeType`, `systemInstruction`)여야 한다. snake_case로 보내면 즉시 400이 아니라 `503 UNAVAILABLE`(high demand)로 애매하게 실패해서 디버깅이 오래 걸렸다.
- base64로 인코딩한 원본 이미지를 그대로 보내면 페이로드가 커져서 역시 503을 유발한다. `src/lib/api.ts`의 `uploadSermonNoteImages`가 업로드 전 캔버스로 긴 변 1200px/JPEG 85%로 리사이즈해서 올린다.
