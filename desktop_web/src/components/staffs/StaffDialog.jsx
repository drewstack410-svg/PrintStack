import { useEffect, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import { Form, Formik } from 'formik'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { staffCreateSchema, staffInitialValues, staffUpdateSchema } from '../../validation/schemas'
import PasswordField from '../common/PasswordField'

export default function StaffDialog({ open, staff, onClose, onSubmit }) {
  const isEdit = Boolean(staff)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!open) {
      setShowPassword(false)
      setShowConfirmPassword(false)
    }
  }, [open])

  const initialValues = staff
    ? {
        firstName: staff.firstName || '',
        middleName: staff.middleName || '',
        lastName: staff.lastName || '',
        email: staff.email || '',
        password: '',
        confirmPassword: '',
      }
    : staffInitialValues

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Formik
        key={open ? staff?.id || 'create' : 'closed'}
        enableReinitialize
        initialValues={initialValues}
        validationSchema={isEdit ? staffUpdateSchema : staffCreateSchema}
        onSubmit={async (values, helpers) => {
          helpers.setStatus('')
          try {
            const payload = {
              firstName: values.firstName.trim(),
              middleName: values.middleName.trim(),
              lastName: values.lastName.trim(),
              email: values.email.trim(),
            }
            if (values.password) {
              payload.password = values.password
            }
            await onSubmit(payload, isEdit)
            helpers.resetForm()
            onClose()
          } catch (err) {
            helpers.setStatus(err.message || (isEdit ? 'Could not update staff' : 'Could not create staff'))
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status }) => (
          <Form>
            <DialogTitle>{isEdit ? 'Edit staff' : 'Add staff'}</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                {status ? <Alert severity="error">{status}</Alert> : null}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    size="small"
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
                    size="small"
                    name="middleName"
                    label="Middle name"
                    value={values.middleName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                  />
                  <TextField
                    size="small"
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
                  size="small"
                  name="email"
                  label="Email"
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.email && errors.email)}
                  helperText={touched.email && errors.email}
                  fullWidth
                />
                <PasswordField
                  size="small"
                  name="password"
                  label={isEdit ? 'New password' : 'Password'}
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.password && errors.password)}
                  helperText={
                    (touched.password && errors.password) ||
                    (isEdit ? 'Leave blank to keep the current password' : '')
                  }
                  showPassword={showPassword}
                  onToggleVisibility={() => setShowPassword((openPassword) => !openPassword)}
                  autoComplete="new-password"
                />
                <PasswordField
                  size="small"
                  name="confirmPassword"
                  label="Confirm password"
                  value={values.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.confirmPassword && errors.confirmPassword)}
                  helperText={touched.confirmPassword && errors.confirmPassword}
                  showPassword={showConfirmPassword}
                  onToggleVisibility={() => setShowConfirmPassword((openConfirm) => !openConfirm)}
                  autoComplete="new-password"
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 1.5 }}>
              <Button size="small" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="small" type="submit" variant="contained" startIcon={isEdit ? undefined : <AddIcon />} disabled={isSubmitting}>
                {isSubmitting ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create staff'}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  )
}
