/** Standard paper presets used by Templates (inches). */
export const PAPER_SIZE_PRESETS = [
  { id: 'letter', name: 'Letter', width: 8.5, height: 11, unit: 'in' },
  { id: 'tabloid', name: 'Tabloid', width: 11, height: 17, unit: 'in' },
  { id: 'legal', name: 'Legal', width: 8.5, height: 14, unit: 'in' },
  { id: 'statement', name: 'Statement', width: 5.5, height: 8.5, unit: 'in' },
  { id: 'executive', name: 'Executive', width: 7.25, height: 10.5, unit: 'in' },
  { id: 'a3', name: 'A3', width: 11.69, height: 16.54, unit: 'in' },
  { id: 'a4', name: 'A4', width: 8.27, height: 11.69, unit: 'in' },
  { id: 'a5', name: 'A5', width: 5.83, height: 8.27, unit: 'in' },
  { id: 'b4-jis', name: 'B4 (JIS)', width: 10.12, height: 14.33, unit: 'in' },
  { id: 'b5-jis', name: 'B5 (JIS)', width: 7.17, height: 10.12, unit: 'in' },
  { id: 'envelope-9', name: 'Envelope #9', width: 3.875, height: 8.875, unit: 'in' },
  { id: 'envelope-10', name: 'Envelope #10', width: 4.125, height: 9.5, unit: 'in' },
  { id: 'c-size', name: 'C size sheet', width: 17, height: 22, unit: 'in' },
]

export function formatPaperPresetLabel(preset) {
  return `${preset.width} × ${preset.height} ${preset.unit}`
}
