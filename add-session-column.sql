-- =============================================
-- 중복 로그인 방지: active_session_id 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. active_session_id 컬럼 추가
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS active_session_id TEXT DEFAULT NULL;

-- 2. 본인 세션 업데이트 정책 추가 (기존 admin 전용 UPDATE에 추가)
--    본인이 자기 active_session_id만 업데이트 가능
CREATE POLICY "users_update_own_session"
  ON user_roles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
