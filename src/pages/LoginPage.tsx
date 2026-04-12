import { useState, useRef, useEffect, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import './LoginPage.css'

interface LoginPageProps {
  kickedOut: boolean
  onClearKickedOut: () => void
}

export function LoginPage({ kickedOut, onClearKickedOut }: LoginPageProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (kickedOut) {
      setError('다른 기기에서 로그인되어 자동 로그아웃되었습니다.')
      onClearKickedOut()
    }
  }, [kickedOut, onClearKickedOut])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError('이메일 또는 비밀번호를 확인해주세요.')
      emailRef.current?.focus()
    }
    setLoading(false)
  }

  return (
    <div className="login-bg">
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🍜</span>
          <h1 className="login-title">선비칼국수</h1>
          <p className="login-sub">통합 허브에 로그인하세요</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">이메일</label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              autoComplete="email"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">비밀번호</label>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && (
            <p className="login-error" id="login-error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? (
              <span className="login-btn-loading">
                <span className="login-spinner" />
                로그인 중...
              </span>
            ) : '로그인'}
          </button>
        </form>
        <p className="login-footer">계정 발급은 본사에 문의하세요</p>
      </div>
    </div>
  )
}
