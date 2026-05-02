from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
import pymysql
from pymysql.cursors import DictCursor

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY         = "senitech_secret_key_2024"  # Change en prod !
ALGORITHM          = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 jours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer      = HTTPBearer()
router      = APIRouter(prefix="/auth", tags=["auth"])

# ── Base de données MySQL (AlwaysData) ──────────────────────────────────────
# Configure via environment variables. Example values below can be used as defaults
# or set by your deployment: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
DB_HOST = os.getenv("DB_HOST", "mysql.alwaysdata.net")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "shahed")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "shahed_senitech")

def get_db():
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        cursorclass=DictCursor,
        autocommit=False,
        charset='utf8mb4'
    )
    return conn

def init_db():
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nom VARCHAR(255) NOT NULL,
                    prenom VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        conn.commit()
        print("✅ Table users créée (MySQL)")
    finally:
        conn.close()

init_db()

# ── Modèles ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    nom:      str
    prenom:   str
    email:    str
    password: str

class LoginRequest(BaseModel):
    email:    str
    password: str

# ── Helpers ───────────────────────────────────────────────────────────────────
def _bcrypt_prepare(password: str) -> bytes:
    password_bytes = password.encode("utf-8")
    return password_bytes[:72]

def hash_password(password: str) -> str:
    return pwd_context.hash(_bcrypt_prepare(password))

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_bcrypt_prepare(plain), hashed)

def create_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub":   str(user_id),
        "email": email,
        "exp":   expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    return decode_token(credentials.credentials)

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterRequest):
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            existing = cursor.fetchone()

            if existing:
                raise HTTPException(status_code=400, detail="Email déjà utilisé")

            hashed = hash_password(req.password)
            cursor.execute(
                "INSERT INTO users (nom, prenom, email, password) VALUES (%s, %s, %s, %s)",
                (req.nom, req.prenom, req.email, hashed)
            )
            conn.commit()
            user_id = cursor.lastrowid

        token = create_token(user_id, req.email)

        return {
            "message": "Compte créé avec succès",
            "token":   token,
            "user": {
                "id":     user_id,
                "nom":    req.nom,
                "prenom": req.prenom,
                "email":  req.email,
            }
        }
    finally:
        conn.close()


@router.post("/login")
def login(req: LoginRequest):
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s", (req.email,))
            user = cursor.fetchone()

            if not user or not verify_password(req.password, user["password"]):
                raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

            token = create_token(user["id"], user["email"])

            return {
                "message": "Connexion réussie",
                "token":   token,
                "user": {
                    "id":     user["id"],
                    "nom":    user["nom"],
                    "prenom": user["prenom"],
                    "email":  user["email"],
                }
            }
    finally:
        conn.close()


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, nom, prenom, email, created_at FROM users WHERE id = %s",
                (current_user["sub"],)
            )
            user = cursor.fetchone()

            if not user:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            return user
    finally:
        conn.close()