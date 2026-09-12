import { CurvePoint, Curves, createDefaultCurves, createIdentityCurve } from '../../editor'

export const MIN_POINT_DISTANCE = 4

export function evaluateCurve(points: CurvePoint[], input: number): number {
  const x = points.map((point) => point[0])
  const y = points.map((point) => point[1])
  const tangents = pchipTangents(x, y)
  const clampedInput = clamp(input, 0, 255)
  let interval = points.length - 2

  for (let index = 0; index < points.length - 1; index += 1) {
    if (clampedInput <= x[index + 1]) {
      interval = index
      break
    }
  }

  const width = x[interval + 1] - x[interval]
  const t = (clampedInput - x[interval]) / width
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1
  const h10 = t ** 3 - 2 * t ** 2 + t
  const h01 = -2 * t ** 3 + 3 * t ** 2
  const h11 = t ** 3 - t ** 2
  return clamp(
    h00 * y[interval]
      + h10 * width * tangents[interval]
      + h01 * y[interval + 1]
      + h11 * width * tangents[interval + 1],
    0,
    255,
  )
}

export function sampleCurve(points: CurvePoint[], samples = 160): CurvePoint[] {
  return Array.from({ length: samples }, (_, index) => {
    const input = (index / (samples - 1)) * 255
    return [input, evaluateCurve(points, input)]
  })
}

export function addCurvePoint(
  points: CurvePoint[],
  input: number,
  output = evaluateCurve(points, input),
): { points: CurvePoint[]; index: number } {
  const x = Math.round(clamp(input, 1, 254))
  const nearestIndex = points.findIndex((point) => Math.abs(point[0] - x) < MIN_POINT_DISTANCE)
  if (nearestIndex >= 0) return { points, index: nearestIndex }

  const nextPoints = [...points, [x, Math.round(clamp(output, 0, 255))] as CurvePoint]
    .sort((first, second) => first[0] - second[0])
  return { points: nextPoints, index: nextPoints.findIndex((point) => point[0] === x) }
}

export function moveCurvePoint(
  points: CurvePoint[],
  index: number,
  input: number,
  output: number,
): CurvePoint[] {
  if (!points[index]) return points
  const isFirst = index === 0
  const isLast = index === points.length - 1
  const minimumInput = isFirst ? 0 : points[index - 1][0] + MIN_POINT_DISTANCE
  const maximumInput = isLast ? 255 : points[index + 1][0] - MIN_POINT_DISTANCE
  const nextInput = isFirst ? 0 : isLast ? 255 : Math.round(clamp(input, minimumInput, maximumInput))
  const nextOutput = Math.round(clamp(output, 0, 255))
  return points.map((point, pointIndex) => (
    pointIndex === index ? [nextInput, nextOutput] as CurvePoint : point
  ))
}

export function removeCurvePoint(
  points: CurvePoint[], index: number,
): { points: CurvePoint[]; selectedIndex: number | null } {
  if (index <= 0 || index >= points.length - 1) return { points, selectedIndex: index }
  return { points: points.filter((_, pointIndex) => pointIndex !== index), selectedIndex: null }
}

export function resetCurve(): CurvePoint[] {
  return createIdentityCurve()
}

export function resetAllCurves(): Curves {
  return createDefaultCurves()
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
  return points.length === 2
    && points[0][0] === 0 && points[0][1] === 0
    && points[1][0] === 255 && points[1][1] === 255
}

function pchipTangents(x: number[], y: number[]): number[] {
  const count = x.length
  const widths = x.slice(1).map((value, index) => value - x[index])
  const slopes = y.slice(1).map((value, index) => (value - y[index]) / widths[index])
  if (count === 2) return [slopes[0], slopes[0]]

  const tangents = Array<number>(count).fill(0)
  for (let index = 1; index < count - 1; index += 1) {
    const before = slopes[index - 1]
    const after = slopes[index]
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) continue
    const beforeWeight = 2 * widths[index] + widths[index - 1]
    const afterWeight = widths[index] + 2 * widths[index - 1]
    tangents[index] = (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after)
  }
  tangents[0] = endpointTangent(widths[0], widths[1], slopes[0], slopes[1])
  tangents[count - 1] = endpointTangent(
    widths[widths.length - 1],
    widths[widths.length - 2],
    slopes[slopes.length - 1],
    slopes[slopes.length - 2],
  )
  return tangents
}

function endpointTangent(width: number, nextWidth: number, slope: number, nextSlope: number): number {
  const tangent = ((2 * width + nextWidth) * slope - width * nextSlope) / (width + nextWidth)
  if (Math.sign(tangent) !== Math.sign(slope)) return 0
  if (Math.sign(slope) !== Math.sign(nextSlope) && Math.abs(tangent) > Math.abs(3 * slope)) return 3 * slope
  return tangent
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
