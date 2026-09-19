const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const {
  getPaymongoConfig,
  listMyPrintOrderPayments,
  createPrintOrderIntent,
  payPrintOrder,
  finalizePrintOrderPayment,
} = require('../controllers/paymentController')

const router = Router()

router.get('/config', getPaymongoConfig)
router.get('/print-order', requireAuth, listMyPrintOrderPayments)
router.post('/print-order/intent', requireAuth, createPrintOrderIntent)
router.post('/print-order/pay', requireAuth, payPrintOrder)
router.post('/print-order/finalize', requireAuth, finalizePrintOrderPayment)
router.get('/print-order/finalize', requireAuth, finalizePrintOrderPayment)

module.exports = { paymentsRouter: router }
