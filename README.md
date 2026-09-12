# Darkroom

Darkroom è un editor fotografico locale e non distruttivo per immagini JPEG e PNG. I contenitori MPO vengono trattati come JPEG compatibili usando il primo frame. Il frontend React mostra l'interfaccia e invia le regolazioni al backend FastAPI; Pillow e NumPy generano la preview e il JPEG esportato senza sovrascrivere la fotografia caricata.

## Requisiti su macOS

- Python 3.9 o successivo
- Node.js 20.19 o successivo (include npm)

Puoi verificare le versioni con `python3 --version`, `node --version` e `npm --version`. Se Node.js non è installato, puoi installarlo dal sito ufficiale oppure con Homebrew: `brew install node`.

## Avvio normale

Dalla cartella principale del progetto esegui:

```bash
./start.sh
```

Lo script crea automaticamente `backend/.venv` se manca, installa le dipendenze Python quando necessario ed esegue `npm install` se `frontend/node_modules` non esiste. Avvia quindi FastAPI e Vite insieme, attende che entrambi siano disponibili e apre automaticamente il browser predefinito su `http://localhost:5173`.

Quando entrambi i servizi sono pronti, lo script apre automaticamente `http://localhost:5173` nel browser predefinito. Per arrestare correttamente sia frontend sia backend premi `Control+C` nel Terminale in cui è in esecuzione lo script.

## Uso dell'editor

Apri oppure trascina nell'area centrale una fotografia JPEG, PNG o MPO. Per gli MPO Darkroom usa il primo frame come fotografia principale. Le regolazioni sono organizzate in sezioni richiudibili; ogni cursore mostra il valore corrente e può essere ripristinato con il pulsante `↺` o con un doppio clic sul cursore o sul valore.

### Curva di viraggio

Il pannello **Curva di viraggio**, subito sotto **Luce**, parte da una diagonale neutra. Il selettore `RGB / R / G / B` sceglie la curva da modificare:

- `RGB` regola insieme la tonalità complessiva;
- `R`, `G` e `B` agiscono separatamente sui tre canali colore;
- ogni canale conserva punti e modifiche indipendenti.

Fai clic sulla curva per aggiungere un punto e trascinalo per cambiare Input e Output. Selezionando un punto puoi digitare valori precisi da 0 a 255 nei campi sotto il grafico. `Delete` o `Backspace`, e anche il doppio clic, eliminano un punto intermedio. I due estremi non si possono eliminare: possono però essere trascinati verticalmente per sollevare il punto nero o comprimere il punto bianco. Punti troppo vicini vengono accorpati e i punti intermedi non possono superarsi, così il trascinamento rimane stabile.

**Reset RGB/R/G/B** azzera soltanto il canale attivo; **Reset tutte** azzera le quattro curve. Il comando globale **Ripristina** azzera curve e regolazioni dell'intera fotografia.

Il pulsante **Prima / Dopo** mantiene visibile l'originale; in alternativa tieni premuto `B` per mostrarlo temporaneamente. I controlli inferiori consentono di adattare la foto allo schermo, visualizzarla al 100%, aumentare o diminuire lo zoom. Quando non è in modalità Adatta, la fotografia può essere spostata trascinandola.

Scorciatoie disponibili:

- `R`: reset globale, con conferma se la fotografia è modificata
- `B` tenuto premuto: mostra temporaneamente l'originale
- `+` e `-`: aumenta o diminuisce lo zoom
- `0`: adatta la foto allo spazio disponibile

Prima dell'esportazione puoi selezionare la qualità JPEG tra 70, 80, 90, 95 e 100. L'esportazione usa sempre la risoluzione originale e tutte le regolazioni correnti.

## Avvio manuale del backend

Apri un Terminale nella cartella del progetto, quindi:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Il backend sarà disponibile su `http://127.0.0.1:8000`. Puoi verificare che funzioni aprendo `http://127.0.0.1:8000/api/health`.

Lascia questo Terminale aperto. Per terminare il server usa `Control+C`; per uscire dall'ambiente virtuale usa `deactivate`.

## Avvio manuale del frontend

Apri un secondo Terminale nella cartella del progetto, quindi:

```bash
cd frontend
npm install
npm run dev
```

Vite mostrerà l'indirizzo locale, normalmente `http://localhost:5173`. Aprilo nel browser, carica un JPEG, PNG o MPO, applica le regolazioni e usa **Esporta JPEG** per scaricare il risultato.

Durante lo sviluppo Vite inoltra automaticamente le richieste `/api` al backend in ascolto sulla porta 8000, quindi entrambi i processi devono essere attivi.

## Test e build

Per eseguire i test del backend:

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
pytest
```

Per controllare la build di produzione del frontend:

```bash
cd frontend
npm run build
```

Per eseguire i test frontend:

```bash
cd frontend
npm test
```

## Struttura principale

```text
Darkroom/
├── backend/
│   ├── app/
│   │   ├── api/routes.py
│   │   ├── models/image.py
│   │   ├── services/image_processor.py
│   │   ├── services/processing/
│   │   │   ├── curves.py
│   │   │   ├── tone.py
│   │   │   ├── color.py
│   │   │   ├── effects.py
│   │   │   └── detail.py
│   │   └── main.py
│   ├── tests/test_api.py
│   ├── tests/test_curves.py
│   └── requirements.txt
├── frontend/
│   ├── src/App.tsx
│   ├── src/components/ToneCurve/
│   │   ├── ToneCurve.tsx
│   │   ├── CurveGraph.tsx
│   │   ├── CurveChannelSelector.tsx
│   │   ├── CurvePointControls.tsx
│   │   └── curveMath.ts
│   ├── src/editor.ts
│   ├── src/styles.css
│   └── vite.config.ts
├── start.sh
├── .gitignore
└── README.md
```

Le immagini caricate vengono copiate in `backend/storage/originals/`, che è esclusa da Git. Ogni modifica viene ricalcolata a partire da quella copia intatta. La preview viene ridotta a un massimo di 1600 × 1600 pixel, usa un breve debounce, annulla le richieste superate e mantiene una piccola cache in memoria; l'esportazione usa invece tutti i pixel dell'immagine originale.

Le curve usano un'interpolazione cubica monotona PCHIP. Questa passa esattamente attraverso i punti senza le oscillazioni e gli overshoot tipici delle spline cubiche generiche. Il backend genera per ogni curva una LUT da 4096 valori e la applica in modo vettorializzato con NumPy: non calcola quindi l'interpolazione pixel per pixel. Il grafico usa la stessa interpolazione, così la forma visualizzata corrisponde al tone mapping applicato.

## Ordine della pipeline

Preview ed esportazione condividono lo stesso ordine di elaborazione:

1. temperatura e tinta
2. esposizione
3. alte luci e ombre
4. bianchi e neri
5. contrasto
6. curva RGB
7. curve Red, Green e Blue
8. vividezza e saturazione
9. vignettatura
10. nitidezza
11. grana

L'ordine mette prima la correzione tonale di base, poi la curva complessiva, quindi le singole componenti colore. Preview ed esportazione richiamano la medesima pipeline e differiscono soltanto per risoluzione e formato di uscita.

## Limiti di questa versione

Sono supportati esclusivamente JPEG, PNG e MPO compatibili con Pillow; per un MPO viene elaborato solo il primo frame. I caricamenti restano sul disco locale finché non vengono rimossi manualmente e non esiste ancora una funzione di catalogo o pulizia. Lo zoom al 100% si riferisce alla preview di editing, non ai pixel dell'originale ad alta risoluzione. La curva è una point curve Lightroom-like, ma non include la modalità parametrica per regioni, il target adjustment tool o un istogramma sovrapposto. Non sono inclusi RAW, CR2, HEIC, ProRAW, database, account, cloud, AI, maschere, preset, HSL, color grading avanzato, istogramma, crop, rotazione, correzione lente o libreria fotografica.
