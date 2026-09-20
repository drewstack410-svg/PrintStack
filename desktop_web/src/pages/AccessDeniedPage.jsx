import { Alert, Button, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'
import { isDesktopApp } from '../lib/platform'

export default function AccessDeniedPage() {
  const { profile, isSuperAdmin, isAdmin, signOut } = useAuth()
  const desktop = isDesktopApp()
  const elevated = isSuperAdmin || isAdmin

  let message
  if (desktop && !elevated) {
    message =
      'This desktop app is for admins and superadmins only. Customers should sign in on the website or mobile app.'
  } else if (!desktop && elevated) {
    message =
      'Admin and superadmin accounts can only sign in on the Printstack desktop app.'
  } else {
    message = `${profile?.email || 'This account'} is signed in but does not have access here.`
  }

  return (
    <Stack spacing={2} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', px: 3 }}>
      <Typography variant="h5">Wrong app for this account</Typography>
      <Alert severity="warning" sx={{ maxWidth: 480 }}>
        {message}
      </Alert>
      <Button variant="contained" onClick={() => signOut()}>
        Sign out
      </Button>
    </Stack>
  )
}
