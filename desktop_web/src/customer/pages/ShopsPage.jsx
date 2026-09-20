import { useEffect, useMemo, useRef, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FilterBAndWIcon from '@mui/icons-material/FilterBAndW'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { brand } from '../../theme'
import {
  EmptyState,
  ErrorCard,
  GradientButton,
  PartnerAvatar,
  StatusChip,
  cardGridSx,
  itemCardSx,
} from '../components'
import {
  analyzePrintFile,
  isImageFile,
  isPdfFile,
  matchPaperSize,
  renderPdfPageCanvases,
} from '../pdfAnalyze'
import DocumentLayoutCanvas from '../DocumentLayoutCanvas'
import { buildPrintDraft } from '../printDraft'
import { usePartners } from '../usePartners'

const ACCEPT_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'])
const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,.doc,.docx'

function fileExtension(name = '') {
  const parts = String(name).toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) : ''
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ShopsPage({ onOpenShop, onContinueToCheckout }) {
  return (
    <ShopListPage
      titleHint="Search and filter partner shops."
      showFilters
      onOpenShop={onOpenShop}
      onContinueToCheckout={onContinueToCheckout}
    />
  )
}

export function ShopPricingDialog({ partner, onClose, onContinueToCheckout }) {
  // Alias kept for desktop dialog usage; mobile renders as a full page via shell.
  return (
    <ShopOrderView
      partner={partner}
      onClose={onClose}
      onContinueToCheckout={onContinueToCheckout}
    />
  )
}

/** Full mobile page / desktop dialog body for shop pricing + print intake. */
export function ShopOrderView({ partner, onClose, onContinueToCheckout }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [reading, setReading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [selectedSizeId, setSelectedSizeId] = useState(null)
  const [copies, setCopies] = useState(1)
  const [printColorAsBw, setPrintColorAsBw] = useState(false)
  const [pageFilter, setPageFilter] = useState('all')
  const [mobileStep, setMobileStep] = useState('pricing') // pricing | layout | order
  const [layoutImage, setLayoutImage] = useState(null)
  const [layoutImageUrl, setLayoutImageUrl] = useState('')
  const [forcedSizeId, setForcedSizeId] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setFile(null)
    setUploadError('')
    setDragOver(false)
    setReading(false)
    setAnalysis(null)
    setSelectedSizeId(null)
    setCopies(1)
    setPrintColorAsBw(false)
    setPageFilter('all')
    setMobileStep('pricing')
    setLayoutImage(null)
    setForcedSizeId(null)
  }, [partner?.id])

  useEffect(() => {
    if (!layoutImage) {
      setLayoutImageUrl('')
      return undefined
    }
    const url = URL.createObjectURL(layoutImage)
    setLayoutImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [layoutImage])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!file || !partner) return undefined
    let cancelled = false
    setReading(true)
    setAnalysis(null)
    setPrintColorAsBw(false)
    setPageFilter('all')
    setCopies(1)

    analyzePrintFile(file)
      .then((info) => {
        if (cancelled) return
        setAnalysis(info)
        if (forcedSizeId) {
          setSelectedSizeId(forcedSizeId)
          return
        }
        const matched = matchPaperSize(
          partner.paperSizes || [],
          info.pageWidthPt,
          info.pageHeightPt,
        )
        setSelectedSizeId(matched?.id || null)
      })
      .catch((err) => {
        console.warn('[shop-pricing] analyze failed', err)
        if (!cancelled) {
          setUploadError('Could not analyze that document.')
          setAnalysis({
            kind: 'unknown',
            pages: 1,
            bwPages: 1,
            colorPages: 0,
            pageIsColor: [false],
            pageWidthPt: 0,
            pageHeightPt: 0,
          })
          if (forcedSizeId) setSelectedSizeId(forcedSizeId)
        }
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })

    return () => {
      cancelled = true
    }
  }, [file, partner, forcedSizeId])

  if (!partner) return null

  const sizes = partner.paperSizes?.length ? partner.paperSizes : []
  const online = partner.location?.online === true
  const shopName = partner.companyName || 'Shop'
  const selectedSize = sizes.find((s) => s.id === selectedSizeId) || null
  const bwPages = analysis?.bwPages || 0
  const colorPages = analysis?.colorPages || 0
  const totalPages = bwPages + colorPages
  const billedBw = printColorAsBw ? totalPages : bwPages
  const billedColor = printColorAsBw ? 0 : colorPages
  const estimatedTotal =
    billedBw * copies * (selectedSize?.priceBw || 0) +
    billedColor * copies * (selectedSize?.priceColor || 0)
  const convenienceFee = partner.convenienceFee > 0 ? partner.convenienceFee : 0
  const orderTotal = estimatedTotal + convenienceFee
  const sizeMatched = Boolean(selectedSize)
  const canPrint =
    Boolean(file) && !reading && sizeMatched && totalPages > 0 && sizes.length > 0

  function takeFile(next) {
    if (!next) return
    const ext = fileExtension(next.name)
    if (!ACCEPT_EXT.has(ext)) {
      setUploadError('Use PDF, Word, or image files (png/jpg).')
      return
    }
    setUploadError('')

    // Mobile mirrors app intake: images go through Place on layout first.
    if (!isDesktop && isImageFile(next)) {
      setForcedSizeId(null)
      setLayoutImage(next)
      setMobileStep('layout')
      return
    }

    setForcedSizeId(null)
    setFile(next)
    if (!isDesktop) setMobileStep('order')
  }

  function clearFile() {
    setFile(null)
    setUploadError('')
    setAnalysis(null)
    setSelectedSizeId(null)
    setForcedSizeId(null)
    setCopies(1)
    setPrintColorAsBw(false)
    setPageFilter('all')
    setLayoutImage(null)
    // Mobile stays on the preview step so upload lives on the preview card.
    if (!isDesktop) setMobileStep('order')
  }

  function toggleFilter(next) {
    setPageFilter((prev) => (prev === next ? 'all' : next))
  }

  function continueToCheckout() {
    if (!canPrint || !onContinueToCheckout) return
    const draft = buildPrintDraft({
      file,
      paperSize: selectedSize,
      copies,
      bwPages,
      colorPages,
      pageIsColor: analysis?.pageIsColor || [],
      forceBlackAndWhite: printColorAsBw,
    })
    onContinueToCheckout([draft])
  }

  function orderControls() {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 1.5,
            py: 0.5,
            bgcolor: brand.mist,
            borderRadius: 1,
            border: '1px solid rgba(124,92,255,0.12)',
          }}
        >
          <Typography sx={{ fontWeight: 800, color: brand.navy, fontSize: 12 }}>Copies</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              disabled={copies <= 1}
              onClick={() => setCopies((c) => Math.max(1, c - 1))}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ minWidth: 28, textAlign: 'center', fontWeight: 800 }}>{copies}</Typography>
            <IconButton
              size="small"
              disabled={copies >= 50}
              onClick={() => setCopies((c) => Math.min(50, c + 1))}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {colorPages > 0 ? (
          <Box
            sx={{
              px: 1.5,
              py: 0.25,
              bgcolor: brand.mist,
              borderRadius: 1,
              border: '1px solid rgba(124,92,255,0.12)',
            }}
          >
            <FormControlLabel
              sx={{ m: 0, width: '100%', justifyContent: 'space-between' }}
              labelPlacement="start"
              control={
                <Switch
                  checked={printColorAsBw}
                  onChange={(e) => {
                    setPrintColorAsBw(e.target.checked)
                    if (e.target.checked) setPageFilter('all')
                  }}
                />
              }
              label={
                <Box sx={{ pr: 1, textAlign: 'left' }}>
                  <Typography sx={{ fontWeight: 800, color: brand.navy, fontSize: 13 }}>
                    Print color as B&W
                  </Typography>
                  <Typography sx={{ color: brand.muted, fontSize: 11.5 }}>
                    {printColorAsBw
                      ? `All ${totalPages} pages billed at B&W price`
                      : `${colorPages} color page${colorPages === 1 ? '' : 's'} at color price`}
                  </Typography>
                </Box>
              }
            />
          </Box>
        ) : null}

        <Box sx={{ px: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography sx={{ color: brand.muted, fontWeight: 700, fontSize: 13 }}>
              Estimated total
            </Typography>
            <Typography sx={{ fontWeight: 900, color: brand.purple, fontSize: 15 }}>
              ₱{orderTotal.toFixed(2)}
            </Typography>
          </Box>
          {convenienceFee > 0 ? (
            <Typography sx={{ color: brand.muted, fontSize: 11.5, fontWeight: 600, mt: 0.35 }}>
              Incl. ₱{convenienceFee.toFixed(2)} convenience fee
            </Typography>
          ) : null}
        </Box>
      </Box>
    )
  }

  const notices = (
    <>
      {!online ? (
        <Typography
          sx={{
            mb: 1.5,
            px: 1.5,
            py: 1,
            bgcolor: 'rgba(124, 92, 255, 0.08)',
            borderRadius: 1,
            color: brand.navy,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          This shop is offline. You can reserve printing and it will be queued for the shop.
        </Typography>
      ) : null}
    </>
  )

  const pricingPanel = (
    <Box
      sx={{
        flex: isDesktop ? '1 1 52%' : '1 1 auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {notices}
      <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 700, mb: 1 }}>
        {sizes.length} layout{sizes.length === 1 ? '' : 's'}
      </Typography>
      {sizes.length === 0 ? (
        <EmptyState
          icon={StorefrontOutlinedIcon}
          title="No paper sizes listed"
          message="This shop has not published pricing yet."
        />
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 1,
          }}
        >
          <PricingTable sizes={sizes} matchedId={selectedSizeId} />
        </Box>
      )}

      {file && isDesktop ? <Box sx={{ mt: 1.5, flexShrink: 0 }}>{orderControls()}</Box> : null}
    </Box>
  )

  const uploadOrPreviewPanel = (
    <Box
      sx={{
        flex: isDesktop ? '1 1 48%' : '1 1 auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: isDesktop ? 0 : 0,
      }}
    >
      {!file ? (
        <>
          <Typography sx={{ fontWeight: 800, color: brand.navy, mb: 1 }}>Upload document</Typography>
          <DocumentDropzone
            file={null}
            dragOver={dragOver}
            error={uploadError}
            onDragOverChange={setDragOver}
            onFile={takeFile}
            onClear={clearFile}
            fill={isDesktop}
          />
        </>
      ) : (
        <DocumentPreviewPane
          file={file}
          previewUrl={previewUrl}
          reading={reading}
          analysis={analysis}
          pageFilter={printColorAsBw ? 'all' : pageFilter}
          printColorAsBw={printColorAsBw}
          sizeMatched={sizeMatched}
          sizeName={selectedSize?.name}
          sizeLabel={selectedSize?.sizeLabel}
          onFilterBw={() => toggleFilter('bw')}
          onFilterColor={() => toggleFilter('color')}
          onClear={clearFile}
          onReplace={takeFile}
        />
      )}
      {uploadError ? (
        <Typography sx={{ mt: 1, color: '#B71C1C', fontSize: 12, fontWeight: 600 }}>
          {uploadError}
        </Typography>
      ) : null}
    </Box>
  )

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      hidden
      type="file"
      accept={ACCEPT_ATTR}
      onChange={(event) => {
        takeFile(event.target.files?.[0])
        event.target.value = ''
      }}
    />
  )

  // —— Mobile page / fullscreen flow: pricing → layout → order preview ——
  const mobileChrome = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        flexShrink: 0,
        bgcolor: brand.barDark,
        color: '#fff',
      }}
    >
      <IconButton
        onClick={() => {
          if (mobileStep === 'layout') {
            setLayoutImage(null)
            setMobileStep('order')
            return
          }
          if (mobileStep === 'order') {
            if (file) {
              clearFile()
              return
            }
            setMobileStep('pricing')
            return
          }
          onClose()
        }}
        aria-label="Back"
        sx={{ color: '#fff' }}
      >
        <ArrowBackIcon />
      </IconButton>
      <PartnerAvatar url={partner.logoUrl} name={shopName} size={36} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, color: '#fff' }}>
          {mobileStep === 'layout' ? 'Place on layout' : shopName}
        </Typography>
        {mobileStep !== 'layout' ? (
          <Typography noWrap sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 12.5 }}>
            {partner.location?.label || partner.email || 'Paper sizes & fees'}
          </Typography>
        ) : null}
      </Box>
      <StatusChip label={online ? 'Online' : 'Offline'} active={online} />
    </Box>
  )

  const mobileBody = (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.mist,
        overflow: 'hidden',
      }}
    >
      {hiddenFileInput}
      {mobileChrome}

      {mobileStep === 'pricing' ? (
        <>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2, pt: 2, pb: 1 }}>
            {notices}
            <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 700, mb: 1 }}>
              {sizes.length} layout{sizes.length === 1 ? '' : 's'}
            </Typography>
            {sizes.length === 0 ? (
              <EmptyState
                icon={StorefrontOutlinedIcon}
                title="No paper sizes listed"
                message="This shop has not published pricing yet."
              />
            ) : (
              <Box
                sx={{
                  bgcolor: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <PricingTable sizes={sizes} matchedId={null} />
              </Box>
            )}
            {uploadError && mobileStep === 'pricing' ? (
              <Typography sx={{ mt: 1.5, color: '#B71C1C', fontSize: 12, fontWeight: 600 }}>
                {uploadError}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ px: 2, py: 1.5, flexShrink: 0, bgcolor: '#fff', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}>
            <GradientButton
              disabled={sizes.length === 0}
              onClick={() => setMobileStep('order')}
            >
              Print at this shop
            </GradientButton>
          </Box>
        </>
      ) : null}

      {mobileStep === 'layout' ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', px: 2, pt: 1.5, pb: 1.5 }}>
          <DocumentLayoutCanvas
            imageUrl={layoutImageUrl}
            layouts={sizes}
            onCancel={() => {
              setLayoutImage(null)
              setMobileStep('order')
            }}
            onApply={({ file: laidOut, paperSize }) => {
              setForcedSizeId(paperSize.id)
              setSelectedSizeId(paperSize.id)
              setLayoutImage(null)
              setFile(laidOut)
              setMobileStep('order')
            }}
          />
        </Box>
      ) : null}

      {mobileStep === 'order' ? (
        <>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {!online ? (
              <Typography
                sx={{
                  mx: 2,
                  mt: 1.25,
                  mb: 0,
                  px: 1.5,
                  py: 1,
                  bgcolor: 'rgba(124, 92, 255, 0.08)',
                  borderRadius: 1,
                  color: brand.navy,
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                This shop is offline. Your print request will be reserved and queued.
              </Typography>
            ) : null}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {file ? (
                <DocumentPreviewPane
                  file={file}
                  previewUrl={previewUrl}
                  reading={reading}
                  analysis={analysis}
                  pageFilter={printColorAsBw ? 'all' : pageFilter}
                  printColorAsBw={printColorAsBw}
                  sizeMatched={sizeMatched}
                  sizeName={selectedSize?.name}
                  sizeLabel={selectedSize?.sizeLabel}
                  onFilterBw={() => toggleFilter('bw')}
                  onFilterColor={() => toggleFilter('color')}
                  onClear={clearFile}
                  onReplace={takeFile}
                />
              ) : (
                <ChooseDocumentCard
                  busy={reading}
                  error={uploadError}
                  onClick={() => fileInputRef.current?.click()}
                />
              )}
            </Box>
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: '#fff',
              boxShadow: '0 -6px 20px rgba(0,0,0,0.12)',
              px: 1.5,
              pt: 1,
              pb: 1.5,
            }}
          >
            {file ? orderControls() : null}
            <Box sx={{ mt: file ? 1.25 : 0 }}>
              <GradientButton disabled={!canPrint} onClick={continueToCheckout}>
                {online ? 'Continue' : 'Reserve'}
              </GradientButton>
            </Box>
          </Box>
        </>
      ) : null}
    </Box>
  )

  if (!isDesktop) {
    return mobileBody
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 'min(1480px, 98vw)',
          height: 'min(960px, 96vh)',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          m: 1,
        },
      }}
    >
      {hiddenFileInput}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pr: 1, flexShrink: 0 }}>
        <PartnerAvatar url={partner.logoUrl} name={shopName} size={34} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800 }}>
            {shopName}
          </Typography>
          <Typography noWrap sx={{ color: brand.muted, fontSize: 13 }}>
            {partner.location?.label || partner.email || 'Paper sizes & fees'}
          </Typography>
        </Box>
        <StatusChip label={online ? 'Online' : 'Offline'} active={online} />
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2.5,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {pricingPanel}
        <Divider orientation="vertical" flexItem />
        {uploadOrPreviewPanel}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, flexShrink: 0, gap: 1.5 }}>
        <GradientButton disabled={!canPrint} onClick={continueToCheckout}>
          {online ? 'Continue' : 'Reserve'}
        </GradientButton>
      </DialogActions>
    </Dialog>
  )
}

function PricingTable({ sizes, matchedId }) {
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
      <Box
        component="thead"
        sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: brand.mist }}
      >
        <Box component="tr">
          <HeaderCell align="left">Layout</HeaderCell>
          <HeaderCell align="center" width={100}>
            B&W
          </HeaderCell>
          <HeaderCell align="center" width={100}>
            Color
          </HeaderCell>
        </Box>
      </Box>
      <Box component="tbody">
        {sizes.map((size, index) => {
          const matched = size.id === matchedId
          return (
            <Box
              component="tr"
              key={size.id}
              sx={{
                borderTop: index === 0 ? 0 : '1px solid rgba(0,0,0,0.06)',
                bgcolor: matched ? 'rgba(124,92,255,0.08)' : 'transparent',
              }}
            >
              <Box component="td" sx={{ px: 1.5, py: 1.15, verticalAlign: 'middle' }}>
                <Typography sx={{ fontWeight: 800, color: brand.navy, fontSize: 13.5 }}>
                  {size.name || 'Untitled layout'}
                </Typography>
                <Typography sx={{ color: brand.muted, fontSize: 11.5 }}>{size.sizeLabel}</Typography>
              </Box>
              <Box
                component="td"
                sx={{ px: 1, py: 1.15, textAlign: 'center', verticalAlign: 'middle' }}
              >
                <PricePill
                  icon={FilterBAndWIcon}
                  value={`₱${size.priceBw.toFixed(2)}`}
                  color={brand.navy}
                />
              </Box>
              <Box
                component="td"
                sx={{ px: 1.25, py: 1.15, textAlign: 'center', verticalAlign: 'middle' }}
              >
                <PricePill
                  icon={PaletteOutlinedIcon}
                  value={`₱${size.priceColor.toFixed(2)}`}
                  color={brand.purple}
                />
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function HeaderCell({ children, align = 'left', width }) {
  return (
    <Box
      component="th"
      sx={{
        px: 1.5,
        py: 1.1,
        textAlign: align,
        width,
        fontWeight: 800,
        color: brand.muted,
        fontSize: 11,
        letterSpacing: 0.35,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Box>
  )
}

function PricePill({ icon: Icon, value, color }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.9,
        py: 0.55,
        borderRadius: 1,
        bgcolor: `${color}14`,
        color,
        fontWeight: 800,
        fontSize: 11.5,
      }}
    >
      <Icon sx={{ fontSize: 13 }} />
      {value}
    </Box>
  )
}

function ChooseDocumentCard({ onClick, busy = false, error = '' }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={busy}
      onClick={onClick}
      sx={{
        flex: 1,
        width: '100%',
        minHeight: 220,
        border: '1.5px solid rgba(124,92,255,0.28)',
        borderRadius: 2,
        bgcolor: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: busy ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.25,
        px: 2,
        fontFamily: 'inherit',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundImage: brand.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 14px rgba(124,92,255,0.28)',
        }}
      >
        {busy ? (
          <CircularProgress size={26} sx={{ color: '#fff' }} />
        ) : (
          <CloudUploadIcon sx={{ color: '#fff', fontSize: 15 }} />
        )}
      </Box>
      <Typography sx={{ fontWeight: 900, color: brand.navy, fontSize: 14 }}>
        Choose document
      </Typography>
      <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
        Tap to upload a PDF, Word, or image file
      </Typography>
      {error ? (
        <Typography sx={{ color: '#B71C1C', fontSize: 12, fontWeight: 600, mt: 0.5 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}

function DocumentDropzone({ file, dragOver, error, onDragOverChange, onFile, onClear, fill }) {
  return (
    <Box
      component="label"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        onDragOverChange(true)
      }}
      onDragLeave={() => onDragOverChange(false)}
      onDrop={(event) => {
        event.preventDefault()
        onDragOverChange(false)
        onFile(event.dataTransfer.files?.[0])
      }}
      sx={{
        flex: fill ? 1 : undefined,
        minHeight: fill ? 0 : 200,
        height: fill ? '100%' : undefined,
        border: '2px dashed',
        borderColor: error ? '#E53935' : dragOver || file ? brand.blue : 'rgba(0,0,0,0.14)',
        borderRadius: 1.5,
        bgcolor: dragOver ? 'rgba(79,124,255,0.06)' : brand.mist,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
        py: 2.5,
      }}
    >
      <input
        hidden
        type="file"
        accept={ACCEPT_ATTR}
        onChange={(event) => {
          onFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <Box>
        <CloudUploadIcon sx={{ fontSize: 36, color: brand.blue, mb: 1 }} />
        <Typography sx={{ fontWeight: 700, color: brand.navy, fontSize: 14 }}>
          Drop document here
        </Typography>
        <Typography sx={{ color: brand.muted, fontSize: 12.5, mt: 0.5 }}>
          or click to browse · PDF, Word, PNG, JPG
        </Typography>
      </Box>
    </Box>
  )
}

function DocumentPreviewPane({
  file,
  previewUrl,
  reading,
  analysis,
  pageFilter,
  printColorAsBw,
  sizeMatched,
  sizeName,
  sizeLabel,
  onFilterBw,
  onFilterColor,
  onClear,
  onReplace,
}) {
  const bwPages = analysis?.bwPages || 0
  const colorPages = analysis?.colorPages || 0
  const previewBw = printColorAsBw ? bwPages + colorPages : bwPages
  const previewColor = printColorAsBw ? 0 : colorPages
  const sizeText = sizeMatched
    ? [sizeName, sizeLabel].filter(Boolean).join(' · ')
    : 'Size not matched'
  const inputRef = useRef(null)

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minHeight: 220,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: '#E8ECF4',
        border: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          filter: printColorAsBw ? 'grayscale(1)' : 'none',
        }}
      >
        {isPdfFile(file) ? (
          <PdfPagesScroller file={file} pageIsColor={analysis?.pageIsColor || []} pageFilter={pageFilter} />
        ) : isImageFile(file) && previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt={file.name}
            sx={{
              display: 'block',
              maxWidth: '100%',
              mx: 'auto',
              my: 2,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          />
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 3,
              textAlign: 'center',
            }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 48, color: brand.purple, mb: 1 }} />
            <Typography sx={{ fontWeight: 800, color: brand.navy }}>{file.name}</Typography>
            <Typography sx={{ color: brand.muted, fontSize: 13, mt: 0.5 }}>
              {formatBytes(file.size)} · Preview available after converting to PDF in the mobile app
            </Typography>
          </Box>
        )}
      </Box>

      {reading ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(255,255,255,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}
        >
          <CircularProgress />
        </Box>
      ) : null}

      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          zIndex: 2,
          pointerEvents: 'none',
          '& > *': { pointerEvents: 'auto' },
        }}
      >
        <ChipBadge
          label={sizeText}
          color={sizeMatched ? brand.navy : '#B71C1C'}
          bgcolor="rgba(255,255,255,0.94)"
        />
        {printColorAsBw ? (
          <ChipBadge label="B&W" color={brand.navy} bgcolor="rgba(255,255,255,0.94)" />
        ) : null}
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          title="Change document"
          onClick={() => inputRef.current?.click()}
          sx={{ bgcolor: 'rgba(255,255,255,0.94)', '&:hover': { bgcolor: '#fff' } }}
        >
          <SwapHorizIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          title="Remove"
          onClick={onClear}
          sx={{ bgcolor: 'rgba(255,255,255,0.94)', '&:hover': { bgcolor: '#fff' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept={ACCEPT_ATTR}
          onChange={(event) => {
            onReplace(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          display: 'flex',
          gap: 1,
          zIndex: 2,
        }}
      >
        <CountFilterChip
          label="B&W"
          count={previewBw}
          color={brand.navy}
          selected={!printColorAsBw && pageFilter === 'bw'}
          disabled={printColorAsBw || previewBw <= 0}
          onClick={onFilterBw}
        />
        <CountFilterChip
          label="Color"
          count={previewColor}
          color={brand.purple}
          selected={!printColorAsBw && pageFilter === 'color'}
          disabled={printColorAsBw || previewColor <= 0}
          onClick={onFilterColor}
        />
      </Box>
    </Box>
  )
}

function ChipBadge({ label, color, bgcolor }) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.6,
        borderRadius: 1,
        bgcolor,
        color,
        fontWeight: 800,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

function CountFilterChip({ label, count, color, selected, disabled, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.1,
        py: 0.65,
        borderRadius: 1,
        border: selected ? `1.5px solid ${color}` : '1.5px solid transparent',
        bgcolor: selected ? `${color}1F` : 'rgba(255,255,255,0.94)',
        color,
        fontWeight: 800,
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        fontFamily: 'inherit',
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      {label} {count}
    </Box>
  )
}

function PdfPagesScroller({ file, pageIsColor, pageFilter }) {
  const hostRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')

  useEffect(() => {
    if (!file) return undefined
    let cancelled = false
    let objectUrl = ''
    const host = hostRef.current
    if (host) host.innerHTML = ''
    setReady(false)
    setEmptyMessage('')
    setFallbackUrl('')
    const controller = new AbortController()

    renderPdfPageCanvases(file, { maxWidth: 720, signal: controller.signal })
      .then((canvases) => {
        if (cancelled || controller.signal.aborted) return
        const node = hostRef.current
        if (!node) {
          objectUrl = URL.createObjectURL(file)
          setFallbackUrl(objectUrl)
          setReady(true)
          return
        }
        node.innerHTML = ''
        let visible = 0
        canvases.forEach((canvas, index) => {
          const isColor = pageIsColor[index] === true
          const show =
            pageFilter === 'all' ||
            pageIsColor.length === 0 ||
            (pageFilter === 'color' ? isColor : !isColor)
          if (!show) return
          visible += 1
          canvas.style.display = 'block'
          canvas.style.width = '100%'
          canvas.style.maxWidth = '100%'
          canvas.style.height = 'auto'
          canvas.style.margin = '12px auto'
          canvas.style.boxShadow = '0 8px 24px rgba(0,0,0,0.16)'
          canvas.style.background = '#fff'
          node.appendChild(canvas)
        })
        if (visible === 0) {
          setEmptyMessage(
            pageFilter === 'color' ? 'No color pages detected' : 'No B&W pages detected',
          )
        }
        setReady(true)
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return
        console.warn('[pdf-preview]', err)
        objectUrl = URL.createObjectURL(file)
        setFallbackUrl(objectUrl)
        setReady(true)
      })

    return () => {
      cancelled = true
      controller.abort()
      if (hostRef.current) hostRef.current.innerHTML = ''
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file, pageFilter, pageIsColor.join(',')])

  return (
    <Box sx={{ position: 'relative', minHeight: '100%', width: '100%', py: 1 }}>
      {fallbackUrl ? (
        <Box
          component="iframe"
          title="PDF preview"
          src={fallbackUrl}
          sx={{
            display: 'block',
            width: '100%',
            height: '100%',
            minHeight: 360,
            border: 0,
            bgcolor: '#fff',
          }}
        />
      ) : (
        <Box ref={hostRef} sx={{ width: '100%', minHeight: 120 }} />
      )}
      {!ready ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}
      {ready && emptyMessage && !fallbackUrl ? (
        <Typography
          sx={{
            textAlign: 'center',
            color: brand.muted,
            fontWeight: 700,
            py: 6,
          }}
        >
          {emptyMessage}
        </Typography>
      ) : null}
    </Box>
  )
}

function ShopListPage({ titleHint, showFilters = false, onOpenShop, onContinueToCheckout }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const { partners, loading, error } = usePartners()
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState('all')
  const [service, setService] = useState('all')
  const [selected, setSelected] = useState(null)

  function openShop(partner) {
    if (!isDesktop && onOpenShop) {
      onOpenShop(partner)
      return
    }
    setSelected(partner)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return partners.filter((partner) => {
      const online = partner.location?.online === true
      const matchesAvailability =
        availability === 'all' ||
        (availability === 'online' && online) ||
        (availability === 'offline' && !online)
      const matchesService =
        service === 'all' ||
        (service === 'printing' && partner.services.printing) ||
        (service === 'xerox' && partner.services.xerox)
      const matchesQuery =
        !q ||
        partner.companyName.toLowerCase().includes(q) ||
        partner.email.toLowerCase().includes(q) ||
        (partner.location?.label || '').toLowerCase().includes(q)
      return matchesAvailability && matchesService && matchesQuery
    })
  }, [partners, query, availability, service])

  if (loading && partners.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 3, width: '100%' }}>
      <Typography sx={{ color: brand.muted, fontSize: 13, mb: 1.5 }}>{titleHint}</Typography>

      {error ? <ErrorCard message={error} /> : null}

      <TextField
        fullWidth
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search shops or locations"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setQuery('')}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          bgcolor: '#fff',
          borderRadius: 1.5,
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        }}
      />

      {showFilters ? (
        <Box sx={{ display: 'flex', gap: 1.25, mt: 1.25 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="online">Online</MenuItem>
            <MenuItem value="offline">Offline</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Service"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="printing">Printing</MenuItem>
            <MenuItem value="xerox">Xerox</MenuItem>
          </TextField>
        </Box>
      ) : null}

      <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 700, mt: 1.5, mb: 1 }}>
        {filtered.length} shop{filtered.length === 1 ? '' : 's'}
      </Typography>

      {filtered.length === 0 ? (
        <EmptyState
          icon={StorefrontOutlinedIcon}
          title="No shops found"
          message="Try another search or filter."
        />
      ) : (
        <Box sx={cardGridSx}>
          {filtered.map((partner) => {
            const online = partner.location?.online === true
            const subtitle = [partner.email, partner.location?.label].filter(Boolean).join(' · ')
            return (
              <Box
                key={partner.id}
                component="button"
                type="button"
                onClick={() => openShop(partner)}
                sx={itemCardSx}
              >
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <PartnerAvatar url={partner.logoUrl} name={partner.companyName} />
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <PartnerAvatar url={partner.logoUrl} name={partner.companyName} size={44} />
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    width: { md: '100%' },
                    textAlign: { xs: 'left', md: 'center' },
                  }}
                >
                  <Typography
                    sx={{ fontSize: { xs: 14, md: 13 }, fontWeight: 700, color: brand.navy }}
                    noWrap
                  >
                    {partner.companyName || 'Untitled shop'}
                  </Typography>
                  {subtitle ? (
                    <Typography noWrap sx={{ color: brand.muted, fontSize: 13, mt: 0.5 }}>
                      {subtitle}
                    </Typography>
                  ) : null}
                </Box>
                <Box sx={{ mt: { md: 0.75 } }}>
                  <StatusChip label={online ? 'Online' : 'Offline'} active={online} />
                </Box>
                <ChevronRightIcon
                  sx={{ color: brand.muted, display: { xs: 'block', md: 'none' } }}
                />
              </Box>
            )
          })}
        </Box>
      )}

      {isDesktop ? (
        <ShopPricingDialog
          partner={selected}
          onClose={() => setSelected(null)}
          onContinueToCheckout={(docs) => {
            const partner = selected
            setSelected(null)
            onContinueToCheckout?.(partner, docs)
          }}
        />
      ) : null}
    </Box>
  )
}
