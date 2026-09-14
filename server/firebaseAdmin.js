import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'

function loadServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (fromEnv) {
    const parsed = JSON.parse(fromEnv)
    if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    }
    return parsed
  }

  const keyPath = resolve(dirname(fileURLToPath(import.meta.url)), 'serviceAccountKey.json')
  if (existsSync(keyPath)) {
    return JSON.parse(readFileSync(keyPath, 'utf8'))
  }

  throw new Error(
    'Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON on Vercel, or add serviceAccountKey.json for local development.',
  )
}

const serviceAccount = loadServiceAccount()

let firebaseApp

try {
  firebaseApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id,
          storageBucket:
            process.env.STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
        })

  console.log(
    `[firebase-admin] ready project=${serviceAccount.project_id} account=${serviceAccount.client_email} app=${firebaseApp.name}`,
  )
} catch (error) {
  console.error('[firebase-admin] failed to initialize', error)
  throw error
}

export default firebaseApp
