from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
import joblib
import numpy as np
import pandas as pd
import unicodedata
import json
import os
from dotenv import load_dotenv
import pickle
from datetime import datetime

BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))

from groq import Groq
from backend.auth import router as auth_router

# ── Config Groq ───────────────────────────────────────────────────────────────
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI(title="Smart Irrigation API")

# ── Auth router ───────────────────────────────────────────────────────────────
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Chargement des modeles IRRIGATION ────────────────────────────────────────
def load_model(filename: str):
    return joblib.load(os.path.join(BASE_DIR, filename))

model    = load_model("model_irrigation_best.pkl")
scaler   = load_model("scaler_irrigation.pkl")
encoders = load_model("encodeurs_irrigation.pkl")

le_erosion   = encoders["le_erosion"]
le_pedestal  = encoders["le_pedestal"]
le_culture   = encoders["le_culture"]
ALL_FEATURES = encoders["features"]
cultures     = encoders["cultures"]

# ── Chargement des modeles FERTILIZER ────────────────────────────────────────
rf_pipeline    = load_model("rf_pipeline.pkl")
regressor_fert = load_model("regressor_fert.pkl")
scaler_fert    = load_model("scaler_fert.pkl")
le_soil        = load_model("le_soil.pkl")
le_crop        = load_model("le_crop.pkl")
le_fert        = load_model("le_fert.pkl")
FEATURES_FERT  = load_model("features_fert.pkl")
# ── Chargement des modeles STORAGE ────────────────────────────────────────────
STORAGE_MODELS_DIR = os.path.join(BASE_DIR, "agri_models")

def load_storage_metadata():
    meta_path = os.path.join(STORAGE_MODELS_DIR, "metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def load_storage_pkg(product: str):
    pkl_path = os.path.join(STORAGE_MODELS_DIR, f"{product}.pkl")
    if not os.path.exists(pkl_path):
        return None
    with open(pkl_path, "rb") as f:
        return pickle.load(f)

storage_metadata = load_storage_metadata()

# ── Utilitaire accents ────────────────────────────────────────────────────────
def normalize(text: str) -> str:
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()

# ── Fonction interne IRRIGATION ───────────────────────────────────────────────
def run_predict(altitude, latitude, longitude, depth_restriction,
                sign_erosion, stone_pedestal, rain_mean_mm,
                rain_accum, pct_normal, culture_name):
    mask = cultures["culture"].apply(normalize) == normalize(culture_name)
    cult = cultures[mask]
    if len(cult) == 0:
        return {"error": f"Culture '{culture_name}' introuvable"}
    cult = cult.iloc[0]

    erosion_enc  = le_erosion.transform([sign_erosion])[0]
    pedestal_enc = le_pedestal.transform([stone_pedestal])[0]
    culture_enc  = le_culture.transform([cult["culture"]])[0]

    kc_x_rain        = cult["kc"] * rain_mean_mm
    deficit_hydrique = max(0, cult["besoin_ref_mm_j"] * 30 - rain_mean_mm)
    stress_sol       = depth_restriction * erosion_enc
    densite_pluie    = rain_accum / (rain_mean_mm + 1)

    row = pd.DataFrame([{
        "altitude"                : altitude,
        "latitude"                : latitude,
        "longitude"               : longitude,
        "depth_restriction_cause" : depth_restriction,
        "erosion_enc"             : erosion_enc,
        "pedestal_enc"            : pedestal_enc,
        "rain_mean_mm"            : rain_mean_mm,
        "rain_accum_mean"         : rain_accum,
        "pct_normal_mean"         : pct_normal,
        "besoin_ref_mm_j"         : cult["besoin_ref_mm_j"],
        "kc"                      : cult["kc"],
        "root_depth_cm"           : cult["root_depth_cm"],
        "drought_tolerant"        : cult["drought_tolerant"],
        "culture_enc"             : culture_enc,
        "kc_x_rain"               : kc_x_rain,
        "deficit_hydrique"        : deficit_hydrique,
        "stress_sol"              : stress_sol,
        "densite_pluie"           : densite_pluie,
    }])[ALL_FEATURES]

    row_sc = scaler.transform(row)
    bni    = float(np.clip(model.predict(row_sc)[0], 0.1, 15))
    niveau = "Faible" if bni < 2 else ("Moyen" if bni < 4 else "Eleve")
    return {"BNI_mm_j": round(bni, 3), "Niveau": niveau, "Culture": str(cult["culture"])}

# ── Fonction interne FERTILIZER ───────────────────────────────────────────────
def run_predict_fertilizer(temperature, humidity, moisture, soil_type, crop_type,
                            nitrogen, phosphorous, potassium):
    try:
        soil_enc = le_soil.transform([soil_type])[0]
    except:
        return {"error": f"Type de sol '{soil_type}' inconnu. Disponibles: {list(le_soil.classes_)}"}
    try:
        crop_enc = le_crop.transform([crop_type])[0]
    except:
        return {"error": f"Culture '{crop_type}' inconnue. Disponibles: {list(le_crop.classes_)}"}

    X_clf     = np.array([[temperature, humidity, moisture, soil_enc, crop_enc,
                           nitrogen, phosphorous, potassium]])
    fert_enc  = rf_pipeline.predict(X_clf)[0]
    fert_name = le_fert.inverse_transform([fert_enc])[0]

    npk_total    = nitrogen + phosphorous + potassium
    npk_deficit  = max(0, 25 - nitrogen) + max(0, 22 - phosphorous) + max(0, 15 - potassium)
    n_ratio      = nitrogen    / (npk_total + 1e-6)
    p_ratio      = phosphorous / (npk_total + 1e-6)
    k_ratio      = potassium   / (npk_total + 1e-6)
    temp_hum     = temperature * humidity / 1000
    moisture_npk = moisture * npk_deficit / 100
    stress_idx   = npk_deficit / (moisture + 1)

    row = pd.DataFrame([{
        "Temparature"  : temperature,
        "Humidity"     : humidity,
        "Moisture"     : moisture,
        "Soil_enc"     : soil_enc,
        "Crop_enc"     : crop_enc,
        "Fert_enc"     : fert_enc,
        "Nitrogen"     : nitrogen,
        "Phosphorous"  : phosphorous,
        "Potassium"    : potassium,
        "NPK_total"    : npk_total,
        "NPK_deficit"  : npk_deficit,
        "N_ratio"      : n_ratio,
        "P_ratio"      : p_ratio,
        "K_ratio"      : k_ratio,
        "Temp_Hum"     : temp_hum,
        "Moisture_NPK" : moisture_npk,
        "Stress_idx"   : stress_idx,
    }]).reindex(columns=FEATURES_FERT, fill_value=0)

    row_sc   = scaler_fert.transform(row)
    quantite = float(np.clip(regressor_fert.predict(row_sc)[0], 50, 300))

    if npk_deficit > 40:
        niveau = "Critique"
    elif npk_deficit > 20:
        niveau = "Moyen"
    else:
        niveau = "Faible"

    return {
        "Fertilisant"    : fert_name,
        "Quantite_kg_ha" : round(quantite, 2),
        "Niveau_Deficit" : niveau,
        "Culture"        : crop_type,
        "Sol"            : soil_type,
    }

# ── Tools pour Groq ───────────────────────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "predict_bni",
            "description": "Predit le besoin net en irrigation BNI en mm/jour pour une parcelle agricole.",
            "parameters": {
                "type": "object",
                "properties": {
                    "altitude":          {"type": "number", "description": "Altitude en metres"},
                    "latitude":          {"type": "number", "description": "Latitude GPS"},
                    "longitude":         {"type": "number", "description": "Longitude GPS"},
                    "depth_restriction": {"type": "number", "description": "Restriction profondeur sol en cm, 0 si aucune"},
                    "sign_erosion":      {"type": "string", "description": "Signe erosion: Yes ou No"},
                    "stone_pedestal":    {"type": "string", "description": "Piedestaux rocheux: Yes ou No"},
                    "rain_mean_mm":      {"type": "number", "description": "Pluie mensuelle moyenne en mm"},
                    "rain_accum":        {"type": "number", "description": "Pluie accumulee annuelle en mm"},
                    "pct_normal":        {"type": "number", "description": "Pourcentage par rapport a la normale"},
                    "culture_name":      {"type": "string", "description": "Culture: Ble, Mais, Tomate, Pomme de terre, Oignon, Carotte, Laitue, Pasteque, Poivron, Courgette"}
                },
                "required": ["altitude", "latitude", "longitude", "depth_restriction",
                             "sign_erosion", "stone_pedestal", "rain_mean_mm",
                             "rain_accum", "pct_normal", "culture_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_alert",
            "description": "Donne une alerte irrigation selon le BNI.",
            "parameters": {
                "type": "object",
                "properties": {
                    "bni":     {"type": "number"},
                    "culture": {"type": "string"}
                },
                "required": ["bni", "culture"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_cultures",
            "description": "Retourne la liste de toutes les cultures disponibles pour l irrigation.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "predict_fertilizer",
            "description": "Predit le fertilisant recommande ET la quantite en kg/ha pour une parcelle agricole.",
            "parameters": {
                "type": "object",
                "properties": {
                    "temperature":  {"type": "number", "description": "Temperature en degres Celsius"},
                    "humidity":     {"type": "number", "description": "Humidite relative en %"},
                    "moisture":     {"type": "number", "description": "Humidite du sol en %"},
                    "soil_type":    {"type": "string", "description": "Type de sol: Sandy, Loamy, Black, Red, Clayey"},
                    "crop_type":    {"type": "string", "description": "Culture: Maize, Wheat, Cotton, Tobacco, Paddy, Barley, Millets, Oil seeds, Pulses, Ground Nuts, Sugarcane"},
                    "nitrogen":     {"type": "number", "description": "Taux d azote dans le sol"},
                    "phosphorous":  {"type": "number", "description": "Taux de phosphore dans le sol"},
                    "potassium":    {"type": "number", "description": "Taux de potassium dans le sol"}
                },
                "required": ["temperature", "humidity", "moisture", "soil_type", "crop_type",
                             "nitrogen", "phosphorous", "potassium"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_fertilizer_alert",
            "description": "Donne une alerte et recommandation sur le fertilisant predit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "fertilisant":    {"type": "string"},
                    "quantite_kg_ha": {"type": "number"},
                    "niveau":         {"type": "string"},
                    "culture":        {"type": "string"}
                },
                "required": ["fertilisant", "quantite_kg_ha", "niveau", "culture"]
            }
        }
    }
]

def execute_tool(tool_name: str, tool_args: dict) -> str:
    if tool_name == "predict_bni":
        result = run_predict(**tool_args)
        return json.dumps(result, ensure_ascii=False)

    elif tool_name == "get_cultures":
        return json.dumps({"cultures": cultures["culture"].tolist()}, ensure_ascii=False)

    elif tool_name == "check_alert":
        bni     = tool_args["bni"]
        culture = tool_args["culture"]
        if bni >= 4:
            alerte = f"ALERTE SECHERESSE : {culture} a besoin de {bni} mm/j. Irrigation urgente."
            niveau = "Eleve"
        elif bni >= 2:
            alerte = f"ATTENTION : {culture} besoin moyen {bni} mm/j. Surveiller humidite sol."
            niveau = "Moyen"
        else:
            alerte = f"OK : {culture} besoin faible {bni} mm/j. Pas d irrigation urgente."
            niveau = "Faible"
        return json.dumps({"alerte": alerte, "niveau": niveau})

    elif tool_name == "predict_fertilizer":
        result = run_predict_fertilizer(**tool_args)
        return json.dumps(result, ensure_ascii=False)

    elif tool_name == "check_fertilizer_alert":
        fertilisant    = tool_args["fertilisant"]
        quantite_kg_ha = tool_args["quantite_kg_ha"]
        niveau         = tool_args["niveau"]
        culture        = tool_args["culture"]
        if niveau == "Critique":
            alerte = f"ALERTE : Sol tres pauvre ! Appliquer {quantite_kg_ha} kg/ha de {fertilisant} pour {culture} immediatement."
        elif niveau == "Moyen":
            alerte = f"ATTENTION : Deficit modere. Appliquer {quantite_kg_ha} kg/ha de {fertilisant} pour {culture}."
        else:
            alerte = f"OK : Sol correct. Appliquer {quantite_kg_ha} kg/ha de {fertilisant} pour {culture} en entretien."
        return json.dumps({"alerte": alerte, "niveau": niveau})

    return json.dumps({"error": "Outil inconnu"})

SYSTEM_PROMPT = """Tu es AgriExpert 🌱, expert agronome specialise en irrigation et fertilisation agricole en Tunisie.
Tu aides les agriculteurs tunisiens a optimiser leurs cultures avec des conseils pratiques et concrets.

=== IRRIGATION ===
Cultures disponibles : Ble, Mais, Tomate, Pomme de terre, Oignon, Carotte, Laitue, Pasteque, Poivron, Courgette.
- Utilise predict_bni pour calculer le Besoin Net en Irrigation (mm/jour)
- Utilise check_alert pour verifier les alertes
- Niveaux BNI : Faible (<2), Modere (2-4), Eleve (4-6), Tres Eleve (>6) mm/jour
- Conseille sur la frequence d arrosage et la methode (goutte-a-goutte, aspersion...)

=== FERTILISATION ===
Cultures disponibles : Maize, Wheat, Cotton, Tobacco, Paddy, Barley, Millets, Oil seeds, Pulses, Ground Nuts, Sugarcane.
Types de sol : Sandy, Loamy, Black, Red, Clayey.
- Utilise predict_fertilizer pour recommander l engrais et la quantite en kg/ha
- Utilise check_fertilizer_alert pour verifier les alertes
- Engrais : Urea (azote), DAP (azote+phosphore), MOP (potassium), 17-17-17 (equilibre NPK)...
- Explique le role de N (azote), P (phosphore), K (potassium) si l utilisateur le demande

=== CONSEILS GENERAUX ===
- Adapte toujours tes conseils au climat tunisien (nord humide, centre semi-aride, sud aride)
- Si l utilisateur donne des valeurs, utilise-les exactement sans les modifier
- NE JAMAIS inventer des coordonnees ou des valeurs
- NE JAMAIS depasser 150 mots par reponse
- Si la question n est pas agricole, redirige poliment vers l agriculture
- Reponds toujours en francais avec des emojis pour plus de clarte
"""

# ── Modeles Pydantic ──────────────────────────────────────────────────────────
class ParcellInput(BaseModel):
    altitude: float
    latitude: float
    longitude: float
    depth_restriction: float
    sign_erosion: str
    stone_pedestal: str
    rain_mean_mm: float
    rain_accum: float
    pct_normal: float
    culture_name: str

class FertilizerInput(BaseModel):
    temperature: float
    humidity: float
    moisture: float
    soil_type: str
    crop_type: str
    nitrogen: float
    phosphorous: float
    potassium: float

class StorageInput(BaseModel):
    product: str
    price_tnd_kg: float
    region: str
    date: str
    season: str
    lag_1:  float = None
    lag_7:  float = None
    lag_14: float = None
    lag_30: float = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

def normalize_chat_messages(raw_messages: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for item in raw_messages:
        if not isinstance(item, dict):
            continue
        role = item.get("role", "user")
        content = item.get("content") or item.get("text")
        if content is None:
            continue
        normalized.append({"role": role, "content": str(content)})
    return normalized

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Smart Irrigation API fonctionne !"}

@app.get("/cultures")
def get_cultures_endpoint():
    return {"cultures": cultures["culture"].tolist()}

@app.post("/predict")
def predict(data: ParcellInput):
    return run_predict(
        data.altitude, data.latitude, data.longitude,
        data.depth_restriction, data.sign_erosion, data.stone_pedestal,
        data.rain_mean_mm, data.rain_accum, data.pct_normal, data.culture_name
    )

@app.post("/fertilizer/predict")
def predict_fertilizer(data: FertilizerInput):
    return run_predict_fertilizer(
        data.temperature, data.humidity, data.moisture,
        data.soil_type, data.crop_type,
        data.nitrogen, data.phosphorous, data.potassium
    )

@app.post("/chat")
def chat(payload: Any = Body(...)):
    try:
        raw_messages = None
        if isinstance(payload, dict):
            raw_messages = payload.get("messages")
        elif isinstance(payload, list):
            raw_messages = payload

        if not isinstance(raw_messages, list):
            raise HTTPException(status_code=422, detail="Body must include a messages list")

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(normalize_chat_messages(raw_messages))
        if len(messages) == 1:
            raise HTTPException(status_code=422, detail="No valid messages provided")

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=2048
        )

        while response.choices[0].finish_reason == "tool_calls":
            tool_calls = response.choices[0].message.tool_calls
            messages.append(response.choices[0].message)

            for tool_call in tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                result    = execute_tool(tool_name, tool_args)

                messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call.id,
                    "content":      result
                })

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=1024
            )

        return {"response": response.choices[0].message.content}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}

# ── Fonction interne STORAGE DECISION ─────────────────────────────────────────
def run_storage_predict(product: str, price_tnd_kg: float, region: str,
                         date_str: str, season: str,
                         lag_1=None, lag_7=None,
                         lag_14=None, lag_30=None):
    pkg = load_storage_pkg(product)
    if pkg is None:
        return {"error": f"Produit '{product}' non disponible"}

    region_classes = pkg.get("region_classes", [])
    region_enc = region_classes.index(region) if region in region_classes else 0

    date   = pd.Timestamp(date_str)
    season_map = {"hiver": 0, "printemps": 1, "ete": 2, "automne": 3}
    doy    = date.dayofyear
    week   = date.isocalendar().week

    # Utiliser les lags fournis ou prix actuel comme fallback
    p = price_tnd_kg
    l1  = lag_1  if lag_1  is not None else p
    l7  = lag_7  if lag_7  is not None else p
    l14 = lag_14 if lag_14 is not None else p
    l30 = lag_30 if lag_30 is not None else p

    feat = {c: 0.0 for c in pkg["feature_cols"]}
    feat.update({
        "lag_1": l1,  "lag_3": p,   "lag_7": l7,
        "lag_14": l14,"lag_21": l30,"lag_30": l30,
        "ma_7": l7,   "ma_14": l14, "ma_30": l30,
        "std_7": 0.0, "std_14": 0.0,"std_30": 0.0,
        "ewm_7": l7,  "ewm_14": l14,"ewm_30": l30,
        "momentum_3": p - l7,  "momentum_7": p - l7,
        "momentum_14": p - l14,"momentum_accel": 0.0,
        "price_ratio_ma7":  p / (l7  + 1e-9),
        "price_ratio_ma14": p / (l14 + 1e-9),
        "price_ratio_ma30": p / (l30 + 1e-9),
        "price_zscore_30": (p - l30) / (abs(l30 - l7) + 1e-9),
        "supply_stress": 0.0,
        "annual_ma": l30, "price_vs_annual": p / (l30 + 1e-9),
        "range_ratio_14": abs(p - l14) / (l14 + 1e-9),
        "month":  float(date.month),
        "week":   float(week),
        "doy":    float(doy),
        "year":   float(date.year),
        "season_enc": float(season_map.get(season, 0)),
        "region_enc": float(region_enc),
        "sin_doy_1": float(np.sin(2 * np.pi * doy / 365)),
        "cos_doy_1": float(np.cos(2 * np.pi * doy / 365)),
        "sin_doy_2": float(np.sin(4 * np.pi * doy / 365)),
        "cos_doy_2": float(np.cos(4 * np.pi * doy / 365)),
        "sin_week":  float(np.sin(2 * np.pi * float(week) / 52)),
        "cos_week":  float(np.cos(2 * np.pi * float(week) / 52)),
    })

    mods_by_h    = pkg["models_by_horizon"]
    cost_per_day = pkg.get("storage_cost_per_day", 0.01)
    max_h        = pkg.get("max_storage_days", 14)
    fragil       = pkg.get("fragility", 0.3)
    horizons     = pkg.get("horizons", [3, 7, 14])

    X = pd.DataFrame([feat])[pkg["feature_cols"]]

    best_gain_net = -np.inf
    best_h        = 0
    forecasts     = {}
    gains         = {}
    confidences   = {}

    for h in horizons:
        if h > max_h or h not in mods_by_h:
            continue
        mods  = mods_by_h[h]
        p_xgb = float(mods["xgb_50"].predict(X)[0])
        p_lgb = float(mods["lgb_50"].predict(X)[0])
        stack = np.array([[p_xgb, p_lgb]])
        p50   = float(mods["meta"].predict(stack)[0]) if mods["meta"] else (p_xgb + p_lgb) / 2
        p05   = float(mods["q05"].predict(X)[0])
        p95   = float(mods["q95"].predict(X)[0])

        storage_cost = cost_per_day * h
        gain_brut    = p50 - price_tnd_kg - storage_cost
        gain_net     = gain_brut * (1 - fragil * (h / max(max_h, 1)))

        pi_width = max(p95 - p05, 1e-6)
        conf     = max(0.0, min(100.0, 100 * (1 - pi_width / (abs(p50) + 1e-9) / 2)))

        forecasts[str(h)]   = {
            "q05": round(p05, 4),
            "q50": round(p50, 4),
            "q95": round(p95, 4),
        }
        gains[str(h)]       = round(gain_net, 4)
        confidences[str(h)] = round(conf, 1)

        if gain_net > 0.001 and gain_net > best_gain_net:
            best_gain_net = gain_net
            best_h        = h

    decision = "store" if best_h > 0 else "sell"
    valid_h_keys = [str(h) for h in horizons if str(h) in forecasts]
    main_h_key   = min(valid_h_keys, key=lambda k: abs(int(k) - 7)) if valid_h_keys else None

    # Construire serie historique simulee pour le graphe
    chart_labels  = [f"J-{i}" for i in reversed(range(1, 8))] + ["Auj"]
    chart_history = [round(price_tnd_kg * (1 + np.random.normal(0, 0.03)), 3)
                     for _ in range(7)] + [price_tnd_kg]

    chart_future_labels = []
    chart_q05 = []
    chart_q50 = []
    chart_q95 = []
    for h in sorted(horizons):
        if str(h) in forecasts:
            chart_future_labels.append(f"J+{h}")
            chart_q05.append(forecasts[str(h)]["q05"])
            chart_q50.append(forecasts[str(h)]["q50"])
            chart_q95.append(forecasts[str(h)]["q95"])

    return {
        "product":           product,
        "date":              date_str,
        "region":            region,
        "price_now":         round(price_tnd_kg, 4),
        "decision":          decision,
        "best_horizon_days": best_h,
        "expected_gain_net": round(best_gain_net, 4) if best_h > 0 else 0.0,
        "confidence_pct":    confidences.get(main_h_key, 50.0) if main_h_key else 50.0,
        "price_q05":         forecasts.get(main_h_key, {}).get("q05") if main_h_key else None,
        "price_q50":         forecasts.get(main_h_key, {}).get("q50") if main_h_key else None,
        "price_q95":         forecasts.get(main_h_key, {}).get("q95") if main_h_key else None,
        "gains_by_horizon":  gains,
        "forecasts":         forecasts,
        "confidences":       confidences,
        "chart": {
            "history_labels":  chart_labels,
            "history_values":  chart_history,
            "future_labels":   chart_future_labels,
            "q05":             chart_q05,
            "q50":             chart_q50,
            "q95":             chart_q95,
        },
        "available_products": list(storage_metadata.get("products", [])),
        "available_regions":  pkg.get("region_classes", []),
    }


@app.get("/storage/products")
def get_storage_products():
    products = storage_metadata.get("products", [])
    return {"products": products}


@app.post("/storage/predict")
def predict_storage(data: StorageInput):
    return run_storage_predict(
        product=data.product,
        price_tnd_kg=data.price_tnd_kg,
        region=data.region,
        date_str=data.date,
        season=data.season,
        lag_1=data.lag_1,
        lag_7=data.lag_7,
        lag_14=data.lag_14,
        lag_30=data.lag_30,
    )