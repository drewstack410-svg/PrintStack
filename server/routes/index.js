import multer from 'multer'
import { Router } from 'express'
import { health } from '../controllers/healthController.js'
import { me } from '../controllers/meController.js'
import { createPartner, deletePartner, listPartners, updatePartner } from '../controllers/partnersController.js'
import { createStaff, deleteStaff, listStaffs, updateStaff } from '../controllers/staffsController.js'
import { createPaperSize, deletePaperSize, listPaperSizes, updatePaperSize } from '../controllers/paperSizesController.js'
import { updateMyLocation } from '../controllers/locationController.js'
import { createPrintJob, listPrintJobs, updatePrintJob } from '../controllers/printJobsController.js'
import { requireAdmin, requireAuth, requireSuperAdmin } from '../middleware/auth.js'

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

export const router = Router()

router.get('/health', health)
router.get('/me', requireAuth, me)
router.patch('/me/location', requireAuth, requireAdmin, updateMyLocation)
router.get('/partners', requireAuth, requireSuperAdmin, listPartners)
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
router.get('/staffs', requireAuth, requireAdmin, listStaffs)
router.post('/staffs', requireAuth, requireAdmin, createStaff)
router.patch('/staffs/:id', requireAuth, requireAdmin, updateStaff)
router.delete('/staffs/:id', requireAuth, requireAdmin, deleteStaff)
router.get('/paper-sizes', requireAuth, requireAdmin, listPaperSizes)
router.post('/paper-sizes', requireAuth, requireAdmin, createPaperSize)
router.patch('/paper-sizes/:id', requireAuth, requireAdmin, updatePaperSize)
router.delete('/paper-sizes/:id', requireAuth, requireAdmin, deletePaperSize)

