import { GOOGLE_MAPS_API_KEY } from './geo'

let mapsPromise

export function loadGoogleMaps() {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }

  if (mapsPromise) {
    return mapsPromise
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Google Maps API key is missing'))
  }

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps)
        return
      }
      reject(new Error('Google Maps failed to load'))
    }
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })

  return mapsPromise
}
