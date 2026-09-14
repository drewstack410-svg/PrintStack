import { useState } from 'react'
import LogoutIcon from '@mui/icons-material/Logout'
import { Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthProvider'
import { brand } from '../../theme'
import { displayName } from '../../users'

function accountLabel(profile, user) {
  return displayName(profile) || profile?.companyName || profile?.email || user?.email || 'Account'
}

function initials(label) {
  const parts = String(label)
    .split(/[\s@._-]+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return String(label).slice(0, 2).toUpperCase()
}

export default function AccountMenu() {
  const { user, profile, signOut } = useAuth()
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const name = displayName(profile) || profile?.companyName || ''
  const email = profile?.email || user?.email || ''
  const label = accountLabel(profile, user)

  async function handleLogout() {
    setAnchorEl(null)
    await signOut()
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          size="small"
          aria-label="Account menu"
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{ p: 0.25, WebkitAppRegion: 'no-drag' }}
        >
          <Avatar src={profile?.logoUrl || user?.photoURL || undefined} alt={label} sx={{ width: 36, height: 36, bgcolor: '#ffffff', color: brand.purpleDark || brand.purple, fontSize: 14, fontWeight: 700 }} slotProps={{ img: { sx: { objectFit: 'contain', p: 0.4 } } }}>
            {initials(label)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 200 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography fontWeight={700} noWrap>
            {name || 'Account'}
          </Typography>
          {email ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {email}
            </Typography>
          ) : null}
        </Box>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </>
  )
}
