import { useCallback, useMemo, useState } from 'react'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import { Alert, Box, Button, Paper, Stack } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import PartnerLocationMap from '../components/dashboard/PartnerLocationMap'
import LocationSearchBar from '../components/location/LocationSearchBar'
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

export default function LocationPage({
  trackedLocation = {
    location: null,
    error: '',
    locating: false,
    setManualLocation: null,
    useMyLocation: null,
  },
}) {
  const { user, profile, isSuperAdmin, isAdmin } = useAuth()
  const partners = usePartnerLocations({ user, enabled: isSuperAdmin })
  const [pinError, setPinError] = useState('')
  const [focusToken, setFocusToken] = useState(0)
  const canEdit = Boolean(isAdmin && !isSuperAdmin && trackedLocation.setManualLocation)

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
  const focusPoint = canEdit
    ? markers[0]
      ? { lat: markers[0].lat, lng: markers[0].lng, token: focusToken }
      : null
    : null

  const handleLocationPick = useCallback(
    async ({ lat, lng, label }) => {
      if (!trackedLocation.setManualLocation) {
        return
      }
      try {
        setPinError('')
        await trackedLocation.setManualLocation({ lat, lng, label })
        setFocusToken((value) => value + 1)
      } catch (err) {
        setPinError(err.message || 'Could not save this pin')
      }
    },
    [trackedLocation.setManualLocation],
  )

  const handleSearchSelect = useCallback(
    async (place) => {
      if (!canEdit || !place) {
        return
      }
      await handleLocationPick({
        lat: place.lat,
        lng: place.lng,
        label: place.label,
      })
      if (place.validated) {
        setPinError('')
      }
    },
    [canEdit, handleLocationPick],
  )

  const handleUseMyLocation = useCallback(async () => {
    if (!trackedLocation.useMyLocation) {
      return
    }
    try {
      setPinError('')
      await trackedLocation.useMyLocation()
      setFocusToken((value) => value + 1)
    } catch (err) {
      setPinError(err.message || 'Could not get your location')
    }
  }, [trackedLocation.useMyLocation])

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, height: '100%' }}>
      <PartnerLocationMap
        markers={markers}
        editable={canEdit}
        focusPoint={focusPoint}
        onLocationPick={canEdit ? handleLocationPick : undefined}
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
        <Paper
          elevation={0}
          sx={{
            px: 1.5,
            py: 1,
            bgcolor: 'rgba(255,255,255,0.94)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flex: '1 1 180px', minWidth: 160 }}>
            <PageHeader
              title="Location"
              subtitle={
                isSuperAdmin
                  ? `${liveCount} logged partner${liveCount === 1 ? '' : 's'} on the map`
                  : trackedLocation.location?.label ||
                    profile?.location?.label ||
                    'Search or pin your shop on the map'
              }
            />
          </Box>

          {canEdit ? (
            <>
              <LocationSearchBar onSelect={handleSearchSelect} disabled={trackedLocation.locating} />
              <Button
                variant="contained"
                size="small"
                startIcon={<MyLocationIcon />}
                onClick={handleUseMyLocation}
                disabled={trackedLocation.locating}
              >
                {trackedLocation.locating ? 'Locating…' : 'Use my location'}
              </Button>
            </>
          ) : null}
        </Paper>

        {canEdit ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Search uses Google Places + Address Validation for an accurate shop pin.
            You can still drag the pin to fine-tune.
            {markers.length === 0 ? ' Click the map once to drop a pin.' : ''}
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
