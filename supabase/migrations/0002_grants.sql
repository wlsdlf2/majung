-- "Automatically expose new tables" 옵션을 끄고 프로젝트를 생성했기 때문에,
-- 테이블 생성 시 authenticated 롤에 대한 기본 권한(GRANT)이 자동으로 부여되지 않았다.
-- RLS 정책은 이 권한이 있어야 평가되므로, 정책에서 허용한 동작에 맞춰 명시적으로 GRANT한다.

GRANT SELECT ON public.users TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.weekly_contents TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.weekly_content_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_content_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflection_answers TO authenticated;

-- BIGINT GENERATED ALWAYS AS IDENTITY 컬럼에 INSERT하려면 시퀀스 USAGE 권한도 필요
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
