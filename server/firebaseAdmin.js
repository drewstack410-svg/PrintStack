import { createRequire } from 'module'
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

let firebaseApp

try {
  firebaseApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id,
          storageBucket: process.env.STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
        })

  console.log(
    `[firebase-admin] ready project=${serviceAccount.project_id} account=${serviceAccount.client_email} app=${firebaseApp.name}`,
  )
} catch (error) {
  console.error('[firebase-admin] failed to initialize', error)
  throw error
}

export default firebaseApp
