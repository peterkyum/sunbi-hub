import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_APPS, AppId, DEFAULT_ALLOWED_APPS, UserRole } from '../types'
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

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_roles').select('*')
    if (data) setUsers(data as UserRow[])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const updateRole = async (userId: string, role: UserRole) => {
    const defaultApps = DEFAULT_ALLOWED_APPS[role]
    setSaving(userId)
    await supabase.from('user_roles').upsert({
      user_id: userId,
      role,
      allowed_apps: defaultApps,
    })
    setUsers(prev => prev.map(u =>
      u.user_id === userId ? { ...u, role, allowed_apps: defaultApps } : u
    ))
    setSaving(null)
  }

  const toggleApp = async (userId: string, appId: AppId, allowed: boolean) => {
    const user = users.find(u => u.user_id === userId)
    if (!user) return
    const newApps = allowed
      ? [...user.allowed_apps, appId]
      : user.allowed_apps.filter(a => a !== appId)

    setSaving(userId)
    await supabase.from('user_roles').upsert({
      user_id: userId,
      allowed_apps: newApps,
    })
    setUsers(prev => prev.map(u =>
      u.user_id === userId ? { ...u, allowed_apps: newApps } : u
    ))
    setSaving(null)
  }

  return (
    <div className="admin-bg">
      <div className="admin-header">
        <button className="admin-back-btn" onClick={onBack}>← 허브로 돌아가기</button>
        <h1 className="admin-title">⚙️ 사용자 권한 관리</h1>
      </div>

      <div className="admin-main">
        {loading ? (
          <div className="admin-loading">사용자 목록 불러오는 중...</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">등록된 사용자가 없습니다.</div>
        ) : (
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
                {users.map(user => (
                  <tr key={user.user_id}>
                    <td className="admin-user-cell">
                      <span className="admin-user-name">{user.name || '이름 없음'}</span>
                      <span className="admin-user-id">{user.user_id.slice(0, 8)}...</span>
                    </td>
                    <td>
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
                    </td>
                    {ALL_APPS.map(app => (
                      <td key={app.id} className="admin-toggle-cell">
                        <input
                          type="checkbox"
                          className="admin-checkbox"
                          checked={user.allowed_apps.includes(app.id)}
                          onChange={e => toggleApp(user.user_id, app.id, e.target.checked)}
                          disabled={saving === user.user_id}
                        />
                      </td>
                    ))}
                    <td className="admin-status-cell">
                      {saving === user.user_id ? '저장 중...' : '✓'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
