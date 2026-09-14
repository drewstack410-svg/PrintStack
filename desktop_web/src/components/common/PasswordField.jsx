import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { IconButton, InputAdornment, TextField } from '@mui/material'

export default function PasswordField({
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  label = 'Password',
  autoComplete = 'current-password',
  ...props
}) {
  return (
    <TextField
      label={label}
      type={showPassword ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={onToggleVisibility}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      {...props}
    />
  )
}
