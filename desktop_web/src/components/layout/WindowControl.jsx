import CloseIcon from '@mui/icons-material/Close'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import FilterNoneIcon from '@mui/icons-material/FilterNone'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import { IconButton } from '@mui/material'
import { TITLE_BAR_HEIGHT } from './constants'

export default function WindowControl({ label, onClick, children, close = false }) {
  return (
    <IconButton
      aria-label={label}
      onClick={onClick}
      sx={{
        width: 46,
        height: TITLE_BAR_HEIGHT,
        borderRadius: 0,
        color: '#ffffff',
        WebkitAppRegion: 'no-drag',
        '&:hover': {
          bgcolor: close ? '#e81123' : 'rgba(255, 255, 255, 0.16)',
        },
      }}
    >
      {children}
    </IconButton>
  )
}

export function MinimizeIcon() {
  return <HorizontalRuleIcon sx={{ fontSize: 16 }} />
}

export function MaximizeIcon({ restored }) {
  return restored ? <FilterNoneIcon sx={{ fontSize: 13 }} /> : <CropSquareIcon sx={{ fontSize: 14 }} />
}

export function CloseWindowIcon() {
  return <CloseIcon sx={{ fontSize: 16 }} />
}
