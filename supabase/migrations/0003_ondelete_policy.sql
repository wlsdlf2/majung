-- 계정 삭제 시 데이터가 어떻게 처리되어야 하는지 정정.
-- weekly_contents(본문/설교노트)는 CONTENT_MANAGER 한 명 개인 소유물이 아니라
-- 교회 전체가 공유하는 자산이므로, 작성자 계정이 삭제돼도 콘텐츠 자체는 남아야 한다
-- (작성자 표시만 NULL이 됨). 반대로 reflections(개인 묵상/답변)는 계정 삭제 시
-- 함께 삭제되는 게 맞다 (reflection_answers는 이미 reflections에 CASCADE로 걸려있음).

ALTER TABLE public.weekly_contents
  DROP CONSTRAINT weekly_contents_created_by_fkey,
  ADD CONSTRAINT weekly_contents_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reflections
  DROP CONSTRAINT reflections_user_id_fkey,
  ADD CONSTRAINT reflections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
