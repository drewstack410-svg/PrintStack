require('./loadEnv')
require('./firebaseAdmin')

const express = require('express')
const cors = require('cors')
const { router } = require('./routes')

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'printstack-api',
    message: 'PrintStack API is running',
  })
})

app.use('/api', router)

app.use((error, _req, res, next) => {
  if (!error) {
    next()
    return
  }

  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
  res.status(status).json({ error: error.message || 'Request failed' })
})

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Printstack API running on http://127.0.0.1:${port}`)
  })
}

module.exports = app
