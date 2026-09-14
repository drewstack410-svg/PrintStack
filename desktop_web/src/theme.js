import { createTheme } from '@mui/material/styles'

export const DEFAULT_COLOR_MODE = 'light'

export const brand = {
  cyan: '#22D3EE',
  blue: '#4F7CFF',
  purple: '#7C5CFF',
  purpleDark: '#3D1FA8',
  navy: '#0B1220',
  mist: '#F4F7FC',
  gradient: 'linear-gradient(90deg, #22D3EE 0%, #4F7CFF 50%, #7C5CFF 100%)',
}

export function createAppTheme(mode = DEFAULT_COLOR_MODE) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? brand.cyan : brand.blue,
        dark: brand.purple,
        light: brand.cyan,
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? brand.purple : brand.cyan,
        contrastText: isDark ? '#ffffff' : brand.navy,
      },
      background: {
        default: isDark ? brand.navy : brand.mist,
        paper: isDark ? '#121A2E' : '#ffffff',
      },
      text: {
        primary: isDark ? '#F8FAFC' : brand.navy,
        secondary: isDark ? '#94A3B8' : '#5B6475',
      },
      divider: isDark ? 'rgba(124, 92, 255, 0.22)' : 'rgba(79, 124, 255, 0.16)',
    },
    shape: {
      borderRadius: 14,
    },
    typography: {
      fontFamily: 'Roboto, system-ui, sans-serif',
      h4: { fontWeight: 800, letterSpacing: 0.4 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700, letterSpacing: 0.2 },
      button: { fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: isDark
              ? `radial-gradient(circle at top right, rgba(124, 92, 255, 0.18), transparent 32%),
                 radial-gradient(circle at bottom left, rgba(34, 211, 238, 0.12), transparent 28%)`
              : `radial-gradient(circle at top right, rgba(124, 92, 255, 0.08), transparent 30%),
                 radial-gradient(circle at bottom left, rgba(34, 211, 238, 0.08), transparent 26%)`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: brand.purpleDark,
            color: '#ffffff',
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${isDark ? 'rgba(124, 92, 255, 0.22)' : 'rgba(79, 124, 255, 0.12)'}`,
            backgroundImage: isDark
              ? 'linear-gradient(180deg, #121A2E 0%, #0B1220 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #F7FAFF 100%)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 999,
            paddingInline: 18,
          },
          containedPrimary: {
            backgroundImage: brand.gradient,
            color: '#ffffff',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            marginInline: 8,
            '&.Mui-selected': {
              backgroundImage: isDark
                ? 'linear-gradient(90deg, rgba(34, 211, 238, 0.16), rgba(124, 92, 255, 0.2))'
                : 'linear-gradient(90deg, rgba(34, 211, 238, 0.14), rgba(124, 92, 255, 0.16))',
              color: '#000000',
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 40,
            color: '#000000',
          },
        },
      },
    },
  })
}
