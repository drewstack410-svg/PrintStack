import { useCallback, useMemo, useState } from 'react'
import { Alert, Box, Paper, Stack } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import PartnerLocationMap from '../components/dashboard/PartnerLocationMap'
import { usePartnerLocations } from '../hooks/usePartnerLocations'
import { displayName } from '../users'

function toMarker(item) {
  if (!item?.location) {
    return null
  }

  return {
    id: item.id || item.partnerId || 'self',
    name: item.companyName || item.name || 'Partner',
    logoUrl: item.logoUrl || '',
    lat: item.location.lat,
    lng: item.location.lng,
    label: item.location.label,
    online: Boolean(item.location.online),
  }
}

export default function SettingsPage({
  trackedLocation = { location: null, error: '', setManualLocation: null },
}) {
  const { user, profile, isSuperAdmin, isAdmin } = useAuth()
  const partners = usePartnerLocations({ user, enabled: isSuperAdmin })
  const [pinError, setPinError] = useState('')
  const canPin = Boolean(isAdmin && !isSuperAdmin && trackedLocation.setManualLocation)

  const markers = useMemo(() => {
    if (isSuperAdmin) {
      return partners.map(toMarker).filter(Boolean)
    }

    const selfLocation = trackedLocation.location || profile?.location
    return [
      toMarker({
        id: profile?.partnerId || 'self',
        companyName: profile?.companyName || displayName(profile) || profile?.email,
        logoUrl: profile?.logoUrl || '',
        location: selfLocation,
      }),
    ].filter(Boolean)
  }, [isSuperAdmin, partners, profile, trackedLocation.location])

  const liveCount = markers.filter((item) => item.online).length

  const handleLocationPick = useCallback(
    async ({ lat, lng }) => {
      if (!trackedLocation.setManualLocation) {
        return
      }
      try {
        setPinError('')
        await trackedLocation.setManualLocation({ lat, lng })
      } catch (err) {
        setPinError(err.message || 'Could not save this pin')
      }
    },
    [trackedLocation],
  )

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, height: '100%' }}>
      <PartnerLocationMap
        markers={markers}
        editable={canPin}
        onLocationPick={canPin ? handleLocationPick : undefined}
      />

      <Stack
        spacing={1.25}
        sx={{
          position: 'absolute',
          zIndex: 500,
          top: 12,
          left: 12,
          right: 12,
          pointerEvents: 'none',
          '& > *': { pointerEvents: 'auto' },
        }}
      >
        <Paper elevation={0} sx={{ px: 1.5, py: 1, bgcolor: 'rgba(255,255,255,0.92)' }}>
          <PageHeader
            title="Settings"
            subtitle={
              isSuperAdmin
                ? `${liveCount} logged partner${liveCount === 1 ? '' : 's'} on the map`
                : trackedLocation.location?.label ||
                  profile?.location?.label ||
                  'Your partner location'
            }
          />
        </Paper>

        {canPin ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Click the map to place your shop pin exactly. Auto-locate stays on, but won’t
            overwrite a pin with coarse IP location.
          </Alert>
        ) : null}

        {trackedLocation.error ? (
          <Alert severity="info" sx={{ py: 0 }}>
            {trackedLocation.error}
          </Alert>
        ) : null}

        {pinError ? (
          <Alert severity="warning" sx={{ py: 0 }}>
            {pinError}
          </Alert>
        ) : null}
      </Stack>
    </Box>
  )
}
