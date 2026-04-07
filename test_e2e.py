"""
Test E2E — Supfile : upload de fichiers + questions au LLM
Simule le parcours complet d'un utilisateur :
  1. Inscription + login
  2. Upload de 3 fichiers texte avec du contenu riche
  3. Attente de l'indexation (embedding brain-api)
  4. Questions au chatbot sur le contenu des fichiers
  5. Test de téléchargement d'un fichier
  6. Rapport final

Usage :
  pip install requests
  python test_e2e.py
"""

import requests
import time
import os
import sys
import tempfile

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
    r = getattr(requests, method)(f"{API}{path}", headers=headers, timeout=30, **kwargs)
    return r

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

# ── Tests ─────────────────────────────────────────────────────────────────────
def test_auth():
    print(f"\n{c('bold', '── 1. Authentification ──────────────────────────────')}")

    # Register (ignore si déjà existant)
    r = api("post", "/auth/register", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
        "firstName": TEST_USER["firstName"],
        "lastName": TEST_USER["lastName"],
    })
    if r.status_code == 201:
        ok(f"Inscription réussie ({TEST_USER['email']})")
    elif r.status_code in (400, 409):
        warn("Utilisateur déjà existant — on continue avec le login")
    else:
        fail(f"Inscription échouée : {r.status_code} — {r.text[:200]}")

    # Login
    r = api("post", "/auth/login", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
    })
    check("Login", r.status_code == 200, f"(HTTP {r.status_code})")
    if r.status_code != 200:
        fail(f"Réponse login : {r.text[:300]}")
        return None

    data = r.json()
    # Le backend retourne toujours un tempToken (MFA setup requis pour les nouveaux users)
    # Le middleware authenticate accepte les tempToken — on l'utilise directement pour les tests
    token = (
        data.get("token")
        or data.get("accessToken")
        or data.get("tempToken")
        or (data.get("data") or {}).get("token")
    )
    check("Token JWT reçu", bool(token), f"(clé: {list(data.keys())})")
    if data.get("mfaSetupRequired"):
        warn("MFA setup requis — utilisation du tempToken pour les tests (accepté par le middleware)")
    return token


def test_upload_files(token):
    print(f"\n{c('bold', '── 2. Upload des fichiers ───────────────────────────')}")
    uploaded = []

    for tf in TEST_FILES:
        info(f"Upload de {tf['name']}...")

        # Créer un fichier temporaire
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f:
            f.write(tf["content"])
            tmp_path = f.name

        try:
            with open(tmp_path, "rb") as f:
                r = api(
                    "post", "/files/upload", token=token,
                    files={"files": (tf["name"], f, "text/plain")},
                )
            check(
                f"Upload {tf['name']}",
                r.status_code in (200, 201, 207),
                f"(HTTP {r.status_code})"
            )
            if r.status_code in (200, 201, 207):
                data = r.json()
                files_list = data.get("files", [data.get("file")])
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
        files = r.json().get("files", [])
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
    info("Attente indexation + embedding (30s)...")
    time.sleep(30)

    for q_item in CHAT_QUESTIONS:
        question = q_item["q"]
        keywords = q_item["keywords"]
        info(f"Question : « {question[:70]}… »")

        r = api("post", "/ai/chat", token=token, json={
            "message": question,
            "history": [],
        })

        check(
            f"Réponse reçue pour la question",
            r.status_code == 200,
            f"(HTTP {r.status_code})"
        )

        if r.status_code == 200:
            data = r.json()
            reply = (
                data.get("response")
                or data.get("message")
                or data.get("reply")
                or str(data)
            ).lower()

            # Vérifier qu'au moins 1 keyword pertinent est dans la réponse
            found = [kw for kw in keywords if kw.lower() in reply]
            check(
                f"Réponse contient des données pertinentes",
                len(found) > 0,
                f"(mots trouvés: {found or 'aucun'} | extrait: «{reply[:150]}»)"
            )
        else:
            fail(f"Erreur LLM : {r.text[:300]}")
            warn("(Le modèle Ollama doit être téléchargé — voir pull_model.sh)")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{c('bold', c('blue', '═══════════════════════════════════════════════════'))}")
    print(f"{c('bold', c('blue', '  SUPFILE — Test E2E : Upload + MinIO + LLM'))}")
    print(f"{c('bold', c('blue', '═══════════════════════════════════════════════════'))}")
    print(f"  Backend : {BASE_URL}")

    # Attendre que le backend soit prêt
    if not wait_for_backend():
        fail("Backend inaccessible après 90s. Vérifiez : docker compose logs backend")
        sys.exit(1)

    # 1. Auth
    token = test_auth()
    if not token:
        fail("Impossible de continuer sans token JWT")
        sys.exit(1)

    # 2. Upload
    uploaded = test_upload_files(token)

    # 3. Liste
    test_list_files(token, expected_count=len(TEST_FILES))

    # 4. Download + déchiffrement depuis MinIO
    if uploaded:
        test_download(token, uploaded[0]["id"], uploaded[0]["name"])

    # 5. Santé MinIO
    test_minio_direct()

    # 6. LLM
    test_ai_chat(token)

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
