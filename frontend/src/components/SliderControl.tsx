import { AdjustmentKey, ControlDefinition, formatAdjustmentValue } from '../editor'

type SliderControlProps = {
  control: ControlDefinition
  value: number
  disabled: boolean
  onChange: (key: AdjustmentKey, value: number) => void
  onReset: (key: AdjustmentKey) => void
}

function SliderControl({ control, value, disabled, onChange, onReset }: SliderControlProps) {
  const reset = () => onReset(control.key)

  return (
    <div className="control" title={control.tooltip}>
      <div className="control-header">
        <label htmlFor={`adjustment-${control.key}`}>{control.label}</label>
        <div className="control-value-group">
          <output
            htmlFor={`adjustment-${control.key}`}
            onDoubleClick={reset}
            title="Doppio clic per reimpostare"
          >
            {formatAdjustmentValue(control.key, value)}
          </output>
          <button
            type="button"
            className="reset-control"
            aria-label={`Reimposta ${control.label}`}
            title={`Reimposta ${control.label}`}
            disabled={disabled || value === 0}
            onClick={reset}
          >
            ↺
          </button>
        </div>
      </div>
      <input
        id={`adjustment-${control.key}`}
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        disabled={disabled}
        aria-valuetext={formatAdjustmentValue(control.key, value)}
        onDoubleClick={reset}
        onChange={(event) => onChange(control.key, Number(event.target.value))}
      />
    </div>
  )
}

export default SliderControl

