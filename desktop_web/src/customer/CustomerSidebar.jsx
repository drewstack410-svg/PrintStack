import {
  Avatar,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import HomeIcon from '@mui/icons-material/Home'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import PaymentsIcon from '@mui/icons-material/Payments'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PersonIcon from '@mui/icons-material/Person'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import PrintIcon from '@mui/icons-material/Print'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import SettingsIcon from '@mui/icons-material/Settings'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import StorefrontIcon from '@mui/icons-material/Storefront'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { useAuth } from '../auth/AuthProvider'
import { displayName } from '../users'
import { brand } from '../theme'
import { BrandWordmark } from './components'
import { DESKTOP_SIDEBAR_NAV, SIDEBAR_NAV, SIDEBAR_WIDTH } from './nav'

const ICONS = {
  StorefrontOutlined: StorefrontOutlinedIcon,
  Storefront: StorefrontIcon,
  PaymentsOutlined: PaymentsOutlinedIcon,
  Payments: PaymentsIcon,
  SettingsOutlined: SettingsOutlinedIcon,
  Settings: SettingsIcon,
  HomeOutlined: HomeOutlinedIcon,
  Home: HomeIcon,
  HistoryOutlined: HistoryOutlinedIcon,
  History: HistoryIcon,
  PrintOutlined: PrintOutlinedIcon,
  Print: PrintIcon,
  PersonOutlined: PersonOutlinedIcon,
  Person: PersonIcon,
}

export default function CustomerSidebar({
  selected,
  onSelect,
  onClose,
  variant = 'drawer',
}) {
  const { user, profile, signOut } = useAuth()
  const name = displayName(profile) || user?.displayName || ''
  const email = profile?.email || user?.email || ''
  const label = name || email || 'Customer'
  const initial = label.charAt(0).toUpperCase()
  const photo = user?.photoURL || ''
  const desktop = variant === 'permanent'
  const items = desktop ? DESKTOP_SIDEBAR_NAV : SIDEBAR_NAV
  const primary = items.filter((item) => !item.section)
  const secondary = items.filter((item) => item.section === 'more')

  function renderItems(list) {
    return list.map((item) => {
      const isSelected = item.id === selected
      const Icon = ICONS[isSelected ? item.selectedIcon : item.icon] || StorefrontOutlinedIcon
      return (
        <ListItemButton
          key={item.id}
          selected={isSelected}
          onClick={() => {
            onSelect(item.id)
            onClose?.()
          }}
          sx={{
            borderRadius: 1.5,
            mx: 0.75,
            my: 0.35,
            py: 1.15,
            minHeight: 48,
            bgcolor: 'transparent',
            backgroundImage: isSelected ? brand.gradient : 'none',
            color: isSelected ? '#fff' : brand.navy,
            boxShadow: isSelected ? '0 6px 16px rgba(124, 92, 255, 0.35)' : 'none',
            '&:hover': {
              bgcolor: isSelected ? undefined : 'rgba(124, 92, 255, 0.06)',
            },
            '&.Mui-selected': {
              backgroundImage: brand.gradient,
              color: '#fff',
            },
            '&.Mui-selected:hover': {
              backgroundImage: brand.gradient,
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 40,
              color: isSelected ? '#fff' : brand.purpleDark,
            }}
          >
            <Icon sx={{ fontSize: 24 }} />
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              fontWeight: 800,
              fontSize: 15,
              color: isSelected ? '#fff' : brand.navy,
            }}
          />
        </ListItemButton>
      )
    })
  }

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fff',
        borderRight: desktop ? '1px solid rgba(79, 124, 255, 0.12)' : 'none',
      }}
    >
      {desktop ? (
        <Box sx={{ px: 2, pt: 2, pb: 1.25 }}>
          <BrandWordmark size={18} />
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: desktop ? 1.15 : 1.5 }}>
        <Avatar
          src={photo || undefined}
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'rgba(124, 92, 255, 0.12)',
            color: brand.purpleDark,
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
          onClick={() => {
            onSelect('account')
            onClose?.()
          }}
        >
          {!photo ? initial : null}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, color: brand.navy, fontSize: 13 }}>
            {label}
          </Typography>
          {name && email ? (
            <Typography noWrap sx={{ color: brand.muted, fontSize: 11 }}>
              {email}
            </Typography>
          ) : null}
        </Box>
      </Box>
      <Divider />
      <List sx={{ px: 0.35, pt: 0.75 }} dense>
        {renderItems(primary)}
      </List>
      {secondary.length ? (
        <>
          <Divider sx={{ my: 0.75 }} />
          <List sx={{ px: 0.35 }} dense>
            {renderItems(secondary)}
          </List>
        </>
      ) : null}
      <Box sx={{ flex: 1 }} />
      <Divider />
      <ListItemButton
        onClick={async () => {
          onClose?.()
          await signOut()
        }}
        sx={{
          mx: 0.75,
          my: 0.75,
          borderRadius: 1.5,
          py: 1.15,
          minHeight: 48,
          bgcolor: 'transparent',
          '&:hover': { bgcolor: 'rgba(124, 92, 255, 0.06)' },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, color: brand.purpleDark }}>
          <LogoutIcon sx={{ fontSize: 24 }} />
        </ListItemIcon>
        <ListItemText
          primary="Sign out"
          primaryTypographyProps={{ fontWeight: 800, color: brand.navy, fontSize: 15 }}
        />
      </ListItemButton>
    </Box>
  )
}
