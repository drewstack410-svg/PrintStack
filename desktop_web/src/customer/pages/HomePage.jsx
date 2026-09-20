import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthProvider'
import { displayName } from '../../users'
import { brand } from '../../theme'
import { EmptyState, ErrorCard, GradientButton, StatusChip, pagePadSx } from '../components'
import { usePartners } from '../usePartners'

export default function HomePage({ onOpenPrint, onOpenHistory }) {
  const { user, profile } = useAuth()
  const { partners, loading, error } = usePartners()
  const name = displayName(profile) || user?.displayName?.trim() || ''
  const greeting = name || 'there'
  const online = partners.filter((p) => p.location?.online)

  if (loading && partners.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Box sx={pagePadSx}>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: brand.navy }}>
        Hi, {greeting}
      </Typography>
      <Typography sx={{ color: brand.muted, fontSize: 13, mt: 0.5 }}>
        Ready to print when shops are online.
      </Typography>

      {error ? (
        <Box sx={{ mt: 2 }}>
          <ErrorCard message={error} />
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', gap: 1.25, mt: 2 }}>
        <StatCard label="Online" value={String(online.length)} accent="#1B5E20" />
        <StatCard label="Shops" value={String(partners.length)} accent={brand.purpleDark} />
      </Box>

      <Box sx={{ mt: 2 }}>
        <GradientButton onClick={onOpenPrint}>Start a print job</GradientButton>
      </Box>
      <Button
        fullWidth
        variant="outlined"
        onClick={onOpenHistory}
        sx={{
          mt: 1,
          minHeight: 42,
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 14,
          color: brand.navy,
          borderColor: 'rgba(79, 124, 255, 0.28)',
        }}
      >
        View history
      </Button>

      <Typography sx={{ fontWeight: 800, fontSize: 14, color: brand.navy, mt: 2.5, mb: 1.25 }}>
        Online now
      </Typography>

      {online.length === 0 ? (
        <EmptyState
          icon={StorefrontOutlinedIcon}
          title="No shops online"
          message="You can still queue jobs — printing starts when a shop comes online."
        />
      ) : (
        online.slice(0, 5).map((partner) => (
          <Box
            key={partner.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.35,
              py: 1.1,
              mb: 1,
              bgcolor: '#fff',
              borderRadius: 1.25,
            }}
          >
            <Typography sx={{ flex: 1, fontWeight: 700, color: brand.navy, fontSize: 13.5 }}>
              {partner.companyName || 'Untitled shop'}
            </Typography>
            <StatusChip label="Online" active />
          </Box>
        ))
      )}
    </Box>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <Box sx={{ flex: 1, p: 1.5, bgcolor: '#fff', borderRadius: 1.25 }}>
      <Typography sx={{ color: brand.muted, fontSize: 12 }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: accent, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  )
}
