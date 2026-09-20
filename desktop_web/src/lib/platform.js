import { getDesktopApi } from '../api'

/** True when running inside the Electron desktop shell. */
export function isDesktopApp() {
  return Boolean(getDesktopApi()?.window)
}
