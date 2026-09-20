import { useMemo } from 'react'
import { Box, CssBaseline, ThemeProvider } from '@mui/material'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { getDesktopApi } from './api'
import LoadingScreen from './components/common/LoadingScreen'
import AppShell from './components/layout/AppShell'
import DesktopTitleBar from './components/layout/DesktopTitleBar'
import CustomerShell from './customer/CustomerShell'
import AccessDeniedPage from './pages/AccessDeniedPage'
import LoginPage from './pages/LoginPage'
import { isDesktopApp } from './lib/platform'
import { createAppTheme, DEFAULT_COLOR_MODE } from './theme'

function AppGate() {
  const { loading, user, isSuperAdmin, isAdmin, isCustomer } = useAuth()
  const desktop = isDesktopApp()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <LoginPage />
  }

  if (desktop) {
    if (isSuperAdmin || isAdmin) {
      return <AppShell />
    }
    return <AccessDeniedPage />
  }

  if (isCustomer) {
    return <CustomerShell />
  }

  return <AccessDeniedPage />
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
