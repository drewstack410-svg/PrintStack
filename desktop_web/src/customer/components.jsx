import { Box, Typography } from '@mui/material'
import { brand } from '../theme'

export function BrandWordmark({ size = 20 }) {
  return (
    <Typography
      sx={{
        fontSize: size,
        fontWeight: 800,
        letterSpacing: 0.3,
        backgroundImage: brand.gradient,
        backgroundClip: 'text',
        color: 'transparent',
        lineHeight: 1.1,
      }}
    >
      PrintStack
    </Typography>
  )
}

export function StatusChip({ label, active = false }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.2,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        bgcolor: active ? '#E8F5E9' : 'rgba(91, 100, 117, 0.12)',
        color: active ? '#1B5E20' : brand.muted,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

export function EmptyState({ icon: Icon, title, message }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 3,
        px: 1.5,
        bgcolor: 'white',
        borderRadius: 1.25,
      }}
    >
      {Icon ? <Icon sx={{ fontSize: 32, color: brand.purple, mb: 0.75 }} /> : null}
      <Typography sx={{ fontWeight: 800, color: brand.navy, fontSize: 14 }}>{title}</Typography>
      {message ? (
        <Typography sx={{ color: brand.muted, mt: 0.5, fontSize: 12.5 }}>{message}</Typography>
      ) : null}
    </Box>
  )
}

export function ErrorCard({ message, onRetry }) {
  return (
    <Box sx={{ p: 1.5, bgcolor: '#FFEBEE', borderRadius: 1.25 }}>
      <Typography sx={{ color: '#B71C1C', fontWeight: 600, whiteSpace: 'pre-wrap', fontSize: 13 }}>
        {message}
      </Typography>
      {onRetry ? (
        <Typography
          component="button"
          onClick={onRetry}
          sx={{
            mt: 0.75,
            border: 0,
            background: 'none',
            color: brand.purpleDark,
            fontWeight: 700,
            cursor: 'pointer',
            p: 0,
            fontSize: 13,
          }}
        >
          Retry
        </Typography>
      ) : null}
    </Box>
  )
}

export function GradientButton({ children, onClick, disabled, fullWidth = true, sx, ...props }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: fullWidth ? '100%' : 'auto',
        minHeight: 42,
        px: 2,
        border: 0,
        borderRadius: 999,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        backgroundImage: brand.gradient,
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        fontFamily: 'inherit',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

export function PartnerAvatar({ url, name, size = 40 }) {
  const initial = (name || 'P').trim().charAt(0).toUpperCase() || 'P'
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        bgcolor: 'rgba(124, 92, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundImage: url ? `url(${url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: brand.purpleDark,
        fontWeight: 800,
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
    >
      {!url ? initial : null}
    </Box>
  )
}

/** List on mobile, square card grid on desktop. */
export const cardGridSx = {
  display: { xs: 'flex', md: 'grid' },
  flexDirection: { xs: 'column' },
  gridTemplateColumns: {
    md: 'repeat(auto-fill, minmax(128px, 1fr))',
    lg: 'repeat(auto-fill, minmax(140px, 1fr))',
  },
  gap: { xs: 0, md: 1.25 },
}

/** Shared list/square card surface. */
export const itemCardSx = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  p: { xs: 1.25, md: 1.15 },
  mb: { xs: 1, md: 0 },
  border: 0,
  bgcolor: '#fff',
  borderRadius: { xs: 1, md: 1 },
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  aspectRatio: { md: '1 / 1' },
  flexDirection: { xs: 'row', md: 'column' },
  justifyContent: { md: 'center' },
  alignItems: { xs: 'center', md: 'center' },
}

/** Default page content padding for customer screens. */
export const pagePadSx = {
  px: 2,
  pt: 2,
  pb: 3,
  width: '100%',
}
