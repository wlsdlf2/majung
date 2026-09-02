# CM 예배 전 준비 서비스 — 기획 문서

작성일: 2026-09-02

## 1. 서비스 개요

- **목적**: CM 리더가 주일 예배 전, 본문 말씀을 묵상하고 설교노트의 질문에 대한 생각을 미리 정리하여 CM 나눔을 준비할 수 있도록 돕는다.
- **사용자**: 초기에는 리더 1인이 사용. 향후 다른 CM 리더들도 계정을 추가해 확장 가능하도록 처음부터 계정 기반 구조로 설계한다.
- **핵심 가치**: CM 모임에서의 침묵과 형식적인 나눔("은혜받았어요" 수준)을 줄이기 위해, 즉흥적으로 답을 떠올리는 부담을 미리 덜어준다.

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 | React + TypeScript | 모바일 웹 반응형, Supabase 클라이언트로 직접 통신 |
| 백엔드/DB | Supabase (Postgres) | Auth, DB, Storage를 별도 서버 없이 통합 제공 |
| 인증 | Supabase Auth | 아이디+비밀번호 기본, 추후 카카오 OAuth 추가 |
| 저장소 | Supabase Storage | 설교노트 원본 이미지 저장 |
| 권한 제어 | Supabase RLS (Row Level Security) | 백엔드 코드 없이 DB 정책으로 권한 규칙 구현 |
| AI 이미지 추출 | Supabase Edge Function (TypeScript/Deno) | 이미지 → 비전 LLM 호출 → 구조화된 JSON 리턴, 무상태 단순 요청이라 별도 상시 서버 불필요 |

**선정 이유**: DB 스키마가 외래키·유니크 제약을 전제로 한 완전한 관계형 구조라 Postgres 기반의 Supabase가 적합하다. 또한 이미 설계된 권한 규칙(WeeklyContent는 권한자만 쓰기, Reflection은 본인만 CRUD)이 RLS 정책으로 그대로 옮겨간다. AI 추출 기능은 상태를 유지하지 않는 단순 요청-응답 작업이라 상시 구동되는 Spring Boot 서버보다 Edge Function이 인프라 관리 부담과 비용 면에서 더 적합하다.

## 3. 핵심 흐름

1. 본문 말씀 공유 (교회에서 전달, 외부)
2. 본문 등록 + 묵상 작성 (리더가 앱에 직접 입력)
3. 설교노트 공유 (교회에서 전달, 외부)
4. 설교노트 등록 + 질문 답변 작성 (리더가 앱에 직접 입력)
5. 주일 예배 참석 (오프라인)
6. CM 나눔 진행 (오프라인, 말로 진행 — 앱은 관여하지 않음)

## 4. 데이터 모델

### User
| 필드 | 설명 |
|---|---|
| id | PK |
| username / password | 아이디+비밀번호 기본 인증 (Supabase Auth) |
| social_login_info | 소셜로그인 정보 (추후 추가, 초기엔 null 허용 구조로 설계) |
| role | 콘텐츠 등록 권한 여부 (예: `MEMBER` / `CONTENT_MANAGER`) — 관리자가 수동 부여 |

### WeeklyContent (본문 + 설교노트, 전체 공용)
| 필드 | 설명 |
|---|---|
| id | PK |
| service_date | 예배일자 — "이번 주" 판별 기준 (날짜 기준 자동 계산) |
| passage_text | 본문 말씀 (순수 텍스트) |
| sermon_note_registration_type | 설교노트 등록 방식 — `TEXT` / `IMAGE` |
| sermon_note_text | 정제된 설교노트 본문 — TEXT 등록 시 직접 입력, IMAGE 등록 시 AI가 추출·정리한 결과. 평소 사용 화면에는 이 값만 노출 |
| raw_image_urls | 업로드한 설교노트 원본 이미지 (0장 이상, 개수 유동적) — 등록/검토 화면과 "원본 보기"에서만 사용 |
| raw_extracted_text | 이미지에서 추출한 원문 텍스트 그대로 (AI 구조화가 실패해도 항상 보존) |
| questions | 질문 목록. 각 항목은 `{ question, guide_text }` 구조 — guide_text는 설교자가 미리 풀어준 해설/예시답변(없으면 null) |
| status | 등록 진행 상태 (본문만 등록됨 / 설교노트까지 완료 / AI 추출 검토 대기) |
| created_by | 등록한 사용자 (User FK) |

### Reflection (개인 묵상 + 답변, 본인만 조회 가능)
| 필드 | 설명 |
|---|---|
| id | PK |
| user_id | FK → User |
| weekly_content_id | FK → WeeklyContent |
| meditation_note | 자유 묵상 메모 |
| answers | 질문별 답변 목록 |

## 5. 권한 정책

- **인증 방식**: 아이디+비밀번호 기본(Supabase Auth), 추후 소셜로그인(예: 카카오) 추가
- **콘텐츠 등록 권한**: role 기반. 관리자(현재는 본인)가 각 계정에 수동으로 권한 부여
- **읽기 권한**: WeeklyContent는 로그인한 모든 사용자에게 공개
- **쓰기 권한**: WeeklyContent 등록·수정은 권한을 부여받은 사용자만 가능
- **Reflection**: 철저히 본인 것만 CRUD 가능 (다른 사용자 것은 조회 자체가 불가)
- **구현 방식**: 위 규칙을 애플리케이션 코드가 아닌 Supabase RLS 정책으로 DB 레벨에서 강제한다 (예시는 8번 섹션 참고)

## 6. 콘텐츠 등록 규칙

- **본문**: 순수 텍스트 (줄바꿈만 적용)
- **"이번 주" 판별**: service_date 기준 날짜 자동 판별 (관리자 수동 지정 없음)

### 설교노트 등록 — 텍스트 방식
- 설교노트 내용을 직접 입력 (마크다운 지원)
- 질문은 "질문 추가" 입력창에서 하나씩 직접 추가 (guide_text도 있으면 함께 입력)

### 설교노트 등록 — 이미지 방식
- 이미지를 장수 제한 없이 업로드 (레이아웃·순서 무관하게 한 번에 전달), Supabase Storage에 저장
- 프론트엔드가 Supabase Edge Function을 호출 → Edge Function이 비전 LLM에게 이미지를 전달해 원문 텍스트를 추출(`raw_extracted_text`)하고, 이를 바탕으로 정제된 설교노트 본문(`sermon_note_text`)과 질문 목록(`questions`)을 구조화 시도 후 JSON으로 리턴
- 프롬프트는 특정 레이아웃(번호 스타일 등)에 고정하지 않고, "본문 해설 + 번호가 매겨진 나눔 질문(해설/예시답변이 딸려있을 수 있음)"이라는 일반적인 패턴으로 지시
- 구조화가 실패하거나 애매해도 `raw_extracted_text`는 항상 저장되어 내용 유실 없음
- **검토 단계 필수**: AI 추출 결과를 리더가 원본 이미지와 나란히 보며 확인·수정한 뒤 확정 저장 (자동 저장 없음)

## 7. 화면 구성 (IA)

1. **로그인/회원가입**: 아이디+비밀번호 입력, 소셜로그인 버튼(추후)
2. **이번 주 화면** (로그인 후 첫 진입 화면): 본문 · 묵상 작성 · 설교노트(정제된 텍스트, 상단에 "원본 보기" 아이콘) · 질문 답변이 한 화면에 모두 포함. 각 질문 아래 guide_text(있는 경우 참고용으로 먼저 표시) → 내 답변 입력창 순서
3. **지난 기록 화면**: 달력형 UI로 주차별 과거 묵상·답변 조회
4. **(권한 보유자 전용) 콘텐츠 등록 화면**: 등록 방식(텍스트/이미지) 선택 → 텍스트면 직접 입력, 이미지면 업로드 후 AI 추출 결과를 원본과 나란히 검토·수정하는 화면으로 진입 → 확정 저장

## 8. DB 테이블 스키마 (Supabase Postgres)

질문 목록과 이미지 목록은 컬럼에 뭉쳐 담지 않고 별도 테이블로 분리했다. 답변이 질문 하나하나에 FK로 연결되어야 개별 질문 단위로 수정·삭제·순서 변경을 깔끔하게 처리할 수 있기 때문이다.

```sql
CREATE TABLE users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password        VARCHAR(255)     NULL,            -- 소셜로그인 전용 계정은 NULL 허용
    social_provider VARCHAR(20)      NULL,             -- 예: KAKAO
    social_id       VARCHAR(100)     NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'MEMBER',  -- MEMBER / CONTENT_MANAGER
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE weekly_contents (
    id                             BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_date                   DATE         NOT NULL UNIQUE,  -- "이번 주" 판별 기준
    passage_text                   TEXT             NULL,
    sermon_note_registration_type  VARCHAR(10)      NULL,          -- TEXT / IMAGE
    sermon_note_text               TEXT             NULL,          -- 정제된 본문, 실사용 화면 노출
    raw_extracted_text             TEXT             NULL,          -- 이미지 원문 추출 보존용
    status                         VARCHAR(20)  NOT NULL DEFAULT 'PASSAGE_ONLY',
                                   -- PASSAGE_ONLY / PENDING_REVIEW / COMPLETED
    created_by                     BIGINT           NULL,
    created_at                     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_weekly_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE weekly_content_images (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    weekly_content_id  BIGINT NOT NULL,
    image_url          VARCHAR(500) NOT NULL,
    sort_order         INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_image_weekly FOREIGN KEY (weekly_content_id) REFERENCES weekly_contents(id) ON DELETE CASCADE
);

CREATE TABLE weekly_content_questions (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    weekly_content_id  BIGINT NOT NULL,
    question_text      TEXT NOT NULL,
    guide_text         TEXT NULL,                    -- 설교자가 미리 풀어준 해설/예시답변, 없으면 NULL
    sort_order         INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_question_weekly FOREIGN KEY (weekly_content_id) REFERENCES weekly_contents(id) ON DELETE CASCADE
);

CREATE TABLE reflections (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT NOT NULL,
    weekly_content_id  BIGINT NOT NULL,
    meditation_note    TEXT NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reflection_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_reflection_weekly FOREIGN KEY (weekly_content_id) REFERENCES weekly_contents(id),
    CONSTRAINT uq_user_week UNIQUE (user_id, weekly_content_id)   -- 유저당 주차별 묵상 1건
);

CREATE TABLE reflection_answers (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    reflection_id   BIGINT NOT NULL,
    question_id     BIGINT NOT NULL,
    answer_text     TEXT NULL,
    CONSTRAINT fk_answer_reflection FOREIGN KEY (reflection_id) REFERENCES reflections(id) ON DELETE CASCADE,
    CONSTRAINT fk_answer_question FOREIGN KEY (question_id) REFERENCES weekly_content_questions(id),
    CONSTRAINT uq_reflection_question UNIQUE (reflection_id, question_id)  -- 질문당 답변 1건
);
```

**설계 포인트**
- `weekly_contents.service_date`에 `UNIQUE` 제약을 걸어 같은 예배일자 중복 등록을 DB 레벨에서 방지. "이번 주" 조회는 `WHERE service_date <= CURRENT_DATE ORDER BY service_date DESC LIMIT 1`로 처리 가능
- `reflections`는 `(user_id, weekly_content_id)` 유니크 — 한 사람이 같은 주차에 묵상을 두 번 만들 수 없고 계속 UPDATE하는 방식으로 사용
- `reflection_answers`도 `(reflection_id, question_id)` 유니크 — 같은 질문에 답이 여러 개 생기지 않도록 방지
- `weekly_contents.created_by`, `users.password`는 NULL 허용 — 소셜로그인 전용 계정 및 향후 확장을 고려한 여유

### RLS 정책 예시 (Supabase)

```sql
-- reflections: 본인 것만 조회/수정 가능
CREATE POLICY "본인 묵상만 조회" ON reflections
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 묵상만 수정" ON reflections
    FOR ALL USING (auth.uid() = user_id);

-- weekly_contents: 로그인한 모두 읽기, 쓰기는 CONTENT_MANAGER만
CREATE POLICY "전체 읽기 허용" ON weekly_contents
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "권한자만 쓰기" ON weekly_contents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );
```

## 9. 미확정 / 추가 논의 필요 항목

- 리마인더 알림 정책 (발송 시점, 웹푸시/카카오톡/이메일 중 방식) — MVP 이후 우선순위 낮음
- 배포 방식: 프론트엔드 호스팅(Vercel 등) 및 도메인 — 미정
- UI 톤앤매너 (색상, 전체 무드) — 와이어프레임 단계에서 함께 결정
- 소셜로그인 제공자 구체 선정 (카카오 등)
- Edge Function에서 사용할 비전 LLM(구체 모델/API) 선정 및 프롬프트 상세 설계

## 10. 다음 단계

- [x] 화면별 와이어프레임 제작 (로그인, 이번 주, 지난 기록, 콘텐츠 등록·검토)
- [x] DB 테이블 스키마 상세 설계 (컬럼 타입, 제약조건까지)
- [x] 기술 스택 결정 (React+TypeScript / Supabase / Edge Function)
- [ ] Supabase 프로젝트 생성 및 스키마·RLS 정책 적용
- [ ] Edge Function AI 추출 프롬프트 설계
- [ ] 프론트엔드 프로젝트 셋업 (Vite + React + TypeScript)
- [ ] 배포 방식 결정
