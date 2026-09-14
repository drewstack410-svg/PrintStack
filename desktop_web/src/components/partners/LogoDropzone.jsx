import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Box, Stack, Typography } from '@mui/material'
import { brand } from '../../theme'

export default function LogoDropzone({ preview, fileName, onFile, disabled = false, error = false }) {
  function takeFile(file) {
    if (!file) {
      return
    }
    onFile(file)
  }

  return (
    <Box
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (disabled) {
          return
        }
        takeFile(event.dataTransfer.files?.[0])
      }}
      sx={{
        height: '100%',
        minHeight: 160,
        border: '2px dashed',
        borderColor: error ? 'error.main' : preview ? brand.blue : 'divider',
        borderRadius: 2,
        bgcolor: preview ? 'transparent' : 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
      }}
      component="label"
    >
      <input
        hidden
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(event) => takeFile(event.target.files?.[0])}
      />
      {preview ? (
        <Box
          component="img"
          src={preview}
          alt="Partner logo preview"
          sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 2 }}
        />
      ) : (
        <Stack spacing={1} alignItems="center">
          <CloudUploadIcon color={error ? 'error' : 'primary'} sx={{ fontSize: 28 }} />
          <Typography fontWeight={600} variant="body2">
            Drop logo here
          </Typography>
          <Typography variant="caption" color="text.secondary">
            or click to browse
          </Typography>
        </Stack>
      )}
      {fileName ? (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            right: 12,
            color: 'text.secondary',
          }}
          noWrap
        >
          {fileName}
        </Typography>
      ) : null}
    </Box>
  )
}
