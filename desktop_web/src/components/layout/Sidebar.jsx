import DashboardIcon from '@mui/icons-material/Dashboard'
import HandshakeIcon from '@mui/icons-material/Handshake'
import PeopleIcon from '@mui/icons-material/People'
import PrintIcon from '@mui/icons-material/Print'
import SettingsIcon from '@mui/icons-material/Settings'
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material'

export const SUPERADMIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'partners', label: 'Partners', icon: <HandshakeIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

export const ADMIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'staffs', label: 'Staffs', icon: <PeopleIcon /> },
  { id: 'printing', label: 'Printing', icon: <PrintIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

export default function Sidebar({ selected = 'dashboard', onSelect, items = SUPERADMIN_NAV_ITEMS }) {
  return (
    <Box>
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ color: '#000000' }}>
          Printstack
        </Typography>
      </Toolbar>
      <List dense>
        {items.map((item) => (
          <ListItemButton
            key={item.id}
            selected={selected === item.id}
            onClick={() => onSelect?.(item.id)}
            sx={{ color: '#000000', py: 0.75 }}
          >
            <ListItemIcon sx={{ color: '#000000' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: selected === item.id ? 700 : 600, color: '#000000' }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
