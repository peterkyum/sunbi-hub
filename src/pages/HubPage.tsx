import { useAuth } from '../context/AuthContext'
import { ALL_APPS, HubApp, AppId } from '../types'
import { AdminPage } from './AdminPage'
import { useState, useRef, useEffect } from 'react'
import './HubPage.css'

const ROLE_LABEL: Record<string, string> = {
  admin: '🏢 본사 관리자',
  staff: '👥 본사 팀원',
  distributor: '🚚 유통사',
  franchise: '🏪 가맹점',
}

export function HubPage() {
  const { profile, signOut } = useAuth()
  const [showAdmin, setShowAdmin] = useState(false)
  const [activeApp, setActiveApp] = useState<AppId | null>(null)
  const [loadedApps, setLoadedApps] = useState<Set<AppId>>(new Set())
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  const allowedApps = ALL_APPS.filter(app =>
    profile?.allowed_apps.includes(app.id)
  )

  // 첫 번째 허용된 앱을 기본으로 선택
  useEffect(() => {
    if (!activeApp && allowedApps.length > 0) {
      setActiveApp(allowedApps[0].id)
      setLoadedApps(new Set([allowedApps[0].id]))
    }
  }, [allowedApps, activeApp])

  const handleTabClick = (app: HubApp) => {
    setActiveApp(app.id)
    setShowAdmin(false)
    // 한번 로드한 앱은 유지 (빠른 탭 전환)
    setLoadedApps(prev => new Set([...prev, app.id]))
  }

  const handleAdminClick = () => {
    setActiveApp(null)
    setShowAdmin(true)
  }

  const handleRefresh = () => {
    if (activeApp && iframeRefs.current[activeApp]) {
      iframeRefs.current[activeApp]!.src = iframeRefs.current[activeApp]!.src
    }
  }

  const handleOpenExternal = () => {
    if (activeApp) {
      const app = ALL_APPS.find(a => a.id === activeApp)
      if (app) window.open(app.url, '_blank', 'noopener')
    }
  }

  if (showAdmin && profile?.role === 'admin') {
    return (
      <div className="hub-bg">
        <Nav
          allowedApps={allowedApps}
          activeApp={null}
          showAdmin={true}
          isAdmin={profile.role === 'admin'}
          roleLabel={ROLE_LABEL[profile.role]}
          onTabClick={handleTabClick}
          onAdminClick={handleAdminClick}
          onSignOut={signOut}
        />
        <div className="hub-content">
          <AdminPage onBack={() => {
            setShowAdmin(false)
            if (allowedApps.length > 0) setActiveApp(allowedApps[0].id)
          }} />
        </div>
      </div>
    )
  }

  return (
    <div className="hub-bg">
      <Nav
        allowedApps={allowedApps}
        activeApp={activeApp}
        showAdmin={false}
        isAdmin={profile?.role === 'admin'}
        roleLabel={ROLE_LABEL[profile?.role || 'franchise']}
        onTabClick={handleTabClick}
        onAdminClick={handleAdminClick}
        onSignOut={signOut}
      />

      {/* 도구 바 */}
      {activeApp && (
        <div className="hub-toolbar">
          <span className="hub-toolbar-label">
            {ALL_APPS.find(a => a.id === activeApp)?.icon}{' '}
            {ALL_APPS.find(a => a.id === activeApp)?.name}
          </span>
          <div className="hub-toolbar-actions">
            <button className="hub-tool-btn" onClick={handleRefresh} title="새로고침">🔄</button>
            <button className="hub-tool-btn" onClick={handleOpenExternal} title="새 창에서 열기">↗️</button>
          </div>
        </div>
      )}

      {/* iframe 컨테이너 — 로드된 앱은 display로 전환하여 상태 유지 */}
      <div className="hub-iframe-wrap">
        {allowedApps.length === 0 && (
          <div className="hub-empty-state">
            <div className="hub-empty-icon">🍜</div>
            <h2>접근 가능한 앱이 없습니다</h2>
            <p>본사에 문의하여 앱 접근 권한을 요청하세요.</p>
          </div>
        )}

        {allowedApps.map(app => (
          loadedApps.has(app.id) && (
            <iframe
              key={app.id}
              ref={el => { iframeRefs.current[app.id] = el }}
              className="hub-iframe"
              src={app.url}
              title={app.name}
              style={{ display: activeApp === app.id ? 'block' : 'none' }}
              allow="clipboard-write; clipboard-read"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
          )
        ))}
      </div>
    </div>
  )
}

/* --- 네비게이션 컴포넌트 --- */
function Nav({
  allowedApps,
  activeApp,
  showAdmin,
  isAdmin,
  roleLabel,
  onTabClick,
  onAdminClick,
  onSignOut,
}: {
  allowedApps: HubApp[]
  activeApp: AppId | null
  showAdmin: boolean
  isAdmin: boolean | undefined
  roleLabel: string
  onTabClick: (app: HubApp) => void
  onAdminClick: () => void
  onSignOut: () => void
}) {
  return (
    <nav className="hub-nav">
      <div className="hub-nav-left">
        <div className="hub-brand">
          <span className="hub-brand-icon">🍜</span>
          <span className="hub-brand-name">선비칼국수</span>
          <span className="hub-brand-role">{roleLabel}</span>
        </div>
        <div className="hub-tabs">
          {allowedApps.map(app => (
            <button
              key={app.id}
              className={`hub-tab ${activeApp === app.id ? 'active' : ''}`}
              onClick={() => onTabClick(app)}
              style={{ '--tab-color': app.color } as React.CSSProperties}
            >
              <span className="hub-tab-icon">{app.icon}</span>
              <span className="hub-tab-label">{app.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="hub-nav-right">
        {isAdmin && (
          <button
            className={`hub-nav-btn admin-btn ${showAdmin ? 'active' : ''}`}
            onClick={onAdminClick}
          >
            ⚙️ 관리자
          </button>
        )}
        <button className="hub-nav-btn signout-btn" onClick={onSignOut}>
          로그아웃
        </button>
      </div>
    </nav>
  )
}
