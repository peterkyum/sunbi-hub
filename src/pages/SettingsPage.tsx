import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import './SettingsPage.css'

const ROLE_LABEL: Record<string, string> = {
  admin: '본사 관리자',
  staff: '본사 팀원',
  distributor: '유통사',
  franchise: '가맹점',
}

interface SettingsPageProps {
  onBack: () => void
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleSignOut = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      await signOut()
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack}>
          ← 돌아가기
        </button>
        <h1 className="settings-title">설정</h1>
      </div>

      <div className="settings-content">
        {/* 프로필 섹션 */}
        <section className="settings-section">
          <h2 className="settings-section-title">프로필</h2>
          <div className="settings-card">
            <div className="settings-profile">
              <div className="settings-profile-avatar">
                {profile?.name?.charAt(0) || '?'}
              </div>
              <div className="settings-profile-info">
                <span className="settings-profile-name">
                  {profile?.name || '이름 없음'}
                </span>
                <span className="settings-profile-email">
                  {user?.email || ''}
                </span>
                <span className="settings-profile-role">
                  {ROLE_LABEL[profile?.role || 'franchise']}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 테마 섹션 */}
        <section className="settings-section">
          <h2 className="settings-section-title">화면</h2>
          <div className="settings-card">
            <div className="settings-row" onClick={toggleTheme}>
              <div className="settings-row-left">
                <span className="settings-row-icon">
                  {theme === 'dark' ? '🌙' : '☀️'}
                </span>
                <div className="settings-row-text">
                  <span className="settings-row-label">다크 모드</span>
                  <span className="settings-row-desc">
                    {theme === 'dark' ? '어두운 화면' : '밝은 화면'}
                  </span>
                </div>
              </div>
              <div className={`settings-toggle ${theme === 'dark' ? 'on' : ''}`}>
                <div className="settings-toggle-thumb" />
              </div>
            </div>
          </div>
        </section>

        {/* 계정 섹션 */}
        <section className="settings-section">
          <h2 className="settings-section-title">계정</h2>
          <div className="settings-card">
            <button className="settings-signout-btn" onClick={handleSignOut}>
              로그아웃
            </button>
          </div>
        </section>

        <p className="settings-version">선비칼국수 허브 v1.0</p>
      </div>
    </div>
  )
}
