export const NAV = {
  home: 'home',
  print: 'print',
  history: 'history',
  shops: 'shops',
  payments: 'payments',
  settings: 'settings',
  account: 'account',
}

export const BOTTOM_NAV = [
  { id: NAV.home, label: 'Home', icon: 'HomeOutlined', selectedIcon: 'Home' },
  { id: NAV.print, label: 'Find shops', icon: 'PrintOutlined', selectedIcon: 'Print' },
  { id: NAV.history, label: 'History', icon: 'HistoryOutlined', selectedIcon: 'History' },
]

export const SIDEBAR_NAV = [
  { id: NAV.shops, label: 'Shops', icon: 'StorefrontOutlined', selectedIcon: 'Storefront' },
  { id: NAV.payments, label: 'Payments', icon: 'PaymentsOutlined', selectedIcon: 'Payments' },
  { id: NAV.settings, label: 'Settings', icon: 'SettingsOutlined', selectedIcon: 'Settings' },
]

/** Full desktop rail: primary tabs + drawer destinations. */
export const DESKTOP_SIDEBAR_NAV = [
  { id: NAV.home, label: 'Home', icon: 'HomeOutlined', selectedIcon: 'Home' },
  { id: NAV.print, label: 'Find shops', icon: 'PrintOutlined', selectedIcon: 'Print' },
  { id: NAV.history, label: 'History', icon: 'HistoryOutlined', selectedIcon: 'History' },
  { id: NAV.shops, label: 'Shops', icon: 'StorefrontOutlined', selectedIcon: 'Storefront', section: 'more' },
  { id: NAV.payments, label: 'Payments', icon: 'PaymentsOutlined', selectedIcon: 'Payments', section: 'more' },
  { id: NAV.settings, label: 'Settings', icon: 'SettingsOutlined', selectedIcon: 'Settings', section: 'more' },
  { id: NAV.account, label: 'Profile', icon: 'PersonOutlined', selectedIcon: 'Person', section: 'more' },
]

export const SIDEBAR_WIDTH = 200


export function pageTitle(id) {
  switch (id) {
    case NAV.home:
      return 'Home'
    case NAV.print:
      return 'Find shops'
    case NAV.history:
      return 'History'
    case NAV.shops:
      return 'Shops'
    case NAV.payments:
      return 'Payments'
    case NAV.settings:
      return 'Settings'
    case NAV.account:
      return 'Profile'
    default:
      return 'Printstack'
  }
}

/** Bottom highlight maps drawer-only routes back to Home. */
export function bottomHighlightId(selected) {
  if (
    selected === NAV.account ||
    selected === NAV.payments ||
    selected === NAV.settings ||
    selected === NAV.shops
  ) {
    return NAV.home
  }
  return selected
}
