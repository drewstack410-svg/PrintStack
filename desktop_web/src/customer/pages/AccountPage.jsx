import { Box, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthProvider'
import { displayName } from '../../users'
import { brand } from '../../theme'
import { GradientButton, pagePadSx } from '../components'

export default function AccountPage() {
  const { user, profile, signOut } = useAuth()
  const name = displayName(profile) || user?.displayName?.trim() || ''
  const email = profile?.email || user?.email || ''

  return (
    <Box sx={pagePadSx}>
      <Box sx={{ p: 1.75, bgcolor: '#fff', borderRadius: 1.25 }}>
        <Typography sx={{ color: brand.muted, fontSize: 12 }}>Signed in as</Typography>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: brand.navy, mt: 0.75 }}>
          {name || 'Customer'}
        </Typography>
        {email ? (
          <Typography sx={{ color: brand.muted, mt: 0.35, fontSize: 13 }}>{email}</Typography>
        ) : null}
      </Box>
      <Box sx={{ mt: 2 }}>
        <GradientButton onClick={() => signOut()}>Sign out</GradientButton>
      </Box>
    </Box>
  )
}
