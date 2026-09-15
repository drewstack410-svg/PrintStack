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
    constructor({ position, item, draggable, onClick, onDragEnd }) {
      super()
      this.position = position
      this.item = item
      this.draggable = Boolean(draggable)
      this.onClick = onClick
      this.onDragEnd = onDragEnd
      this.el = null
      this.shadow = null
      this.dragging = false
      this._onPointerDown = this._onPointerDown.bind(this)
      this._onPointerMove = this._onPointerMove.bind(this)
      this._onPointerUp = this._onPointerUp.bind(this)
    }

    onAdd() {
      const wrap = document.createElement('button')
      wrap.type = 'button'
      wrap.className = `ps-logo-pin${this.item.online ? ' is-online' : ''}${this.draggable ? ' is-draggable' : ''}`
      wrap.title = this.draggable
        ? `${this.item.name || 'Partner'} — drag to adjust`
        : this.item.name || 'Partner'
      wrap.setAttribute('aria-label', this.item.name || 'Partner')

      const face = document.createElement('span')
      face.className = 'ps-logo-pin-face'

      if (this.item.logoUrl) {
        const img = document.createElement('img')
        img.src = this.item.logoUrl
        img.alt = ''
        img.draggable = false
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
        if (this.dragging) {
          return
        }
        this.onClick?.(this)
      })

      if (this.draggable) {
        wrap.addEventListener('pointerdown', this._onPointerDown)
      }

      const shadow = document.createElement('span')
      shadow.className = 'ps-logo-pin-shadow'
      shadow.setAttribute('aria-hidden', 'true')

      this.el = wrap
      this.shadow = shadow
      const pane = this.getPanes().overlayMouseTarget
      pane.appendChild(shadow)
      pane.appendChild(wrap)
    }

    _onPointerDown(event) {
      if (!this.draggable || event.button !== 0) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      this.dragging = true
      this.moved = false
      this.el?.classList.remove('is-drop')
      this.el?.classList.add('is-dragging')
      this.shadow?.classList.add('is-dragging')
      this.el?.setPointerCapture?.(event.pointerId)

      const map = this.getMap()
      if (map) {
        map.setOptions({ draggable: false, gestureHandling: 'none' })
      }

      window.addEventListener('pointermove', this._onPointerMove)
      window.addEventListener('pointerup', this._onPointerUp)
      window.addEventListener('pointercancel', this._onPointerUp)
    }

    _onPointerMove(event) {
      if (!this.dragging) {
        return
      }
      const projection = this.getProjection()
      const map = this.getMap()
      if (!projection || !map || !this.el) {
        return
      }

      const bounds = this.el.getBoundingClientRect()
      const mapDiv = map.getDiv().getBoundingClientRect()
      const x = event.clientX - mapDiv.left
      const y = event.clientY - mapDiv.top
      const latLng = projection.fromContainerPixelToLatLng(new maps.Point(x, y + bounds.height * 0.35))
      if (!latLng) {
        return
      }

      this.moved = true
      this.position = latLng
      this.draw()
    }

    _onPointerUp() {
      if (!this.dragging) {
        return
      }

      window.removeEventListener('pointermove', this._onPointerMove)
      window.removeEventListener('pointerup', this._onPointerUp)
      window.removeEventListener('pointercancel', this._onPointerUp)

      const map = this.getMap()
      if (map) {
        map.setOptions({ draggable: true, gestureHandling: 'auto' })
      }

      this.el?.classList.remove('is-dragging')
      this.shadow?.classList.remove('is-dragging')
      if (this.moved) {
        this.el?.classList.add('is-drop')
        window.setTimeout(() => {
          this.el?.classList.remove('is-drop')
        }, 420)
      }

      const moved = this.moved
      const lat = this.position?.lat?.() ?? this.position?.lat
      const lng = this.position?.lng?.() ?? this.position?.lng

      // Keep click from firing after a drag.
      window.setTimeout(() => {
        this.dragging = false
        this.moved = false
      }, 0)

      if (moved && Number.isFinite(lat) && Number.isFinite(lng)) {
        this.onDragEnd?.({ lat, lng })
      }
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
      if (this.shadow) {
        this.shadow.style.left = `${point.x}px`
        this.shadow.style.top = `${point.y}px`
      }
    }

    onRemove() {
      window.removeEventListener('pointermove', this._onPointerMove)
      window.removeEventListener('pointerup', this._onPointerUp)
      window.removeEventListener('pointercancel', this._onPointerUp)
      this.el?.remove()
      this.shadow?.remove()
      this.el = null
      this.shadow = null
    }
  }
}

export default function PartnerLocationMap({
  markers = [],
  editable = false,
  focusPoint = null,
  onLocationPick,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const infoRef = useRef(null)
  const clickListenerRef = useRef(null)
  const onPickRef = useRef(onLocationPick)
  const fittedKeyRef = useRef('')
  const focusTokenRef = useRef(null)

  useEffect(() => {
    onPickRef.current = onLocationPick
  }, [onLocationPick])

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

      if (clickListenerRef.current) {
        maps.event.removeListener(clickListenerRef.current)
        clickListenerRef.current = null
      }

      overlaysRef.current.forEach((marker) => marker.setMap(null))
      overlaysRef.current = []

      const points = markers.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      const bounds = new maps.LatLngBounds()

      // No pin yet — click the map once to drop one.
      if (editable && points.length === 0) {
        clickListenerRef.current = map.addListener('click', (event) => {
          if (!event?.latLng) {
            return
          }
          onPickRef.current?.({ lat: event.latLng.lat(), lng: event.latLng.lng() })
        })
        map.setOptions({ draggableCursor: 'crosshair' })
      } else {
        map.setOptions({ draggableCursor: null })
      }

      points.forEach((item) => {
        const position = new maps.LatLng(item.lat, item.lng)
        const pin = new LogoPin({
          position,
          item,
          draggable: editable && points.length === 1,
          onClick: () => {
            info.setContent(popupHtml(item))
            info.setPosition(pin.position)
            info.open({ map })
          },
          onDragEnd: ({ lat, lng }) => {
            onPickRef.current?.({ lat, lng })
          },
        })
        pin.setMap(map)
        overlaysRef.current.push(pin)
        bounds.extend(position)
      })

      const focusToken = focusPoint?.token
      const shouldFocus =
        focusPoint &&
        Number.isFinite(focusPoint.lat) &&
        Number.isFinite(focusPoint.lng) &&
        focusToken != null &&
        focusToken !== focusTokenRef.current

      if (shouldFocus) {
        focusTokenRef.current = focusToken
        fittedKeyRef.current = `${focusPoint.lat.toFixed(5)}:${focusPoint.lng.toFixed(5)}`
        map.panTo({ lat: focusPoint.lat, lng: focusPoint.lng })
        if (map.getZoom() < DEFAULT_MAP_ZOOM - 1) {
          map.setZoom(DEFAULT_MAP_ZOOM)
        }
        return
      }

      const fitKey = points.map((item) => `${item.id}:${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`).join('|')
      if (fitKey !== fittedKeyRef.current) {
        fittedKeyRef.current = fitKey
        if (points.length === 1) {
          map.panTo({ lat: points[0].lat, lng: points[0].lng })
          if (map.getZoom() < DEFAULT_MAP_ZOOM - 1) {
            map.setZoom(DEFAULT_MAP_ZOOM)
          }
        } else if (points.length > 1) {
          map.fitBounds(bounds, 48)
        } else {
          map.setCenter(DEFAULT_MAP_CENTER)
          map.setZoom(DEFAULT_MAP_ZOOM)
        }
      }
    }

    render().catch((error) => {
      console.error('[map] Google Maps failed', error)
    })

    return () => {
      cancelled = true
    }
  }, [markers, editable, focusPoint])

  return (
    <div
      ref={containerRef}
      className="ps-partner-map"
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
    />
  )
}
