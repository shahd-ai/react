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
