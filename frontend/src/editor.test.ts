import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADJUSTMENTS,
  FILE_INPUT_ACCEPT,
  hasAdjustments,
  resetAdjustments,
  resolvePreviewUrl,
} from './editor'

describe('stato delle regolazioni', () => {
  it('riconosce una foto modificata e applica il reset globale', () => {
    const modified = { ...DEFAULT_ADJUSTMENTS, exposure: 1.2, grain: 30 }
    expect(hasAdjustments(modified)).toBe(true)
    expect(resetAdjustments()).toEqual(DEFAULT_ADJUSTMENTS)
    expect(hasAdjustments(resetAdjustments())).toBe(false)
  })
})

describe('before / after', () => {
  it('sceglie l’originale solo quando il confronto è attivo', () => {
    expect(resolvePreviewUrl('after.jpg', 'before.jpg', false)).toBe('after.jpg')
    expect(resolvePreviewUrl('after.jpg', 'before.jpg', true)).toBe('before.jpg')
    expect(resolvePreviewUrl('after.jpg', null, true)).toBe('after.jpg')
  })
})

describe('filtro del selettore file', () => {
  it('dichiara JPEG e PNG, incluse le estensioni maiuscole', () => {
    expect(FILE_INPUT_ACCEPT).toContain('image/jpeg')
    expect(FILE_INPUT_ACCEPT).toContain('.jpg')
    expect(FILE_INPUT_ACCEPT).toContain('.jpeg')
    expect(FILE_INPUT_ACCEPT).toContain('.JPG')
    expect(FILE_INPUT_ACCEPT).toContain('.JPEG')
    expect(FILE_INPUT_ACCEPT).toContain('image/mpo')
    expect(FILE_INPUT_ACCEPT).toContain('.mpo')
  })
})
