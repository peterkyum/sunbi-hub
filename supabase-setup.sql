-- =============================================
-- sunbi-hub: 사용자 역할 및 앱 접근 권한 테이블
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. user_roles 테이블
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'franchise'
    CHECK (role IN ('admin', 'staff', 'distributor', 'franchise')),
  name TEXT NOT NULL DEFAULT '',
  allowed_apps TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS 활성화
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 3. 본인 프로필 조회
CREATE POLICY "users_read_own_role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- 4. admin만 전체 조회 가능
CREATE POLICY "admin_read_all_roles"
  ON user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. admin만 upsert 가능
CREATE POLICY "admin_upsert_roles"
  ON user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 6. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 첫 번째 관리자 계정 등록 예시
-- (로그인 후 auth.uid() 확인하여 실행)
-- =============================================
-- INSERT INTO user_roles (user_id, role, name, allowed_apps)
-- VALUES (
--   '<YOUR_USER_UUID>',
--   'admin',
--   '본사 관리자',
--   ARRAY['sunbi-base', 'sunbi-crew-order', 'sunbi-floor-plan', 'sunbi-store-abb']
-- );
