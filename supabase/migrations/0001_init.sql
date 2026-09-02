-- CM 예배 전 준비 서비스 — 초기 스키마
-- 기획문서(8절)의 MySQL 스타일 DDL을 Postgres/Supabase 관례에 맞게 변환:
--   * BIGINT AUTO_INCREMENT -> BIGINT GENERATED ALWAYS AS IDENTITY
--   * users.id는 auth.users(id)를 그대로 참조하는 UUID로 변경 (RLS의 auth.uid()와 직접 비교하기 위함)
--   * username/password 대신 Supabase Auth(auth.users)가 인증을 전담 -> public.users에는
--     role 등 앱 전용 필드만 둠 (password, social_provider, social_id 컬럼 제거)
--   * ON UPDATE CURRENT_TIMESTAMP는 Postgres에 없으므로 트리거로 구현

-- =========================================
-- 1. users (auth.users 확장 프로필)
-- =========================================
CREATE TABLE public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username    VARCHAR(50) NOT NULL UNIQUE,
    role        VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'CONTENT_MANAGER')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 회원가입 시 auth.users에 새 계정이 생기면 public.users 프로필을 자동 생성
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 2. weekly_contents (본문 + 설교노트, 전체 공용)
-- =========================================
CREATE TABLE public.weekly_contents (
    id                              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_date                    DATE NOT NULL UNIQUE,
    passage_text                    TEXT,
    sermon_note_registration_type   VARCHAR(10) CHECK (sermon_note_registration_type IN ('TEXT', 'IMAGE')),
    sermon_note_text                TEXT,
    raw_extracted_text              TEXT,
    status                           VARCHAR(20) NOT NULL DEFAULT 'PASSAGE_ONLY'
                                     CHECK (status IN ('PASSAGE_ONLY', 'PENDING_REVIEW', 'COMPLETED')),
    created_by                      UUID REFERENCES public.users(id),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_contents_set_updated_at
    BEFORE UPDATE ON public.weekly_contents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 3. weekly_content_images (설교노트 원본 이미지)
-- =========================================
CREATE TABLE public.weekly_content_images (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    weekly_content_id  BIGINT NOT NULL REFERENCES public.weekly_contents(id) ON DELETE CASCADE,
    image_url          VARCHAR(500) NOT NULL,
    sort_order         INT NOT NULL DEFAULT 0
);

-- =========================================
-- 4. weekly_content_questions
-- =========================================
CREATE TABLE public.weekly_content_questions (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    weekly_content_id  BIGINT NOT NULL REFERENCES public.weekly_contents(id) ON DELETE CASCADE,
    question_text      TEXT NOT NULL,
    guide_text         TEXT,
    sort_order         INT NOT NULL DEFAULT 0
);

-- =========================================
-- 5. reflections (개인 묵상 + 답변, 본인만 조회 가능)
-- =========================================
CREATE TABLE public.reflections (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            UUID NOT NULL REFERENCES public.users(id),
    weekly_content_id  BIGINT NOT NULL REFERENCES public.weekly_contents(id),
    meditation_note    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_week UNIQUE (user_id, weekly_content_id)
);

CREATE TRIGGER reflections_set_updated_at
    BEFORE UPDATE ON public.reflections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 6. reflection_answers
-- =========================================
CREATE TABLE public.reflection_answers (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reflection_id  BIGINT NOT NULL REFERENCES public.reflections(id) ON DELETE CASCADE,
    question_id    BIGINT NOT NULL REFERENCES public.weekly_content_questions(id),
    answer_text    TEXT,
    CONSTRAINT uq_reflection_question UNIQUE (reflection_id, question_id)
);

-- =========================================
-- 7. RLS 활성화 + 정책
-- =========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_content_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_content_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflection_answers ENABLE ROW LEVEL SECURITY;

-- users: 로그인한 사용자는 전체 프로필(id/username/role)을 읽을 수 있음 (나눔 화면 등에서 필요),
-- role 변경은 관리자가 SQL/서비스 롤로 수동 처리하므로 클라이언트용 INSERT/UPDATE 정책은 두지 않음
CREATE POLICY "로그인한 사용자는 프로필 전체 조회 가능" ON public.users
    FOR SELECT USING (auth.role() = 'authenticated');

-- weekly_contents: 로그인한 모두 읽기, 쓰기는 CONTENT_MANAGER만
CREATE POLICY "전체 읽기 허용" ON public.weekly_contents
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "권한자만 쓰기" ON public.weekly_contents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

CREATE POLICY "권한자만 수정" ON public.weekly_contents
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

-- weekly_content_images / weekly_content_questions: 부모와 동일한 규칙
CREATE POLICY "전체 읽기 허용" ON public.weekly_content_images
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "권한자만 쓰기" ON public.weekly_content_images
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

CREATE POLICY "권한자만 삭제" ON public.weekly_content_images
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

CREATE POLICY "전체 읽기 허용" ON public.weekly_content_questions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "권한자만 쓰기" ON public.weekly_content_questions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

CREATE POLICY "권한자만 수정" ON public.weekly_content_questions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

CREATE POLICY "권한자만 삭제" ON public.weekly_content_questions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );

-- reflections: 본인 것만 CRUD 가능
CREATE POLICY "본인 묵상만 조회" ON public.reflections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 묵상만 생성" ON public.reflections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 묵상만 수정" ON public.reflections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인 묵상만 삭제" ON public.reflections
    FOR DELETE USING (auth.uid() = user_id);

-- reflection_answers: 본인 소유 reflection에 속한 답변만 CRUD 가능
CREATE POLICY "본인 답변만 조회" ON public.reflection_answers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.reflections r WHERE r.id = reflection_id AND r.user_id = auth.uid())
    );

CREATE POLICY "본인 답변만 생성" ON public.reflection_answers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.reflections r WHERE r.id = reflection_id AND r.user_id = auth.uid())
    );

CREATE POLICY "본인 답변만 수정" ON public.reflection_answers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.reflections r WHERE r.id = reflection_id AND r.user_id = auth.uid())
    );

CREATE POLICY "본인 답변만 삭제" ON public.reflection_answers
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.reflections r WHERE r.id = reflection_id AND r.user_id = auth.uid())
    );

-- =========================================
-- 8. Storage: 설교노트 원본 이미지 버킷
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('sermon-note-images', 'sermon-note-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "설교노트 이미지 공개 읽기" ON storage.objects
    FOR SELECT USING (bucket_id = 'sermon-note-images');

CREATE POLICY "권한자만 설교노트 이미지 업로드" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'sermon-note-images'
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'CONTENT_MANAGER')
    );
