import MenuIcon from '@mui/icons-material/Menu'
import { AppBar, IconButton, Toolbar, Typography } from '@mui/material'
import { brand } from '../../theme'
import AccountMenu from './AccountMenu'
import { DRAWER_WIDTH } from './constants'

export default function AppHeader({ desktopOffset, onMenuClick, title = 'Dashboard' }) {
  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { sm: `${DRAWER_WIDTH}px` },
        top: desktopOffset,
        bgcolor: brand.purpleDark,
        backgroundImage: 'none',
        color: '#ffffff',
        boxShadow: 'none',
      }}
    >
      <Toolbar variant="dense">
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { sm: 'none' }, WebkitAppRegion: 'no-drag' }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1, color: '#ffffff' }}>
          {title}
        </Typography>
        <AccountMenu />
      </Toolbar>
    </AppBar>
  )
}
