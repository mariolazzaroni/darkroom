import { Fragment } from 'react'
import {
  AdjustmentKey,
  Adjustments,
  CONTROL_SECTIONS,
  Curves,
} from '../editor'
import SliderControl from './SliderControl'
import ToneCurve from './ToneCurve/ToneCurve'

type AdjustmentPanelProps = {
  adjustments: Adjustments
  disabled: boolean
  onChange: (key: AdjustmentKey, value: number) => void
  onCurvesChange: (curves: Curves) => void
  onResetOne: (key: AdjustmentKey) => void
}

function AdjustmentPanel({ adjustments, disabled, onChange, onCurvesChange, onResetOne }: AdjustmentPanelProps) {
  return (
    <aside className="adjustment-panel" aria-label="Regolazioni fotografiche">
      <div className="panel-title-row">
        <span>Regolazioni</span>
        <span className="panel-hint">Doppio clic per azzerare</span>
      </div>
      <div className="sections-scroll">
        {CONTROL_SECTIONS.map((section, index) => (
          <Fragment key={section.title}>
            <details className="adjustment-section" open>
              <summary>{section.title}</summary>
              <div className="section-controls">
                {section.controls.map((control) => (
                  <SliderControl
                    key={control.key}
                    control={control}
                    value={adjustments[control.key]}
                    disabled={disabled}
                    onChange={onChange}
                    onReset={onResetOne}
                  />
                ))}
              </div>
            </details>
            {index === 0 && (
              <ToneCurve
                curves={adjustments.curves}
                disabled={disabled}
                onChange={onCurvesChange}
              />
            )}
          </Fragment>
        ))}
      </div>
    </aside>
  )
}

export default AdjustmentPanel
