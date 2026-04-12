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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [kickedOut, setKickedOut] = useState(false)
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 현재 브라우저 인스턴스 ID (같은 브라우저 내 탭들은 동일)
  const browserInstanceId = useRef(getBrowserInstanceId())

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

    const fetched: UserProfile = {
      user_id: data.user_id,
      role: data.role,
      name: data.name || '',
      allowed_apps: ((data.allowed_apps as string[]) || DEFAULT_ALLOWED_APPS[(data.role as UserRole)]) as AppId[],
    }
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

        // Supabase 세션이 유효하면 → 바로 프로필 로드 (탭 간 공유 가능)
        // DB에서 세션 검증 (다른 기기 중복 로그인 여부만 확인)
        const valid = await verifySession(session.user.id)
        if (valid) {
          // 현재 브라우저 인스턴스를 DB에 등록 (아직 없는 경우 덮어씀)
          await saveSessionToDb(session.user.id, browserInstanceId.current)
          startSessionCheck(session.user.id)
          await fetchProfile(session.user.id)
        }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        stopSessionCheck()
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
      // 현재 브라우저 인스턴스 ID를 DB에 저장 → 다른 기기/브라우저의 기존 세션 무효화
      await saveSessionToDb(data.user.id, browserInstanceId.current)
      startSessionCheck(data.user.id)
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
    setProfile(null)
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
