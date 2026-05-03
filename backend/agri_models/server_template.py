
# server.py — FastAPI backend pour React Native
# Installation: pip install fastapi uvicorn
# Lancement: uvicorn server:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI
from pydantic import BaseModel
import functools, pickle, os

app = FastAPI(title="Agri Storage API v6")
MODELS_DIR = "models_pkl"

@functools.lru_cache(maxsize=32)  # Cache les .pkl en mémoire
def load_model(product: str):
    with open(os.path.join(MODELS_DIR, f"{product}.pkl"), "rb") as f:
        return pickle.load(f)

class PredictRequest(BaseModel):
    product: str
    date: str          # "2024-11-15"
    price_tnd_kg: float
    region: str
    season: str        # hiver|printemps|ete|automne
    # Optionnel: lags historiques pour meilleure précision
    lag_1: float = None
    lag_7: float = None

@app.post("/predict")
def predict(req: PredictRequest):
    return predict_for_mobile(
        req.product, req.date, req.price_tnd_kg,
        req.region, req.season
    )

@app.get("/products")
def list_products():
    return [f.replace(".pkl","") for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]
