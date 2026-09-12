import { describe, expect, it } from 'vitest'
import { createDefaultCurves } from '../../editor'
import {
  addCurvePoint,
  evaluateCurve,
  isIdentityCurve,
  moveCurvePoint,
  removeCurvePoint,
  resetAllCurves,
  resetCurve,
  sampleCurve,
} from './curveMath'

describe('interpolazione della curva', () => {
  it('mantiene esatta la curva identità', () => {
    const samples = sampleCurve([[0, 0], [255, 255]], 256)
    samples.forEach(([input, output]) => expect(output).toBeCloseTo(input, 8))
  })

  it('crea una S-curve morbida, monotona e senza overshoot', () => {
    const points: Array<[number, number]> = [[0, 0], [64, 45], [128, 128], [192, 215], [255, 255]]
    const output = sampleCurve(points, 512).map((point) => point[1])
    expect(output.every((value, index) => index === 0 || value >= output[index - 1])).toBe(true)
    expect(Math.min(...output)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...output)).toBeLessThanOrEqual(255)
    expect(evaluateCurve(points, 64)).toBeCloseTo(45, 8)
    expect(evaluateCurve(points, 192)).toBeCloseTo(215, 8)
  })
})

describe('gestione dei punti', () => {
  it('aggiunge un punto ordinato e non crea duplicati troppo vicini', () => {
    const identity: Array<[number, number]> = [[0, 0], [255, 255]]
    const added = addCurvePoint(identity, 128, 140)
    expect(added.points).toEqual([[0, 0], [128, 140], [255, 255]])
    expect(addCurvePoint(added.points, 130, 10)).toEqual({ points: added.points, index: 1 })
  })

  it('blocca la coordinata Input degli estremi ma permette il black e white point', () => {
    const identity: Array<[number, number]> = [[0, 0], [255, 255]]
    expect(moveCurvePoint(identity, 0, 80, 20)).toEqual([[0, 20], [255, 255]])
    expect(moveCurvePoint(identity, 1, 180, 235)).toEqual([[0, 0], [255, 235]])
  })

  it('mantiene la distanza minima tra punti intermedi', () => {
    const points: Array<[number, number]> = [[0, 0], [64, 64], [128, 128], [255, 255]]
    expect(moveCurvePoint(points, 1, 127, 90)[1]).toEqual([124, 90])
  })

  it('rimuove solo i punti intermedi', () => {
    const points: Array<[number, number]> = [[0, 0], [128, 140], [255, 255]]
    expect(removeCurvePoint(points, 1).points).toEqual([[0, 0], [255, 255]])
    expect(removeCurvePoint(points, 0).points).toBe(points)
    expect(removeCurvePoint(points, 2).points).toBe(points)
  })
})

describe('reset delle curve', () => {
  it('ripristina una curva e tutte le quattro curve indipendenti', () => {
    expect(isIdentityCurve(resetCurve())).toBe(true)
    expect(resetAllCurves()).toEqual(createDefaultCurves())
    expect(resetAllCurves().rgb).not.toBe(resetAllCurves().red)
  })
})
