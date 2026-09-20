import { useMemo, useState } from 'react'
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import HistoryIcon from '@mui/icons-material/History'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import HomeIcon from '@mui/icons-material/Home'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import { useAuth } from '../auth/AuthProvider'
import { displayName } from '../users'
import { brand, createCustomerTheme, DEFAULT_COLOR_MODE } from '../theme'
import CustomerSidebar from './CustomerSidebar'
import { NAV, SIDEBAR_WIDTH, bottomHighlightId, pageTitle } from './nav'
import AccountPage from './pages/AccountPage'
import FindShopsPage from './pages/FindShopsPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import PaymentsPage from './pages/PaymentsPage'
import SettingsPage from './pages/SettingsPage'
import CheckoutPage from './pages/CheckoutPage'
import ShopsPage, { ShopOrderView } from './pages/ShopsPage'

/** Content fills the main pane; pages keep their own inner padding. */
const contentPane = {
  width: '100%',
  maxWidth: '100%',
  mx: 0,
  px: 0,
}

export default function CustomerShell() {
  const outerTheme = useTheme()
  const customerTheme = useMemo(() => createCustomerTheme(DEFAULT_COLOR_MODE), [])
  const isDesktop = useMediaQuery(outerTheme.breakpoints.up('md'))
  const [selected, setSelected] = useState(NAV.home)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hideChromeForSearch, setHideChromeForSearch] = useState(false)
  const [orderPartner, setOrderPartner] = useState(null)
  const [checkout, setCheckout] = useState(null) // { partner, documents }
  const { user, profile } = useAuth()

  const title = pageTitle(selected)
  const bottomId = bottomHighlightId(selected)
  const printSelected = bottomId === NAV.print
  const isFindShops = selected === NAV.print
  const isShopOrder = Boolean(orderPartner)
  const isCheckout = Boolean(checkout) && !orderPartner
  const contentInset = contentPane
  const showBottomDock =
    !isDesktop && !hideChromeForSearch && !isShopOrder && !isCheckout
  const chromeVisible = showBottomDock

  const label = displayName(profile) || user?.displayName || user?.email || 'P'
  const initial = label.charAt(0).toUpperCase()
  const photo = user?.photoURL || ''

  function goTo(id) {
    setHideChromeForSearch(false)
    setOrderPartner(null)
    setCheckout(null)
    setSelected(id)
  }

  function openShopOrder(partner) {
    if (!partner) return
    if (isDesktop) return
    setOrderPartner(partner)
  }

  function continueToCheckout(partner, docs) {
    if (!partner || !docs?.length) return
    setCheckout((prev) => {
      const existing =
        prev?.partner?.id === partner.id ? prev.documents || [] : []
      return { partner, documents: [...existing, ...docs] }
    })
    setOrderPartner(null)
  }

  const body = useMemo(() => {
    if (isShopOrder) {
      return (
        <ShopOrderView
          partner={orderPartner}
          onClose={() => setOrderPartner(null)}
          onContinueToCheckout={(docs) => continueToCheckout(orderPartner, docs)}
        />
      )
    }
    if (isCheckout) {
      return (
        <CheckoutPage
          partner={checkout.partner}
          documents={checkout.documents}
          onClose={() => setCheckout(null)}
          onAddMore={(docs) => {
            setCheckout({ partner: checkout.partner, documents: docs || [] })
            setOrderPartner(checkout.partner)
          }}
        />
      )
    }
    switch (selected) {
      case NAV.home:
        return (
          <HomePage
            onOpenPrint={() => goTo(NAV.print)}
            onOpenHistory={() => goTo(NAV.history)}
          />
        )
      case NAV.print:
        return (
          <FindShopsPage
            onSearchFocusChanged={setHideChromeForSearch}
            chromeVisible={chromeVisible}
            onOpenShop={openShopOrder}
            onContinueToCheckout={continueToCheckout}
          />
        )
      case NAV.history:
        return <HistoryPage />
      case NAV.shops:
        return (
          <ShopsPage
            onOpenShop={openShopOrder}
            onContinueToCheckout={continueToCheckout}
          />
        )
      case NAV.payments:
        return <PaymentsPage />
      case NAV.settings:
        return <SettingsPage />
      case NAV.account:
        return <AccountPage />
      default:
        return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav callbacks are intentional
  }, [
    selected,
    chromeVisible,
    hideChromeForSearch,
    isShopOrder,
    isCheckout,
    orderPartner,
    checkout,
    isDesktop,
  ])

  return (
    <ThemeProvider theme={customerTheme}>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          bgcolor: isFindShops && !isShopOrder && !isCheckout ? 'transparent' : brand.mist,
          overflow: 'hidden',
        }}
      >
      {/* Permanent desktop sidebar */}
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          height: '100%',
          zIndex: 12,
        }}
      >
        <CustomerSidebar
          variant="permanent"
          selected={selected}
          onSelect={goTo}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {!isShopOrder && !isCheckout ? (
          <AppBar position="static" elevation={0} sx={{ bgcolor: brand.barDark }}>
            <Toolbar sx={{ minHeight: 48, gap: 0.75 }}>
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                {title}
              </Typography>
              <IconButton
                color="inherit"
                onClick={() => goTo(NAV.account)}
                aria-label="Profile"
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <Avatar
                  src={photo || undefined}
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: 'rgba(255,255,255,0.18)',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {!photo ? initial : null}
                </Avatar>
              </IconButton>
            </Toolbar>
          </AppBar>
        ) : null}

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <CustomerSidebar
            selected={selected}
            onSelect={goTo}
            onClose={() => setDrawerOpen(false)}
          />
        </Drawer>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: isFindShops || isShopOrder || isCheckout ? 'hidden' : 'auto',
            pb: isFindShops || isShopOrder || isCheckout || !showBottomDock ? 0 : 11,
            position: 'relative',
            bgcolor: isFindShops && !isShopOrder && !isCheckout ? 'transparent' : undefined,
          }}
        >
          <Box
            sx={{
              ...contentInset,
              height: isFindShops || isShopOrder || isCheckout ? '100%' : 'auto',
              minHeight: isFindShops || isShopOrder || isCheckout ? '100%' : undefined,
            }}
          >
            {body}
          </Box>
        </Box>

        {showBottomDock ? (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              pointerEvents: 'none',
              ...contentPane,
            }}
          >
            <Box sx={{ position: 'relative', pointerEvents: 'auto' }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 26,
                  transform: 'translateX(-50%)',
                  zIndex: 12,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => goTo(NAV.print)}
                  aria-label="Find shops"
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    border: printSelected ? '3.5px solid #fff' : '3px solid #fff',
                    backgroundImage: brand.gradient,
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: printSelected
                      ? '0 10px 24px rgba(124, 92, 255, 0.55)'
                      : '0 6px 18px rgba(124, 92, 255, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.25,
                    p: 0,
                  }}
                >
                  <StorefrontRoundedIcon sx={{ fontSize: 24 }} />
                  <Typography sx={{ fontSize: 9, fontWeight: 800, lineHeight: 1.05 }}>
                    Find shops
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  height: 54,
                  bgcolor: brand.barDark,
                  display: 'flex',
                  alignItems: 'stretch',
                  boxShadow: '0 -3px 12px rgba(11, 18, 32, 0.16)',
                  overflow: 'hidden',
                }}
              >
                <NavItem
                  label="Home"
                  selected={bottomId === NAV.home}
                  icon={bottomId === NAV.home ? <HomeIcon /> : <HomeOutlinedIcon />}
                  onClick={() => goTo(NAV.home)}
                />
                <Box sx={{ flex: 1 }} />
                <NavItem
                  label="History"
                  selected={bottomId === NAV.history}
                  icon={bottomId === NAV.history ? <HistoryIcon /> : <HistoryOutlinedIcon />}
                  onClick={() => goTo(NAV.history)}
                />
              </Box>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
    </ThemeProvider>
  )
}

function NavItem({ label, selected, icon, onClick }) {
  const color = selected ? '#fff' : '#9AA3B5'
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        flex: 1,
        border: 0,
        bgcolor: 'transparent',
        color,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.35,
        fontFamily: 'inherit',
      }}
    >
      <Box sx={{ color, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 20 } }}>{icon}</Box>
      <Typography sx={{ fontSize: 11, fontWeight: selected ? 800 : 600, color }}>
        {label}
      </Typography>
    </Box>
  )
}
