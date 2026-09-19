const multer = require('multer')
const { Router } = require('express')
const { health } = require('../controllers/healthController')
const { me } = require('../controllers/meController')
const {
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
} = require('../controllers/partnersController')
const {
  createStaff,
  deleteStaff,
  listStaffs,
  updateStaff,
} = require('../controllers/staffsController')
const {
  createPaperSize,
  deletePaperSize,
  listPaperSizes,
  resetPaperSizes,
  updatePaperSize,
} = require('../controllers/paperSizesController')
const { updateMyLocation } = require('../controllers/locationController')
const { locate, reverse, autocomplete, resolvePlace, route } = require('../controllers/geoController')
const {
  cancelCustomerReservation,
  createPrintJob,
  createCustomerPrintJob,
  listPrintJobs,
  updatePrintJob,
} = require('../controllers/printJobsController')
const { paymentsRouter } = require('./payments')
const { requireAdmin, requireAuth, requireSuperAdmin } = require('../middleware/auth')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Logo must be an image'))
      return
    }
    cb(null, true)
  },
})

const router = Router()

router.get('/health', health)
router.use('/payments', paymentsRouter)
router.get('/me', requireAuth, me)
router.patch('/me/location', requireAuth, requireAdmin, updateMyLocation)
router.post('/geo/locate', requireAuth, locate)
router.get('/geo/reverse', requireAuth, reverse)
router.get('/geo/autocomplete', requireAuth, autocomplete)
router.post('/geo/resolve-place', requireAuth, resolvePlace)
router.get('/geo/route', requireAuth, route)
router.get('/partners', requireAuth, listPartners)
router.post(
  '/partners',
  requireAuth,
  requireSuperAdmin,
  upload.single('logo'),
  createPartner,
)
router.patch(
  '/partners/:id',
  requireAuth,
  requireSuperAdmin,
  upload.single('logo'),
  updatePartner,
)
router.delete('/partners/:id', requireAuth, requireSuperAdmin, deletePartner)
router.post(
  '/partners/:partnerId/print-jobs',
  requireAuth,
  createCustomerPrintJob,
)
router.post(
  '/partners/:partnerId/print-jobs/:id/cancel',
  requireAuth,
  cancelCustomerReservation,
)
router.get('/staffs', requireAuth, requireAdmin, listStaffs)
router.post('/staffs', requireAuth, requireAdmin, createStaff)
router.patch('/staffs/:id', requireAuth, requireAdmin, updateStaff)
router.delete('/staffs/:id', requireAuth, requireAdmin, deleteStaff)
router.get('/paper-sizes', requireAuth, requireAdmin, listPaperSizes)
router.post('/paper-sizes/reset', requireAuth, requireAdmin, resetPaperSizes)
router.post('/paper-sizes', requireAuth, requireAdmin, createPaperSize)
router.patch('/paper-sizes/:id', requireAuth, requireAdmin, updatePaperSize)
router.delete('/paper-sizes/:id', requireAuth, requireAdmin, deletePaperSize)
router.get('/print-jobs', requireAuth, requireAdmin, listPrintJobs)
router.post('/print-jobs', requireAuth, requireAdmin, createPrintJob)
router.patch('/print-jobs/:id', requireAuth, requireAdmin, updatePrintJob)

module.exports = { router }
