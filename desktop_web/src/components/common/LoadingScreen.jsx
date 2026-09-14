import { Box, CircularProgress } from '@mui/material'

export default function LoadingScreen() {
  return (
    <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  )
}
