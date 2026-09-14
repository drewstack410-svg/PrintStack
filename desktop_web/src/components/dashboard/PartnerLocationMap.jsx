import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../lib/mapDefaults'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function popupHtml(item) {
  const name = escapeHtml(item.name || 'Partner')
  const label = escapeHtml(item.label || 'Partner location')
  const status = item.online ? 'Online now' : 'Last known location'
  const logo = item.logoUrl
    ? `<img src="${escapeHtml(item.logoUrl)}" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:8px;background:#f4f7fc;margin-bottom:6px" />`
    : ''
  return `<div style="font:13px Roboto,sans-serif;min-width:140px">${logo}<strong>${name}</strong><br/>${label}<br/>${status}</div>`
}

function initial(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?'
}

function createLogoPinOverlay(maps) {
  return class LogoPin extends maps.OverlayView {
    constructor({ position, item, onClick }) {
      super()
      this.position = position
      this.item = item
      this.onClick = onClick
      this.el = null
    }

    onAdd() {
      const wrap = document.createElement('button')
      wrap.type = 'button'
      wrap.className = `ps-logo-pin${this.item.online ? ' is-online' : ''}`
      wrap.title = this.item.name || 'Partner'
      wrap.setAttribute('aria-label', this.item.name || 'Partner')

      const face = document.createElement('span')
      face.className = 'ps-logo-pin-face'

      if (this.item.logoUrl) {
        const img = document.createElement('img')
        img.src = this.item.logoUrl
        img.alt = ''
        img.referrerPolicy = 'no-referrer'
        img.addEventListener('error', () => {
          img.remove()
          const letter = document.createElement('span')
          letter.className = 'ps-logo-pin-initial'
          letter.textContent = initial(this.item.name)
          face.appendChild(letter)
        })
        face.appendChild(img)
      } else {
        const letter = document.createElement('span')
        letter.className = 'ps-logo-pin-initial'
        letter.textContent = initial(this.item.name)
        face.appendChild(letter)
      }

      const tail = document.createElement('span')
      tail.className = 'ps-logo-pin-tail'

      wrap.append(face, tail)
      wrap.addEventListener('click', (event) => {
        event.stopPropagation()
        this.onClick?.(this)
      })

      this.el = wrap
      this.getPanes().overlayMouseTarget.appendChild(wrap)
    }

    draw() {
      const projection = this.getProjection()
      if (!projection || !this.el) {
        return
      }

      const point = projection.fromLatLngToDivPixel(this.position)
      if (!point) {
        return
      }

      this.el.style.left = `${point.x}px`
      this.el.style.top = `${point.y}px`
    }

    onRemove() {
      this.el?.remove()
      this.el = null
    }
  }
}

export default function PartnerLocationMap({ markers = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const infoRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      const maps = await loadGoogleMaps()
      if (cancelled || !containerRef.current) {
        return
      }

      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: false,
          clickableIcons: true,
        })
      }

      const map = mapRef.current
      const LogoPin = createLogoPinOverlay(maps)
      const info = infoRef.current || new maps.InfoWindow()
      infoRef.current = info

      overlaysRef.current.forEach((marker) => marker.setMap(null))
      overlaysRef.current = []

      const points = markers.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      const bounds = new maps.LatLngBounds()

      points.forEach((item) => {
        const position = new maps.LatLng(item.lat, item.lng)
        const pin = new LogoPin({
          position,
          item,
          onClick: () => {
            info.setContent(popupHtml(item))
            info.setPosition(position)
            info.open({ map })
          },
        })
        pin.setMap(map)
        overlaysRef.current.push(pin)
        bounds.extend(position)
      })

      if (points.length === 1) {
        map.setCenter({ lat: points[0].lat, lng: points[0].lng })
        map.setZoom(DEFAULT_MAP_ZOOM)
      } else if (points.length > 1) {
        map.fitBounds(bounds, 48)
      } else {
        map.setCenter(DEFAULT_MAP_CENTER)
        map.setZoom(DEFAULT_MAP_ZOOM)
      }
    }

    render().catch((error) => {
      console.error('[map] Google Maps failed', error)
    })

    return () => {
      cancelled = true
    }
  }, [markers])

  return (
    <div
      ref={containerRef}
      className="ps-partner-map"
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
    />
  )
}
