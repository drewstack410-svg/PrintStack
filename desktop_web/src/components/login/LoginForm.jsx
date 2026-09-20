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
import { isDesktopApp } from '../../lib/platform'
import { brand } from '../../theme'
import { loginInitialValues, loginSchema } from '../../validation/schemas'
import PasswordField from '../common/PasswordField'
import GoogleSignInButton from './GoogleSignInButton'

export default function LoginForm({ onRegister, compact = false }) {
  const { signIn, signInWithGoogle } = useAuth()
  const desktop = isDesktopApp()
  const [showPassword, setShowPassword] = useState(false)
  const [info, setInfo] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleError, setGoogleError] = useState('')

  async function handleForgotPassword(email, setStatus) {
    setInfo('')
    setStatus('')
    setGoogleError('')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo('Password reset email sent.')
    } catch (err) {
      setStatus(authMessage(err))
    }
  }

  async function handleGoogle() {
    setInfo('')
    setGoogleError('')
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setGoogleError(authMessage(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  const form = (
    <Formik
      initialValues={loginInitialValues}
      validationSchema={loginSchema}
      onSubmit={async (values, helpers) => {
        helpers.setStatus('')
        setInfo('')
        setGoogleError('')
        try {
          await signIn(values.email.trim(), values.password)
        } catch (err) {
          helpers.setStatus(authMessage(err))
        }
      }}
    >
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status, setStatus, validateField }) => {
        const locked = isSubmitting || googleBusy
        return (
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
                {desktop ? 'Sign in with your admin account' : 'Sign in to PrintStack'}
              </Typography>
            </Box>

            {status || googleError ? <Alert severity="error">{status || googleError}</Alert> : null}
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

            <Button type="submit" variant="contained" size="large" disabled={locked} sx={{ py: 1.4 }}>
              {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
            </Button>

            <Box textAlign="center">
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={async () => {
                  const emailError = await validateField('email')
                  if (emailError) return
                  await handleForgotPassword(values.email, setStatus)
                }}
                sx={{ color: brand.purple, fontWeight: 600 }}
              >
                Forgot password?
              </Link>
            </Box>

            {!desktop ? (
              <>
                <Divider>or</Divider>
                <GoogleSignInButton busy={googleBusy} onClick={handleGoogle} />
              </>
            ) : null}

            <Typography variant="body2" color="text.secondary" textAlign="center">
              {desktop ? (
                <>
                  Don&apos;t have an account?{' '}
                  <Box component="span" sx={{ color: brand.purple, fontWeight: 600 }}>
                    Ask a superadmin
                  </Box>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <Link
                    component="button"
                    type="button"
                    onClick={onRegister}
                    sx={{ color: brand.purple, fontWeight: 700 }}
                  >
                    Register
                  </Link>
                </>
              )}
            </Typography>
          </Stack>
        )
      }}
    </Formik>
  )

  if (compact) {
    return form
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
      <Box sx={{ width: '100%', maxWidth: 420 }}>{form}</Box>
    </Box>
  )
}
