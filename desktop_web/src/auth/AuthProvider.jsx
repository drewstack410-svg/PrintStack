import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { fetchMe } from '../api'
import { ADMIN_ROLE, CUSTOMER_ROLE, mapUserDoc, SUPERADMIN_ROLE } from '../users'
import { ensureCustomerProfile } from './ensureCustomerProfile'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()

async function loadProfile(currentUser) {
  try {
    const token = await currentUser.getIdToken(true)
    return await fetchMe(token)
  } catch (error) {
    console.warn('[auth] API session check failed, using Firestore', error)
    const snap = await getDoc(doc(db, 'users', currentUser.uid))
    return mapUserDoc(currentUser.uid, snap.exists() ? snap.data() : {}, currentUser.email)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const session = await loadProfile(currentUser)
        setUser(currentUser)
        setProfile(session)
      } catch (error) {
        console.error('[auth] profile load failed', error)
        setUser(currentUser)
        setProfile(mapUserDoc(currentUser.uid, {}, currentUser.email))
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isSuperAdmin: profile?.role === SUPERADMIN_ROLE,
      isAdmin: profile?.role === ADMIN_ROLE,
      isCustomer: profile?.role === CUSTOMER_ROLE,
      signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
      signUp: async ({ firstName, lastName, email, password }) => {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        const displayName = [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(' ')
        if (displayName) {
          await updateProfile(credential.user, { displayName })
        }
        await ensureCustomerProfile(credential.user, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        })
        return credential
      },
      signInWithGoogle: async () => {
        const credential = await signInWithPopup(auth, googleProvider)
        await ensureCustomerProfile(credential.user)
        return credential
      },
      signOut: () => signOut(auth),
    }),
    [user, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
