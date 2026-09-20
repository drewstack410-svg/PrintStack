import { Button, CircularProgress } from '@mui/material'

function GoogleMark() {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        border: '1px solid #E5E7EB',
        background: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 13,
        color: '#4285F4',
        lineHeight: 1,
      }}
    >
      G
    </span>
  )
}

export default function GoogleSignInButton({ onClick, busy = false, label = 'Continue with Google' }) {
  return (
    <Button
      type="button"
      variant="outlined"
      size="large"
      fullWidth
      disabled={busy}
      onClick={onClick}
      startIcon={busy ? null : <GoogleMark />}
      sx={{ py: 1.25 }}
    >
      {busy ? <CircularProgress size={22} color="inherit" /> : label}
    </Button>
  )
}
