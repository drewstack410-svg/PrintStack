export const DEFAULT_MAP_CENTER = {
  lat: 10.2976,
  lng: 123.8962,
}

export const DEFAULT_MAP_ZOOM = 16

/** Philippines overview used by customer Find shops (matches mobile). */
export const PHILIPPINES_MAP_CENTER = {
  lat: 12.8797,
  lng: 121.7740,
}

export const PHILIPPINES_MAP_ZOOM = 5.6

export const CLOUD_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '57a5e418958e3cb7bb8e1abd'

export const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c6675' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4e6d70' }],
  },
]
