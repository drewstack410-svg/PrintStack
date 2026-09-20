import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { parseFirestoreDate } from './partners'

function mapJob(doc, partnerId, partnerName) {
  const data = doc.data() || {}
  const documents = Array.isArray(data.documents) ? data.documents : []
  return {
    id: doc.id,
    partnerId,
    partnerName,
    orderNumber: String(data.orderNumber || doc.id.slice(0, 8)),
    status: String(data.status || 'queued'),
    documentCount: documents.length || Number(data.documentCount) || 1,
    totalPrice: Number(data.totalPrice) || 0,
    isReservation: data.isReservation === true || data.reservation === true,
    createdAt: parseFirestoreDate(data.createdAt),
    raw: data,
  }
}

export function useMyPrintJobs(limit = 40) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const uid = auth.currentUser?.uid || ''

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const jobsByPartner = new Map()
    const partnerNames = new Map()
    const jobUnsubs = new Map()

    function emit() {
      const all = [...jobsByPartner.values()].flat()
      all.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      setJobs(all.slice(0, limit))
      setLoading(false)
    }

    const partnersUnsub = onSnapshot(
      collection(db, 'partners'),
      (partnersSnap) => {
        const activeIds = new Set(partnersSnap.docs.map((doc) => doc.id))

        partnersSnap.docs.forEach((partnerDoc) => {
          const partnerId = partnerDoc.id
          partnerNames.set(partnerId, String(partnerDoc.data()?.companyName || ''))
          if (jobUnsubs.has(partnerId)) return

          const jobsQuery = query(
            collection(db, 'partners', partnerId, 'printJobs'),
            where('customerUid', '==', uid),
          )

          const unsub = onSnapshot(
            jobsQuery,
            (jobsSnap) => {
              jobsByPartner.set(
                partnerId,
                jobsSnap.docs.map((doc) =>
                  mapJob(doc, partnerId, partnerNames.get(partnerId) || ''),
                ),
              )
              setError('')
              emit()
            },
            (err) => {
              console.error('[printJobs]', err)
              setError(err.message || 'Could not load history.')
              setLoading(false)
            },
          )
          jobUnsubs.set(partnerId, unsub)
        })

        for (const partnerId of [...jobUnsubs.keys()]) {
          if (!activeIds.has(partnerId)) {
            jobUnsubs.get(partnerId)?.()
            jobUnsubs.delete(partnerId)
            jobsByPartner.delete(partnerId)
            partnerNames.delete(partnerId)
          }
        }
        emit()
      },
      (err) => {
        console.error('[printJobs partners]', err)
        setError(err.message || 'Could not load history.')
        setLoading(false)
      },
    )

    return () => {
      partnersUnsub()
      jobUnsubs.forEach((unsub) => unsub())
    }
  }, [limit, uid])

  return { jobs: uid ? jobs : [], loading: uid ? loading : false, error }
}
