import express from 'express'
import cors from 'cors'
import './loadEnv.js'
import './firebaseAdmin.js'
import { router } from './routes/index.js'

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors({ origin: true }))
app.use(express.json())
app.use('/api', router)

app.use((error, _req, res, next) => {
  if (!error) {
    next()
    return
  }

  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
  res.status(status).json({ error: error.message || 'Request failed' })
})

app.listen(port, () => {
  console.log(`Printstack API running on http://127.0.0.1:${port}`)
})
