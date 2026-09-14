import { Box } from '@mui/material'
import LoginForm from '../components/login/LoginForm'
import ShowcasePane from '../components/login/ShowcasePane'
import { brand } from '../theme'

export default function LoginPage() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100%', height: '100%', bgcolor: brand.mist }}>
      <ShowcasePane />
      <LoginForm />
    </Box>
  )
}
