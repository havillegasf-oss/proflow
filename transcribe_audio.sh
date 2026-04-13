#!/bin/bash
set -e
VENV="/Users/andresvillegas/.openclaw/workspace/.venv-audio"
if [ ! -d "$VENV" ]; then
  echo "Error: no existe el entorno $VENV"
  exit 1
fi
if [ -z "$1" ]; then
  echo "Uso: ./transcribe_audio.sh /ruta/al/audio.ogg"
  exit 1
fi
source "$VENV/bin/activate"
python -m whisper "$1" --language Spanish --task transcribe
