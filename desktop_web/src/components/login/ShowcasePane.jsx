import { Box } from '@mui/material'
import { brand } from '../../theme'

const SHOWCASE_URL = 'https://drew-stack-client.vercel.app/systems-showcase'

export default function ShowcasePane() {
  return (
    <Box
      sx={{
        flex: 1,
        display: { xs: 'none', md: 'block' },
        position: 'relative',
        bgcolor: brand.navy,
      }}
    >
      <Box
        component="iframe"
        src={SHOWCASE_URL}
        title="DrewStack systems showcase"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          bgcolor: brand.navy,
        }}
      />
    </Box>
  )
}
