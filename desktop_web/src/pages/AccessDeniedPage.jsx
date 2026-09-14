import { Alert, Button, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'

export default function AccessDeniedPage() {
  const { profile, signOut } = useAuth()

  return (
    <Stack spacing={2} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', px: 3 }}>
      <Typography variant="h5">Access required</Typography>
      <Alert severity="warning">
        {profile?.email || 'This account'} is signed in but does not have access to Printstack.
      </Alert>
      <Button variant="contained" onClick={() => signOut()}>
        Sign out
      </Button>
    </Stack>
  )
}
