import { useEffect, useState } from 'react'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { Box, FormControlLabel, Switch, Typography } from '@mui/material'
import { brand } from '../../theme'
import { pagePadSx } from '../components'

const STORAGE_KEY = 'printstack.mapDark'

export default function SettingsPage() {
  const [darkMap, setDarkMap] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, darkMap ? '1' : '0')
  }, [darkMap])

  return (
    <Box sx={pagePadSx}>
      <Box
        sx={{
          bgcolor: '#fff',
          borderRadius: 1.25,
          px: 1.5,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <DarkModeOutlinedIcon sx={{ color: brand.purple, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: brand.navy, fontSize: 13.5 }}>Dark map</Typography>
          <Typography sx={{ color: brand.muted, fontSize: 12 }}>
            Use dark styling when viewing shop locations.
          </Typography>
        </Box>
        <FormControlLabel
          control={<Switch size="small" checked={darkMap} onChange={(e) => setDarkMap(e.target.checked)} />}
          label=""
        />
      </Box>
    </Box>
  )
}
