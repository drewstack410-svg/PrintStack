import { useMemo, useState } from 'react'
import DashboardIcon from '@mui/icons-material/Dashboard'
import HandshakeIcon from '@mui/icons-material/Handshake'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PeopleIcon from '@mui/icons-material/People'
import PrintIcon from '@mui/icons-material/Print'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import {
  Box,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material'

export const SUPERADMIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'partners', label: 'Partners', icon: <HandshakeIcon /> },
  { id: 'location', label: 'Location', icon: <LocationOnIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

export const ADMIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'staffs', label: 'Staffs', icon: <PeopleIcon /> },
  { id: 'printing', label: 'Printing', icon: <PrintIcon /> },
  { id: 'templates', label: 'Templates', icon: <ViewModuleIcon /> },
  { id: 'location', label: 'Location', icon: <LocationOnIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

export default function Sidebar({
  selected = 'dashboard',
  onSelect,
  items = SUPERADMIN_NAV_ITEMS,
}) {
  const [query, setQuery] = useState('')

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return items
    }
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [items, query])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 1.25, pt: 1.25, pb: 0.5 }}>
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              sx: { bgcolor: '#ffffff' },
            },
          }}
        />
      </Box>
      <List dense sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {filteredItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={selected === item.id}
            onClick={() => onSelect?.(item.id)}
            sx={{ color: '#000000', py: 0.75 }}
          >
            <ListItemIcon sx={{ color: '#000000', minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontWeight: selected === item.id ? 700 : 600,
                color: '#000000',
              }}
            />
          </ListItemButton>
        ))}
        {filteredItems.length === 0 ? (
          <ListItemText
            sx={{ px: 2, py: 1 }}
            primary="No matches"
            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
          />
        ) : null}
      </List>
    </Box>
  )
}
