import { Form, Formik } from 'formik'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, TextField } from '@mui/material'
import { paperSizeInitialValues, paperSizeSchema } from '../../validation/schemas'

export default function PaperSizeDialog({ open, paperSize, onClose, onSubmit }) {
  const isEdit = Boolean(paperSize)
  const initialValues = paperSize
    ? {
        name: paperSize.name || '',
        width: paperSize.width ?? '',
        height: paperSize.height ?? '',
        unit: paperSize.unit || 'mm',
        pricePerPiece: paperSize.pricePerPiece ?? '',
      }
    : paperSizeInitialValues

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Formik
        key={open ? paperSize?.id || 'create' : 'closed'}
        enableReinitialize
        initialValues={initialValues}
        validationSchema={paperSizeSchema}
        onSubmit={async (values, helpers) => {
          helpers.setStatus('')
          try {
            await onSubmit({
              name: values.name.trim(),
              width: Number(values.width),
              height: Number(values.height),
              unit: values.unit,
              pricePerPiece: Number(values.pricePerPiece),
            })
            helpers.resetForm()
            onClose()
          } catch (err) {
            helpers.setStatus(err.message || 'Could not save paper size')
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status }) => (
          <Form>
            <DialogTitle>{isEdit ? 'Edit paper size' : 'Add paper size'}</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                {status ? <Alert severity="error">{status}</Alert> : null}
                <TextField
                  size="small"
                  name="name"
                  label="Paper size"
                  value={values.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.name && errors.name)}
                  helperText={touched.name && errors.name}
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    name="width"
                    label="Width"
                    type="number"
                    value={values.width}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={Boolean(touched.width && errors.width)}
                    helperText={touched.width && errors.width}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    name="height"
                    label="Height"
                    type="number"
                    value={values.height}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={Boolean(touched.height && errors.height)}
                    helperText={touched.height && errors.height}
                    fullWidth
                  />
                  <TextField
                    select
                    size="small"
                    name="unit"
                    label="Unit"
                    value={values.unit}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    sx={{ minWidth: 88 }}
                  >
                    <MenuItem value="mm">mm</MenuItem>
                    <MenuItem value="in">in</MenuItem>
                  </TextField>
                </Stack>
                <TextField
                  size="small"
                  name="pricePerPiece"
                  label="Price / piece"
                  type="number"
                  value={values.pricePerPiece}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.pricePerPiece && errors.pricePerPiece)}
                  helperText={touched.pricePerPiece && errors.pricePerPiece}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                    },
                  }}
                  fullWidth
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 1.5 }}>
              <Button size="small" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="small" type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add size'}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  )
}
