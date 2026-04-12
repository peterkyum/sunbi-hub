import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LoginPage } from './pages/LoginPage'
import { HubPage } from './pages/HubPage'

function AppContent() {
  const { user, loading, kickedOut, clearKickedOut } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f0c08',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: 'SandollGukdaeTteokbokki, sans-serif',
      }}>
        <div style={{
          fontSize: '48px',
          animation: 'pulse-loading 1.5s ease-in-out infinite',
        }}>
          🍜
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '15px',
          fontWeight: 500,
        }}>
          불러오는 중...
        </div>
        <style>{`
          @keyframes pulse-loading {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.15); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  if (!user) {
    return <LoginPage kickedOut={kickedOut} onClearKickedOut={clearKickedOut} />
  }

  return <HubPage />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
