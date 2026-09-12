import { ChangeEvent, useEffect, useRef, useState } from 'react'

type Adjustments = {
  exposure: number
  contrast: number
  saturation: number
  temperature: number
}

type UploadResult = {
  image_id: string
  filename: string
  width: number
  height: number
}

const INITIAL_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
}

const CONTROLS: Array<{
  key: keyof Adjustments
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'exposure', label: 'Esposizione', min: -2, max: 2, step: 0.1 },
  { key: 'contrast', label: 'Contrasto', min: -100, max: 100, step: 1 },
  { key: 'saturation', label: 'Saturazione', min: -100, max: 100, step: 1 },
  { key: 'temperature', label: 'Temperatura colore', min: -100, max: 100, step: 1 },
]

function App() {
  const [image, setImage] = useState<UploadResult | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustments>(INITIAL_ADJUSTMENTS)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!image) return

    const controller = new AbortController()
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
        const blob = await response.blob()
        const nextUrl = URL.createObjectURL(blob)
        setPreviewUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl)
          return nextUrl
        })
        setError(null)
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Preview non disponibile')
      } finally {
        if (!controller.signal.aborted) setIsRendering(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [image, adjustments])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    const body = new FormData()
    body.append('file', file)

    try {
      const response = await fetch('/api/images', { method: 'POST', body })
      if (!response.ok) throw new Error(await readApiError(response))
      const uploaded = (await response.json()) as UploadResult
      setAdjustments(INITIAL_ADJUSTMENTS)
      setImage(uploaded)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Caricamento non riuscito')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function exportJpeg() {
    if (!image) return
    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/images/${image.image_id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustments),
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />Darkroom</div>
        <button className="primary-button" onClick={() => fileInput.current?.click()} disabled={isUploading}>
          {isUploading ? 'Caricamento…' : 'Carica foto'}
        </button>
        <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={handleFile} />
      </header>

      <main className="workspace">
        <aside className="left-panel">
          <p className="panel-label">Immagine</p>
          {image ? (
            <div className="file-info">
              <strong title={image.filename}>{image.filename}</strong>
              <span>{image.width} × {image.height} px</span>
            </div>
          ) : <p className="muted-copy">Nessuna foto caricata</p>}
        </aside>

        <section className="canvas" aria-label="Area di anteprima">
          {previewUrl ? (
            <div className="photo-frame">
              <img src={previewUrl} alt={`Anteprima di ${image?.filename ?? 'foto'}`} />
              {isRendering && <span className="rendering-badge">Aggiornamento…</span>}
            </div>
          ) : (
            <button className="empty-state" onClick={() => fileInput.current?.click()}>
              <span className="upload-icon">＋</span>
              <strong>Carica una fotografia</strong>
              <span>JPEG o PNG</span>
            </button>
          )}
          {error && <div className="error-message" role="alert">{error}</div>}
        </section>

        <aside className="right-panel">
          <div className="controls-heading">
            <p className="panel-label">Regolazioni</p>
            <button className="text-button" disabled={!image} onClick={() => setAdjustments(INITIAL_ADJUSTMENTS)}>Reset</button>
          </div>

          <div className="controls-list">
            {CONTROLS.map((control) => (
              <label className="control" key={control.key}>
                <span><span>{control.label}</span><output>{formatValue(control.key, adjustments[control.key])}</output></span>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={adjustments[control.key]}
                  disabled={!image}
                  onChange={(event) => setAdjustments((current) => ({ ...current, [control.key]: Number(event.target.value) }))}
                />
              </label>
            ))}
          </div>

          <button className="export-button" disabled={!image || isExporting} onClick={exportJpeg}>
            {isExporting ? 'Esportazione…' : 'Esporta JPEG'}
          </button>
        </aside>
      </main>
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

function formatValue(key: keyof Adjustments, value: number): string {
  if (key === 'exposure') return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
  return `${value > 0 ? '+' : ''}${value}`
}

export default App
