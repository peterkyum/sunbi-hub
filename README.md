# 선비칼국수 파트너센터 (Sunbi Partner Hub)

> 본사 / 유통사 / 가맹점을 하나로 연결하는 프랜차이즈 통합 운영 플랫폼

## 개요

선비칼국수 파트너센터는 프랜차이즈 운영에 필요한 모든 기능을 **역할 기반 접근 제어(RBAC)** 아래 하나의 허브에서 제공합니다.
허브가 게이트웨이 역할을 하며, 각 마이크로앱을 iframe 프록시로 로드하여 **단일 인증, 단일 세션**으로 운영됩니다.

## 플랫폼 아키텍처

```
사용자 → sunbi-hub (Supabase Auth 로그인)
              │
              ├─ user_roles 테이블에서 역할·허용앱 조회
              └─ 허용된 앱을 iframe 프록시로 로드 (탭 전환 시 상태 유지)
                   │
                   ├─ /app/base/        → sunbi-base         (재고관리)
                   ├─ /app/order/       → sunbi-crew-order   (발주관리)
                   ├─ /app/floor-plan/  → sunbi-floor-plan   (매장 평면도)
                   └─ /app/store/       → sunbi-store-abb    (매장정보)
```

## 역할 체계

| 역할 | 설명 | 접근 가능 앱 (기본값) |
|------|------|----------------------|
| `admin` | 본사 관리자 | 전체 앱 + 관리자 페이지 |
| `staff` | 본사 팀원 | 전체 앱 |
| `distributor` | 유통사 | 재고관리, 발주관리 |
| `franchise` | 가맹점 | 재고관리, 발주관리 |

- 관리자는 **AdminPage**에서 사용자별 역할·앱 권한을 실시간 수정 가능
- 역할별 기본 앱 범위를 초과하는 권한은 자동으로 필터링됨

## 마이크로앱 구성

### 1. sunbi-hub (이 리포지토리)

통합 허브 — 인증 게이트웨이 + 앱 런처

| 항목 | 내용 |
|------|------|
| 스택 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 인증 | Supabase Auth (이메일/비밀번호) |
| 상태관리 | Zustand |
| 배포 | Vercel |
| 리포 | [peterkyum/sunbi-hub](https://github.com/peterkyum/sunbi-hub) |

**주요 기능**
- SSO 게이트웨이: 한 번 로그인으로 모든 앱 접근
- 단일 세션 정책: 다른 기기/브라우저 로그인 시 기존 세션 자동 로그아웃
- iframe 프록시: Vercel rewrite로 같은 도메인에서 로드 (iOS Safari ITP 대응)
- 다크모드 지원
- 반응형 UI: 데스크탑 탑 내비 + 모바일 바텀 내비

### 2. sunbi-base (재고관리)

매장 재고 입출고 및 현황 관리 PWA

| 항목 | 내용 |
|------|------|
| 스택 | 바닐라 JavaScript (PWA) |
| 연동 | Supabase + Telegram Bot (알림) |
| 배포 | Vercel |
| 리포 | [peterkyum/sunbi-base](https://github.com/peterkyum/sunbi-base) |

**주요 기능**
- 재고 입출고 기록 및 현황 대시보드
- Telegram 봇 연동 알림 (macOS LaunchAgent 60초 폴링)
- 오프라인 지원 (Service Worker)

### 3. sunbi-crew-order (발주관리)

가맹점 발주 및 주문 현황 관리

| 항목 | 내용 |
|------|------|
| 스택 | Flutter Web (Dart) |
| 연동 | Supabase + Google Apps Script |
| 배포 | Vercel |
| 리포 | [peterkyum/sunbi-crew-order](https://github.com/peterkyum/sunbi-crew-order) |

**주요 기능**
- 역할별 화면 분기 (가맹점 / 유통사 / 본사)
- 발주 생성·확인·이력 관리
- 공지사항 시스템
- Excel / PDF 다운로드

### 4. sunbi-floor-plan (매장 평면도)

매장 레이아웃 및 좌석 배치 에디터

| 항목 | 내용 |
|------|------|
| 스택 | React + Vite + Konva (Canvas) |
| 배포 | Vercel |
| 리포 | [peterkyum/sunbi-floor-plan](https://github.com/peterkyum/sunbi-floor-plan) |

**주요 기능**
- 드래그 앤 드롭 평면도 편집
- 좌석·테이블·기물 배치
- PDF 내보내기

### 5. sunbi-store-abb (매장정보)

가맹점 정보 및 약어 관리

| 항목 | 내용 |
|------|------|
| 스택 | React + Vite + Express API |
| 배포 | Vercel |
| 리포 | [peterkyum/sunbi-store-abb](https://github.com/peterkyum/sunbi-store-abb) |

**주요 기능**
- 가맹점 기본 정보 관리
- 매장 약어 코드 체계

## 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Vite 6, Tailwind CSS 4, Flutter Web |
| 상태관리 | Zustand, React Context |
| Canvas | Konva + react-konva |
| 인증/DB | Supabase (PostgreSQL, Auth, RLS) |
| 배포 | Vercel (rewrite 기반 iframe 프록시) |
| 외부 연동 | Google Apps Script, Telegram Bot API |
| AI 에이전트 | Ollama (로컬 LLM) — 자비스(JARVIS) |

## 데이터베이스 (Supabase)

핵심 테이블: `user_roles`

```sql
CREATE TABLE user_roles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id),
  role          TEXT NOT NULL DEFAULT 'franchise',
  name          TEXT NOT NULL DEFAULT '',
  allowed_apps  TEXT[] NOT NULL DEFAULT '{}',
  active_session_id TEXT,           -- 단일 세션 관리
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

- **RLS 정책**: 본인 프로필 조회 + admin 전체 CRUD
- **`is_admin()` 함수**: `SECURITY DEFINER`로 RLS 재귀 방지
- **트리거**: `updated_at` 자동 갱신

## 시작하기

### 사전 요구사항

- Node.js 18+
- Supabase 프로젝트 (Auth + Database)
- Vercel 계정 (배포용)

### 로컬 개발

```bash
# 1. 리포 클론
git clone https://github.com/peterkyum/sunbi-hub.git
cd sunbi-hub

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일에 Supabase URL과 Anon Key 입력

# 4. Supabase 스키마 적용
# supabase-setup.sql을 Supabase SQL Editor에서 실행

# 5. 개발 서버 시작
npm run dev
# → http://localhost:5173
```

### 환경변수

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 빌드 & 배포

```bash
npm run build    # tsc -b && vite build → dist/
npm run preview  # 빌드 결과 로컬 프리뷰
```

Vercel에 연결하면 `main` 브랜치 푸시 시 자동 배포됩니다.

## 프로젝트 구조

```
sunbi-hub/
├── src/
│   ├── App.tsx              # 루트 컴포넌트 (Auth 분기)
│   ├── main.tsx             # 엔트리포인트
│   ├── components/
│   │   └── Toast.tsx        # 토스트 알림
│   ├── context/
│   │   ├── AuthContext.tsx   # 인증·세션·프로필 관리
│   │   └── ThemeContext.tsx  # 다크모드 테마
│   ├── lib/
│   │   └── supabase.ts      # Supabase 클라이언트
│   ├── pages/
│   │   ├── LoginPage.tsx     # 로그인 화면
│   │   ├── HubPage.tsx       # 메인 허브 (탭 + iframe)
│   │   ├── AdminPage.tsx     # 관리자 전용 (사용자·권한 관리)
│   │   └── SettingsPage.tsx  # 설정 (다크모드 등)
│   └── types/
│       └── index.ts          # 앱·역할·프로필 타입 정의
├── api/                      # Vercel Serverless Functions
├── supabase-setup.sql        # DB 스키마 (user_roles + RLS)
├── vercel.json               # Vercel rewrite 규칙 (iframe 프록시)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 인증 흐름

```
1. 사용자가 이메일/비밀번호로 로그인
2. Supabase Auth 세션 발급
3. user_roles에서 역할·허용앱 조회
4. active_session_id에 브라우저 인스턴스 ID 저장
5. 15초 간격으로 세션 유효성 검증
6. 다른 기기에서 로그인 시 → 기존 세션 자동 로그아웃 (kickedOut)
7. localStorage에 토큰 저장 → iframe 앱들과 SSO 공유
```

## 운영 도구

### 자비스 (JARVIS) — 로컬 AI 에이전트

100% 로컬 실행되는 AI 비서. 데이터 외부 유출 없음.

```bash
# Ollama 서버 실행 필요
ollama serve

# 대화 모드
python3 자비스.py

# 단발 질문
python3 자비스.py "이번 달 발주 현황 정리해줘"
```

## 라이선스

Private — ConnectAI (커넥트AI)
