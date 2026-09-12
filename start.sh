#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"
REQUIREMENTS_STAMP="$VENV_DIR/.darkroom-requirements.sha256"
BACKEND_URL="http://127.0.0.1:8000/api/health"
FRONTEND_URL="http://localhost:5173"
FRONTEND_CHECK_URL="http://127.0.0.1:5173"
BACKEND_PID=""
FRONTEND_PID=""
CLEANED_UP=false

cleanup() {
  if [[ "$CLEANED_UP" == true ]]; then
    return
  fi
  CLEANED_UP=true

  echo
  echo "Arresto Darkroom..."

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$FRONTEND_PID" ]]; then
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]]; then
    wait "$BACKEND_PID" 2>/dev/null || true
  fi

  echo "Darkroom arrestato."
}

handle_signal() {
  cleanup
  exit 130
}

wait_for_service() {
  local service_name="$1"
  local service_url="$2"
  local attempts=0

  while [[ "$attempts" -lt 120 ]]; do
    if curl --silent --fail --max-time 1 "$service_url" >/dev/null 2>&1; then
      return 0
    fi

    if ! kill -0 "$BACKEND_PID" 2>/dev/null || \
      ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo "Errore: $service_name non si è avviato correttamente." >&2
      return 1
    fi

    attempts=$((attempts + 1))
    sleep 0.25
  done

  echo "Errore: timeout durante l'avvio di $service_name." >&2
  return 1
}

trap cleanup EXIT
trap handle_signal INT TERM

if ! command -v python3 >/dev/null 2>&1; then
  echo "Errore: Python 3 non è installato o non è disponibile nel PATH." >&2
  exit 1
fi

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Creo l'ambiente virtuale Python..."
  python3 -m venv "$VENV_DIR"
fi

REQUIREMENTS_HASH="$(shasum -a 256 "$REQUIREMENTS_FILE" | awk '{print $1}')"
INSTALLED_HASH=""
if [[ -f "$REQUIREMENTS_STAMP" ]]; then
  INSTALLED_HASH="$(<"$REQUIREMENTS_STAMP")"
fi

if [[ "$REQUIREMENTS_HASH" != "$INSTALLED_HASH" ]] || \
  ! "$PYTHON_BIN" -c "import fastapi, uvicorn, PIL, numpy, multipart" >/dev/null 2>&1; then
  echo "Installo le dipendenze Python..."
  "$PYTHON_BIN" -m pip install -r "$REQUIREMENTS_FILE"
  printf '%s\n' "$REQUIREMENTS_HASH" > "$REQUIREMENTS_STAMP"
else
  echo "Dipendenze Python già disponibili."
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Errore: Node.js e npm non sono installati o non sono disponibili nel PATH." >&2
  echo "Installa Node.js e riprova con ./start.sh." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Errore: curl non è disponibile nel PATH." >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]] || \
  [[ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
  echo "Installo le dipendenze frontend..."
  (cd "$FRONTEND_DIR" && npm install)
else
  echo "Dipendenze frontend già disponibili."
fi

echo "Avvio il backend FastAPI sulla porta 8000..."
(
  cd "$BACKEND_DIR"
  exec "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

echo "Avvio il frontend Vite sulla porta 5173..."
(
  cd "$FRONTEND_DIR"
  exec "$FRONTEND_DIR/node_modules/.bin/vite" --host 127.0.0.1 --port 5173
) &
FRONTEND_PID=$!

echo "Attendo che backend e frontend siano disponibili..."
wait_for_service "FastAPI" "$BACKEND_URL"
wait_for_service "Vite" "$FRONTEND_CHECK_URL"

echo
echo "Darkroom è disponibile su: $FRONTEND_URL"
echo "Premi Ctrl+C per arrestare frontend e backend."
echo

if command -v open >/dev/null 2>&1; then
  if ! open "$FRONTEND_URL"; then
    echo "Avviso: non è stato possibile aprire automaticamente il browser." >&2
  fi
else
  echo "Avviso: comando 'open' non disponibile; apri manualmente $FRONTEND_URL." >&2
fi

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

echo "Uno dei processi di Darkroom si è arrestato inaspettatamente." >&2
exit 1
