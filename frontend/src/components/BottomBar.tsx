type JpegQuality = 70 | 80 | 90 | 95 | 100

type BottomBarProps = {
  disabled: boolean
  beforeDisabled: boolean
  showBefore: boolean
  zoom: number
  fitMode: boolean
  quality: JpegQuality
  isExporting: boolean
  onToggleBefore: () => void
  onFit: () => void
  onActualSize: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onQualityChange: (quality: JpegQuality) => void
  onExport: () => void
}

export type { JpegQuality }

function BottomBar({
  disabled,
  beforeDisabled,
  showBefore,
  zoom,
  fitMode,
  quality,
  isExporting,
  onToggleBefore,
  onFit,
  onActualSize,
  onZoomIn,
  onZoomOut,
  onQualityChange,
  onExport,
}: BottomBarProps) {
  return (
    <footer className="bottom-bar">
      <button
        type="button"
        className={`toolbar-button compare-button${showBefore ? ' active' : ''}`}
        disabled={beforeDisabled}
        title="Mostra l'originale. Puoi anche tenere premuto B."
        onClick={onToggleBefore}
      >
        Prima / Dopo
      </button>

      <div className="zoom-controls" aria-label="Controlli zoom">
        <button type="button" className="icon-button" disabled={disabled} title="Zoom indietro (-)" onClick={onZoomOut}>−</button>
        <button type="button" className={`zoom-value${fitMode ? ' fit' : ''}`} disabled={disabled} title="Adatta allo schermo (0)" onClick={onFit}>{Math.round(zoom)}%</button>
        <button type="button" className="icon-button" disabled={disabled} title="Zoom avanti (+)" onClick={onZoomIn}>＋</button>
        <button type="button" className="toolbar-button compact" disabled={disabled} title="Visualizzazione al 100%" onClick={onActualSize}>100%</button>
        <button type="button" className="toolbar-button compact" disabled={disabled} title="Adatta allo schermo (0)" onClick={onFit}>Adatta</button>
      </div>

      <div className="export-controls">
        <label>
          Qualità
          <select
            value={quality}
            disabled={disabled || isExporting}
            onChange={(event) => onQualityChange(Number(event.target.value) as JpegQuality)}
          >
            {[70, 80, 90, 95, 100].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" className="export-button" disabled={disabled || isExporting} onClick={onExport}>
          {isExporting ? 'Esportazione…' : 'Esporta JPEG'}
        </button>
      </div>
    </footer>
  )
}

export default BottomBar
