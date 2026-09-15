export const DEFAULT_CONTINUE_PRINT_KEY = {
  code: 'Space',
  label: 'Space',
}

export function keyLabelFromEvent(event) {
  if (!event) {
    return DEFAULT_CONTINUE_PRINT_KEY.label
  }
  if (event.code === 'Space' || event.key === ' ') {
    return 'Space'
  }
  if (event.code === 'Enter' || event.key === 'Enter') {
    return 'Enter'
  }
  if (event.code === 'Tab') {
    return 'Tab'
  }
  if (event.code?.startsWith('Key') && event.code.length === 4) {
    return event.code.slice(3)
  }
  if (event.code?.startsWith('Digit') && event.code.length === 6) {
    return event.code.slice(5)
  }
  if (event.code?.startsWith('Numpad') && event.code.length > 6) {
    return `Numpad ${event.code.slice(6)}`
  }
  if (event.key && event.key.length === 1) {
    return event.key.toUpperCase()
  }
  return event.code || event.key || DEFAULT_CONTINUE_PRINT_KEY.label
}

export function isCaptureableContinueKey(event) {
  if (!event?.code) {
    return false
  }
  if (
    event.key === 'Escape' ||
    event.key === 'Shift' ||
    event.key === 'Control' ||
    event.key === 'Alt' ||
    event.key === 'Meta' ||
    event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight' ||
    event.code === 'ControlLeft' ||
    event.code === 'ControlRight' ||
    event.code === 'AltLeft' ||
    event.code === 'AltRight' ||
    event.code === 'MetaLeft' ||
    event.code === 'MetaRight' ||
    event.code === 'CapsLock' ||
    event.code === 'ContextMenu'
  ) {
    return false
  }
  return true
}

export function normalizeContinuePrintPreferences(raw = {}) {
  const legacyEnabled = raw.spacebarContinueAfterPrint
  const enabled =
    typeof raw.continuePrintWithKey === 'boolean'
      ? raw.continuePrintWithKey
      : legacyEnabled !== false

  const code = String(raw.continuePrintKeyCode || DEFAULT_CONTINUE_PRINT_KEY.code).trim() ||
    DEFAULT_CONTINUE_PRINT_KEY.code
  const label =
    String(raw.continuePrintKeyLabel || '').trim() ||
    (code === 'Space' ? 'Space' : code)

  return {
    continuePrintWithKey: enabled,
    continuePrintKeyCode: code,
    continuePrintKeyLabel: label,
    // Keep legacy field in sync for older builds.
    spacebarContinueAfterPrint: enabled && code === 'Space',
  }
}
