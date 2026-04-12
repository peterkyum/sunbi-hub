-- ============================================
-- 선비칼국수 Supabase 통합 마이그레이션
-- 허브(nhgkzquqbxbzwejzcdft)에 모든 테이블 생성
-- ============================================

-- 1. user_roles 확장 (crew-order profiles + store-abb users 필드 추가)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS business_number TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS invoice_email TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. 발주관리 테이블 (crew-order)
CREATE TABLE IF NOT EXISTS franchise_orders (
  id BIGSERIAL PRIMARY KEY,
  branch_id UUID NOT NULL,
  branch_name TEXT NOT NULL,
  order_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES franchise_orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT,
  qty NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_notices (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notice_reads (
  id BIGSERIAL PRIMARY KEY,
  notice_id BIGINT NOT NULL,
  branch_id UUID NOT NULL,
  branch_name TEXT,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notice_id, branch_id)
);

-- 3. 매장 정보 테이블 (store-abb)
CREATE TABLE IF NOT EXISTS consulting_posts (
  id BIGSERIAL PRIMARY KEY,
  category TEXT,
  title TEXT NOT NULL,
  content TEXT,
  user_id UUID REFERENCES auth.users(id),
  store_name TEXT,
  status TEXT DEFAULT 'pending',
  answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hq_notices (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS manuals (
  id BIGSERIAL PRIMARY KEY,
  category TEXT,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  video_url TEXT,
  file_url TEXT,
  file_name TEXT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sos_inquiries (
  id BIGSERIAL PRIMARY KEY,
  title TEXT,
  message TEXT,
  author TEXT,
  author_uid UUID,
  store_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_registrations (
  id BIGSERIAL PRIMARY KEY,
  "businessName" TEXT,
  "ownerName" TEXT,
  "businessNumber" TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  registered_by TEXT
);

-- 4. Storage bucket (매뉴얼 파일 업로드용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS 정책 (인증된 사용자 접근)
ALTER TABLE franchise_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hq_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_registrations ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 정책 (간단히)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'franchise_orders','franchise_order_items','order_notices','notice_reads',
    'consulting_posts','hq_notices','manuals','sos_inquiries','knowledge_base','business_registrations'
  ]) LOOP
    EXECUTE format('CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- uploads 버킷 정책
CREATE POLICY "auth_upload" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'uploads') WITH CHECK (bucket_id = 'uploads');
