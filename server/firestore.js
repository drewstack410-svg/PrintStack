import { getFirestore } from 'firebase-admin/firestore'
import firebaseApp from './firebaseAdmin.js'

export const db = getFirestore(firebaseApp)
