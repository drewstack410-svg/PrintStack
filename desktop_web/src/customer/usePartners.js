import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { mapPartner, sortPartners } from './partners'

export function usePartners() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'partners'),
      (snapshot) => {
        const next = sortPartners(snapshot.docs.map((doc) => mapPartner(doc.id, doc.data())))
        setPartners(next)
        setError('')
        setLoading(false)
      },
      (err) => {
        console.error('[partners]', err)
        setError(err.message || 'Could not load shops.')
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  return { partners, loading, error }
}
