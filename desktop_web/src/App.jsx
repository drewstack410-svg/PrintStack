import { useMemo } from 'react'
import { Box, CssBaseline, ThemeProvider } from '@mui/material'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { getDesktopApi } from './api'
import LoadingScreen from './components/common/LoadingScreen'
import AppShell from './components/layout/AppShell'
import DesktopTitleBar from './components/layout/DesktopTitleBar'
import AccessDeniedPage from './pages/AccessDeniedPage'
import LoginPage from './pages/LoginPage'
import { createAppTheme, DEFAULT_COLOR_MODE } from './theme'

function AppGate() {
  const { loading, user, isSuperAdmin, isAdmin } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <LoginPage />
  }

  if (!isSuperAdmin && !isAdmin) {
    return <AccessDeniedPage />
  }

  return <AppShell />
}

export default function App() {
  const theme = useMemo(() => createAppTheme(DEFAULT_COLOR_MODE), [])
  const hasDesktopChrome = Boolean(getDesktopApi()?.window)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasDesktopChrome ? <DesktopTitleBar /> : null}
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <AppGate />
          </Box>
        </Box>
      </AuthProvider>
    </ThemeProvider>
  )
}
