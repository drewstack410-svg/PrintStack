import { useEffect, useState } from 'react'
import { Box, Drawer, Toolbar } from '@mui/material'
import { getDesktopApi } from '../../api'
import { useAuth } from '../../auth/AuthProvider'
import { usePartnerLocation } from '../../hooks/usePartnerLocation'
import DashboardPage from '../../pages/DashboardPage'
import LocationPage from '../../pages/LocationPage'
import PartnersPage from '../../pages/PartnersPage'
import PrintingPage from '../../pages/PrintingPage'
import SettingsPage from '../../pages/SettingsPage'
import StaffsPage from '../../pages/StaffsPage'
import TemplatesPage from '../../pages/TemplatesPage'
import AppHeader from './AppHeader'
import Sidebar, { ADMIN_NAV_ITEMS, SUPERADMIN_NAV_ITEMS } from './Sidebar'
import { DRAWER_WIDTH, TITLE_BAR_HEIGHT } from './constants'

const FULL_BLEED_PAGES = new Set(['location'])

export default function AppShell() {
  const { user, profile, isSuperAdmin, isAdmin } = useAuth()
  const trackedLocation = usePartnerLocation({
    user,
    enabled: Boolean(isAdmin && profile?.partnerId),
    seedLocation: profile?.location || null,
  })
  const navItems = isSuperAdmin ? SUPERADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const [page, setPage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const desktopOffset = getDesktopApi()?.window ? TITLE_BAR_HEIGHT : 0
  const drawerPaper = {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    top: desktopOffset,
    height: `calc(100% - ${desktopOffset}px)`,
  }
  const fullBleed = FULL_BLEED_PAGES.has(page)

  useEffect(() => {
    if (!navItems.some((item) => item.id === page)) {
      setPage('dashboard')
    }
  }, [navItems, page])

  function selectPage(id) {
    setPage(id)
    setMobileOpen(false)
  }

  const drawer = <Sidebar items={navItems} selected={page} onSelect={selectPage} />

  return (
    <Box sx={{ display: 'flex', minHeight: '100%', height: '100%' }}>
      <AppHeader
        desktopOffset={desktopOffset}
        onMenuClick={() => setMobileOpen((open) => !open)}
      />

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': drawerPaper,
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': drawerPaper,
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          p: fullBleed ? 0 : { xs: 1.25, sm: 2 },
          overflow: fullBleed ? 'hidden' : 'auto',
          width: { xs: '100%', sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
        }}
      >
        <Toolbar variant="dense" />
        {page === 'dashboard' ? <DashboardPage /> : null}
        {page === 'partners' && isSuperAdmin ? <PartnersPage /> : null}
        {page === 'staffs' && !isSuperAdmin ? <StaffsPage /> : null}
        {page === 'printing' && !isSuperAdmin ? <PrintingPage /> : null}
        {page === 'templates' ? <TemplatesPage /> : null}
        {page === 'location' ? <LocationPage trackedLocation={trackedLocation} /> : null}
        {page === 'settings' ? <SettingsPage /> : null}
      </Box>
    </Box>
  )
}
