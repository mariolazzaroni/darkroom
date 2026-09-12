# Darkroom

Darkroom è una prima base locale per un editor fotografico non distruttivo. Il frontend React mostra l'interfaccia e invia le regolazioni al backend FastAPI; Pillow e NumPy generano la preview e il JPEG esportato senza sovrascrivere la fotografia caricata.

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

Apri `http://localhost:5173` nel browser. Per arrestare correttamente sia frontend sia backend premi `Control+C` nel Terminale in cui è in esecuzione lo script.

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

Vite mostrerà l'indirizzo locale, normalmente `http://localhost:5173`. Aprilo nel browser, carica un JPEG o PNG, modifica i quattro controlli e usa **Esporta JPEG** per scaricare il risultato.

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

## Struttura principale

```text
Darkroom/
├── backend/
│   ├── app/
│   │   ├── api/routes.py
│   │   ├── models/image.py
│   │   ├── services/image_processor.py
│   │   └── main.py
│   ├── tests/test_api.py
│   └── requirements.txt
├── frontend/
│   ├── src/App.tsx
│   ├── src/styles.css
│   └── vite.config.ts
├── start.sh
├── .gitignore
└── README.md
```

Le immagini caricate vengono copiate in `backend/storage/originals/`, che è esclusa da Git. Ogni modifica viene ricalcolata a partire da quella copia intatta. La preview viene ridotta a un massimo di 1600 × 1600 pixel e aggiornata con un breve debounce; l'esportazione usa invece tutti i pixel dell'immagine originale.

## Limiti di questa versione

Sono supportati esclusivamente JPEG e PNG. I caricamenti restano sul disco locale finché non vengono rimossi manualmente e non esiste ancora una funzione di catalogo o pulizia. Non sono inclusi RAW, HEIC, database, account, cloud, AI, maschere, preset, curve, HSL, istogramma o libreria fotografica.
