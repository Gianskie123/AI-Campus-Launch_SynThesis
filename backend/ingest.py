# Embeds title + abstract + keywords + methodology + datasets for every
# record, and stores vectors in Qdrant using a collision-free point ID.

import json, os
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from dotenv import load_dotenv

load_dotenv()

openai  = OpenAI(api_key=os.getenv("AIMLAPI_KEY"), base_url="https://api.aimlapi.com/v1")
qdrant  = QdrantClient(host="localhost", port=6333)
COLLECTION  = "theses"
EMBED_MODEL = "text-embedding-3-small"

with open("data/synthesis_research_data.json", encoding="utf-8") as f:
    theses = json.load(f)

# NOTE: if you've ingested before with the old script, delete the existing
# collection first so stale, ID-colliding points don't linger:
#   qdrant.delete_collection(collection_name=COLLECTION)
# Create collection (safe to re-run)
try:
    qdrant.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    )
except Exception:
    pass


def build_embedding_text(record: dict) -> str:
    """
    Build the text that gets embedded for a record.

    Previously this was just `title + abstract`, which meant structured
    fields like `methodology` and `keywords` never influenced the vector —
    a record could explicitly list "XGBoost" in its methodology array and
    still rank poorly for an "xgboost" query if the word didn't happen to
    appear naturally in the abstract prose. Folding those fields in fixes
    that, since now every record's vector reflects its tagged tools and
    keywords, not just whatever phrasing the abstract happened to use.
    """
    parts = [record["title"], record.get("abstract", "")]

    if record.get("keywords"):
        parts.append("Keywords: " + ", ".join(record["keywords"]))
    if record.get("methodology"):
        parts.append("Methodology/Tools: " + ", ".join(record["methodology"]))
    if record.get("datasets"):
        parts.append("Datasets: " + ", ".join(record["datasets"]))

    return ". ".join(p for p in parts if p)


points = []
for i, thesis in enumerate(theses):
    text     = build_embedding_text(thesis)
    response = openai.embeddings.create(input=text, model=EMBED_MODEL)
    vector   = response.data[0].embedding

    points.append(PointStruct(id=i, vector=vector, payload=thesis))

qdrant.upsert(collection_name=COLLECTION, points=points)
print(f"✓ Ingested {len(points)} records.")