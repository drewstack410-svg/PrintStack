import { useMemo, useRef, useState } from 'react'
import Rotate90DegreesCcwIcon from '@mui/icons-material/Rotate90DegreesCcw'
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import {
  Box,
  CircularProgress,
  IconButton,
  MenuItem,
  Slider,
  TextField,
  Typography,
} from '@mui/material'
import { brand } from '../theme'
import { GradientButton } from './components'

const SNAP_PX = 12
const SNAP_RAD = 0.08

function normalizeRotation(radians) {
  let value = radians
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

function snapRotation(radians) {
  const candidates = [0, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]
  const normalized = normalizeRotation(radians)
  for (const target of candidates) {
    if (Math.abs(normalized - target) <= SNAP_RAD) {
      return target === -Math.PI ? Math.PI : target
    }
  }
  return normalized
}

function snapOffset(next) {
  let dx = next.x
  let dy = next.y
  if (Math.abs(dx) <= SNAP_PX) dx = 0
  if (Math.abs(dy) <= SNAP_PX) dy = 0
  return { x: dx, y: dy }
}

/**
 * Mobile "Place on layout" step — mirrors DocumentLayoutCanvasPage.
 */
export default function DocumentLayoutCanvas({
  imageUrl,
  layouts,
  initialLayoutId,
  onCancel,
  onApply,
}) {
  const paperRef = useRef(null)
  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)

  const safeLayouts = layouts?.length ? layouts : []
  const [layoutId, setLayoutId] = useState(
    () =>
      (initialLayoutId && safeLayouts.some((s) => s.id === initialLayoutId)
        ? initialLayoutId
        : safeLayouts[0]?.id) || '',
  )
  const [title, setTitle] = useState('Scanned document')
  const [titleError, setTitleError] = useState('')
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [exporting, setExporting] = useState(false)

  const layout = useMemo(
    () => safeLayouts.find((s) => s.id === layoutId) || safeLayouts[0] || null,
    [safeLayouts, layoutId],
  )

  const paperAspect = useMemo(() => {
    if (!layout) return 1
    const w = layout.width <= 0 ? 1 : layout.width
    const h = layout.height <= 0 ? 1 : layout.height
    return w / h
  }, [layout])

  function resetTransform() {
    setScale(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }

  function rotateBy(delta) {
    setRotation((prev) => snapRotation(normalizeRotation(prev + delta)))
  }

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()]
      const dx = pts[1].x - pts[0].x
      const dy = pts[1].y - pts[0].y
      pinchRef.current = {
        startDist: Math.hypot(dx, dy) || 1,
        startScale: scale,
      }
    }
  }

  function onPointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return
    const prev = pointersRef.current.get(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()]
      const dx = pts[1].x - pts[0].x
      const dy = pts[1].y - pts[0].y
      const dist = Math.hypot(dx, dy) || 1
      const next = (pinchRef.current.startScale * dist) / pinchRef.current.startDist
      setScale(Math.min(6, Math.max(0.35, next)))
      return
    }

    if (pointersRef.current.size === 1) {
      const dx = event.clientX - prev.x
      const dy = event.clientY - prev.y
      setOffset((o) => snapOffset({ x: o.x + dx, y: o.y + dy }))
    }
  }

  function onPointerUp(event) {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
  }

  async function capturePaper() {
    if (!imageUrl || !layout || !paperRef.current) return null
    const rect = paperRef.current.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * 2))
    const h = Math.max(1, Math.round(rect.height * 2))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Image failed'))
      el.src = imageUrl
    })

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    ctx.translate(w / 2 + offset.x * 2, h / 2 + offset.y * 2)
    ctx.rotate(rotation)
    ctx.scale(scale, scale)
    const fit = Math.min(w / img.width, h / img.height)
    const dw = img.width * fit
    const dh = img.height * fit
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
    return canvas
  }

  async function handleApplyCapture() {
    const cleaned = title.trim()
    if (!cleaned) {
      setTitleError('Enter a file title')
      return
    }
    if (!layout) return
    setExporting(true)
    setTitleError('')
    try {
      const canvas = await capturePaper()
      if (!canvas) throw new Error('Canvas not ready')
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (next) => (next ? resolve(next) : reject(new Error('Could not capture layout'))),
          'image/png',
        )
      })
      const safe = cleaned
        .replace(/[^\w.\- ]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
      const baseName = safe || 'scanned-document'
      const base = baseName.toLowerCase().endsWith('.png') ? baseName : `${baseName}.png`
      const file = new File([blob], base, { type: 'image/png' })
      onApply({ file, paperSize: layout })
    } catch (err) {
      console.warn('[layout-canvas]', err)
      setTitleError('Could not apply layout')
    } finally {
      setExporting(false)
    }
  }

  if (!layout) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">No paper layouts available for this shop.</Typography>
        <GradientButton onClick={onCancel} sx={{ mt: 2 }}>
          Back
        </GradientButton>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
        <Typography sx={{ flex: 1, fontWeight: 800, color: brand.navy }}>Place on layout</Typography>
        <Typography
          component="button"
          type="button"
          onClick={resetTransform}
          disabled={exporting}
          sx={{
            border: 0,
            background: 'none',
            color: brand.purpleDark,
            fontWeight: 700,
            cursor: exporting ? 'default' : 'pointer',
            fontFamily: 'inherit',
            p: 0,
          }}
        >
          Reset
        </Typography>
      </Box>

      <TextField
        size="small"
        label="File title"
        placeholder="e.g. School form"
        value={title}
        disabled={exporting}
        error={Boolean(titleError)}
        helperText={titleError || ' '}
        onChange={(e) => {
          setTitle(e.target.value)
          if (titleError) setTitleError('')
        }}
        sx={{ mb: 1, flexShrink: 0 }}
      />
      <TextField
        select
        size="small"
        label="Paper layout"
        value={layout.id}
        disabled={exporting}
        onChange={(e) => {
          setLayoutId(e.target.value)
          resetTransform()
        }}
        sx={{ mb: 1.5, flexShrink: 0 }}
      >
        {safeLayouts.map((size) => (
          <MenuItem key={size.id} value={size.id}>
            {size.name} · {size.sizeLabel}
          </MenuItem>
        ))}
      </TextField>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 0.5,
          mb: 1,
        }}
      >
        <Box
          ref={paperRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            width: '100%',
            maxWidth: 420,
            aspectRatio: `${paperAspect}`,
            borderRadius: 1,
            border: '1px solid rgba(124,92,255,0.25)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.16)',
            overflow: 'hidden',
            touchAction: 'none',
            cursor: 'grab',
            position: 'relative',
            backgroundColor: '#E8ECF4',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Box
              component="img"
              src={imageUrl}
              alt=""
              draggable={false}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}rad) scale(${scale})`,
                transformOrigin: 'center center',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, bgcolor: '#fff', pt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton disabled={exporting} onClick={() => rotateBy(-Math.PI / 2)} title="Rotate left">
            <Rotate90DegreesCcwIcon />
          </IconButton>
          <IconButton disabled={exporting} onClick={() => rotateBy(Math.PI / 2)} title="Rotate right">
            <Rotate90DegreesCwIcon />
          </IconButton>
          <Box sx={{ flex: 1, px: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: brand.muted }}>Rotate</Typography>
            <Slider
              size="small"
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={rotation}
              disabled={exporting}
              onChange={(_, value) => setRotation(snapRotation(value))}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
          <ZoomInIcon sx={{ fontSize: 15, color: brand.muted }} />
          <Slider
            size="small"
            min={0.35}
            max={6}
            step={0.01}
            value={scale}
            disabled={exporting}
            onChange={(_, value) => setScale(value)}
            sx={{ flex: 1 }}
          />
          <Typography sx={{ fontWeight: 800, color: brand.navy, minWidth: 36 }}>
            {scale.toFixed(1)}×
          </Typography>
        </Box>
        <Typography
          sx={{
            textAlign: 'center',
            color: brand.muted,
            fontSize: 11,
            fontWeight: 600,
            mb: 1.25,
          }}
        >
          Pinch to scale · drag to move · paper edge crops the print
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box
            component="button"
            type="button"
            disabled={exporting}
            onClick={onCancel}
            sx={{
              minWidth: 88,
              minHeight: 42,
              border: 0,
              borderRadius: 999,
              bgcolor: 'rgba(91,100,117,0.12)',
              color: brand.navy,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: exporting ? 'default' : 'pointer',
            }}
          >
            Back
          </Box>
          <Box sx={{ flex: 1 }}>
            <GradientButton disabled={exporting} onClick={handleApplyCapture}>
              {exporting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Apply to preview'}
            </GradientButton>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
