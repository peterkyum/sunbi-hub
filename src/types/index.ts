// 앱 정의 타입
export type AppId = 'sunbi-base' | 'sunbi-crew-order' | 'sunbi-floor-plan' | 'sunbi-store-abb'

export interface HubApp {
  id: AppId
  name: string
  description: string
  icon: string
  url: string
  color: string
  openInNewTab: boolean
}

// 역할 타입
export type UserRole = 'admin' | 'staff' | 'distributor' | 'franchise'

export interface UserProfile {
  user_id: string
  role: UserRole
  name: string
  allowed_apps: AppId[]
}

// 앱 목록 (본사가 관리)
export const ALL_APPS: HubApp[] = [
  {
    id: 'sunbi-base',
    name: '재고관리',
    description: '매장 재고 입출고 및 현황 관리',
    icon: '📦',
    url: 'https://sunbi-base.vercel.app',
    color: '#7B4A1E',
    openInNewTab: true,
  },
  {
    id: 'sunbi-crew-order',
    name: '발주관리',
    description: '가맹점 발주 및 주문 현황',
    icon: '🛒',
    url: 'https://sunbi-crew-order.vercel.app',
    color: '#E8A020',
    openInNewTab: true,
  },
  {
    id: 'sunbi-floor-plan',
    name: '매장 평면도',
    description: '매장 레이아웃 및 좌석 배치 관리',
    icon: '🗺️',
    url: 'https://sunbi-floor-plan.vercel.app',
    color: '#2D7DD2',
    openInNewTab: true,
  },
  {
    id: 'sunbi-store-abb',
    name: '점주 전용',
    description: '가맹점 정보 및 약어 관리',
    icon: '🏪',
    url: 'https://sunbi-store-abb.vercel.app',
    color: '#3BB273',
    openInNewTab: true,
  },
]

// 역할별 기본 허용 앱 (관리자가 개별 조정 가능)
export const DEFAULT_ALLOWED_APPS: Record<UserRole, AppId[]> = {
  admin: ['sunbi-base', 'sunbi-crew-order', 'sunbi-floor-plan', 'sunbi-store-abb'],
  staff: ['sunbi-base', 'sunbi-crew-order', 'sunbi-floor-plan', 'sunbi-store-abb'],
  distributor: ['sunbi-crew-order'],
  franchise: ['sunbi-base', 'sunbi-crew-order'],
}
