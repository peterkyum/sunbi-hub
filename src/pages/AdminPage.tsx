import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_APPS, AppId, DEFAULT_ALLOWED_APPS, UserRole } from '../types'
import { useToast, ToastContainer } from '../components/Toast'
import './AdminPage.css'

interface UserRow {
  user_id: string
  role: UserRole
  name: string
  email?: string
  allowed_apps: AppId[]
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: '🏢 본사 관리자' },
  { value: 'staff', label: '👥 본사 팀원' },
  { value: 'distributor', label: '🚚 유통사' },
  { value: 'franchise', label: '🏪 가맹점' },
]

export function AdminPage({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const { toasts, show: showToast } = useToast()

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      ROLE_OPTIONS.find(r => r.value === u.role)?.label.toLowerCase().includes(q)
    )
  }, [users, search])

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('user_roles').select('*')
    if (error) {
      setFetchError(`사용자 목록 불러오기 실패: ${error.message}`)
      setLoading(false)
      return
    }
    // DB의 'hq' role → hub의 'admin'으로 매핑
    const mapped = (data as UserRow[]).map(u => ({
      ...u,
      role: (u.role === 'hq' as unknown ? 'admin' : u.role) as UserRole,
    }))
    setUsers(mapped)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const updateRole = async (userId: string, role: UserRole) => {
    const user = users.find(u => u.user_id === userId)
    if (!user) return
    const defaultApps = DEFAULT_ALLOWED_APPS[role]
    setSaving(userId)
    const { error } = await supabase.from('user_roles').upsert({
      user_id: userId,
      role,
      name: user.name,
      allowed_apps: defaultApps,
    })
    if (error) {
      showToast(`역할 변경 실패: ${error.message}`, 'error')
      setSaving(null)
      return
    }
    setUsers(prev => prev.map(u =>
      u.user_id === userId ? { ...u, role, allowed_apps: defaultApps } : u
    ))
    showToast(`${user.name || '사용자'}의 역할이 변경되었습니다.`, 'success')
    setSaving(null)
  }

  const toggleApp = async (userId: string, appId: AppId, allowed: boolean) => {
    const user = users.find(u => u.user_id === userId)
    if (!user) return
    const newApps = allowed
      ? [...user.allowed_apps, appId]
      : user.allowed_apps.filter(a => a !== appId)

    setSaving(userId)
    const { error } = await supabase.from('user_roles').upsert({
      user_id: userId,
      role: user.role,
      name: user.name,
      allowed_apps: newApps,
    })
    if (error) {
      showToast(`앱 권한 변경 실패: ${error.message}`, 'error')
      setSaving(null)
      return
    }
    setUsers(prev => prev.map(u =>
      u.user_id === userId ? { ...u, allowed_apps: newApps } : u
    ))
    const appName = ALL_APPS.find(a => a.id === appId)?.name ?? appId
    showToast(`${user.name || '사용자'} — ${appName} ${allowed ? '허용' : '해제'}`, 'success')
    setSaving(null)
  }

  return (
    <div className="admin-bg">
      <ToastContainer toasts={toasts} />

      <div className="admin-header">
        <button className="admin-back-btn" onClick={onBack} aria-label="허브로 돌아가기">
          ← 허브로 돌아가기
        </button>
        <h1 className="admin-title">⚙️ 사용자 권한 관리</h1>
      </div>

      <div className="admin-main">
        {/* 검색 바 */}
        {!loading && !fetchError && users.length > 0 && (
          <div className="admin-search-bar">
            <input
              type="text"
              className="admin-search-input"
              placeholder="이름, 이메일, 역할로 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="사용자 검색"
            />
            {search && (
              <span className="admin-search-count">
                {filteredUsers.length}명
              </span>
            )}
          </div>
        )}

        {fetchError ? (
          <div className="admin-loading" style={{ color: '#ff6b6b' }} role="alert">{fetchError}</div>
        ) : loading ? (
          <div className="admin-loading">
            <div className="admin-spinner" />
            사용자 목록 불러오는 중...
          </div>
        ) : users.length === 0 ? (
          <div className="admin-empty">등록된 사용자가 없습니다.</div>
        ) : (
          <>
            {/* 데스크탑: 테이블 */}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>사용자</th>
                    <th>역할</th>
                    {ALL_APPS.map(app => (
                      <th key={app.id}>{app.icon} {app.name}</th>
                    ))}
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.user_id}>
                      <td className="admin-user-cell">
                        <span className="admin-user-name">{user.name || '이름 없음'}</span>
                        <span className="admin-user-id">{user.email || user.user_id.slice(0, 8) + '...'}</span>
                      </td>
                      <td>
                        <select
                          className="admin-role-select"
                          value={user.role}
                          onChange={e => updateRole(user.user_id, e.target.value as UserRole)}
                          disabled={saving === user.user_id}
                          aria-label={`${user.name || '사용자'} 역할 변경`}
                        >
                          {ROLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      {ALL_APPS.map(app => {
                        const roleAllowed = DEFAULT_ALLOWED_APPS[user.role].includes(app.id)
                        return (
                          <td key={app.id} className="admin-toggle-cell">
                            <label className="admin-toggle" title={roleAllowed ? undefined : `${ROLE_OPTIONS.find(r => r.value === user.role)?.label} 역할에서 사용 불가`}>
                              <input
                                type="checkbox"
                                checked={roleAllowed && user.allowed_apps.includes(app.id)}
                                onChange={e => toggleApp(user.user_id, app.id, e.target.checked)}
                                disabled={saving === user.user_id || !roleAllowed}
                                aria-label={`${user.name || '사용자'} ${app.name} 접근 권한`}
                              />
                              <span className={`admin-toggle-track ${!roleAllowed ? 'disabled-role' : ''}`} />
                            </label>
                          </td>
                        )
                      })}
                      <td className="admin-status-cell">
                        {saving === user.user_id ? (
                          <span className="admin-saving">저장 중...</span>
                        ) : (
                          <span className="admin-saved">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일: 카드 리스트 */}
            <div className="admin-card-list">
              {filteredUsers.map(user => (
                <div key={user.user_id} className="admin-card">
                  <div className="admin-card-header">
                    <div className="admin-card-user">
                      <span className="admin-card-name">{user.name || '이름 없음'}</span>
                      <span className="admin-card-email">{user.email || user.user_id.slice(0, 8) + '...'}</span>
                    </div>
                    {saving === user.user_id && (
                      <span className="admin-saving">저장 중...</span>
                    )}
                  </div>
                  <div className="admin-card-role">
                    <label className="admin-card-label">역할</label>
                    <select
                      className="admin-role-select"
                      value={user.role}
                      onChange={e => updateRole(user.user_id, e.target.value as UserRole)}
                      disabled={saving === user.user_id}
                    >
                      {ROLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-card-apps">
                    <label className="admin-card-label">앱 권한</label>
                    <div className="admin-card-app-grid">
                      {ALL_APPS.map(app => {
                        const roleAllowed = DEFAULT_ALLOWED_APPS[user.role].includes(app.id)
                        return (
                          <label key={app.id} className={`admin-card-app-item ${!roleAllowed ? 'disabled-role' : ''}`}>
                            <input
                              type="checkbox"
                              checked={roleAllowed && user.allowed_apps.includes(app.id)}
                              onChange={e => toggleApp(user.user_id, app.id, e.target.checked)}
                              disabled={saving === user.user_id || !roleAllowed}
                            />
                            <span className="admin-card-app-name">{app.icon} {app.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && search && (
              <div className="admin-empty">'{search}' 검색 결과가 없습니다.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
