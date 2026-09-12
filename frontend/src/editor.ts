export type CurvePoint = [number, number]
export type CurveChannel = 'rgb' | 'red' | 'green' | 'blue'
export type Curves = Record<CurveChannel, CurvePoint[]>

export type Adjustments = {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  temperature: number
  tint: number
  vibrance: number
  saturation: number
  vignette: number
  grain: number
  sharpening: number
  curves: Curves
}

export type AdjustmentKey = Exclude<keyof Adjustments, 'curves'>

export type ControlDefinition = {
  key: AdjustmentKey
  label: string
  min: number
  max: number
  step: number
  tooltip: string
}

export type ControlSection = {
  title: string
  controls: ControlDefinition[]
}

export const FILE_INPUT_ACCEPT = 'image/jpeg,image/mpo,image/png,.jpg,.jpeg,.JPG,.JPEG,.mpo,.MPO,.png,.PNG'

export function createIdentityCurve(): CurvePoint[] {
  return [[0, 0], [255, 255]]
}

export function createDefaultCurves(): Curves {
  return {
    rgb: createIdentityCurve(),
    red: createIdentityCurve(),
    green: createIdentityCurve(),
    blue: createIdentityCurve(),
  }
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  vignette: 0,
  grain: 0,
  sharpening: 0,
  curves: createDefaultCurves(),
}

export const CONTROL_SECTIONS: ControlSection[] = [
  {
    title: 'Luce',
    controls: [
      { key: 'exposure', label: 'Esposizione', min: -5, max: 5, step: 0.1, tooltip: 'Luminosità globale, in valori EV relativi.' },
      { key: 'contrast', label: 'Contrasto', min: -100, max: 100, step: 1, tooltip: 'Distanza tra toni chiari e scuri.' },
      { key: 'highlights', label: 'Alte luci', min: -100, max: 100, step: 1, tooltip: 'Regola soprattutto le zone luminose.' },
      { key: 'shadows', label: 'Ombre', min: -100, max: 100, step: 1, tooltip: 'Regola soprattutto le zone scure.' },
      { key: 'whites', label: 'Bianchi', min: -100, max: 100, step: 1, tooltip: 'Sposta il punto dei bianchi.' },
      { key: 'blacks', label: 'Neri', min: -100, max: 100, step: 1, tooltip: 'Sposta il punto dei neri.' },
    ],
  },
  {
    title: 'Colore',
    controls: [
      { key: 'temperature', label: 'Temperatura', min: -100, max: 100, step: 1, tooltip: 'Valori negativi raffreddano, positivi scaldano.' },
      { key: 'tint', label: 'Tinta', min: -100, max: 100, step: 1, tooltip: 'Valori negativi verso il verde, positivi verso il magenta.' },
      { key: 'vibrance', label: 'Vividezza', min: -100, max: 100, step: 1, tooltip: 'Agisce maggiormente sui colori meno saturi.' },
      { key: 'saturation', label: 'Saturazione', min: -100, max: 100, step: 1, tooltip: 'Intensità globale dei colori.' },
    ],
  },
  {
    title: 'Effetti',
    controls: [
      { key: 'vignette', label: 'Vignettatura', min: -100, max: 100, step: 1, tooltip: 'Scurisce o schiarisce gradualmente i bordi.' },
      { key: 'grain', label: 'Grana', min: 0, max: 100, step: 1, tooltip: 'Aggiunge una grana monocromatica controllata.' },
    ],
  },
  {
    title: 'Dettaglio',
    controls: [
      { key: 'sharpening', label: 'Nitidezza', min: 0, max: 100, step: 1, tooltip: 'Aumenta il contrasto locale dei dettagli.' },
    ],
  },
]

export function hasAdjustments(adjustments: Adjustments): boolean {
  const scalarChanged = (Object.keys(DEFAULT_ADJUSTMENTS) as Array<keyof Adjustments>)
    .filter((key): key is AdjustmentKey => key !== 'curves')
    .some(
    (key) => adjustments[key] !== DEFAULT_ADJUSTMENTS[key],
  )
  return scalarChanged || JSON.stringify(adjustments.curves) !== JSON.stringify(DEFAULT_ADJUSTMENTS.curves)
}

export function resetAdjustments(): Adjustments {
  return { ...DEFAULT_ADJUSTMENTS, curves: createDefaultCurves() }
}

export function resolvePreviewUrl(
  adjustedUrl: string | null,
  originalUrl: string | null,
  showBefore: boolean,
): string | null {
  return showBefore && originalUrl ? originalUrl : adjustedUrl
}

export function formatAdjustmentValue(key: AdjustmentKey, value: number): string {
  if (key === 'exposure') return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
  return `${value > 0 ? '+' : ''}${value}`
}
