import { useState } from 'react'
import { Box } from '@mui/material'
import AuthScaffold from '../components/login/AuthScaffold'
import LoginForm from '../components/login/LoginForm'
import ShowcasePane from '../components/login/ShowcasePane'
import SignupForm from '../components/login/SignupForm'
import { BrandWordmark } from '../customer/components'
import { isDesktopApp } from '../lib/platform'
import { brand } from '../theme'

export default function LoginPage() {
  const desktop = isDesktopApp()
  const [mode, setMode] = useState('login')

  if (desktop) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100%', height: '100%', bgcolor: brand.mist }}>
        <ShowcasePane />
        <LoginForm />
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
