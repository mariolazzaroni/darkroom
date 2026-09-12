import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react'

type EditorCanvasProps = {
  imageUrl: string | null
  imageName: string | null
  isBefore: boolean
  isRendering: boolean
  isUploading: boolean
  zoom: number
  fitMode: boolean
  error: string | null
  onChooseFile: () => void
  onDropFile: (file: File) => void
  onFitCalculated: (zoom: number) => void
}

type Point = { x: number; y: number }

function EditorCanvas({
  imageUrl,
  imageName,
  isBefore,
  isRendering,
  isUploading,
  zoom,
  fitMode,
  error,
  onChooseFile,
  onDropFile,
  onFitCalculated,
}: EditorCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragOrigin = useRef<Point | null>(null)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [naturalSize, setNaturalSize] = useState<Point>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isFileOver, setIsFileOver] = useState(false)

  const calculateFit = useCallback(() => {
    const viewport = viewportRef.current
    const image = imageRef.current
    if (!viewport || !image || !image.naturalWidth || !image.naturalHeight) return
    const availableWidth = Math.max(1, viewport.clientWidth - 64)
    const availableHeight = Math.max(1, viewport.clientHeight - 64)
    const nextZoom = Math.max(
      5,
      Math.min(
        100,
        (availableWidth / image.naturalWidth) * 100,
        (availableHeight / image.naturalHeight) * 100,
      ),
    )
    onFitCalculated(Math.round(nextZoom))
  }, [onFitCalculated])

  useEffect(() => {
    if (!fitMode) return
    const viewport = viewportRef.current
    if (!viewport) return
    calculateFit()
    const observer = new ResizeObserver(calculateFit)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [calculateFit, fitMode, imageUrl])

  useEffect(() => {
    if (fitMode) setPan({ x: 0, y: 0 })
  }, [fitMode, imageUrl])

  const canPan = Boolean(imageUrl && !fitMode)

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (!canPan || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = { x: event.clientX, y: event.clientY }
    setIsPanning(true)
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current || !isPanning) return
    const deltaX = event.clientX - dragOrigin.current.x
    const deltaY = event.clientY - dragOrigin.current.y
    dragOrigin.current = { x: event.clientX, y: event.clientY }
    setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }))
  }

  function stopPan() {
    dragOrigin.current = null
    setIsPanning(false)
  }

  return (
    <section
      ref={viewportRef}
      className={`editor-canvas${isFileOver ? ' file-over' : ''}${canPan ? ' can-pan' : ''}${isPanning ? ' is-panning' : ''}`}
      aria-label="Area di anteprima e trascinamento foto"
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setIsFileOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsFileOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsFileOver(false)
        const file = event.dataTransfer.files[0]
        if (file) onDropFile(file)
      }}
    >
      {imageUrl ? (
        <div
          className="image-stage"
          style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={`${isBefore ? 'Originale' : 'Anteprima modificata'} di ${imageName ?? 'foto'}`}
            draggable={false}
            style={{ width: naturalSize.x ? `${naturalSize.x * zoom / 100}px` : 'auto' }}
            onLoad={() => {
              if (imageRef.current) {
                setNaturalSize({ x: imageRef.current.naturalWidth, y: imageRef.current.naturalHeight })
              }
              if (fitMode) calculateFit()
            }}
          />
          {isBefore && <span className="before-badge">Prima</span>}
        </div>
      ) : (
        <button className="empty-state" type="button" onClick={onChooseFile} disabled={isUploading || Boolean(imageName)}>
          <span className="upload-icon">＋</span>
          <strong>{isUploading || imageName ? 'Preparazione preview…' : 'Trascina una fotografia'}</strong>
          <span>{imageName ? imageName : 'oppure fai clic · JPEG, PNG o MPO'}</span>
        </button>
      )}

      {isFileOver && (
        <div className="drop-overlay">
          <strong>Rilascia per aprire</strong>
          <span>JPEG, PNG o MPO</span>
        </div>
      )}
      {isRendering && imageUrl && (
        <div className="rendering-indicator" role="status">
          <span className="spinner" /> Elaborazione preview
        </div>
      )}
      {error && <div className="error-message" role="alert">{error}</div>}
    </section>
  )
}

export default EditorCanvas
