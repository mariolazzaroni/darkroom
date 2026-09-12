import { PointerEvent, useEffect, useMemo, useRef } from 'react'
import { CurveChannel, CurvePoint } from '../../editor'
import {
  addCurvePoint,
  moveCurvePoint,
  removeCurvePoint,
  sampleCurve,
} from './curveMath'

type CurveGraphProps = {
  channel: CurveChannel
  points: CurvePoint[]
  selectedIndex: number | null
  disabled: boolean
  onChange: (points: CurvePoint[]) => void
  onSelect: (index: number | null) => void
}

function CurveGraph({ channel, points, selectedIndex, disabled, onChange, onSelect }: CurveGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointsRef = useRef(points)
  const draggingIndex = useRef<number | null>(null)
  pointsRef.current = points

  const curvePath = useMemo(() => sampleCurve(points)
    .map(([input, output], index) => `${index === 0 ? 'M' : 'L'} ${input.toFixed(2)} ${(255 - output).toFixed(2)}`)
    .join(' '), [points])

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= points.length) onSelect(null)
  }, [onSelect, points.length, selectedIndex])

  function coordinates(event: PointerEvent<SVGSVGElement>): CurvePoint {
    const bounds = event.currentTarget.getBoundingClientRect()
    const input = ((event.clientX - bounds.left) / bounds.width) * 255
    const output = 255 - ((event.clientY - bounds.top) / bounds.height) * 255
    return [input, output]
  }

  function addPoint(event: PointerEvent<SVGSVGElement>) {
    if (disabled || event.button !== 0) return
    event.currentTarget.focus()
    const [input, output] = coordinates(event)
    const added = addCurvePoint(pointsRef.current, input, output)
    pointsRef.current = added.points
    onChange(added.points)
    onSelect(added.index)
  }

  function movePoint(event: PointerEvent<SVGSVGElement>) {
    if (draggingIndex.current === null) return
    const [input, output] = coordinates(event)
    const nextPoints = moveCurvePoint(pointsRef.current, draggingIndex.current, input, output)
    pointsRef.current = nextPoints
    onChange(nextPoints)
  }

  function finishDrag() {
    draggingIndex.current = null
  }

  function removeSelected() {
    if (selectedIndex === null) return
    const result = removeCurvePoint(pointsRef.current, selectedIndex)
    pointsRef.current = result.points
    onChange(result.points)
    onSelect(result.selectedIndex)
  }

  return (
    <svg
      ref={svgRef}
      className={`curve-graph ${channel}`}
      viewBox="0 0 255 255"
      role="application"
      aria-label={`Curva ${channel.toUpperCase()}. Clic per aggiungere un punto, trascina per modificarlo.`}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={addPoint}
      onPointerMove={movePoint}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={(event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIndex !== null) {
          event.preventDefault()
          removeSelected()
        }
      }}
    >
      <defs>
        <linearGradient id={`curve-gradient-${channel}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#111316" />
          <stop offset="1" stopColor="#3a3d42" />
        </linearGradient>
      </defs>
      <rect width="255" height="255" fill={`url(#curve-gradient-${channel})`} />
      {[63.75, 127.5, 191.25].map((position) => (
        <g key={position} className="curve-grid">
          <line x1={position} y1="0" x2={position} y2="255" />
          <line x1="0" y1={position} x2="255" y2={position} />
        </g>
      ))}
      <line className="curve-reference" x1="0" y1="255" x2="255" y2="0" />
      <path className="curve-line-shadow" d={curvePath} />
      <path className="curve-line" d={curvePath} />
      {points.map(([input, output], index) => (
        <circle
          key={index}
          className={`curve-point${selectedIndex === index ? ' selected' : ''}`}
          cx={input}
          cy={255 - output}
          r={selectedIndex === index ? 5 : 4}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            svgRef.current?.focus()
            draggingIndex.current = index
            onSelect(index)
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            if (index === 0 || index === points.length - 1) return
            const result = removeCurvePoint(pointsRef.current, index)
            pointsRef.current = result.points
            onChange(result.points)
            onSelect(null)
          }}
        />
      ))}
    </svg>
  )
}

export default CurveGraph
