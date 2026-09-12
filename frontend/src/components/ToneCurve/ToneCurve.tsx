import { useEffect, useState } from 'react'
import { CurveChannel, CurvePoint, Curves } from '../../editor'
import CurveChannelSelector from './CurveChannelSelector'
import CurveGraph from './CurveGraph'
import CurvePointControls from './CurvePointControls'
import {
  isIdentityCurve,
  moveCurvePoint,
  resetAllCurves,
  resetCurve,
} from './curveMath'

type ToneCurveProps = {
  curves: Curves
  disabled: boolean
  onChange: (curves: Curves) => void
}

function ToneCurve({ curves, disabled, onChange }: ToneCurveProps) {
  const [channel, setChannel] = useState<CurveChannel>('rgb')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const points = curves[channel]
  const selectedPoint = selectedIndex === null ? null : points[selectedIndex] ?? null
  const endpoint = selectedIndex === 0 || selectedIndex === points.length - 1

  useEffect(() => setSelectedIndex(null), [channel])

  function updatePoints(nextPoints: CurvePoint[]) {
    onChange({ ...curves, [channel]: nextPoints })
  }

  return (
    <details className="adjustment-section tone-curve-section" open>
      <summary>Curva di viraggio</summary>
      <div className="tone-curve-panel">
        <CurveChannelSelector
          active={channel}
          disabled={disabled}
          onChange={setChannel}
        />
        <CurveGraph
          channel={channel}
          points={points}
          selectedIndex={selectedIndex}
          disabled={disabled}
          onChange={updatePoints}
          onSelect={setSelectedIndex}
        />
        <div className="curve-status-row">
          <span>Canale <strong>{channel.toUpperCase()}</strong></span>
          <span>{points.length} punti</span>
        </div>
        <CurvePointControls
          point={selectedPoint}
          endpoint={endpoint}
          disabled={disabled}
          onChange={(input, output) => {
            if (selectedIndex === null) return
            updatePoints(moveCurvePoint(points, selectedIndex, input, output))
          }}
        />
        <div className="curve-reset-row">
          <button
            type="button"
            disabled={disabled || isIdentityCurve(points)}
            onClick={() => {
              updatePoints(resetCurve())
              setSelectedIndex(null)
            }}
          >
            Reset {channel.toUpperCase()}
          </button>
          <button
            type="button"
            disabled={disabled || Object.values(curves).every(isIdentityCurve)}
            onClick={() => {
              onChange(resetAllCurves())
              setSelectedIndex(null)
            }}
          >
            Reset tutte
          </button>
        </div>
        <p className="curve-help">Clic per aggiungere · trascina per regolare · Delete per rimuovere</p>
      </div>
    </details>
  )
}

export default ToneCurve
