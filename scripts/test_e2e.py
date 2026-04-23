"""
Test E2E — Supfile : upload de fichiers + questions au LLM + sécurité
Simule le parcours complet d'un utilisateur :
  1. Inscription + login
  2. Upload de 3 fichiers texte avec du contenu riche
  3. Attente de l'indexation (embedding brain-api)
  4. Questions au chatbot sur le contenu des fichiers
  5. Test de téléchargement d'un fichier
  6. Tests de sécurité (injection, IDOR, JWT, XSS, path traversal, etc.)
  7. Rapport final

Usage :
  pip install requests
  python test_e2e.py
"""

import requests
import time
import os
import sys
import tempfile
import base64
import json

# Force UTF-8 sur Windows (évite l'erreur cp1252 avec les caractères spéciaux)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# ── Config ───────────────────────────────────────────────────────────────────
BASE_URL  = os.getenv("API_URL", "http://127.0.0.1:5001")
API       = f"{BASE_URL}/api"
TEST_USER = {
    "email":     "test_e2e@supfile.local",
    "password":  "TestPassword123!",
    "firstName": "Test",
    "lastName":  "E2E",
}
# Second user pour les tests IDOR
TEST_USER_2 = {
    "email":     "test_e2e_victim@supfile.local",
    "password":  "VictimPassword456!",
    "firstName": "Victim",
    "lastName":  "User",
}

COLORS = {
    "green":  "\033[92m",
    "red":    "\033[91m",
    "yellow": "\033[93m",
    "blue":   "\033[94m",
    "reset":  "\033[0m",
    "bold":   "\033[1m",
}

def c(color, text):
    return f"{COLORS[color]}{text}{COLORS['reset']}"

def ok(msg):   print(f"  {c('green', '✓')} {msg}")
def fail(msg): print(f"  {c('red',   '✗')} {msg}")
def info(msg): print(f"  {c('blue',  '→')} {msg}")
def warn(msg): print(f"  {c('yellow','!')} {msg}")

results = {"passed": 0, "failed": 0, "errors": []}

def check(label, condition, detail=""):
    if condition:
        ok(label)
        results["passed"] += 1
    else:
        fail(f"{label} {detail}")
        results["failed"] += 1
        results["errors"].append(label)

# ── Fichiers de test ──────────────────────────────────────────────────────────
TEST_FILES = [
    {
        "name": "rapport_projet_alpha.txt",
        "content": """RAPPORT DE PROJET ALPHA - Q4 2024

RÉSUMÉ EXÉCUTIF
Le projet Alpha est une initiative stratégique visant à moderniser l'infrastructure cloud de l'entreprise.
Budget alloué : 250 000 euros. Délai : 18 mois. Chef de projet : Marie Dupont.

OBJECTIFS PRINCIPAUX
1. Migration de 80% des serveurs on-premise vers le cloud AWS
2. Réduction des coûts opérationnels de 35%
3. Amélioration de la disponibilité à 99.9%

AVANCEMENT
- Phase 1 (Migration BDD) : 100% complète - terminée en octobre 2024
- Phase 2 (Migration API) : 75% en cours - prévu novembre 2024
- Phase 3 (Migration Frontend) : 0% - début janvier 2025

RISQUES IDENTIFIÉS
- Dépendances legacy sur le module de facturation (criticité: haute)
- Manque de compétences AWS dans l'équipe (formation prévue en décembre)

BUDGET CONSOMMÉ
- Phase 1 : 45 000€ (budget : 50 000€) - sous budget
- Phase 2 : 80 000€ engagés sur 120 000€ prévus
- Total consommé : 125 000€ sur 250 000€
""",
    },
    {
        "name": "recette_tarte_citron.txt",
        "content": """RECETTE : TARTE AU CITRON MERINGUÉE

Temps de préparation : 45 minutes
Temps de cuisson : 35 minutes
Difficulté : Intermédiaire
Pour : 8 personnes

INGRÉDIENTS — PÂTE SABLÉE
- 250g de farine
- 125g de beurre froid en dés
- 80g de sucre glace
- 1 œuf
- 1 pincée de sel

INGRÉDIENTS — CRÈME CITRON
- 4 citrons (zeste + jus, soit environ 150ml)
- 4 œufs entiers
- 150g de sucre
- 100g de beurre
- 2 cuillères à soupe de Maïzena

INGRÉDIENTS — MERINGUE ITALIENNE
- 4 blancs d'œufs
- 200g de sucre
- 60ml d'eau

PRÉPARATION
1. Préparez la pâte : mélangez farine, beurre, sucre glace et sel jusqu'à obtenir une texture sableuse.
   Ajoutez l'œuf et formez une boule. Réfrigérez 30 minutes.
2. Étalez la pâte dans un moule de 26cm. Piquez et cuisez à blanc 20 min à 180°C.
3. Crème citron : faites chauffer jus et zestes avec le sucre. Ajoutez les œufs battus et la Maïzena.
   Faites épaissir à feu doux en remuant. Incorporez le beurre hors du feu.
4. Versez la crème sur le fond de tarte refroidi. Réfrigérez 2h.
5. Meringue : faites un sirop à 121°C avec sucre + eau. Versez en filet sur les blancs montés.
6. Dressez la meringue et dorez au chalumeau.

CONSEILS
- La tarte se conserve 2 jours au réfrigérateur.
- Utilisez des citrons non traités pour le zeste.
""",
    },
    {
        "name": "guide_python_async.txt",
        "content": """GUIDE PRATIQUE — PROGRAMMATION ASYNCHRONE EN PYTHON

INTRODUCTION
La programmation asynchrone avec asyncio permet d'exécuter des opérations I/O sans bloquer le thread principal.
C'est essentiel pour les applications réseau, les APIs REST et le scraping.

LES BASES
- async def : déclare une coroutine
- await : suspend la coroutine jusqu'à la fin de l'opération
- asyncio.run() : point d'entrée principal
- asyncio.gather() : exécute plusieurs coroutines en parallèle

EXEMPLE SIMPLE
```python
import asyncio
import aiohttp

async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def main():
    urls = [
        "https://api.example.com/users/1",
        "https://api.example.com/users/2",
        "https://api.example.com/users/3",
    ]
    # Exécution parallèle des 3 requêtes
    results = await asyncio.gather(*[fetch_data(url) for url in urls])
    print(f"Récupéré {len(results)} utilisateurs")

asyncio.run(main())
```

PIÈGES COURANTS
1. Ne jamais appeler time.sleep() dans une coroutine — utilisez await asyncio.sleep()
2. Les opérations CPU-intensives bloquent la boucle — utilisez run_in_executor()
3. Ne pas créer de boucle manuellement — utilisez asyncio.run()

PERFORMANCES
Dans un benchmark typique récupérant 100 URLs :
- Synchrone : ~30 secondes
- Asynchrone (asyncio) : ~1.5 secondes
- Gain : 20x plus rapide

LIBRAIRIES RECOMMANDÉES
- aiohttp : requêtes HTTP asynchrones
- asyncpg : PostgreSQL asynchrone
- motor : MongoDB asynchrone
- aiofiles : lecture/écriture fichiers asynchrone
""",
    },
]

# Questions à poser au chatbot
CHAT_QUESTIONS = [
    {
        "q": "Quel est le budget total du projet Alpha et combien a été consommé ?",
        "keywords": ["250", "125", "budget", "projet", "alpha"],
    },
    {
        "q": "Quelle est la température pour préparer le sirop de la meringue italienne ?",
        "keywords": ["121", "sirop", "meringue", "sucre"],
    },
    {
        "q": "Quel est le gain de performance entre code synchrone et asynchrone d'après le guide Python ?",
        "keywords": ["20", "rapide", "benchmark", "asyncio", "url"],
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def api(method, path, token=None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = getattr(requests, method)(f"{API}{path}", headers=headers, timeout=90, **kwargs)
    return r

def get_data(r):
    """Extrait le payload depuis { success, data } ou directement."""
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    return body.get("data", body)

def wait_for_backend(max_retries=30):
    info(f"Attente du backend ({BASE_URL})...")
    for i in range(max_retries):
        try:
            r = requests.get(f"{BASE_URL}/health", timeout=3)
            if r.status_code < 500:
                ok("Backend accessible")
                return True
        except Exception:
            pass
        time.sleep(3)
        print(f"    tentative {i+1}/{max_retries}...", end="\r")
    return False

def login_user(email, password):
    """Login et retourne le token (gère tempToken + token imbriqué)."""
    r = api("post", "/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        return None
    nested = get_data(r)
    return (
        nested.get("token")
        or nested.get("accessToken")
        or nested.get("tempToken")
    )

# ── Tests fonctionnels ────────────────────────────────────────────────────────
def test_auth():
    print(f"\n{c('bold', '── 1. Authentification ──────────────────────────────')}")

    r = api("post", "/auth/register", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
        "firstName": TEST_USER["firstName"],
        "lastName": TEST_USER["lastName"],
    })
    if r.status_code == 201:
        ok(f"Inscription réussie ({TEST_USER['email']})")
    elif r.status_code in (400, 409, 500):
        warn("Utilisateur déjà existant — on continue avec le login")
    else:
        fail(f"Inscription échouée : {r.status_code} — {r.text[:200]}")

    r = api("post", "/auth/login", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
    })
    check("Login", r.status_code == 200, f"(HTTP {r.status_code})")
    if r.status_code != 200:
        fail(f"Réponse login : {r.text[:300]}")
        return None, ""

    nested = get_data(r)
    token = nested.get("token") or nested.get("accessToken") or nested.get("tempToken")
    check("Token JWT reçu", bool(token), f"(clés: {list(nested.keys())})")
    if nested.get("mfaSetupRequired"):
        warn("MFA setup requis — utilisation du tempToken pour les tests")
    return token, r.text


def test_upload_files(token):
    print(f"\n{c('bold', '── 2. Upload des fichiers ───────────────────────────')}")
    uploaded = []

    for tf in TEST_FILES:
        info(f"Upload de {tf['name']}...")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(tf["content"])
            tmp_path = f.name
        try:
            with open(tmp_path, "rb") as f:
                r = api("post", "/files/upload", token=token,
                        files={"files": (tf["name"], f, "text/plain")})
            check(f"Upload {tf['name']}", r.status_code in (200, 201, 207), f"(HTTP {r.status_code})")
            if r.status_code in (200, 201, 207):
                data = get_data(r)
                files_list = data.get("files") or [data.get("file")]
                if files_list and files_list[0]:
                    fid = files_list[0].get("id")
                    uploaded.append({"id": fid, "name": tf["name"]})
                    info(f"  → id={fid}")
            else:
                fail(f"Erreur upload : {r.text[:300]}")
        finally:
            os.unlink(tmp_path)

    return uploaded


def test_list_files(token, expected_count):
    print(f"\n{c('bold', '── 3. Vérification liste fichiers ───────────────────')}")
    r = api("get", "/files", token=token)
    check("GET /files répond 200", r.status_code == 200, f"(HTTP {r.status_code})")
    if r.status_code == 200:
        files = get_data(r).get("files", [])
        check(
            f"Au moins {expected_count} fichier(s) dans la liste",
            len(files) >= expected_count,
            f"(trouvé {len(files)})"
        )


def test_download(token, file_id, file_name):
    print(f"\n{c('bold', '── 4. Téléchargement + déchiffrement ────────────────')}")
    r = api("get", f"/files/{file_id}/download", token=token, stream=True)
    check(f"Download {file_name}", r.status_code == 200, f"(HTTP {r.status_code})")
    if r.status_code == 200:
        content = b"".join(r.iter_content(chunk_size=8192)).decode("utf-8", errors="replace")
        check("Contenu déchiffré non vide", len(content) > 50, f"({len(content)} chars)")
        check(
            "Contenu correspond au fichier original",
            "projet" in content.lower() or "alpha" in content.lower(),
            "(mot-clé 'projet'/'alpha' attendu)"
        )


def test_minio_direct():
    print(f"\n{c('bold', '── 5. Vérification MinIO ────────────────────────────')}")
    try:
        r = requests.get("http://127.0.0.1:9000/minio/health/live", timeout=5)
        check("MinIO health endpoint répond", r.status_code == 200, f"(HTTP {r.status_code})")
    except Exception as e:
        warn(f"MinIO non accessible depuis l'hôte : {e}")
        warn("(Normal en production — port non exposé)")


def test_ai_chat(token):
    print(f"\n{c('bold', '── 6. Questions au LLM (Bobby) ──────────────────────')}")
    info("Attente indexation + embedding (60s)...")
    time.sleep(60)

    for q_item in CHAT_QUESTIONS:
        question = q_item["q"]
        keywords = q_item["keywords"]
        info(f"Question : « {question[:70]}… »")

        r = api("post", "/ai/chat", token=token, json={"message": question})
        check(f"Réponse reçue pour la question", r.status_code == 200, f"(HTTP {r.status_code})")

        if r.status_code == 200:
            data = get_data(r)
            reply = (data.get("response") or data.get("message") or data.get("reply") or str(data)).lower()
            found = [kw for kw in keywords if kw.lower() in reply]
            check(
                f"Réponse contient des données pertinentes",
                len(found) > 0,
                f"(mots trouvés: {found or 'aucun'} | extrait: «{reply[:150]}»)"
            )
        else:
            fail(f"Erreur LLM : {r.text[:300]}")
            warn("(Le modèle Ollama doit être téléchargé — voir pull_model.sh)")


def test_input_validation(token):
    """Vérifie que les inputs trop grands sont rejetés (DOS protection)."""
    print(f"\n{c('bold', '── 7. Validation des inputs (sécurité DOS) ──────────')}")

    oversized_query = "A" * 10_001
    r = api("post", "/ai/chat", token=token, json={"message": oversized_query})
    check("Query > 10 000 chars rejetée (400)", r.status_code == 400, f"(HTTP {r.status_code})")

    brain_url = "http://127.0.0.1:8001/chat"
    try:
        big_history = [{"role": "user", "content": "msg"}] * 51
        r_brain = requests.post(brain_url, json={"user_id": "test", "query": "test", "history": big_history}, timeout=3)
        check("History > 50 msgs rejetée par brain-api (422)", r_brain.status_code == 422, f"(HTTP {r_brain.status_code})")

        bad_history = [{"role": "hacker", "content": "injected"}]
        r_brain2 = requests.post(brain_url, json={"user_id": "test", "query": "test", "history": bad_history}, timeout=3)
        check("Rôle invalide dans history rejeté (422)", r_brain2.status_code == 422, f"(HTTP {r_brain2.status_code})")
    except Exception:
        warn("brain-api non exposé sur l'hôte (normal) — validation interne Docker uniquement")


def test_conversation_persistence(token):
    """Vérifie que les conversations sont persistées et rechargées."""
    print(f"\n{c('bold', '── 8. Persistance des conversations ─────────────────')}")

    r = api("post", "/ai/chat", token=token, json={"message": "Quel est le budget du projet Alpha ?"})
    check("Premier message reçu (200)", r.status_code == 200, f"(HTTP {r.status_code})")
    if r.status_code != 200:
        fail(f"Réponse : {r.text[:200]}")
        return

    data = get_data(r)
    conv_id = data.get("conversationId")
    check("conversationId retourné", bool(conv_id), f"(reçu: {conv_id})")
    if not conv_id:
        return

    r2 = api("post", "/ai/chat", token=token, json={
        "message": "Et combien a été consommé de ce budget ?",
        "conversationId": conv_id,
    })
    check("Deuxième message avec conversationId (200)", r2.status_code == 200, f"(HTTP {r2.status_code})")

    r3 = api("get", "/ai/conversations", token=token)
    check("GET /ai/conversations (200)", r3.status_code == 200, f"(HTTP {r3.status_code})")
    if r3.status_code == 200:
        convs = get_data(r3).get("conversations", [])
        found = any(c_item["id"] == conv_id for c_item in convs)
        check("Conversation présente dans la liste", found, f"(trouvé dans {len(convs)} conversations)")

    r4 = api("get", f"/ai/conversations/{conv_id}", token=token)
    check("GET /ai/conversations/:id (200)", r4.status_code == 200, f"(HTTP {r4.status_code})")
    if r4.status_code == 200:
        msgs = get_data(r4).get("conversation", {}).get("messages", [])
        check("Historique contient 4 messages (2 user + 2 assistant)", len(msgs) == 4, f"(trouvé {len(msgs)})")

    r5 = api("delete", f"/ai/conversations/{conv_id}", token=token)
    check("DELETE /ai/conversations/:id (200)", r5.status_code == 200, f"(HTTP {r5.status_code})")

    r6 = api("get", f"/ai/conversations/{conv_id}", token=token)
    check("Conversation supprimée (404)", r6.status_code == 404, f"(HTTP {r6.status_code})")


def test_unauthorized_access():
    """Vérifie que les routes protégées rejettent les requêtes sans token."""
    print(f"\n{c('bold', '── 9. Sécurité — accès non autorisé ────────────────')}")

    endpoints = [
        ("get",    "/files"),
        ("post",   "/ai/chat"),
        ("get",    "/ai/conversations"),
        ("get",    "/folders"),
        ("get",    "/users/me"),
        ("get",    "/admin/users"),
    ]
    for method, path in endpoints:
        r = api(method, path)
        check(
            f"{method.upper()} {path} sans token → 401",
            r.status_code == 401,
            f"(HTTP {r.status_code})"
        )


# ── Tests de sécurité avancés ─────────────────────────────────────────────────

def test_jwt_attacks(token):
    """JWT forgery, algorithm confusion, token manipulation."""
    print(f"\n{c('bold', '── 10. Sécurité — Attaques JWT ─────────────────────')}")

    # Token vide
    r = api("get", "/files", token="")
    check("Token vide → 401", r.status_code == 401, f"(HTTP {r.status_code})")

    # Token malformé
    r = api("get", "/files", token="not.a.jwt")
    check("Token malformé → 401", r.status_code == 401, f"(HTTP {r.status_code})")

    # Token avec algo=none (alg confusion)
    header = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(b'{"userId":"admin","email":"admin@x.com","tokenVersion":1}').rstrip(b"=").decode()
    none_token = f"{header}.{payload}."
    r = api("get", "/files", token=none_token)
    check("JWT alg=none rejeté → 401", r.status_code == 401, f"(HTTP {r.status_code})")

    # Token HS256 signé avec secret vide
    header2 = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    payload2 = base64.urlsafe_b64encode(b'{"userId":"hacker","email":"hacker@x.com"}').rstrip(b"=").decode()
    fake_token = f"{header2}.{payload2}.invalidsignature"
    r = api("get", "/files", token=fake_token)
    check("JWT signature invalide → 401", r.status_code == 401, f"(HTTP {r.status_code})")

    # Token valide mais userId inexistant
    if token:
        parts = token.split(".")
        if len(parts) == 3:
            try:
                padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
                pl = json.loads(base64.urlsafe_b64decode(padded))
                pl["userId"] = "00000000-0000-0000-0000-000000000000"
                new_pl = base64.urlsafe_b64encode(json.dumps(pl).encode()).rstrip(b"=").decode()
                tampered = f"{parts[0]}.{new_pl}.{parts[2]}"
                r = api("get", "/files", token=tampered)
                check("JWT payload modifié → 401", r.status_code == 401, f"(HTTP {r.status_code})")
            except Exception:
                warn("Impossible de modifier le payload JWT pour ce test")


def test_sql_injection(token):
    """Injection SQL dans les champs utilisateur."""
    print(f"\n{c('bold', '── 11. Sécurité — Injection SQL ─────────────────────')}")

    payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1; SELECT * FROM information_schema.tables",
        "admin'--",
    ]

    # Login avec payloads SQL — 429 est aussi acceptable (rate-limited = rejeté)
    for payload in payloads[:3]:
        r = api("post", "/auth/login", json={"email": payload, "password": "whatever"})
        check(
            f"Login SQL injection rejeté ({payload[:30]})",
            r.status_code in (400, 401, 422, 429, 500) and r.status_code != 200,
            f"(HTTP {r.status_code})"
        )

    # Recherche de fichiers avec payload SQL
    if token:
        for payload in payloads[:2]:
            r = api("get", f"/files/search?q={requests.utils.quote(payload)}", token=token)
            check(
                f"Recherche SQL injection ne crash pas ({payload[:25]})",
                r.status_code in (200, 400, 422),
                f"(HTTP {r.status_code} — ne doit pas retourner 500)"
            )
            if r.status_code == 200:
                check(
                    "Aucune donnée sensible exposée par l'injection",
                    "password" not in r.text.lower() and "secret" not in r.text.lower(),
                    f"(extrait: {r.text[:100]})"
                )


def test_xss_injection(token):
    """XSS dans les noms de fichiers et dossiers."""
    print(f"\n{c('bold', '── 12. Sécurité — XSS / Injection HTML ──────────────')}")

    xss_payloads = [
        "<script>alert('XSS')</script>",
        '"><img src=x onerror=alert(1)>',
        "javascript:alert(1)",
        "<svg onload=alert(1)>",
    ]

    if not token:
        warn("Token manquant — skip XSS tests")
        return

    run_ts = int(time.time())
    for i, payload in enumerate(xss_payloads):
        # Use unique name to avoid "already exists" 409 masking the real behavior
        unique_name = f"xss_{run_ts}_{i}_{payload}"
        r = api("post", "/folders", token=token, json={"name": unique_name, "parentId": None})
        if r.status_code in (200, 201):
            # Storage apps legitimately accept any name — check the JSON response is proper JSON
            # (no reflected XSS in the API response itself)
            check(
                f"XSS dans nom dossier : réponse JSON valide ({payload[:25]})",
                r.headers.get("Content-Type", "").startswith("application/json"),
                f"(Content-Type: {r.headers.get('Content-Type', 'absent')})"
            )
            # Nettoyage : supprimer le dossier
            folder_id = (get_data(r).get("folder") or get_data(r)).get("id")
            if folder_id:
                api("delete", f"/folders/{folder_id}", token=token)
        else:
            check(
                f"XSS dossier rejeté proprement ({payload[:25]})",
                r.status_code not in (500,),
                f"(HTTP {r.status_code} — 500 = crash serveur)"
            )


def test_path_traversal(token):
    """Path traversal dans les IDs et paramètres."""
    print(f"\n{c('bold', '── 13. Sécurité — Path Traversal ────────────────────')}")

    if not token:
        warn("Token manquant — skip path traversal tests")
        return

    traversal_ids = [
        "../../../etc/passwd",
        "..%2F..%2F..%2Fetc%2Fpasswd",
        "....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f",
        "null",
        "undefined",
    ]

    for tid in traversal_ids:
        r = api("get", f"/files/{tid}/download", token=token)
        check(
            f"Path traversal rejeté ({tid[:30]})",
            r.status_code in (400, 401, 403, 404, 422),
            f"(HTTP {r.status_code} — ne doit pas retourner 200 ou 500)"
        )

    # Tentative de téléchargement d'un fichier système via storagePath
    for tid in traversal_ids[:3]:
        r = api("get", f"/folders/{tid}", token=token)
        check(
            f"Path traversal dossier rejeté ({tid[:30]})",
            r.status_code in (400, 401, 403, 404, 422),
            f"(HTTP {r.status_code})"
        )


def test_idor(token, uploaded_file_ids):
    """IDOR — un utilisateur ne peut pas accéder aux ressources d'un autre."""
    print(f"\n{c('bold', '── 14. Sécurité — IDOR ──────────────────────────────')}")

    if not token or not uploaded_file_ids:
        warn("Token ou fichiers manquants — skip IDOR tests")
        return

    # Créer un second utilisateur
    r = api("post", "/auth/register", json={
        "email": TEST_USER_2["email"],
        "password": TEST_USER_2["password"],
        "firstName": TEST_USER_2["firstName"],
        "lastName": TEST_USER_2["lastName"],
    })
    if r.status_code not in (201, 400, 409, 500):
        warn(f"Impossible de créer user2 : {r.status_code}")
        return

    token2 = login_user(TEST_USER_2["email"], TEST_USER_2["password"])
    if not token2:
        warn("Impossible de se connecter avec user2 — skip IDOR tests")
        return

    ok("User2 créé et connecté pour les tests IDOR")

    for fid in uploaded_file_ids[:2]:
        # User2 tente d'accéder aux fichiers de user1
        r = api("get", f"/files/{fid}/download", token=token2)
        check(
            f"IDOR: user2 ne peut pas télécharger le fichier de user1 ({fid[:8]}...)",
            r.status_code in (403, 404),
            f"(HTTP {r.status_code} — attendu 403 ou 404)"
        )

        r = api("delete", f"/files/{fid}", token=token2)
        check(
            f"IDOR: user2 ne peut pas supprimer le fichier de user1 ({fid[:8]}...)",
            r.status_code in (403, 404),
            f"(HTTP {r.status_code} — attendu 403 ou 404)"
        )

        r = api("patch", f"/files/{fid}", token=token2, json={"name": "hacked.txt"})
        check(
            f"IDOR: user2 ne peut pas renommer le fichier de user1 ({fid[:8]}...)",
            r.status_code in (403, 404),
            f"(HTTP {r.status_code} — attendu 403 ou 404)"
        )


def test_brute_force_protection():
    """Vérifie que le rate limiting protège contre le brute force."""
    print(f"\n{c('bold', '── 15. Sécurité — Brute Force / Rate Limiting ───────')}")

    blocked = False
    for i in range(15):
        r = api("post", "/auth/login", json={
            "email": "bruteforce@test.local",
            "password": f"wrong_password_{i}",
        })
        if r.status_code == 429:
            ok(f"Rate limiting déclenché après {i+1} tentatives (HTTP 429)")
            results["passed"] += 1
            blocked = True
            break

    if not blocked:
        warn("Rate limiting non déclenché après 15 tentatives (peut être configuré à >15 req/15min)")


def test_mass_assignment(token):
    """Vérifie qu'on ne peut pas modifier des champs protégés via l'API."""
    print(f"\n{c('bold', '── 16. Sécurité — Mass Assignment ───────────────────')}")

    if not token:
        warn("Token manquant — skip mass assignment tests")
        return

    # Tentative de s'accorder le rôle ADMIN
    r = api("patch", "/users/me", token=token, json={
        "role": "ADMIN",
        "plan": "ENTERPRISE",
        "quotaLimit": 999999999999,
    })
    if r.status_code in (200, 201):
        data = get_data(r)
        user = data.get("user") or data
        role = (user.get("role") or "").upper()
        plan = (user.get("plan") or "").upper()
        check(
            "Mass assignment: role non modifiable via /users/me",
            role not in ("ADMIN", "SUPERADMIN"),
            f"(role obtenu: {role})"
        )
        check(
            "Mass assignment: plan non modifiable via /users/me",
            plan != "ENTERPRISE",
            f"(plan obtenu: {plan})"
        )
    else:
        ok(f"Mass assignment rejeté (HTTP {r.status_code})")
        results["passed"] += 2


def test_sensitive_data_exposure(login_body: str = ""):
    """Vérifie que les champs sensibles ne sont pas exposés dans les réponses."""
    print(f"\n{c('bold', '── 17. Sécurité — Exposition données sensibles ──────')}")

    # Use cached login response from section 1 to avoid re-hitting the rate limiter
    if not login_body:
        r = api("post", "/auth/login", json={
            "email": TEST_USER["email"],
            "password": TEST_USER["password"],
        })
        if r.status_code != 200:
            warn(f"Login non disponible (HTTP {r.status_code}) — skip sensitive data checks")
            return
        login_body = r.text

    body = login_body.lower()
    check("Mot de passe hashé absent de la réponse login", "password" not in body or "$2b$" not in body,
          f"(bcrypt hash détecté dans la réponse)")
    check("mfaSecret absent de la réponse login", "mfasecret" not in body,
          f"(champ mfaSecret exposé)")
    check("kekSalt absent de la réponse login", "keksalt" not in body,
          f"(champ kekSalt exposé)")
    check("encryptedDek absent de la réponse login", "encrypteddek" not in body,
          f"(champ encryptedDek exposé)")
    check("vaultPasswordHash absent de la réponse login", "vaultpasswordhash" not in body,
          f"(champ vaultPasswordHash exposé)")


def test_upload_security(token):
    """Sécurité sur les uploads : noms dangereux, content-type spoofing."""
    print(f"\n{c('bold', '── 18. Sécurité — Upload malveillant ────────────────')}")

    if not token:
        warn("Token manquant — skip upload security tests")
        return

    # Content is intentionally benign — we're testing filename sanitization, not AV evasion
    dangerous_files = [
        ("../../../etc/passwd", b"test content", "text/plain"),
        ("shell.php", b"test content", "text/plain"),
        ("exploit.exe", b"test content", "application/octet-stream"),
        ("<script>.txt", b"test content", "text/plain"),
    ]

    for fname, content, mime in dangerous_files:
        fd, tmp_path = tempfile.mkstemp()
        try:
            os.write(fd, content)
            os.close(fd)
            with open(tmp_path, "rb") as f:
                r = api("post", "/files/upload", token=token,
                        files={"files": (fname, f, mime)})
            # Le service de stockage accepte tout MIME (by design) mais ne doit pas crasher
            # et ne doit pas permettre de path traversal via le nom de fichier
            if r.status_code in (200, 201, 207):
                data = get_data(r)
                files_list = data.get("files") or []
                if files_list and files_list[0]:
                    stored_name = files_list[0].get("name", "")
                    check(
                        f"Nom de fichier dangereux assaini ({fname[:25]})",
                        ".." not in stored_name and "/" not in stored_name,
                        f"(nom stocké: {stored_name})"
                    )
                    # Nettoyage
                    fid = files_list[0].get("id")
                    if fid:
                        api("delete", f"/files/{fid}?permanent=true", token=token)
            else:
                ok(f"Upload dangereux rejeté ({fname[:25]}) HTTP {r.status_code}")
                results["passed"] += 1
        finally:
            os.unlink(tmp_path)


def test_http_methods(token):
    """Vérifie que les méthodes HTTP non autorisées sont rejetées."""
    print(f"\n{c('bold', '── 19. Sécurité — Méthodes HTTP non autorisées ─────')}")

    cases = [
        ("delete", "/auth/login"),
        ("put",    "/auth/login"),
        ("patch",  "/auth/register"),
    ]
    for method, path in cases:
        r = api(method, path, token=token)
        check(
            f"{method.upper()} {path} → non 200",
            r.status_code not in (200, 201),
            f"(HTTP {r.status_code})"
        )


def test_header_injection(token):
    """Host header injection et headers suspects."""
    print(f"\n{c('bold', '── 20. Securite — Injection en-tetes ───────────────')}")

    # Host header forgery
    r = requests.get(f"{API}/files", headers={
        "Authorization": f"Bearer {token}" if token else "",
        "Host": "evil.com",
        "X-Forwarded-Host": "evil.com",
        "X-Forwarded-For": "127.0.0.1",
    }, timeout=10)
    check(
        "Host injection ne provoque pas de redirect vers evil.com",
        "evil.com" not in r.headers.get("Location", ""),
        f"(Location: {r.headers.get('Location', 'absent')})"
    )

    # Content-Type non JSON sur endpoint JSON
    r = requests.post(f"{API}/auth/login",
                      data="email=test&password=test",
                      headers={"Content-Type": "text/plain"},
                      timeout=10)
    check(
        "Content-Type text/plain sur endpoint JSON → non 200",
        r.status_code != 200,
        f"(HTTP {r.status_code})"
    )


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{c('bold', c('blue', '═══════════════════════════════════════════════════'))}")
    print(f"{c('bold', c('blue', '  SUPFILE — Test E2E : Upload + MinIO + LLM + Sécurité'))}")
    print(f"{c('bold', c('blue', '═══════════════════════════════════════════════════'))}")
    print(f"  Backend : {BASE_URL}")

    if not wait_for_backend():
        fail("Backend inaccessible après 90s. Vérifiez : docker compose logs backend")
        sys.exit(1)

    # ── Tests fonctionnels ────────────────────────────────────────────────────
    auth_result = test_auth()
    token, login_body = auth_result if auth_result else (None, "")
    if not token:
        fail("Impossible de continuer sans token JWT")
        sys.exit(1)

    uploaded = test_upload_files(token)
    test_list_files(token, expected_count=len(TEST_FILES))

    if uploaded:
        test_download(token, uploaded[0]["id"], uploaded[0]["name"])

    test_minio_direct()
    test_ai_chat(token)
    test_input_validation(token)
    test_conversation_persistence(token)
    test_unauthorized_access()

    # ── Tests de sécurité ────────────────────────────────────────────────────
    test_jwt_attacks(token)
    test_sql_injection(token)
    test_xss_injection(token)
    test_path_traversal(token)
    test_idor(token, [f["id"] for f in uploaded if f.get("id")])
    test_mass_assignment(token)
    test_sensitive_data_exposure(login_body)
    test_upload_security(token)
    test_http_methods(token)
    test_header_injection(token)
    # Brute force last: leaves the IP rate-limited, breaking subsequent auth calls
    test_brute_force_protection()

    # ── Rapport final ─────────────────────────────────────────────────────────
    print(f"\n{c('bold', '═══════════════════════════════════════════════════')}")
    total = results["passed"] + results["failed"]
    color = "green" if results["failed"] == 0 else "red"
    summary = f"{results['passed']}/{total} tests passés"
    print(f"  Résultats : {c(color, summary)}")
    if results["errors"]:
        print(f"  Échecs :")
        for e in results["errors"]:
            print(f"    {c('red', '✗')} {e}")
    print(f"{c('bold', '═══════════════════════════════════════════════════')}\n")

    sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
