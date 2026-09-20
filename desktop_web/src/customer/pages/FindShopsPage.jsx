import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike'
import DirectionsBusFilledIcon from '@mui/icons-material/DirectionsBusFilled'
import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { fetchRouteViaApi, locateViaApi } from '../../api'
import { useAuth } from '../../auth/AuthProvider'
import { loadGoogleMaps } from '../../lib/googleMaps'
import {
  CLOUD_MAP_ID,
  DARK_MAP_STYLES,
  PHILIPPINES_MAP_CENTER,
  PHILIPPINES_MAP_ZOOM,
} from '../../lib/mapDefaults'
import { brand } from '../../theme'
import { PartnerAvatar } from '../components'
import { usePartners } from '../usePartners'
import { ShopPricingDialog } from './ShopsPage'
import { SHOP_PIN, createShopLogoPin, createUserLocationPin } from '../shopLogoPin'

const TRAVEL_MODES = [
  { id: 'walk', label: 'Walk', Icon: DirectionsWalkIcon },
  { id: 'drive', label: 'Drive', Icon: DirectionsCarFilledIcon },
  { id: 'bicycle', label: 'Bike', Icon: DirectionsBikeIcon },
  { id: 'transit', label: 'Transit', Icon: DirectionsBusFilledIcon },
]

function haversineMeters(a, b) {
  if (!a || !b) return null
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function formatDistance(meters) {
  if (meters == null) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function etaLabel(route) {
  const traffic = String(route?.durationInTrafficText || '').trim()
  if (traffic) return traffic
  return String(route?.durationText || '').trim()
}

function trafficLabel(route) {
  const level = String(route?.trafficLevel || '').trim().toLowerCase()
  if (level === 'light') return 'Light traffic'
  if (level === 'moderate') return 'Moderate traffic'
  if (level === 'heavy') return 'Heavy traffic'
  return route?.hasTraffic ? 'Live traffic' : 'Route'
}

function routeChipText(route) {
  if (!route) return ''
  const distance = String(route.distanceText || '').trim()
  const eta = etaLabel(route)
  if (!distance && !eta) return ''
  return [distance, eta, trafficLabel(route)].filter(Boolean).join(' · ')
}

function isDarkMapEnabled() {
  try {
    return localStorage.getItem('printstack.mapDark') === '1'
  } catch {
    return false
  }
}

export default function FindShopsPage({
  onSearchFocusChanged,
  chromeVisible = true,
  onOpenShop,
  onContinueToCheckout,
}) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const { user } = useAuth()
  const { partners, loading, error } = usePartners()
  const mapNodeRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const ShopPinClassRef = useRef(null)
  const UserPinClassRef = useRef(null)
  const polylineRef = useRef(null)
  const trafficLayerRef = useRef(null)
  const didIntroFly = useRef(false)
  const routeRequestId = useRef(0)
  const carouselRef = useRef(null)

  const [mapsReady, setMapsReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [myLatLng, setMyLatLng] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [travelMode, setTravelMode] = useState('walk')
  const [activeRoute, setActiveRoute] = useState(null)
  const [pricingPartner, setPricingPartner] = useState(null)
  const [pageIndex, setPageIndex] = useState(0)

  const mappable = useMemo(() => {
    const withLoc = partners.filter(
      (p) => p.location && Number.isFinite(p.location.lat) && Number.isFinite(p.location.lng),
    )
    if (!myLatLng) return withLoc
    return [...withLoc].sort((a, b) => {
      const da = haversineMeters(myLatLng, a.location) ?? Number.POSITIVE_INFINITY
      const db = haversineMeters(myLatLng, b.location) ?? Number.POSITIVE_INFINITY
      return da - db
    })
  }, [partners, myLatLng])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return mappable
    return mappable.filter((partner) => {
      return (
        partner.companyName.toLowerCase().includes(q) ||
        partner.email.toLowerCase().includes(q) ||
        (partner.location?.label || '').toLowerCase().includes(q)
      )
    })
  }, [mappable, query])

  const selectedPartner = useMemo(() => {
    if (!mappable.length) return null
    return mappable.find((p) => p.id === selectedId) || mappable[0]
  }, [mappable, selectedId])

  const activeSelectedId = selectedPartner?.id || null

  useEffect(() => {
    onSearchFocusChanged?.(searchFocused)
    return () => onSearchFocusChanged?.(false)
  }, [searchFocused, onSearchFocusChanged])

  useEffect(() => {
    let cancelled = false
    async function resolveLocation() {
      try {
        if (navigator.geolocation) {
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (!cancelled) {
                  setMyLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                }
                resolve()
              },
              () => resolve(),
              { enableHighAccuracy: true, timeout: 10000 },
            )
          })
        }
      } catch {
        // fall through to API
      }

      if (cancelled) return
      if (!user) return
      try {
        const token = await user.getIdToken()
        const located = await locateViaApi(token)
        const lat = Number(located?.lat ?? located?.location?.lat)
        const lng = Number(located?.lng ?? located?.location?.lng)
        if (!cancelled && Number.isFinite(lat) && Number.isFinite(lng)) {
          setMyLatLng((prev) => prev || { lat, lng })
        }
      } catch (err) {
        console.warn('[find-shops] locate failed', err)
      }
    }
    resolveLocation()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    let cancelled = false
    async function initMap() {
      try {
        const maps = await loadGoogleMaps()
        if (cancelled || !mapNodeRef.current) return

        const dark = isDarkMapEnabled()
        const map = new maps.Map(mapNodeRef.current, {
          center: PHILIPPINES_MAP_CENTER,
          zoom: PHILIPPINES_MAP_ZOOM,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          ...(CLOUD_MAP_ID ? { mapId: CLOUD_MAP_ID } : {}),
          ...(!CLOUD_MAP_ID && dark ? { styles: DARK_MAP_STYLES } : {}),
          ...(dark && !CLOUD_MAP_ID ? {} : {}),
        })

        // Cloud map IDs ignore JSON styles; apply styles only when no mapId.
        if (!CLOUD_MAP_ID && dark) {
          map.setOptions({ styles: DARK_MAP_STYLES })
        } else if (dark && CLOUD_MAP_ID) {
          // Fallback dark JSON still helps when Map ID has no dark cloud style.
          try {
            map.setOptions({ styles: DARK_MAP_STYLES })
          } catch {
            // ignore
          }
        }

        map.addListener('click', () => setSearchFocused(false))

        // Live traffic overlay — matches mobile `trafficEnabled: true`.
        const trafficLayer = new maps.TrafficLayer()
        trafficLayer.setMap(map)
        trafficLayerRef.current = trafficLayer

        mapRef.current = map
        ShopPinClassRef.current = createShopLogoPin(maps)
        UserPinClassRef.current = createUserLocationPin(maps)
        setMapsReady(true)
        setMapError('')
      } catch (err) {
        console.error('[find-shops] map load failed', err)
        if (!cancelled) setMapError(err.message || 'Could not load Google Maps')
      }
    }
    initMap()
    return () => {
      cancelled = true
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      polylineRef.current?.setMap(null)
      polylineRef.current = null
      trafficLayerRef.current?.setMap(null)
      trafficLayerRef.current = null
      mapRef.current = null
      ShopPinClassRef.current = null
      UserPinClassRef.current = null
    }
  }, [])

  const flyTo = useCallback((target, zoom = 14.5) => {
    const map = mapRef.current
    if (!map || !target) return
    map.panTo(target)
    map.setZoom(zoom)
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapsReady || !map || !myLatLng || didIntroFly.current) return
    didIntroFly.current = true
    map.setCenter(PHILIPPINES_MAP_CENTER)
    map.setZoom(PHILIPPINES_MAP_ZOOM)
    const timer = window.setTimeout(() => {
      flyTo(myLatLng, 14.5)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [mapsReady, myLatLng, flyTo])

  useEffect(() => {
    const map = mapRef.current
    const UserPin = UserPinClassRef.current
    if (!mapsReady || !map || !UserPin) return

    if (!myLatLng) {
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      return undefined
    }

    if (!userMarkerRef.current) {
      const pin = new UserPin({ position: myLatLng })
      pin.setMap(map)
      userMarkerRef.current = pin
    } else {
      userMarkerRef.current.setPosition(myLatLng)
    }

    return undefined
  }, [mapsReady, myLatLng])

  useEffect(() => {
    const map = mapRef.current
    const ShopPin = ShopPinClassRef.current
    if (!mapsReady || !map || !ShopPin) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = mappable.map((partner) => {
      const pin = new ShopPin({
        position: { lat: partner.location.lat, lng: partner.location.lng },
        partner,
        selected: partner.id === activeSelectedId,
        onClick: (shop) => {
          setSelectedId(shop.id)
          const index = mappable.findIndex((p) => p.id === shop.id)
          if (index >= 0) {
            setPageIndex(index)
            scrollCarouselTo(index)
          }
        },
      })
      pin.setMap(map)
      return pin
    })

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [mapsReady, mappable, activeSelectedId])

  const loadRoute = useCallback(
    async (partner) => {
      const map = mapRef.current
      const maps = window.google?.maps
      if (!map || !maps || !partner?.location || !myLatLng || !user) {
        setActiveRoute(null)
        polylineRef.current?.setMap(null)
        polylineRef.current = null
        return
      }

      const requestId = ++routeRequestId.current
      try {
        const token = await user.getIdToken()
        const payload = await fetchRouteViaApi(token, {
          fromLat: myLatLng.lat,
          fromLng: myLatLng.lng,
          toLat: partner.location.lat,
          toLng: partner.location.lng,
          mode: travelMode,
        })
        if (requestId !== routeRequestId.current) return
        const route = payload?.route || payload
        const points = Array.isArray(route?.points)
          ? route.points
              .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
              .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          : []

        setActiveRoute(route || null)
        polylineRef.current?.setMap(null)
        if (points.length >= 2) {
          polylineRef.current = new maps.Polyline({
            path: points,
            geodesic: false,
            strokeColor: SHOP_PIN.route,
            strokeOpacity: 0.95,
            strokeWeight: SHOP_PIN.routeWidth,
            map,
          })
          const bounds = new maps.LatLngBounds()
          points.forEach((p) => bounds.extend(p))
          bounds.extend(myLatLng)
          map.fitBounds(bounds, 72)
        } else {
          polylineRef.current = null
          flyTo({ lat: partner.location.lat, lng: partner.location.lng })
        }
      } catch (err) {
        console.warn('[find-shops] route failed', err)
        if (requestId === routeRequestId.current) {
          setActiveRoute(null)
          polylineRef.current?.setMap(null)
          polylineRef.current = null
          flyTo({ lat: partner.location.lat, lng: partner.location.lng })
        }
      }
    },
    [flyTo, myLatLng, travelMode, user],
  )

  useEffect(() => {
    if (!selectedPartner) return undefined
    const timer = window.setTimeout(() => {
      void loadRoute(selectedPartner)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedPartner, loadRoute])

  function scrollCarouselTo(index) {
    const node = carouselRef.current
    if (!node) return
    const card = node.children[index]
    if (!card) return
    const left = card.offsetLeft - (node.clientWidth - card.clientWidth) / 2
    node.scrollTo({ left, behavior: 'smooth' })
  }

  function selectPartner(partner, { openPricing = false } = {}) {
    if (!partner) return
    setSelectedId(partner.id)
    setSearchFocused(false)
    setQuery('')
    const index = mappable.findIndex((p) => p.id === partner.id)
    if (index >= 0) {
      setPageIndex(index)
      scrollCarouselTo(index)
    }
    if (openPricing) {
      if (!isDesktop && onOpenShop) {
        onOpenShop(partner)
        return
      }
      setPricingPartner(partner)
    }
  }

  async function goToMyLocation() {
    if (myLatLng) {
      flyTo(myLatLng, 14.5)
      return
    }
    if (!user) return
    try {
      const token = await user.getIdToken()
      const located = await locateViaApi(token)
      const lat = Number(located?.lat ?? located?.location?.lat)
      const lng = Number(located?.lng ?? located?.location?.lng)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const next = { lat, lng }
        setMyLatLng(next)
        flyTo(next, 14.5)
      }
    } catch (err) {
      console.warn('[find-shops] my location failed', err)
    }
  }

  const routeChip = routeChipText(activeRoute)

  useEffect(() => {
    const map = mapRef.current
    const maps = window.google?.maps
    if (!map || !maps) return
    const timer = window.setTimeout(() => {
      maps.event.trigger(map, 'resize')
    }, 50)
    return () => window.clearTimeout(timer)
  }, [chromeVisible, mapsReady])

  const dockClearance = chromeVisible ? 88 : 12

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Box ref={mapNodeRef} sx={{ position: 'absolute', inset: 0 }} />

      {(loading && !mapsReady) || (!mapsReady && !mapError) ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(244,247,252,0.55)',
            zIndex: 2,
          }}
        >
          <CircularProgress />
        </Box>
      ) : null}

      {mapError || error ? (
        <Box
          sx={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 72,
            zIndex: 3,
            p: 1.5,
            bgcolor: '#FFEBEE',
            borderRadius: 1.5,
            color: '#B71C1C',
            fontWeight: 600,
          }}
        >
          {mapError || error}
        </Box>
      ) : null}

      {!loading && mapsReady && mappable.length === 0 ? (
        <Box
          sx={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: 72,
            zIndex: 3,
            p: 2,
            bgcolor: '#fff',
            borderRadius: 1.5,
            boxShadow: 3,
          }}
        >
          <Typography sx={{ fontWeight: 800, color: brand.navy }}>No shops on the map</Typography>
          <Typography sx={{ color: brand.muted, mt: 0.5 }}>
            Shops with a valid location will appear here.
          </Typography>
        </Box>
      ) : null}

      {/* Search + chips */}
      <Box sx={{ position: 'absolute', left: 12, right: 12, top: 10, zIndex: 4 }}>
        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 1.5,
            boxShadow: 3,
            overflow: 'hidden',
          }}
        >
          <TextField
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={searchFocused ? 'Nearby shops' : 'Search shops…'}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuery('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .MuiInputBase-input': { py: 1.4, fontWeight: 600 },
            }}
          />
        </Box>

        {searchFocused ? (
          <Box
            sx={{
              mt: 0.75,
              bgcolor: '#fff',
              borderRadius: 1.5,
              boxShadow: 3,
              maxHeight: '45vh',
              overflow: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <Typography sx={{ px: 1.75, py: 1.75, color: brand.muted, fontWeight: 600, fontSize: 13 }}>
                {query.trim() ? 'No shops match that search.' : 'No shops with map locations.'}
              </Typography>
            ) : (
              filtered.map((partner, index) => {
                const distance = haversineMeters(myLatLng, partner.location)
                const meta = [
                  partner.location?.label,
                  distance != null ? formatDistance(distance) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <Box
                    key={partner.id}
                    component="button"
                    type="button"
                    onClick={() => selectPartner(partner)}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 1,
                      border: 0,
                      borderBottom:
                        index === filtered.length - 1 ? 0 : '1px solid rgba(0,0,0,0.06)',
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      '&:hover': { bgcolor: 'rgba(124,92,255,0.06)' },
                    }}
                  >
                    <PartnerAvatar url={partner.logoUrl} name={partner.companyName} size={34} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontWeight: 800, fontSize: 13.5, color: brand.navy }}>
                        {partner.companyName || 'Shop'}
                      </Typography>
                      {meta ? (
                        <Typography noWrap sx={{ color: brand.muted, fontSize: 11.5 }}>
                          {meta}
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        ) : (
          <Box sx={{ mt: 0.75, display: 'flex', justifyContent: 'flex-end' }}>
            {routeChip ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  maxWidth: '100%',
                  bgcolor: '#fff',
                  borderRadius: 1.5,
                  pl: 1.5,
                  pr: 0.5,
                  py: 0.5,
                  boxShadow: 2,
                  fontWeight: 700,
                  fontSize: 12.5,
                  color: brand.navy,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: SHOP_PIN.route,
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {routeChip}
                </Box>
                <IconButton size="small" onClick={goToMyLocation} aria-label="My location">
                  <MyLocationIcon fontSize="small" sx={{ color: brand.purpleDark }} />
                </IconButton>
              </Box>
            ) : (
              <IconButton
                onClick={goToMyLocation}
                aria-label="My location"
                sx={{ bgcolor: '#fff', boxShadow: 2, '&:hover': { bgcolor: '#fff' } }}
              >
                <MyLocationIcon sx={{ color: brand.purpleDark }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>

      {!searchFocused ? (
        <>
          <Box
            sx={{
              position: 'absolute',
              right: 12,
              bottom: mappable.length ? dockClearance + 160 : dockClearance + 46,
              zIndex: 4,
              bgcolor: '#fff',
              borderRadius: 1.5,
              boxShadow: 3,
              p: 0.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
            }}
          >
            {TRAVEL_MODES.map(({ id, label, Icon }) => {
              const selected = travelMode === id
              return (
                <IconButton
                  key={id}
                  title={label}
                  onClick={() => setTravelMode(id)}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.25,
                    bgcolor: selected ? 'rgba(124,92,255,0.14)' : 'transparent',
                    color: selected ? brand.purple : brand.muted,
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              )
            })}
          </Box>

          <Box
            sx={{
              position: 'absolute',
              right: 12,
              bottom: mappable.length ? dockClearance + 114 : dockClearance,
              zIndex: 4,
              bgcolor: '#fff',
              borderRadius: 1.25,
              boxShadow: 2,
              px: 1.25,
              py: 0.9,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <LegendDot color={SHOP_PIN.legendOnline} label="Online" />
            <LegendDot color={SHOP_PIN.legendOffline} label="Offline" />
          </Box>
        </>
      ) : null}

      {!searchFocused && mappable.length > 0 ? (
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: dockClearance, zIndex: 4 }}>
          <Box
            ref={carouselRef}
            onScroll={(e) => {
              const node = e.currentTarget
              const cards = [...node.children]
              if (!cards.length) return
              const center = node.scrollLeft + node.clientWidth / 2
              let best = 0
              let bestDist = Number.POSITIVE_INFINITY
              cards.forEach((card, index) => {
                const cardCenter = card.offsetLeft + card.clientWidth / 2
                const dist = Math.abs(cardCenter - center)
                if (dist < bestDist) {
                  bestDist = dist
                  best = index
                }
              })
                if (best !== pageIndex) {
                setPageIndex(best)
                const partner = mappable[best]
                if (partner && partner.id !== activeSelectedId) {
                  setSelectedId(partner.id)
                }
              }
            }}
            sx={{
              display: 'flex',
              gap: { xs: 0.75, md: 1.25 },
              overflowX: 'auto',
              px: { xs: '36%', md: '42%' },
              pb: 0.5,
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {mappable.map((partner) => {
              const selected = partner.id === activeSelectedId
              const online = partner.location?.online === true
              const distance = haversineMeters(myLatLng, partner.location)
              const meta = [
                selected ? etaLabel(activeRoute) : '',
                selected && activeRoute?.distanceText
                  ? activeRoute.distanceText
                  : formatDistance(distance) || partner.location?.label || 'Nearby',
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <Box
                  key={partner.id}
                  component="button"
                  type="button"
                  onClick={() => selectPartner(partner, { openPricing: selected })}
                  sx={{
                    flex: '0 0 auto',
                    width: { xs: 96, md: 132 },
                    height: { xs: 96, md: 132 },
                    aspectRatio: '1 / 1',
                    scrollSnapAlign: 'center',
                    border: selected
                      ? '1.2px solid rgba(124,92,255,0.55)'
                      : '1.2px solid rgba(0,0,0,0.06)',
                    borderRadius: { xs: 1.25, md: 1 },
                    bgcolor: '#fff',
                    boxShadow: selected
                      ? '0 10px 24px rgba(0,0,0,0.22)'
                      : '0 4px 12px rgba(0,0,0,0.12)',
                    transform: selected ? 'scale(1)' : 'scale(0.9)',
                    opacity: selected ? 1 : 0.72,
                    transition: 'transform 220ms ease, opacity 220ms ease, box-shadow 220ms ease',
                    cursor: 'pointer',
                    p: { xs: 1, md: 1.25 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    fontFamily: 'inherit',
                    ...(online
                      ? { boxShadow: selected
                          ? '0 10px 24px rgba(34,197,94,0.35)'
                          : '0 4px 12px rgba(34,197,94,0.28)' }
                      : {}),
                  }}
                >
                  <Box sx={{ position: 'relative', width: { xs: 30, md: 40 }, height: { xs: 30, md: 40 } }}>
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      <PartnerAvatar url={partner.logoUrl} name={partner.companyName} size={30} />
                    </Box>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <PartnerAvatar url={partner.logoUrl} name={partner.companyName} size={34} />
                    </Box>
                    {online ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          right: -2,
                          top: -2,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: '#22C55E',
                          border: '2px solid #fff',
                        }}
                      />
                    ) : null}
                  </Box>
                  <Typography
                    noWrap
                    sx={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      color: brand.navy,
                    }}
                  >
                    {partner.companyName || 'Untitled'}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: 9,
                      color: brand.muted,
                      lineHeight: 1.15,
                    }}
                  >
                    {meta}
                  </Typography>
                </Box>
              )
            })}
          </Box>
          <Typography
            sx={{
              mt: 1,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 700,
              fontSize: 11,
              textShadow: '0 1px 6px rgba(0,0,0,0.55)',
            }}
          >
            Nearby · {pageIndex + 1} / {mappable.length}
          </Typography>
        </Box>
      ) : null}

      {isDesktop ? (
        <ShopPricingDialog
          partner={pricingPartner}
          onClose={() => setPricingPartner(null)}
          onContinueToCheckout={(docs) => {
            const partner = pricingPartner
            setPricingPartner(null)
            onContinueToCheckout?.(partner, docs)
          }}
        />
      ) : null}
    </Box>
  )
}

function LegendDot({ color, label }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Box component="span">{label}</Box>
    </Box>
  )
}
