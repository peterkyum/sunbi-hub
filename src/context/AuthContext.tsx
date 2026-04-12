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

const SESSION_CHECK_INTERVAL = 10_000 // 10초마다 DB 세션 검증

const generateSessionId = (userId: string): string => {
  return `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [kickedOut, setKickedOut] = useState(false)
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // DB에 세션 ID 저장
  const saveSessionToDb = useCallback(async (userId: string, newSessionId: string) => {
    await supabase
      .from('user_roles')
      .update({ active_session_id: newSessionId })
      .eq('user_id', userId)
  }, [])

  // DB에서 세션 ID 검증 (다른 기기/브라우저 중복 로그인 감지)
  const verifySession = useCallback(async (userId: string, localSessionId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('active_session_id')
      .eq('user_id', userId)
      .single()

    if (data && data.active_session_id && data.active_session_id !== localSessionId) {
      // 다른 곳에서 로그인됨 → 강제 로그아웃
      setKickedOut(true)
      await supabase.auth.signOut()
      setProfile(null)
      setSessionId(null)
      return false
    }
    return true
  }, [])

  // 주기적 세션 검증 시작/중지
  const startSessionCheck = useCallback((userId: string, localSessionId: string) => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current)
    }
    sessionCheckRef.current = setInterval(() => {
      verifySession(userId, localSessionId)
    }, SESSION_CHECK_INTERVAL)
  }, [verifySession])

  const stopSessionCheck = useCallback(() => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current)
      sessionCheckRef.current = null
    }
  }, [])

  // 초기 세션 복원
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const storedSessionId = localStorage.getItem(`session-${session.user.id}`)

        if (storedSessionId) {
          // DB에서 세션 유효성 확인
          const valid = await verifySession(session.user.id, storedSessionId)
          if (valid) {
            setSessionId(storedSessionId)
            startSessionCheck(session.user.id, storedSessionId)
            await fetchProfile(session.user.id)
          }
        } else {
          // 로컬 세션 ID 없음 → 로그아웃
          await supabase.auth.signOut()
        }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setSessionId(null)
        stopSessionCheck()
      }
    })

    return () => {
      listener.subscription.unsubscribe()
      stopSessionCheck()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 같은 브라우저 다른 탭 감지 (localStorage 이벤트)
  useEffect(() => {
    if (!user?.id || !sessionId) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `session-${user.id}` && e.newValue && e.newValue !== sessionId) {
        setKickedOut(true)
        supabase.auth.signOut().then(() => {
          setProfile(null)
          setSessionId(null)
          stopSessionCheck()
        })
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user?.id, sessionId, stopSessionCheck])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const newSessionId = generateSessionId(data.user.id)
      setSessionId(newSessionId)
      localStorage.setItem(`session-${data.user.id}`, newSessionId)

      // DB에 세션 저장 → 다른 기기의 기존 세션 무효화
      await saveSessionToDb(data.user.id, newSessionId)

      // 주기적 세션 검증 시작
      startSessionCheck(data.user.id, newSessionId)

      await fetchProfile(data.user.id)
    }

    return { error: null }
  }

  const signOut = async () => {
    stopSessionCheck()
    if (user) {
      localStorage.removeItem(`session-${user.id}`)
      // DB 세션도 제거
      await supabase
        .from('user_roles')
        .update({ active_session_id: null })
        .eq('user_id', user.id)
    }
    await supabase.auth.signOut()
    setProfile(null)
    setSessionId(null)
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
