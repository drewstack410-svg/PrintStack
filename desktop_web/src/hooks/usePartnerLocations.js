import { useCallback, useEffect, useState } from 'react'
import { listPartners } from '../api'

export function usePartnerLocations({ user, enabled }) {
  const [partners, setPartners] = useState([])

  const loadPartners = useCallback(async () => {
    if (!user || !enabled) {
      return
    }

    try {
      const token = await user.getIdToken()
      const payload = await listPartners(token)
      setPartners(payload.partners || [])
    } catch {
      setPartners([])
    }
  }, [enabled, user])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    loadPartners()
    const timer = window.setInterval(loadPartners, 20_000)
    return () => window.clearInterval(timer)
  }, [enabled, loadPartners])

  return partners
}
