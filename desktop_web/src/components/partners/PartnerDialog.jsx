import { useEffect, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import { Form, Formik } from 'formik'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { partnerCreateSchema, partnerInitialValues, partnerUpdateSchema } from '../../validation/schemas'
import PasswordField from '../common/PasswordField'
import LogoDropzone from './LogoDropzone'

export default function PartnerDialog({ open, partner, onClose, onSubmit }) {
  const isEdit = Boolean(partner)
  const [preview, setPreview] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!open) {
      setPreview('')
      setShowPassword(false)
      setShowConfirmPassword(false)
    }
  }, [open])

  const initialValues = partner
    ? {
        companyName: partner.companyName || '',
        email: partner.email || '',
        password: '',
        confirmPassword: '',
        logo: null,
        convenienceFee: Number(partner.convenienceFee) || 0,
        servicePrinting: partner.services?.printing !== false,
        serviceXerox: partner.services?.xerox === true,
      }
    : partnerInitialValues

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Formik
        key={open ? partner?.id || 'create' : 'closed'}
        enableReinitialize
        initialValues={initialValues}
        validationSchema={isEdit ? partnerUpdateSchema : partnerCreateSchema}
        onSubmit={async (values, helpers) => {
          helpers.setStatus('')
          try {
            const data = new FormData()
            data.append('companyName', values.companyName.trim())
            data.append('email', values.email.trim())
            data.append('convenienceFee', String(Number(values.convenienceFee) || 0))
            data.append('servicePrinting', values.servicePrinting ? 'true' : 'false')
            data.append('serviceXerox', values.serviceXerox ? 'true' : 'false')
            if (values.password) {
              data.append('password', values.password)
            }
            if (values.logo) {
              data.append('logo', values.logo)
            }
            await onSubmit(data, isEdit)
            helpers.resetForm()
            onClose()
          } catch (err) {
            helpers.setStatus(err.message || (isEdit ? 'Could not update partner' : 'Could not create partner'))
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting, setFieldValue, setFieldTouched, status }) => (
          <PartnerFormBody
            isEdit={isEdit}
            existingLogoUrl={partner?.logoUrl || ''}
            values={values}
            errors={errors}
            touched={touched}
            handleChange={handleChange}
            handleBlur={handleBlur}
            isSubmitting={isSubmitting}
            setFieldValue={setFieldValue}
            setFieldTouched={setFieldTouched}
            status={status}
            preview={preview}
            setPreview={setPreview}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            onClose={onClose}
          />
        )}
      </Formik>
    </Dialog>
  )
}

function PartnerFormBody({
  isEdit,
  existingLogoUrl,
  values,
  errors,
  touched,
  handleChange,
  handleBlur,
  isSubmitting,
  setFieldValue,
  setFieldTouched,
  status,
  preview,
  setPreview,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onClose,
}) {
  useEffect(() => {
    if (values.logo && values.logo.type?.startsWith('image/')) {
      const url = URL.createObjectURL(values.logo)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }

    setPreview(existingLogoUrl || '')
    return undefined
  }, [existingLogoUrl, setPreview, values.logo])

  return (
    <Form>
      <DialogTitle>{isEdit ? 'Edit partner' : 'Add partner'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {status ? <Alert severity="error">{status}</Alert> : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
              gap: 1.5,
              alignItems: 'stretch',
            }}
          >
            <Stack spacing={0.5}>
              <LogoDropzone
                preview={preview}
                fileName={values.logo?.name}
                onFile={(file) => {
                  setFieldValue('logo', file, true)
                  setFieldTouched('logo', true, false)
                }}
                disabled={isSubmitting}
                error={Boolean(touched.logo && errors.logo)}
              />
              {touched.logo && errors.logo ? (
                <Typography variant="caption" color="error">
                  {errors.logo}
                </Typography>
              ) : null}
            </Stack>
            <Stack spacing={1.5} justifyContent="center">
              <TextField
                size="small"
                name="companyName"
                label="Company name"
                value={values.companyName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={Boolean(touched.companyName && errors.companyName)}
                helperText={touched.companyName && errors.companyName}
                fullWidth
              />
              <TextField
                size="small"
                name="email"
                label="Account email"
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
                required={false}
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
                required={false}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              px: 1.5,
              py: 1.25,
            }}
          >
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" fontWeight={700}>
                Platform settings
              </Typography>
              <TextField
                size="small"
                name="convenienceFee"
                label="Convenience fee (₱)"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={values.convenienceFee}
                onChange={handleChange}
                onBlur={handleBlur}
                error={Boolean(touched.convenienceFee && errors.convenienceFee)}
                helperText={
                  (touched.convenienceFee && errors.convenienceFee) ||
                  'Charged per order on top of partner pricing'
                }
                fullWidth
              />
              <Stack spacing={0.25}>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Enabled services
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(values.servicePrinting)}
                      onChange={(event) => setFieldValue('servicePrinting', event.target.checked)}
                      disabled={isSubmitting}
                    />
                  }
                  label="Printing"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(values.serviceXerox)}
                      onChange={(event) => setFieldValue('serviceXerox', event.target.checked)}
                      disabled={isSubmitting}
                    />
                  }
                  label="Xerox"
                />
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button size="small" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="small" type="submit" variant="contained" startIcon={isEdit ? undefined : <AddIcon />} disabled={isSubmitting}>
          {isSubmitting ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create partner'}
        </Button>
      </DialogActions>
    </Form>
  )
}
