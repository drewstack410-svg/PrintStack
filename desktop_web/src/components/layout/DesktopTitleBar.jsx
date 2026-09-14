import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { getDesktopApi } from '../../api'
import { brand } from '../../theme'
import { TITLE_BAR_HEIGHT } from './constants'
import WindowControl, { CloseWindowIcon, MaximizeIcon, MinimizeIcon } from './WindowControl'

export default function DesktopTitleBar() {
  const desktop = getDesktopApi()?.window
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!desktop) {
      return undefined
    }

    desktop.isMaximized().then(setMaximized).catch(() => {})
    return desktop.onMaximized(setMaximized)
  }, [desktop])

  if (!desktop) {
    return null
  }

  return (
    <Box
      onDoubleClick={() => desktop.maximize()}
      sx={{
        height: TITLE_BAR_HEIGHT,
        minHeight: TITLE_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        color: '#ffffff',
        bgcolor: brand.navy,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        zIndex: (theme) => theme.zIndex.drawer + 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ pl: 2, fontWeight: 700, letterSpacing: 0.4 }}>
        Printstack
      </Typography>
      <Box sx={{ flexGrow: 1, height: '100%' }} />
      <WindowControl label="Minimize" onClick={() => desktop.minimize()}>
        <MinimizeIcon />
      </WindowControl>
      <WindowControl label={maximized ? 'Restore' : 'Maximize'} onClick={() => desktop.maximize()}>
        <MaximizeIcon restored={maximized} />
      </WindowControl>
      <WindowControl label="Close" close onClick={() => desktop.close()}>
        <CloseWindowIcon />
      </WindowControl>
    </Box>
  )
}
