/** Mobile-matching shop map pin colors (PrintStack brand). */
export const SHOP_PIN = {
  cyan: '#22D3EE',
  blue: '#4F7CFF',
  purple: '#7C5CFF',
  purpleDark: '#3D1FA8',
  onlineBadge: '#2E7D32',
  offlineRing: '#616161',
  offlineFill: '#757575',
  offlineBadge: '#9E9E9E',
  offlineTip: '#424242',
  /** Route polyline — AppColors.purple on mobile */
  route: '#7C5CFF',
  routeWidth: 6,
  /** Legend dots on mobile print page */
  legendOnline: '#7C3AED',
  legendOffline: '#616161',
}

function initial(name) {
  return String(name || 'P').trim().slice(0, 1).toUpperCase() || 'P'
}

/**
 * Overlay pin with shop logo — mirrors mobile PartnerMapMarkers.
 */
export function createShopLogoPin(maps) {
  return class ShopLogoPin extends maps.OverlayView {
    constructor({ position, partner, selected, onClick }) {
      super()
      this.position = position
      this.partner = partner
      this.selected = Boolean(selected)
      this.onClick = onClick
      this.el = null
    }

    onAdd() {
      const online = this.partner?.location?.online === true
      const name = this.partner?.companyName || 'Shop'
      const logoUrl = this.partner?.logoUrl || ''

      const wrap = document.createElement('button')
      wrap.type = 'button'
      wrap.className = [
        'ps-shop-pin',
        online ? 'is-online' : 'is-offline',
        this.selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')
      wrap.title = name
      wrap.setAttribute('aria-label', name)

      const face = document.createElement('span')
      face.className = 'ps-shop-pin-face'

      if (logoUrl) {
        const img = document.createElement('img')
        img.src = logoUrl
        img.alt = ''
        img.draggable = false
        img.referrerPolicy = 'no-referrer'
        img.addEventListener('error', () => {
          img.remove()
          const letter = document.createElement('span')
          letter.className = 'ps-shop-pin-initial'
          letter.textContent = initial(name)
          face.appendChild(letter)
        })
        face.appendChild(img)
      } else {
        const letter = document.createElement('span')
        letter.className = 'ps-shop-pin-initial'
        letter.textContent = initial(name)
        face.appendChild(letter)
      }

      const badge = document.createElement('span')
      badge.className = 'ps-shop-pin-badge'
      badge.setAttribute('aria-hidden', 'true')

      const tip = document.createElement('span')
      tip.className = 'ps-shop-pin-tip'
      tip.setAttribute('aria-hidden', 'true')

      wrap.append(face, badge, tip)
      wrap.addEventListener('click', (event) => {
        event.stopPropagation()
        this.onClick?.(this.partner)
      })

      this.el = wrap
      this.getPanes().overlayMouseTarget.appendChild(wrap)
    }

    draw() {
      const projection = this.getProjection()
      if (!projection || !this.el || !this.position) return
      const point = projection.fromLatLngToDivPixel(
        new maps.LatLng(this.position.lat, this.position.lng),
      )
      if (!point) return
      this.el.style.left = `${point.x}px`
      this.el.style.top = `${point.y}px`
      this.el.style.zIndex = this.selected ? '20' : this.partner?.location?.online ? '5' : '2'
    }

    onRemove() {
      this.el?.remove()
      this.el = null
    }

    setSelected(selected) {
      this.selected = Boolean(selected)
      this.el?.classList.toggle('is-selected', this.selected)
      this.draw()
    }
  }
}

/**
 * Blue my-location marker — mirrors mobile GoogleMap `myLocationEnabled` dot.
 */
export function createUserLocationPin(maps) {
  return class UserLocationPin extends maps.OverlayView {
    constructor({ position }) {
      super()
      this.position = position
      this.el = null
    }

    onAdd() {
      const wrap = document.createElement('div')
      wrap.className = 'ps-user-loc'
      wrap.setAttribute('aria-label', 'Your location')

      const pulse = document.createElement('span')
      pulse.className = 'ps-user-loc-pulse'
      pulse.setAttribute('aria-hidden', 'true')

      const dot = document.createElement('span')
      dot.className = 'ps-user-loc-dot'
      dot.setAttribute('aria-hidden', 'true')

      wrap.append(pulse, dot)
      this.el = wrap
      this.getPanes().overlayMouseTarget.appendChild(wrap)
    }

    draw() {
      const projection = this.getProjection()
      if (!projection || !this.el || !this.position) return
      const point = projection.fromLatLngToDivPixel(
        new maps.LatLng(this.position.lat, this.position.lng),
      )
      if (!point) return
      this.el.style.left = `${point.x}px`
      this.el.style.top = `${point.y}px`
    }

    onRemove() {
      this.el?.remove()
      this.el = null
    }

    setPosition(position) {
      this.position = position
      this.draw()
    }
  }
}
