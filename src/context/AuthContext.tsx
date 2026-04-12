import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserProfile, UserRole, DEFAULT_ALLOWED_APPS } from '../types'

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

const generateSessionId = (userId: string): string => {
  return `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const getSessionKey = (userId: string): string => `session-${userId}`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [kickedOut, setKickedOut] = useState(false)

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // 프로필 없는 경우 기본값 (franchise)
      setProfile({
        user_id: userId,
        role: 'franchise',
        name: '',
        allowed_apps: DEFAULT_ALLOWED_APPS['franchise'],
      })
      return
    }

    setProfile({
      user_id: data.user_id,
      role: data.role,
      name: data.name || '',
      allowed_apps: ((data.allowed_apps as string[]) || DEFAULT_ALLOWED_APPS[(data.role as UserRole)]) as import('../types').AppId[],
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const storedSessionId = localStorage.getItem(getSessionKey(session.user.id))
        if (storedSessionId) {
          setSessionId(storedSessionId)
        }
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const storedSessionId = localStorage.getItem(getSessionKey(session.user.id))
        setSessionId(storedSessionId)
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setSessionId(null)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // 다른 탭에서 로그인 감지
  useEffect(() => {
    if (!user?.id) return

    const handleStorageChange = (e: StorageEvent) => {
      const sessionKey = getSessionKey(user.id)
      if (e.key === sessionKey && e.newValue && e.newValue !== sessionId) {
        // 다른 탭에서 같은 계정으로 로그인됨
        setKickedOut(true)
        supabase.auth.signOut().then(() => {
          setProfile(null)
          setSessionId(null)
        })
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user?.id, sessionId])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const newSessionId = generateSessionId(data.user.id)
      setSessionId(newSessionId)
      localStorage.setItem(getSessionKey(data.user.id), newSessionId)
    }

    return { error: null }
  }

  const signOut = async () => {
    if (user) {
      localStorage.removeItem(getSessionKey(user.id))
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
