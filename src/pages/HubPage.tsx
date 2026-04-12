import { useAuth } from '../context/AuthContext'
import { ALL_APPS, HubApp, AppId } from '../types'
import { lazy, Suspense, useState, useRef, useEffect, useMemo, useCallback } from 'react'

const AdminPage = lazy(() => import('./AdminPage').then(m => ({ default: m.AdminPage })))
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.SettingsPage })))
import './HubPage.css'

const ROLE_LABEL: Record<string, string> = {
  admin: '🏢 본사 관리자',
  staff: '👥 본사 팀원',
  distributor: '🚚 유통사',
  franchise: '🏪 가맹점',
}

const IFRAME_LOAD_TIMEOUT_MS = 15_000

export function HubPage() {
  const { profile } = useAuth()
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeApp, setActiveApp] = useState<AppId | null>(null)
  const [loadedApps, setLoadedApps] = useState<Set<AppId>>(new Set())
  const [iframeStatus, setIframeStatus] = useState<Record<string, 'loading' | 'ready' | 'error'>>({})
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const allowedApps = useMemo(
    () => ALL_APPS.filter(app => profile?.allowed_apps.includes(app.id)),
    [profile?.allowed_apps]
  )

  // 첫 앱 자동 선택
  useEffect(() => {
    if (!activeApp && allowedApps.length > 0) {
      const firstApp = allowedApps[0].id
      setActiveApp(firstApp)
      setLoadedApps(new Set([firstApp]))
      setIframeStatus(prev => ({ ...prev, [firstApp]: 'loading' }))
    }
  }, [allowedApps, activeApp])

  // 타임아웃 클린업
  useEffect(() => {
    const refs = timeoutRefs.current
    return () => { Object.values(refs).forEach(clearTimeout) }
  }, [])

  const startLoadTimeout = useCallback((appId: string) => {
    if (timeoutRefs.current[appId]) clearTimeout(timeoutRefs.current[appId])
    timeoutRefs.current[appId] = setTimeout(() => {
      setIframeStatus(prev =>
        prev[appId] === 'loading' ? { ...prev, [appId]: 'error' } : prev
      )
    }, IFRAME_LOAD_TIMEOUT_MS)
  }, [])

  const handleIframeLoad = useCallback((appId: string) => {
    if (timeoutRefs.current[appId]) clearTimeout(timeoutRefs.current[appId])
    setIframeStatus(prev => ({ ...prev, [appId]: 'ready' }))
  }, [])

  const handleIframeError = useCallback((appId: string) => {
    if (timeoutRefs.current[appId]) clearTimeout(timeoutRefs.current[appId])
    setIframeStatus(prev => ({ ...prev, [appId]: 'error' }))
  }, [])

  const handleTabClick = (app: HubApp) => {
    setActiveApp(app.id)
    setShowAdmin(false)
    setShowSettings(false)
    if (!loadedApps.has(app.id)) {
      setLoadedApps(prev => new Set([...prev, app.id]))
      setIframeStatus(prev => ({ ...prev, [app.id]: 'loading' }))
      startLoadTimeout(app.id)
    }
  }

  const handleAdminClick = () => {
    setActiveApp(null)
    setShowAdmin(true)
    setShowSettings(false)
  }

  const handleSettingsClick = () => {
    setActiveApp(null)
    setShowAdmin(false)
    setShowSettings(true)
  }

  const handleRetry = () => {
    if (!activeApp) return
    setIframeStatus(prev => ({ ...prev, [activeApp]: 'loading' }))
    startLoadTimeout(activeApp)
    setLoadedApps(prev => {
      const next = new Set(prev)
      next.delete(activeApp)
      return next
    })
    requestAnimationFrame(() => {
      setLoadedApps(prev => new Set([...prev, activeApp]))
    })
  }

  const currentStatus = activeApp ? (iframeStatus[activeApp] ?? 'loading') : null

  if (showSettings) {
    return (
      <div className="hub-bg">
        <Nav
          allowedApps={allowedApps}
          activeApp={null}
          showAdmin={false}
          showSettings={true}
          isAdmin={profile?.role === 'admin'}
          roleLabel={ROLE_LABEL[profile?.role || 'franchise']}
          onTabClick={handleTabClick}
          onAdminClick={handleAdminClick}
          onSettingsClick={handleSettingsClick}
        />
        <Suspense fallback={null}>
          <SettingsPage onBack={() => {
            setShowSettings(false)
            if (allowedApps.length > 0) setActiveApp(allowedApps[0].id)
          }} />
        </Suspense>
      </div>
    )
  }

  if (showAdmin && profile?.role === 'admin') {
    return (
      <div className="hub-bg">
        <Nav
          allowedApps={allowedApps}
          activeApp={null}
          showAdmin={true}
          showSettings={false}
          isAdmin={profile.role === 'admin'}
          roleLabel={ROLE_LABEL[profile.role]}
          onTabClick={handleTabClick}
          onAdminClick={handleAdminClick}
          onSettingsClick={handleSettingsClick}
        />
        <div className="hub-content">
          <Suspense fallback={null}>
            <AdminPage onBack={() => {
              setShowAdmin(false)
              if (allowedApps.length > 0) setActiveApp(allowedApps[0].id)
            }} />
          </Suspense>
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
        showSettings={false}
        isAdmin={profile?.role === 'admin'}
        roleLabel={ROLE_LABEL[profile?.role || 'franchise']}
        onTabClick={handleTabClick}
        onAdminClick={handleAdminClick}
        onSettingsClick={handleSettingsClick}
      />

      {/* 도구 바 */}
      {activeApp && (
        <div className="hub-toolbar">
          <span className="hub-toolbar-label">
            {ALL_APPS.find(a => a.id === activeApp)?.icon}{' '}
            {ALL_APPS.find(a => a.id === activeApp)?.name}
          </span>
        </div>
      )}

      {/* iframe 영역 */}
      <div className="hub-iframe-wrap">
        {allowedApps.length === 0 && (
          <div className="hub-empty-state">
            <div className="hub-empty-icon">🍜</div>
            <h2>접근 가능한 앱이 없습니다</h2>
            <p>본사에 문의하여 앱 접근 권한을 요청하세요.</p>
          </div>
        )}

        {activeApp && currentStatus === 'loading' && (
          <div className="hub-iframe-overlay" role="status" aria-live="polite">
            <div className="hub-iframe-spinner" />
            <p className="hub-iframe-overlay-text">
              {ALL_APPS.find(a => a.id === activeApp)?.name} 불러오는 중...
            </p>
          </div>
        )}

        {activeApp && currentStatus === 'error' && (
          <div className="hub-iframe-overlay" role="alert">
            <div className="hub-iframe-error-icon">⚠️</div>
            <p className="hub-iframe-overlay-title">앱에 연결할 수 없습니다</p>
            <p className="hub-iframe-overlay-text">
              서버가 응답하지 않거나 네트워크 문제가 있습니다.
            </p>
            <button className="hub-iframe-retry-btn" onClick={handleRetry}>
              다시 시도
            </button>
          </div>
        )}

        {/* 같은 도메인 프록시 경로로 iframe 로드 — localStorage 공유 */}
        {allowedApps.map(app => (
          loadedApps.has(app.id) && (
            <iframe
              key={app.id}
              className="hub-iframe"
              src={app.proxyPath}
              title={app.name}
              style={{
                display: activeApp === app.id ? 'block' : 'none',
                opacity: iframeStatus[app.id] === 'ready' ? 1 : 0,
              }}
              onLoad={() => handleIframeLoad(app.id)}
              onError={() => handleIframeError(app.id)}
              allow="clipboard-write; clipboard-read"
            />
          )
        ))}
      </div>

      {/* 모바일 바텀 내비 */}
      <nav className="hub-bottom-nav" aria-label="앱 탐색">
        {allowedApps.map(app => (
          <button
            key={app.id}
            className={`hub-bottom-tab ${activeApp === app.id ? 'active' : ''}`}
            onClick={() => handleTabClick(app)}
            aria-label={app.name}
            aria-current={activeApp === app.id ? 'page' : undefined}
          >
            <span className="hub-bottom-tab-icon">{app.icon}</span>
            <span className="hub-bottom-tab-label">{app.name}</span>
          </button>
        ))}
        {profile?.role === 'admin' && (
          <button
            className={`hub-bottom-tab ${showAdmin ? 'active' : ''}`}
            onClick={handleAdminClick}
            aria-label="관리자"
          >
            <span className="hub-bottom-tab-icon">⚙️</span>
            <span className="hub-bottom-tab-label">관리</span>
          </button>
        )}
        <button
          className={`hub-bottom-tab ${showSettings ? 'active' : ''}`}
          onClick={handleSettingsClick}
          aria-label="설정"
        >
          <span className="hub-bottom-tab-icon">⚙</span>
          <span className="hub-bottom-tab-label">설정</span>
        </button>
      </nav>
    </div>
  )
}

/* --- 네비게이션 컴포넌트 (데스크탑) --- */
function Nav({
  allowedApps,
  activeApp,
  showAdmin,
  showSettings,
  isAdmin,
  roleLabel,
  onTabClick,
  onAdminClick,
  onSettingsClick,
}: {
  allowedApps: HubApp[]
  activeApp: AppId | null
  showAdmin: boolean
  showSettings: boolean
  isAdmin: boolean | undefined
  roleLabel: string
  onTabClick: (app: HubApp) => void
  onAdminClick: () => void
  onSettingsClick: () => void
}) {
  return (
    <nav className="hub-nav" aria-label="메인 네비게이션">
      <div className="hub-nav-left">
        <div className="hub-brand">
          <span className="hub-brand-icon" aria-hidden="true">🍜</span>
          <span className="hub-brand-name">선비칼국수</span>
          <span className="hub-brand-role">{roleLabel}</span>
        </div>
        <div className="hub-tabs" role="tablist">
          {allowedApps.map(app => (
            <button
              key={app.id}
              className={`hub-tab ${activeApp === app.id ? 'active' : ''}`}
              onClick={() => onTabClick(app)}
              role="tab"
              aria-selected={activeApp === app.id}
              aria-label={app.name}
              style={{ '--tab-color': app.color } as React.CSSProperties}
            >
              <span className="hub-tab-icon" aria-hidden="true">{app.icon}</span>
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
            aria-label="관리자 페이지"
          >
            ⚙️ 관리자
          </button>
        )}
        <button
          className={`hub-nav-btn settings-btn ${showSettings ? 'active' : ''}`}
          onClick={onSettingsClick}
          aria-label="설정"
        >
          ⚙ 설정
        </button>
      </div>
    </nav>
  )
}
