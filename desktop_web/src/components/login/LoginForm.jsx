import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { Form, Formik } from 'formik'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../../auth/AuthProvider'
import { auth } from '../../firebase'
import { authMessage } from '../../lib/authErrors'
import { brand } from '../../theme'
import { loginInitialValues, loginSchema } from '../../validation/schemas'
import PasswordField from '../common/PasswordField'

export default function LoginForm() {
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [info, setInfo] = useState('')

  async function handleForgotPassword(email, setStatus) {
    setInfo('')
    setStatus('')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo('Password reset email sent.')
    } catch (err) {
      setStatus(authMessage(err))
    }
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 3, sm: 6, md: 10 },
        py: 6,
        backgroundImage: `radial-gradient(circle at top right, rgba(124, 92, 255, 0.08), transparent 30%),
          radial-gradient(circle at bottom left, rgba(34, 211, 238, 0.08), transparent 26%)`,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        <Formik
          initialValues={loginInitialValues}
          validationSchema={loginSchema}
          onSubmit={async (values, helpers) => {
            helpers.setStatus('')
            setInfo('')
            try {
              await signIn(values.email.trim(), values.password)
            } catch (err) {
              helpers.setStatus(authMessage(err))
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status, setStatus, validateField }) => (
            <Stack spacing={3} component={Form}>
              <Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 800,
                    backgroundImage: brand.gradient,
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  Welcome back
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Sign in to Printstack
                </Typography>
              </Box>

              {status ? <Alert severity="error">{status}</Alert> : null}
              {info ? <Alert severity="success">{info}</Alert> : null}

              <TextField
                name="email"
                label="Email"
                type="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                error={Boolean(touched.email && errors.email)}
                helperText={touched.email && errors.email}
                autoComplete="username"
                fullWidth
              />
              <PasswordField
                name="password"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={Boolean(touched.password && errors.password)}
                helperText={touched.password && errors.password}
                showPassword={showPassword}
                onToggleVisibility={() => setShowPassword((open) => !open)}
                required={false}
              />

              <Button type="submit" variant="contained" size="large" disabled={isSubmitting} sx={{ py: 1.4 }}>
                {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
              </Button>

              <Box textAlign="center">
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={async () => {
                    const emailError = await validateField('email')
                    if (emailError) {
                      return
                    }
                    await handleForgotPassword(values.email, setStatus)
                  }}
                  sx={{ color: brand.purple, fontWeight: 600 }}
                >
                  Forgot password?
                </Link>
              </Box>

              <Divider />

              <Typography variant="body2" color="text.secondary" textAlign="center">
                Don&apos;t have an account?{' '}
                <Box component="span" sx={{ color: brand.purple, fontWeight: 600 }}>
                  Ask an admin
                </Box>
              </Typography>
            </Stack>
          )}
        </Formik>
      </Box>
    </Box>
  )
}
