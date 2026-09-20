import { useState } from 'react'
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
import { authMessage } from '../../lib/authErrors'
import { brand } from '../../theme'
import { signupInitialValues, signupSchema } from '../../validation/schemas'
import PasswordField from '../common/PasswordField'
import GoogleSignInButton from './GoogleSignInButton'

export default function SignupForm({ onSignIn }) {
  const { signUp, signInWithGoogle } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function handleGoogle() {
    setStatus('')
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setStatus(authMessage(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <Formik
      initialValues={signupInitialValues}
      validationSchema={signupSchema}
      onSubmit={async (values, helpers) => {
        helpers.setStatus('')
        setStatus('')
        try {
          await signUp({
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            password: values.password,
          })
        } catch (err) {
          helpers.setStatus(authMessage(err))
        }
      }}
    >
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status: formStatus }) => {
        const locked = isSubmitting || googleBusy
        return (
          <Stack spacing={2.5} component={Form}>
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
                Create account
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Sign up for PrintStack
              </Typography>
            </Box>

            {formStatus || status ? (
              <Alert severity="error">{formStatus || status}</Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                name="firstName"
                label="First name"
                value={values.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={Boolean(touched.firstName && errors.firstName)}
                helperText={touched.firstName && errors.firstName}
                fullWidth
              />
              <TextField
                name="lastName"
                label="Last name"
                value={values.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={Boolean(touched.lastName && errors.lastName)}
                helperText={touched.lastName && errors.lastName}
                fullWidth
              />
            </Stack>

            <TextField
              name="email"
              label="Email"
              type="email"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(touched.email && errors.email)}
              helperText={touched.email && errors.email}
              autoComplete="email"
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
              autoComplete="new-password"
            />

            <PasswordField
              name="confirmPassword"
              label="Confirm password"
              value={values.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(touched.confirmPassword && errors.confirmPassword)}
              helperText={touched.confirmPassword && errors.confirmPassword}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((open) => !open)}
              autoComplete="new-password"
            />

            <Button type="submit" variant="contained" size="large" disabled={locked} sx={{ py: 1.4 }}>
              {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Create account'}
            </Button>

            <Divider>or</Divider>

            <GoogleSignInButton busy={googleBusy} onClick={handleGoogle} />

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Already have an account?{' '}
              <Link
                component="button"
                type="button"
                onClick={onSignIn}
                sx={{ color: brand.purple, fontWeight: 700 }}
              >
                Sign in
              </Link>
            </Typography>
          </Stack>
        )
      }}
    </Formik>
  )
}
