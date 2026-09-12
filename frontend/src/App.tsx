import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import AdjustmentPanel from './components/AdjustmentPanel'
import BottomBar, { JpegQuality } from './components/BottomBar'
import EditorCanvas from './components/EditorCanvas'
import {
  AdjustmentKey,
  Adjustments,
  DEFAULT_ADJUSTMENTS,
  FILE_INPUT_ACCEPT,
  hasAdjustments,
  resetAdjustments,
  resolvePreviewUrl,
} from './editor'

type UploadResult = {
  image_id: string
  filename: string
  width: number
  height: number
}

const ZOOM_STEPS = [10, 16, 25, 33, 50, 67, 100, 150, 200, 300, 400]

function App() {
  const [image, setImage] = useState<UploadResult | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustments>(resetAdjustments)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compareLocked, setCompareLocked] = useState(false)
  const [holdOriginal, setHoldOriginal] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [fitMode, setFitMode] = useState(true)
  const [quality, setQuality] = useState<JpegQuality>(95)
  const fileInput = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const originalUrlRef = useRef<string | null>(null)
  const previewRequestId = useRef(0)

  const modified = hasAdjustments(adjustments)
  const showBefore = Boolean(image && originalUrl && (compareLocked || holdOriginal))
  const displayedUrl = resolvePreviewUrl(previewUrl, originalUrl, showBefore)

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
  }, [])

  const replaceOriginalUrl = useCallback((nextUrl: string | null) => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
    originalUrlRef.current = nextUrl
    setOriginalUrl(nextUrl)
  }, [])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
  }, [])

  useEffect(() => {
    if (!image) return
    const controller = new AbortController()

    void (async () => {
      try {
        const response = await fetch(`/api/images/${image.image_id}/original-preview`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(await readApiError(response))
        replaceOriginalUrl(URL.createObjectURL(await response.blob()))
      } catch (requestError) {
        if (isAbortError(requestError)) return
        setError(requestError instanceof Error ? requestError.message : 'Originale non disponibile')
      }
    })()

    return () => controller.abort()
  }, [image, replaceOriginalUrl])

  useEffect(() => {
    if (!image) return
    const controller = new AbortController()
    const requestId = ++previewRequestId.current
    const timer = window.setTimeout(async () => {
      setIsRendering(true)
      try {
        const response = await fetch(`/api/images/${image.image_id}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adjustments),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(await readApiError(response))
        const nextUrl = URL.createObjectURL(await response.blob())
        if (requestId !== previewRequestId.current) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        replacePreviewUrl(nextUrl)
        setError(null)
      } catch (requestError) {
        if (isAbortError(requestError) || requestId !== previewRequestId.current) return
        setError(requestError instanceof Error ? requestError.message : 'Preview non disponibile')
      } finally {
        if (requestId === previewRequestId.current) setIsRendering(false)
      }
    }, 160)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [image, adjustments, replacePreviewUrl])

  const resetAll = useCallback(() => {
    if (!hasAdjustments(adjustments)) return
    if (window.confirm('Ripristinare tutte le regolazioni della foto?')) {
      setAdjustments(resetAdjustments())
    }
  }, [adjustments])

  const fitToScreen = useCallback(() => setFitMode(true), [])

  const zoomIn = useCallback(() => {
    setFitMode(false)
    setZoom((current) => ZOOM_STEPS.find((step) => step > current) ?? 400)
  }, [])

  const zoomOut = useCallback(() => {
    setFitMode(false)
    setZoom((current) => [...ZOOM_STEPS].reverse().find((step) => step < current) ?? 10)
  }, [])

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return
      const key = event.key.toLowerCase()

      if (key === 'b' && image && originalUrl) {
        event.preventDefault()
        setHoldOriginal(true)
      } else if (key === 'r' && image && !event.repeat) {
        event.preventDefault()
        resetAll()
      } else if ((event.key === '+' || event.key === '=') && image) {
        event.preventDefault()
        zoomIn()
      } else if (event.key === '-' && image) {
        event.preventDefault()
        zoomOut()
      } else if (event.key === '0' && image) {
        event.preventDefault()
        fitToScreen()
      }
    }

    function keyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'b') setHoldOriginal(false)
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  }, [fitToScreen, image, originalUrl, resetAll, zoomIn, zoomOut])

  async function uploadFile(file: File) {
    setIsUploading(true)
    setError(null)
    const body = new FormData()
    body.append('file', file)

    try {
      const response = await fetch('/api/images', { method: 'POST', body })
      if (!response.ok) throw new Error(await readApiError(response))
      const uploaded = (await response.json()) as UploadResult
      previewRequestId.current += 1
      replacePreviewUrl(null)
      replaceOriginalUrl(null)
      setAdjustments(resetAdjustments())
      setCompareLocked(false)
      setHoldOriginal(false)
      setFitMode(true)
      setQuality(95)
      setImage(uploaded)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Caricamento non riuscito')
    } finally {
      setIsUploading(false)
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void uploadFile(file)
    event.target.value = ''
  }

  function updateAdjustment(key: AdjustmentKey, value: number) {
    setAdjustments((current) => ({ ...current, [key]: value }))
  }

  function resetOne(key: AdjustmentKey) {
    setAdjustments((current) => ({ ...current, [key]: DEFAULT_ADJUSTMENTS[key] }))
  }

  async function exportJpeg() {
    if (!image) return
    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/images/${image.image_id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adjustments, quality }),
      })
      if (!response.ok) throw new Error(await readApiError(response))
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${image.filename.replace(/\.[^.]+$/, '')}-darkroom.jpg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Esportazione non riuscita')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFitCalculated = useCallback((nextZoom: number) => {
    if (fitMode) setZoom(nextZoom)
  }, [fitMode])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />Darkroom</div>
        <div className="document-status">
          {image ? (
            <>
              <span className={`modified-dot${modified ? ' visible' : ''}`} aria-hidden="true" />
              <strong title={image.filename}>{image.filename}</strong>
              <span>{image.width} × {image.height}</span>
              {modified && <em>Modificata</em>}
            </>
          ) : <span>Nessuna fotografia aperta</span>}
        </div>
        <div className="top-actions">
          <button className="ghost-button" type="button" disabled={!image || !modified} onClick={resetAll} title="Reset globale (R)">Ripristina</button>
          <button className="primary-button" type="button" onClick={() => fileInput.current?.click()} disabled={isUploading}>
            {isUploading ? 'Caricamento…' : 'Apri foto'}
          </button>
          <input ref={fileInput} className="sr-only" type="file" accept={FILE_INPUT_ACCEPT} onChange={handleFileInput} />
        </div>
      </header>

      <main className="workspace">
        <EditorCanvas
          imageUrl={displayedUrl}
          imageName={image?.filename ?? null}
          isBefore={showBefore}
          isRendering={isRendering}
          isUploading={isUploading}
          zoom={zoom}
          fitMode={fitMode}
          error={error}
          onChooseFile={() => fileInput.current?.click()}
          onDropFile={(file) => void uploadFile(file)}
          onFitCalculated={handleFitCalculated}
        />
        <AdjustmentPanel
          adjustments={adjustments}
          disabled={!image || isUploading}
          onChange={updateAdjustment}
          onCurvesChange={(curves) => setAdjustments((current) => ({ ...current, curves }))}
          onResetOne={resetOne}
        />
      </main>

      <BottomBar
        disabled={!image}
        beforeDisabled={!image || !originalUrl}
        showBefore={showBefore}
        zoom={zoom}
        fitMode={fitMode}
        quality={quality}
        isExporting={isExporting}
        onToggleBefore={() => setCompareLocked((current) => !current)}
        onFit={fitToScreen}
        onActualSize={() => { setFitMode(false); setZoom(100) }}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onQualityChange={setQuality}
        onExport={() => void exportJpeg()}
      />
    </div>
  )
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { detail?: string }
    return body.detail || `Errore ${response.status}`
  } catch {
    return `Errore ${response.status}`
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.isContentEditable
}

export default App
