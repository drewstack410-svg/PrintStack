import { useState } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import AuthScaffold from '../components/login/AuthScaffold'
import LoginForm from '../components/login/LoginForm'
import ShowcasePane from '../components/login/ShowcasePane'
import SignupForm from '../components/login/SignupForm'
import { BrandWordmark } from '../customer/components'
import { isDesktopApp } from '../lib/platform'
import { brand } from '../theme'

export default function LoginPage() {
  const desktopApp = isDesktopApp()
  const theme = useTheme()
  const desktopViewport = useMediaQuery(theme.breakpoints.up('md'))
  const [mode, setMode] = useState('login')

  if (desktopApp || desktopViewport) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100%', height: '100%', bgcolor: brand.mist }}>
        <ShowcasePane />
        {mode === 'login' ? (
          <LoginForm onRegister={() => setMode('signup')} />
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              px: { xs: 3, sm: 6, md: 10 },
              py: 6,
            }}
          >
            <Box sx={{ width: '100%', maxWidth: 440 }}>
              <SignupForm onSignIn={() => setMode('login')} />
            </Box>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <AuthScaffold>
      <Box sx={{ mb: 3.5 }}>
        <BrandWordmark size={34} />
      </Box>
      {mode === 'login' ? (
        <LoginForm compact onRegister={() => setMode('signup')} />
      ) : (
        <SignupForm onSignIn={() => setMode('login')} />
      )}
    </AuthScaffold>
  )
}
