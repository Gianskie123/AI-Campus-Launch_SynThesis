#!/usr/bin/env bash
set -e
if [ ! -d venv ]; then python3 -m venv venv; fi
. venv/bin/activate
pip install -r requirements.txt
if [ ! -f .env ]; then cp .env.example .env; fi
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
