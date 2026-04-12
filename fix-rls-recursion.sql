-- =============================================
-- RLS 무한 재귀 수정 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 기존 재귀 정책 제거
DROP POLICY IF EXISTS "users_read_own_role" ON user_roles;
DROP POLICY IF EXISTS "admin_read_all_roles" ON user_roles;
DROP POLICY IF EXISTS "admin_upsert_roles" ON user_roles;

-- 2. admin 판별 함수 (SECURITY DEFINER → RLS 우회하여 재귀 방지)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. 본인 프로필 조회 OR admin 전체 조회
CREATE POLICY "users_read_own_or_admin"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

-- 4. admin만 INSERT 가능
CREATE POLICY "admin_insert_roles"
  ON user_roles FOR INSERT
  WITH CHECK (is_admin());

-- 5. admin만 UPDATE 가능
CREATE POLICY "admin_update_roles"
  ON user_roles FOR UPDATE
  USING (is_admin());

-- 6. admin만 DELETE 가능
CREATE POLICY "admin_delete_roles"
  ON user_roles FOR DELETE
  USING (is_admin());
