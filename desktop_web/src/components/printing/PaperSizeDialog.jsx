import { Form, Formik } from 'formik'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { formatPaperPresetLabel, PAPER_SIZE_PRESETS } from '../../constants/paperSizePresets'
import { paperSizeInitialValues, paperSizeSchema } from '../../validation/schemas'

function matchPresetId(values) {
  const found = PAPER_SIZE_PRESETS.find(
    (preset) =>
      preset.name === values.name &&
      Number(preset.width) === Number(values.width) &&
      Number(preset.height) === Number(values.height) &&
      preset.unit === values.unit,
  )
  return found?.id || ''
}

export default function PaperSizeDialog({ open, paperSize, onClose, onSubmit }) {
  const isEdit = Boolean(paperSize)
  const initialValues = paperSize
    ? {
        name: paperSize.name || '',
        width: paperSize.width ?? '',
        height: paperSize.height ?? '',
        unit: paperSize.unit || 'in',
        priceBw: paperSize.priceBw ?? paperSize.pricePerPiece ?? '',
        priceColor: paperSize.priceColor ?? paperSize.pricePerPiece ?? '',
      }
    : {
        ...paperSizeInitialValues,
        name: PAPER_SIZE_PRESETS[0].name,
        width: PAPER_SIZE_PRESETS[0].width,
        height: PAPER_SIZE_PRESETS[0].height,
        unit: PAPER_SIZE_PRESETS[0].unit,
      }

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
            const priceBw = Number(values.priceBw)
            const priceColor = Number(values.priceColor)
            await onSubmit({
              name: values.name.trim(),
              width: Number(values.width),
              height: Number(values.height),
              unit: values.unit,
              priceBw,
              priceColor,
              pricePerPiece: priceBw,
            })
            helpers.resetForm()
            onClose()
          } catch (err) {
            helpers.setStatus(err.message || 'Could not save paper size')
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, setFieldValue, isSubmitting, status }) => (
          <Form>
            <DialogTitle>{isEdit ? 'Edit paper size' : 'Add paper size'}</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                {status ? <Alert severity="error">{status}</Alert> : null}
                <TextField
                  select
                  size="small"
                  label="Preset"
                  value={matchPresetId(values)}
                  onChange={(event) => {
                    const preset = PAPER_SIZE_PRESETS.find((item) => item.id === event.target.value)
                    if (!preset) {
                      return
                    }
                    setFieldValue('name', preset.name)
                    setFieldValue('width', preset.width)
                    setFieldValue('height', preset.height)
                    setFieldValue('unit', preset.unit)
                  }}
                  fullWidth
                  helperText="Choose a standard size, then set pricing"
                >
                  {PAPER_SIZE_PRESETS.map((preset) => (
                    <MenuItem key={preset.id} value={preset.id}>
                      <ListItemText
                        primary={preset.name}
                        secondary={formatPaperPresetLabel(preset)}
                        primaryTypographyProps={{ fontWeight: 700 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </MenuItem>
                  ))}
                </TextField>
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
                    <MenuItem value="in">in</MenuItem>
                    <MenuItem value="mm">mm</MenuItem>
                  </TextField>
                </Stack>
                <TextField
                  size="small"
                  name="priceBw"
                  label="B&W price / page"
                  type="number"
                  value={values.priceBw}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.priceBw && errors.priceBw)}
                  helperText={touched.priceBw && errors.priceBw}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                    },
                  }}
                  fullWidth
                />
                <TextField
                  size="small"
                  name="priceColor"
                  label="Color price / page"
                  type="number"
                  value={values.priceColor}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={Boolean(touched.priceColor && errors.priceColor)}
                  helperText={touched.priceColor && errors.priceColor}
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
