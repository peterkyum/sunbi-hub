import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserProfile, UserRole, DEFAULT_ALLOWED_APPS, AppId } from '../types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  kickedOut: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  clearKickedOut: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// ──────────────────────────────────────────────────────────────
// 같은 브라우저 내 모든 탭이 공유하는 "탭 그룹 ID"
// 탭 > sessionStorage(탭마다 고유) vs localStorage(탭 간 공유)
// 브라우저 인스턴스 단위 식별: localStorage의 browser-instance-id 사용
// ──────────────────────────────────────────────────────────────
const getBrowserInstanceId = (): string => {
  let id = localStorage.getItem('sunbi-browser-instance')
  if (!id) {
    id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('sunbi-browser-instance', id)
  }
  return id
}

const SESSION_CHECK_INTERVAL = 15_000 // 15초마다 DB 세션 검증

// 공유 계정 — 중복 로그인 허용 (세션 검증 건너뜀)
const SHARED_ACCOUNT_EMAILS = ['hq@sunbi.com']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [kickedOut, setKickedOut] = useState(false)
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 현재 브라우저 인스턴스 ID (같은 브라우저 내 탭들은 동일)
  const browserInstanceId = useRef(getBrowserInstanceId())
  // 프로필 최신값을 콜백에서 참조하기 위한 ref
  const profileRef = useRef<UserProfile | null>(null)

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      const fallback: UserProfile = {
        user_id: userId,
        role: 'franchise',
        name: '',
        allowed_apps: DEFAULT_ALLOWED_APPS['franchise'],
      }
      setProfile(fallback)
      return fallback
    }

    const role = data.role as UserRole
    const roleMaxApps = DEFAULT_ALLOWED_APPS[role]
    const rawApps = ((data.allowed_apps as string[]) || roleMaxApps) as AppId[]
    // 역할별 최대 허용 범위를 초과하는 앱 제거 (안전장치)
    const safeApps = rawApps.filter(app => roleMaxApps.includes(app))

    const fetched: UserProfile = {
      user_id: data.user_id,
      role,
      name: data.name || '',
      allowed_apps: safeApps,
    }
    profileRef.current = fetched
    setProfile(fetched)
    return fetched
  }, [])

  // DB에 브라우저 인스턴스 ID 저장 (기기 단위 중복 로그인 방지)
  const saveSessionToDb = useCallback(async (userId: string, instanceId: string) => {
    await supabase
      .from('user_roles')
      .update({ active_session_id: instanceId })
      .eq('user_id', userId)
  }, [])

  // DB에서 세션 검증 — 같은 브라우저 인스턴스면 OK, 다른 브라우저/기기면 강제 로그아웃
  const verifySession = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('active_session_id')
      .eq('user_id', userId)
      .single()

    const myInstanceId = browserInstanceId.current
    if (data && data.active_session_id && data.active_session_id !== myInstanceId) {
      // 다른 브라우저/기기에서 로그인됨 → 강제 로그아웃
      setKickedOut(true)
      await supabase.auth.signOut()
      setProfile(null)
      return false
    }
    return true
  }, [])

  const stopSessionCheck = useCallback(() => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current)
      sessionCheckRef.current = null
    }
  }, [])

  const startSessionCheck = useCallback((userId: string) => {
    stopSessionCheck()
    sessionCheckRef.current = setInterval(() => {
      verifySession(userId)
    }, SESSION_CHECK_INTERVAL)
  }, [verifySession, stopSessionCheck])

  // 초기 세션 복원
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)

        const isShared = SHARED_ACCOUNT_EMAILS.includes(
          (session.user.email || '').toLowerCase()
        )

        if (isShared) {
          // 공유 계정: 세션 검증 건너뜀 → 중복 로그인 허용
          const userProfile = await fetchProfile(session.user.id)
          try {
            localStorage.setItem('sunbi_hub_token', JSON.stringify({
              access_token: session.access_token,
              email: session.user.email,
              role: userProfile.role,
            }))
          } catch (_) { /* ignore */ }
        } else {
          // 일반 계정: 기존 단일 세션 정책 유지
          const valid = await verifySession(session.user.id)
          if (valid) {
            await saveSessionToDb(session.user.id, browserInstanceId.current)
            startSessionCheck(session.user.id)
            const userProfile = await fetchProfile(session.user.id)
            try {
              localStorage.setItem('sunbi_hub_token', JSON.stringify({
                access_token: session.access_token,
                email: session.user.email,
                role: userProfile.role,
              }))
            } catch (_) { /* ignore */ }
          }
        }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // profileRef로 최신 프로필 참조 (state closure는 stale할 수 있음)
        const currentProfile = profileRef.current
        // 프로필이 아직 로드되지 않았으면 토큰 갱신하지 않음 (초기 로드 시 위에서 별도 처리)
        if (currentProfile) {
          try {
            localStorage.setItem('sunbi_hub_token', JSON.stringify({
              access_token: session.access_token,
              email: session.user.email,
              role: currentProfile.role,
            }))
          } catch (_) { /* ignore */ }
        }
      } else {
        setProfile(null)
        stopSessionCheck()
        try { localStorage.removeItem('sunbi_hub_token') } catch (_) { /* ignore */ }
        try { localStorage.removeItem('sunbi_sso_init') } catch (_) { /* ignore */ }
      }
    })

    return () => {
      listener.subscription.unsubscribe()
      stopSessionCheck()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const isShared = SHARED_ACCOUNT_EMAILS.includes(
        (email || '').toLowerCase()
      )
      if (!isShared) {
        // 일반 계정만 세션 관리 (공유 계정은 중복 로그인 허용)
        await saveSessionToDb(data.user.id, browserInstanceId.current)
        startSessionCheck(data.user.id)
      }
      await fetchProfile(data.user.id)
    }

    return { error: null }
  }

  const signOut = async () => {
    stopSessionCheck()
    if (user) {
      await supabase
        .from('user_roles')
        .update({ active_session_id: null })
        .eq('user_id', user.id)
    }
    await supabase.auth.signOut()
    profileRef.current = null
    setProfile(null)
    // iframe SSO 초기화 플래그 리셋 (다음 로그인 시 토큰 재전달)
    try { localStorage.removeItem('sunbi_sso_init') } catch (_) { /* ignore */ }
  }

  const clearKickedOut = () => setKickedOut(false)

  return (
    <AuthContext.Provider value={{ user, profile, loading, kickedOut, signIn, signOut, clearKickedOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
