import { Box, Typography } from '@mui/material'
import { brand } from '../../theme'

/** Mobile-style auth frame: mist + purple radial, centered column. */
export default function AuthScaffold({ children, maxWidth = 440 }) {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: '100%',
        overflow: 'auto',
        bgcolor: brand.mist,
        backgroundImage:
          'radial-gradient(circle at top right, rgba(124, 92, 255, 0.14), transparent 42%)',
      }}
    >
      <Box
        sx={{
          maxWidth,
          mx: 'auto',
          px: 3,
          py: 4,
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export function AuthHeadline({ title, subtitle }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 800,
          backgroundImage: brand.gradient,
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {title}
      </Typography>
      {subtitle ? (
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  )
}
