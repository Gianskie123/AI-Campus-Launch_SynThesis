# Embeds every abstract and stores vectors in Qdrant.

import json
import os
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DATA_PATH = BASE_DIR / "data" / "synthesis_research_data.json"
COLLECTION = os.getenv("QDRANT_COLLECTION", "theses")
EMBED_MODEL = os.getenv("SYNTHESIS_EMBED_MODEL") or os.getenv("EMBED_MODEL", "text-embedding-3-small")
VECTOR_SIZE = int(os.getenv("SYNTHESIS_VECTOR_SIZE") or os.getenv("EMBED_VECTOR_SIZE", "1536"))


def get_oai() -> OpenAI:
    aiml_key = os.getenv("AIMLAPI_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    api_key = aiml_key or openai_key
    if not api_key:
        raise RuntimeError("Set AIMLAPI_KEY or OPENAI_API_KEY in backend/.env before running ingest.py")

    kwargs: dict[str, Any] = {"api_key": api_key}
    if aiml_key:
        kwargs["base_url"] = os.getenv("AIMLAPI_BASE_URL", "https://api.aimlapi.com/v1")
    elif os.getenv("OPENAI_BASE_URL"):
        kwargs["base_url"] = os.getenv("OPENAI_BASE_URL")
    return OpenAI(**kwargs)


oai = get_oai()
qdrant = QdrantClient(
    host=os.getenv("QDRANT_HOST", "localhost"),
    port=int(os.getenv("QDRANT_PORT", "6333")),
)

with DATA_PATH.open(encoding="utf-8") as f:
    theses = json.load(f)

try:
    if qdrant.collection_exists(COLLECTION):
        qdrant.delete_collection(COLLECTION)
except Exception:
    try:
        qdrant.delete_collection(COLLECTION)
    except Exception:
        pass

qdrant.create_collection(
    collection_name=COLLECTION,
    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
)

points: list[PointStruct] = []
for thesis in theses:
    text = f"{thesis.get('title', '')}. {thesis.get('abstract', '')}"
    response = oai.embeddings.create(input=text, model=EMBED_MODEL)
    vector = response.data[0].embedding

    # Qdrant integer IDs collided between faculty_001 and thesis_001.
    # UUID5 keeps IDs deterministic and unique for every string ID.
    point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, thesis["id"]))
    points.append(PointStruct(id=point_id, vector=vector, payload=thesis))

qdrant.upsert(collection_name=COLLECTION, points=points)
print(f"Ingested {len(points)} records into Qdrant collection '{COLLECTION}'.")
