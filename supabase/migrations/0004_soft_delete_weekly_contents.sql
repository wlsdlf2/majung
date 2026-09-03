-- weekly_contents 소프트 삭제 지원.
-- CONTENT_MANAGER의 삭제는 즉시 모든 사용자에게 영향을 주는 공용 자산 삭제이므로,
-- 실수해도 되돌릴 수 있도록 행을 실제로 지우지 않고 deleted_at만 세운다.
-- (weekly_content_questions/images는 ON DELETE CASCADE라 실제 삭제 시 함께 지워지지만,
-- 소프트 삭제는 UPDATE라서 자식 행이 그대로 남아있어 복구 시 100% 원상복구된다.)

ALTER TABLE public.weekly_contents
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- service_date UNIQUE를 "삭제되지 않은 행" 범위로만 좁혀서, 삭제된 날짜에
-- 새 콘텐츠를 다시 등록할 수 있게 한다.
ALTER TABLE public.weekly_contents
  DROP CONSTRAINT weekly_contents_service_date_key;

CREATE UNIQUE INDEX weekly_contents_service_date_active_key
  ON public.weekly_contents (service_date)
  WHERE deleted_at IS NULL;

-- 삭제/복구는 UPDATE 한 건이라 기존 "권한자만 수정" 정책이 이미 커버한다.
-- 별도 RLS 정책 추가는 필요 없다.
