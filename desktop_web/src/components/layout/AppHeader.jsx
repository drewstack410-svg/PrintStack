import MenuIcon from '@mui/icons-material/Menu'
import { AppBar, Box, IconButton, Toolbar } from '@mui/material'
import { brand } from '../../theme'
import AccountMenu from './AccountMenu'
import { DRAWER_WIDTH } from './constants'

export default function AppHeader({ desktopOffset, onMenuClick }) {
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
      <Toolbar variant="dense" sx={{ justifyContent: 'flex-end' }}>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 'auto', display: { sm: 'none' }, WebkitAppRegion: 'no-drag' }}
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, flexGrow: 1 }} />
        <AccountMenu />
      </Toolbar>
    </AppBar>
  )
}
