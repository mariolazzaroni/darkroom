import { CurvePoint } from '../../editor'

type CurvePointControlsProps = {
  point: CurvePoint | null
  endpoint: boolean
  disabled: boolean
  onChange: (input: number, output: number) => void
}

function CurvePointControls({ point, endpoint, disabled, onChange }: CurvePointControlsProps) {
  return (
    <div className="curve-point-controls">
      <label>
        Input
        <input
          type="number"
          min="0"
          max="255"
          value={point?.[0] ?? ''}
          disabled={disabled || !point || endpoint}
          title={endpoint ? 'L’Input dei punti estremi è fisso' : 'Input del punto selezionato'}
          onChange={(event) => point && onChange(Number(event.target.value), point[1])}
        />
      </label>
      <label>
        Output
        <input
          type="number"
          min="0"
          max="255"
          value={point?.[1] ?? ''}
          disabled={disabled || !point}
          title="Output del punto selezionato"
          onChange={(event) => point && onChange(point[0], Number(event.target.value))}
        />
      </label>
    </div>
  )
}

export default CurvePointControls

