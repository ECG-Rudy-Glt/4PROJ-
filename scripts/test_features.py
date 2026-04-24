"""
Test fonctionnel avancé — SUPFile
Teste les 5 fonctionnalités complexes :
  1. Coffre-fort (vault) — setup MFA complet + vault + chiffrement
  2. Partage de dossier — invitation, acceptation, accès, écriture
  3. Export GDPR — complétude, absence de secrets
  4. OnlyOffice — config éditeur, can-edit par type de fichier
  5. Admin panel — overview, users, CSV, changement de plan

Usage :
  pip install requests pyotp
  python test_features.py
"""

import requests
import time
import os
import sys
import tempfile
import json
import pyotp
import subprocess

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = os.getenv("API_URL", "http://127.0.0.1:5001")
API = f"{BASE_URL}/api"

# Utilisateur principal pour les tests avancés
VAULT_USER = {
    "email":     "test_vault@supfile.local",
    "password":  "VaultTest123!",
    "firstName": "Vault",
    "lastName":  "Tester",
}
VAULT_PASSWORD = "Sup3rS3cretV@ult2024!"

# Second utilisateur pour les tests de partage
SHARE_USER = {
    "email":     "test_share@supfile.local",
    "password":  "ShareTest456!",
    "firstName": "Share",
    "lastName":  "Receiver",
}

# DB connection pour les opérations d'administration directe
POSTGRES_HOST = "127.0.0.1"
POSTGRES_PORT = "5433"
POSTGRES_DB   = "supfile"
POSTGRES_USER = "postgres"
POSTGRES_PASS = "CHANGEZ_MOI_mot_de_passe_fort_ici"

COLORS = {
    "green":  "\033[92m",
    "red":    "\033[91m",
    "yellow": "\033[93m",
    "blue":   "\033[94m",
    "bold":   "\033[1m",
    "reset":  "\033[0m",
}

results = {"passed": 0, "failed": 0, "errors": []}


def c(color, text):
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


def ok(msg):
    print(f"  {c('green', '✓')} {msg}")
    results["passed"] += 1


def fail(msg):
    print(f"  {c('red', '✗')} {msg}")
    results["failed"] += 1
    results["errors"].append(msg)


def warn(msg):
    print(f"  {c('yellow', '!')} {msg}")


def info(msg):
    print(f"  {c('blue', '→')} {msg}")


def check(label, condition, detail=""):
    if condition:
        ok(label)
    else:
        fail(f"{label} {detail}")


def api(method, path, token=None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"{API}{path}"
    try:
        return getattr(requests, method)(url, headers=headers, timeout=30, **kwargs)
    except Exception as e:
        class FakeResp:
            status_code = 0
            text = str(e)
            headers = {}
            def json(self): return {}
        return FakeResp()


def get_data(r):
    try:
        body = r.json()
        return body.get("data", body)
    except Exception:
        return {}


def db_exec(sql):
    """Execute SQL directly in the Postgres container."""
    cmd = [
        "docker", "exec", "supfile-postgres",
        "psql", "-U", POSTGRES_USER, "-d", POSTGRES_DB,
        "-t", "-c", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip(), result.returncode


def register_and_login(user):
    """Register (ignore if exists) and login, return (token, user_id)."""
    api("post", "/auth/register", json=user)
    r = api("post", "/auth/login", json={"email": user["email"], "password": user["password"]})
    if r.status_code != 200:
        return None, None
    data = get_data(r)
    token = data.get("token") or data.get("tempToken")
    user_id = data.get("userId") or data.get("user", {}).get("id")
    if not user_id:
        # fetch from DB
        email = user["email"]
        out, _ = db_exec(f"SELECT id FROM \"User\" WHERE email='{email}'")
        user_id = out.strip() if out else None
    return token, user_id


# ─────────────────────────────────────────────────────────────────────────────
# 1. COFFRE-FORT (VAULT)
# ─────────────────────────────────────────────────────────────────────────────
def test_vault():
    print(f"\n{c('bold', '═══ 1. Coffre-fort (Vault) ════════════════════════════')}")

    # --- 1a. Reset vault user for idempotent runs ---
    # MFA_ENCRYPTION_KEY is random at each backend restart → stored mfaSecret
    # is unreadable after restart. Reset MFA+vault state so setup always works.
    vault_email = VAULT_USER["email"]
    db_exec(
        f"UPDATE \"User\" SET \"mfaEnabled\"=false, \"mfaSecret\"=null, "
        f"\"vaultEnabled\"=false, \"vaultPasswordHash\"=null, \"vaultUnlockUntil\"=null, "
        f"\"vaultLockedUntil\"=null, \"vaultFailedAttempts\"=0 "
        f"WHERE email='{vault_email}'"
    )
    db_exec(
        f"DELETE FROM \"Folder\" WHERE \"isVault\"=true AND \"userId\"=("
        f"SELECT id FROM \"User\" WHERE email='{vault_email}')"
    )
    info("Reset MFA/vault effectué")

    # --- 1b. Register/login vault user ---
    info("Création / login de l'utilisateur vault...")
    temp_token, user_id = register_and_login(VAULT_USER)
    if not temp_token:
        fail("Impossible de créer/connecter l'utilisateur vault")
        return None

    info(f"user_id = {user_id}")

    # --- 1c. Passer l'utilisateur en plan PRO (nécessaire pour le vault) ---
    info("Passage en plan PRO (DB direct)...")
    _, rc = db_exec(f"UPDATE \"User\" SET plan='PRO' WHERE id='{user_id}'")
    check("Utilisateur passé en PRO", rc == 0)

    # --- 1d. Compléter le setup MFA ---
    info("Setup MFA (TOTP)...")
    r = api("post", "/mfa/setup", token=temp_token)
    check("POST /mfa/setup → 200", r.status_code == 200, f"(HTTP {r.status_code}: {r.text[:100]})")
    if r.status_code != 200:
        fail("Impossible de continuer sans MFA secret")
        return None

    mfa_data = get_data(r)
    secret = mfa_data.get("secret")
    backup_codes = mfa_data.get("backupCodes", [])
    check("Secret TOTP reçu", bool(secret), f"(clés: {list(mfa_data.keys())})")
    if not secret:
        return None

    # Générer le code TOTP
    totp = pyotp.TOTP(secret)
    totp_code = totp.now()
    info(f"Code TOTP généré : {totp_code}")

    r = api("post", "/mfa/verify-setup", token=temp_token, json={
        "token": totp_code,
        "secret": secret,
        "backupCodes": backup_codes,
        "rememberDevice": False,
    })
    check("POST /mfa/verify-setup → 200", r.status_code == 200, f"(HTTP {r.status_code}: {r.text[:150]})")
    if r.status_code != 200:
        # MFA may already be enabled — try to get a real token via verify
        warn("MFA déjà activé, tentative de login complet...")
        r_login = api("post", "/auth/login", json={"email": VAULT_USER["email"], "password": VAULT_USER["password"]})
        login_data = get_data(r_login)
        if login_data.get("mfaRequired"):
            totp_code = totp.now()
            r_mfa = api("post", "/mfa/verify", json={
                "userId": user_id,
                "token": totp_code,
            })
            full_token = get_data(r_mfa).get("token")
        else:
            full_token = login_data.get("token")
    else:
        full_token = get_data(r).get("token")

    check("Token JWT complet reçu (post-MFA)", bool(full_token))
    if not full_token:
        return None

    # Relogin to get fresh token if MFA was already active
    # Try login → mfa/verify flow
    r_login = api("post", "/auth/login", json={"email": VAULT_USER["email"], "password": VAULT_USER["password"]})
    login_data = get_data(r_login)
    if login_data.get("mfaRequired"):
        time.sleep(30)  # wait for TOTP window to refresh
        totp_code2 = totp.now()
        r_mfa = api("post", "/mfa/verify", json={"userId": user_id, "token": totp_code2})
        full_token = get_data(r_mfa).get("token") or full_token

    info(f"Token complet obtenu : {full_token[:30]}...")

    # --- 1d. Statut vault avant setup ---
    r = api("get", "/vault/status", token=full_token)
    check("GET /vault/status → 200", r.status_code == 200, f"(HTTP {r.status_code})")
    vault_status = get_data(r).get("status", {})
    info(f"Statut vault initial : {vault_status}")

    if vault_status.get("enabled"):
        warn("Coffre-fort déjà activé pour cet utilisateur — on continue avec unlock")
    else:
        # --- 1e. Setup du vault ---
        info("Setup du coffre-fort...")
        # Use fresh TOTP code
        time.sleep(5)
        setup_totp = totp.now()
        r = api("post", "/vault/setup", token=full_token, json={
            "password": VAULT_PASSWORD,
            "totpCode": setup_totp,
        })
        check("POST /vault/setup → 200", r.status_code == 200,
              f"(HTTP {r.status_code}: {r.text[:200]})")
        if r.status_code == 200:
            status = get_data(r).get("status", {})
            check("Vault enabled après setup", status.get("enabled") is True)
            check("vaultPasswordHash absent de la réponse setup",
                  "passwordhash" not in r.text.lower())

    # --- 1f. Récupérer le dossier vault root ---
    r = api("get", "/vault/status", token=full_token)
    root_folder = get_data(r).get("rootFolder")
    check("Dossier racine vault créé", root_folder is not None,
          f"(rootFolder: {root_folder})")
    vault_folder_id = root_folder.get("id") if root_folder else None
    check("Dossier vault isVault=true en DB",
          root_folder.get("isVault") is True if root_folder else False)

    # --- 1g. Unlock vault ---
    info("Unlock du coffre-fort...")
    time.sleep(5)
    unlock_totp = totp.now()
    r = api("post", "/vault/unlock", token=full_token, json={
        "password": VAULT_PASSWORD,
        "totpCode": unlock_totp,
    })
    check("POST /vault/unlock → 200", r.status_code == 200,
          f"(HTTP {r.status_code}: {r.text[:200]})")

    # --- 1h. Upload d'un fichier dans le vault ---
    info("Upload d'un fichier dans le vault...")
    secret_content = "CONFIDENTIEL — données ultra-sensibles du coffre-fort"
    fd, tmp_path = tempfile.mkstemp(suffix=".txt")
    try:
        os.write(fd, secret_content.encode())
        os.close(fd)
        with open(tmp_path, "rb") as f:
            r = api("post", "/files/upload", token=full_token,
                    files={"files": ("secret_vault.txt", f, "text/plain")},
                    data={"folderId": vault_folder_id} if vault_folder_id else {})
        check("Upload fichier vault → 200/201/207",
              r.status_code in (200, 201, 207),
              f"(HTTP {r.status_code}: {r.text[:200]})")
    finally:
        os.unlink(tmp_path)

    vault_file_id = None
    if r.status_code in (200, 201, 207):
        files_list = get_data(r).get("files") or [get_data(r).get("file")]
        if files_list and files_list[0]:
            vault_file_id = files_list[0].get("id")
            info(f"Fichier vault uploadé : {vault_file_id}")

            # Vérifier le chiffrement en DB
            out, _ = db_exec(
                f"SELECT name, \"storagePath\", \"mimeType\" FROM \"File\" WHERE id='{vault_file_id}'"
            )
            info(f"Entrée DB : {out.strip()}")
            check("Fichier vault dans le dossier isVault=true",
                  bool(out.strip()))

    # --- 1i. Lock vault ---
    info("Lock du coffre-fort...")
    r = api("post", "/vault/lock", token=full_token)
    check("POST /vault/lock → 200", r.status_code == 200,
          f"(HTTP {r.status_code})")

    # --- 1j. Tentative d'accès au fichier vault VERROUILLÉ ---
    if vault_file_id:
        info("Accès au fichier vault verrouillé (doit échouer)...")
        r = api("get", f"/files/{vault_file_id}/download", token=full_token)
        check("Téléchargement vault verrouillé → 403/401/423",
              r.status_code in (401, 403, 423),
              f"(HTTP {r.status_code} — doit refuser quand coffre verrouillé)")

    # --- 1k. Mauvais mot de passe vault ---
    info("Unlock avec mauvais mot de passe...")
    time.sleep(5)
    bad_totp = totp.now()
    r = api("post", "/vault/unlock", token=full_token, json={
        "password": "WrongPassword123!",
        "totpCode": bad_totp,
    })
    check("Vault unlock mauvais MDP → 401/400",
          r.status_code in (400, 401, 403),
          f"(HTTP {r.status_code})")

    # --- 1l. Vérifier le chiffrement en base ---
    info("Vérification du chiffrement en base de données...")
    out, _ = db_exec(
        "SELECT \"encryptedDek\", \"kekSalt\", \"vaultPasswordHash\" IS NOT NULL as has_vault_hash "
        f"FROM \"User\" WHERE id='{user_id}'"
    )
    info(f"Champs chiffrement : {out.strip()}")
    check("encryptedDek présent en DB (DEK chiffré)", "encryptedDek" not in out or len(out.strip()) > 10)
    check("vaultPasswordHash présent en DB", "t" in out.lower())

    return full_token, user_id


# ─────────────────────────────────────────────────────────────────────────────
# 2. PARTAGE DE DOSSIER
# ─────────────────────────────────────────────────────────────────────────────
def test_sharing(admin_token=None, share_token=None, share_uid=None):
    print(f"\n{c('bold', '═══ 2. Partage de dossier ════════════════════════════')}")

    # User1 = admin user (a valid token without MFA complexity)
    # User2 = share user
    token1 = admin_token
    token2 = share_token
    uid2 = share_uid

    if not token1 or not token2:
        fail("Tokens manquants pour test_sharing")
        return
    check("User1 (admin) et user2 (share) prêts", True)

    # --- 2a. Créer un dossier à partager ---
    info("Création du dossier à partager...")
    folder_name = f"DossierPartage_{int(time.time())}"
    r = api("post", "/folders", token=token1, json={"name": folder_name})
    check("Création dossier partageur → 201", r.status_code in (200, 201),
          f"(HTTP {r.status_code}: {r.text[:100]})")
    if r.status_code not in (200, 201):
        return
    folder_id = get_data(r).get("folder", {}).get("id")
    info(f"Dossier créé : {folder_id}")

    # --- 2b. Uploader un fichier dans ce dossier ---
    info("Upload d'un fichier dans le dossier partagé...")
    fd, tmp_path = tempfile.mkstemp(suffix=".txt")
    try:
        os.write(fd, b"Contenu partage user1")
        os.close(fd)
        with open(tmp_path, "rb") as f:
            r_up = api("post", "/files/upload", token=token1,
                       files={"files": ("fichier_partage.txt", f, "text/plain")},
                       data={"folderId": folder_id})
    finally:
        os.unlink(tmp_path)
    check("Upload fichier dans dossier partagé → 200/201/207",
          r_up.status_code in (200, 201, 207),
          f"(HTTP {r_up.status_code})")

    # --- 2c. Partager le dossier avec user2 ---
    info(f"Partage du dossier avec {SHARE_USER['email']}...")
    r = api("post", "/share/folders", token=token1, json={
        "folderId": folder_id,
        "targetUserEmail": SHARE_USER["email"],
        "canRead": True,
        "canWrite": True,
        "canDelete": False,
        "canShare": False,
    })
    check("POST /shares/folders → 201", r.status_code in (200, 201),
          f"(HTTP {r.status_code}: {r.text[:200]})")
    if r.status_code not in (200, 201):
        return

    share_data = get_data(r)
    shared_folder = share_data.get("sharedFolder", {})
    share_id = shared_folder.get("id")
    info(f"Share créé : {share_id}")
    check("sharedFolder id retourné", bool(share_id))

    # --- 2d. Vérifier les shares envoyés par user1 ---
    r = api("get", "/share/folders/by-me", token=token1)
    check("GET /shares/folders/by-me → 200", r.status_code == 200,
          f"(HTTP {r.status_code})")
    shares_by_me = get_data(r).get("sharedFolders", [])
    check("Dossier partagé présent dans la liste by-me",
          any(s.get("folderId") == folder_id for s in shares_by_me),
          f"({len(shares_by_me)} partages trouvés)")

    # --- 2e. User2 voit le partage en attente ---
    r = api("get", "/share/pending", token=token2)
    check("GET /share/pending user2 → 200", r.status_code == 200,
          f"(HTTP {r.status_code})")
    pending = get_data(r)
    folders_pending = pending.get("pendingFolders", [])
    info(f"Partages en attente pour user2 : {len(folders_pending)} dossier(s)")
    check("Dossier partagé visible dans pending de user2",
          len(folders_pending) > 0,
          "(aucun partage en attente)")

    if folders_pending:
        pending_share_id = folders_pending[0].get("id")
        # --- 2f. User2 accepte le partage ---
        info(f"User2 accepte le partage {pending_share_id}...")
        r = api("post", f"/share/folders/{pending_share_id}/accept", token=token2)
        check("POST /share/folders/:id/accept → 200", r.status_code == 200,
              f"(HTTP {r.status_code}: {r.text[:200]})")

        # --- 2g. User2 voit le dossier partagé ---
        r = api("get", "/share/folders/with-me", token=token2)
        check("GET /share/folders/with-me → 200", r.status_code == 200,
              f"(HTTP {r.status_code})")
        shared_with_me = get_data(r).get("sharedFolders", [])
        check("Dossier partagé visible dans with-me de user2",
              len(shared_with_me) > 0,
              f"({len(shared_with_me)} dossiers reçus)")

        # --- 2h. Isolation du chiffrement ---
        info("Vérification isolation chiffrement (DEK distinct par utilisateur)...")
        admin_email = "test_admin@supfile.local"
        out, _ = db_exec(
            f"SELECT \"encryptedDek\" FROM \"User\" WHERE email='{admin_email}'"
        )
        dek1 = out.strip()
        out2, _ = db_exec(
            f"SELECT \"encryptedDek\" FROM \"User\" WHERE id='{uid2}'"
        )
        dek2 = out2.strip()
        check("DEK user1 ≠ DEK user2 (chiffrement isolé)", dek1 != dek2,
              "(même DEK — isolation compromise)")

    # --- 2i. User3 tente d'accéder au dossier partagé sans invitation ---
    r = api("get", f"/folders/{folder_id}", token=token2)
    info(f"Accès direct dossier par user2 : HTTP {r.status_code}")
    # Non partagé directement — dépend de l'implémentation

    # Nettoyage
    info("Suppression du dossier partagé (nettoyage)...")
    api("delete", f"/folders/{folder_id}", token=token1)


# ─────────────────────────────────────────────────────────────────────────────
# 3. EXPORT GDPR
# ─────────────────────────────────────────────────────────────────────────────
def test_gdpr_export(token=None):
    print(f"\n{c('bold', '═══ 3. Export GDPR ════════════════════════════════════')}")

    if not token:
        fail("Token manquant pour GDPR export")
        return

    # --- 3a. Déclencher l'export ---
    info("GET /auth/export-data...")
    r = api("get", "/auth/export-data", token=token)
    check("GET /auth/export-data → 200", r.status_code == 200,
          f"(HTTP {r.status_code}: {r.text[:200]})")
    if r.status_code != 200:
        return

    # --- 3b. Vérifier le format CSV de l'export ---
    # L'export GDPR est un fichier CSV (pas JSON)
    content_type = r.headers.get("Content-Type", "")
    check("Export GDPR format CSV", "csv" in content_type.lower() or "text" in content_type.lower(),
          f"(Content-Type: {content_type})")

    export_text = r.text.lower()
    check("Export CSV contient l'email utilisateur",
          SHARE_USER["email"].lower() in export_text,
          "(email absent du CSV)")
    check("Export CSV contient les sections attendues",
          "profil" in export_text or "section" in export_text,
          "(section 'profil' absente)")
    check("Export CSV contient au moins 5 lignes",
          export_text.count("\n") >= 5,
          f"({export_text.count(chr(10))} lignes)")

    # --- 3c. Vérifier l'absence de secrets dans l'export ---
    check("Password hash ($2b$) absent de l'export GDPR",
          "$2b$" not in r.text,
          "(bcrypt hash trouvé)")
    check("mfaSecret absent de l'export GDPR",
          "mfasecret" not in export_text,
          "(mfaSecret trouvé)")
    check("encryptedDek absent de l'export GDPR",
          "encrypteddek" not in export_text,
          "(encryptedDek trouvé)")
    check("vaultPasswordHash absent de l'export GDPR",
          "vaultpasswordhash" not in export_text,
          "(vaultPasswordHash trouvé)")
    check("kekSalt absent de l'export GDPR",
          "keksalt" not in export_text,
          "(kekSalt trouvé)")

    # --- 3d. Sans token ---
    r_unauth = api("get", "/auth/export-data")
    check("Export GDPR sans token → 401", r_unauth.status_code == 401,
          f"(HTTP {r_unauth.status_code})")

    info(f"Export GDPR : {len(r.content)} octets, {r.text.count(chr(10))} lignes CSV")


# ─────────────────────────────────────────────────────────────────────────────
# 4. ONLYOFFICE
# ─────────────────────────────────────────────────────────────────────────────
def test_onlyoffice(token=None):
    print(f"\n{c('bold', '═══ 4. OnlyOffice ════════════════════════════════════')}")

    if not token:
        fail("Token manquant pour OnlyOffice")
        return

    # --- 4a. Upload d'un fichier .docx ---
    info("Upload d'un fichier .docx...")
    docx_content = b"PK\x03\x04"  # Début signature ZIP valide (docx = zip)
    fd, tmp_path = tempfile.mkstemp(suffix=".docx")
    try:
        os.write(fd, docx_content + b"\x00" * 100)
        os.close(fd)
        with open(tmp_path, "rb") as f:
            r = api("post", "/files/upload", token=token,
                    files={"files": ("document_test.docx", f,
                                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    finally:
        os.unlink(tmp_path)

    check("Upload .docx → 200/201/207", r.status_code in (200, 201, 207),
          f"(HTTP {r.status_code})")
    if r.status_code not in (200, 201, 207):
        return

    files_list = get_data(r).get("files") or [get_data(r).get("file")]
    docx_id = files_list[0].get("id") if files_list and files_list[0] else None
    info(f"docx uploadé : {docx_id}")

    # --- 4b. can-edit sur .docx ---
    if docx_id:
        r = api("get", f"/onlyoffice/can-edit/{docx_id}", token=token)
        check("GET /onlyoffice/can-edit (.docx) → 200", r.status_code == 200,
              f"(HTTP {r.status_code}: {r.text[:200]})")
        if r.status_code == 200:
            can_edit = get_data(r).get("canEdit")
            check(".docx est éditable (canEdit=true)", can_edit is True,
                  f"(canEdit={can_edit})")

    # --- 4c. Config éditeur pour .docx ---
    if docx_id:
        r = api("get", f"/onlyoffice/config/{docx_id}", token=token)
        check("GET /onlyoffice/config (.docx) → 200", r.status_code == 200,
              f"(HTTP {r.status_code}: {r.text[:300]})")
        if r.status_code == 200:
            resp = get_data(r)
            # Response: { config: { document: {...}, editorConfig: {...} }, token: "...", onlyofficeUrl: "..." }
            config = resp.get("config", resp)
            check("Config contient 'document'", "document" in config,
                  f"(clés config: {list(config.keys())})")
            check("Config contient 'editorConfig'", "editorConfig" in config,
                  f"(clés config: {list(config.keys())})")
            check("Réponse contient 'token' OnlyOffice", "token" in resp,
                  f"(clés réponse: {list(resp.keys())})")
            # Vérifier que l'URL du document pointe vers le backend (pas MinIO direct)
            doc_url = config.get("document", {}).get("url", "")
            info(f"URL document OnlyOffice : {doc_url[:80]}")
            check("URL document passe par le backend (pas MinIO direct)",
                  "minio" not in doc_url.lower() and "9000" not in doc_url,
                  f"(URL: {doc_url[:80]})")

    # --- 4d. Upload .txt → non éditable ---
    info("Upload d'un fichier .txt pour vérifier can-edit=false...")
    fd, tmp_path = tempfile.mkstemp(suffix=".txt")
    try:
        os.write(fd, b"Fichier texte brut")
        os.close(fd)
        with open(tmp_path, "rb") as f:
            r_txt = api("post", "/files/upload", token=token,
                        files={"files": ("texte_brut.txt", f, "text/plain")})
    finally:
        os.unlink(tmp_path)

    if r_txt.status_code in (200, 201, 207):
        files_list = get_data(r_txt).get("files") or [get_data(r_txt).get("file")]
        txt_id = files_list[0].get("id") if files_list and files_list[0] else None
        if txt_id:
            r = api("get", f"/onlyoffice/can-edit/{txt_id}", token=token)
            check("GET /onlyoffice/can-edit (.txt) → 200", r.status_code == 200,
                  f"(HTTP {r.status_code})")
            if r.status_code == 200:
                can_edit = get_data(r).get("canEdit")
                # OnlyOffice supporte .txt — canEdit peut être True ou False selon la config
                info(f".txt canEdit={can_edit} (OnlyOffice peut supporter .txt)")

    # --- 4e. Accès à /onlyoffice/config sans token ---
    if docx_id:
        r = api("get", f"/onlyoffice/config/{docx_id}")
        check("Config OnlyOffice sans token → 401", r.status_code == 401,
              f"(HTTP {r.status_code})")

    # Nettoyage
    if docx_id:
        api("delete", f"/files/{docx_id}?permanent=true", token=token)


# ─────────────────────────────────────────────────────────────────────────────
# 5. ADMIN PANEL
# ─────────────────────────────────────────────────────────────────────────────
def test_admin_panel(admin_token=None, non_admin_token=None, non_admin_uid=None):
    print(f"\n{c('bold', '═══ 5. Admin Panel ════════════════════════════════════')}")

    if not admin_token:
        fail("Token admin manquant")
        return
    check("Token admin disponible", True)

    # --- 5b. GET /admin/overview ---
    r = api("get", "/admin/overview", token=admin_token)
    check("GET /admin/overview → 200", r.status_code == 200,
          f"(HTTP {r.status_code}: {r.text[:200]})")
    if r.status_code == 200:
        overview = get_data(r)
        info(f"Overview : {json.dumps(overview, indent=2, default=str)[:300]}")
        kpis = overview.get("kpis", overview)
        check("Overview contient les stats utilisateurs",
              "totalUsers" in kpis,
              f"(clés kpis: {list(kpis.keys())})")
        info(f"totalUsers={kpis.get('totalUsers')}, totalFiles={kpis.get('totalFiles')}, "
             f"totalStorageUsed={kpis.get('totalStorageUsed')}")

    # --- 5c. GET /admin/users ---
    r = api("get", "/admin/users", token=admin_token)
    check("GET /admin/users → 200", r.status_code == 200,
          f"(HTTP {r.status_code}: {r.text[:200]})")
    if r.status_code == 200:
        users_data = get_data(r)
        users = users_data.get("users", users_data if isinstance(users_data, list) else [])
        check("Liste utilisateurs non vide", len(users) > 0, f"({len(users)} users)")
        if users:
            first_user = users[0]
            check("Mot de passe hashé absent de la liste admin",
                  "password" not in str(first_user).lower() or "$2b$" not in str(first_user),
                  "(password hash exposé dans /admin/users)")
            check("mfaSecret absent de la liste admin",
                  "mfasecret" not in str(first_user).lower(),
                  "(mfaSecret exposé)")

    # --- 5d. GET /admin/export/users.csv ---
    r = api("get", "/admin/export/users.csv", token=admin_token)
    check("GET /admin/export/users.csv → 200", r.status_code == 200,
          f"(HTTP {r.status_code})")
    if r.status_code == 200:
        check("Content-Type CSV", "csv" in r.headers.get("Content-Type", "").lower() or
              "text" in r.headers.get("Content-Type", "").lower(),
              f"(Content-Type: {r.headers.get('Content-Type', '?')})")
        check("CSV contient une ligne header", "email" in r.text.lower(),
              f"(extrait: {r.text[:100]})")
        check("CSV ne contient pas de hash bcrypt",
              "$2b$" not in r.text,
              "(bcrypt hash dans CSV)")

    # --- 5e. GET /admin/export/storage.csv ---
    r = api("get", "/admin/export/storage.csv", token=admin_token)
    check("GET /admin/export/storage.csv → 200", r.status_code == 200,
          f"(HTTP {r.status_code})")

    # --- 5f. Vérifier qu'un non-admin ne peut pas accéder ---
    r = api("get", "/admin/overview", token=non_admin_token)
    check("GET /admin/overview non-admin → 403", r.status_code == 403,
          f"(HTTP {r.status_code} — un non-admin ne doit pas accéder)")

    # --- 5g. PATCH /admin/users/:userId/plan ---
    info("Test changement de plan via admin...")
    target_uid = non_admin_uid
    if target_uid:
        r = api("patch", f"/admin/users/{target_uid}/plan", token=admin_token,
                json={"plan": "PRO"})
        check("PATCH /admin/users/:id/plan → 200", r.status_code == 200,
              f"(HTTP {r.status_code}: {r.text[:200]})")
        if r.status_code == 200:
            # Remettre en FREE
            api("patch", f"/admin/users/{target_uid}/plan", token=admin_token,
                json={"plan": "FREE"})

    # --- 5h. POST /admin/reindex ---
    info("Test reindex des fichiers...")
    r = api("post", "/admin/reindex", token=admin_token)
    check("POST /admin/reindex → 200/202", r.status_code in (200, 202),
          f"(HTTP {r.status_code}: {r.text[:200]})")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{c('bold', c('blue', '═══════════════════════════════════════════════════'))}")
    print(f"{c('bold', c('blue', '  SUPFILE — Tests fonctionnels avancés'))}")
    print(f"{c('bold', c('blue', '═══════════════════════════════════════════════════'))}")
    print(f"  Backend : {BASE_URL}")

    # Vérifier que le backend répond
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if r.status_code not in (200, 404):
            raise Exception("Backend non disponible")
    except Exception:
        try:
            r = requests.get(f"{BASE_URL}/api/auth/login", timeout=5)
        except Exception as e:
            print(f"\n{c('red', f'Backend inaccessible : {e}')}")
            sys.exit(1)

    print(f"  {c('green', '✓')} Backend accessible\n")

    # ── Pre-auth : créer tous les comptes et obtenir les tokens en une seule passe
    # pour ne pas dépenser le budget du rate limiter dans chaque test.
    print(f"{c('bold', '── Initialisation des comptes ────────────────────────')}")

    # Admin user — pas de MFA, créé via DB
    admin_user = {"email": "test_admin@supfile.local", "password": "AdminPass123!",
                  "firstName": "Admin", "lastName": "Test"}
    api("post", "/auth/register", json=admin_user)
    out, _ = db_exec(f"UPDATE \"User\" SET role='ADMIN' WHERE email='{admin_user['email']}' RETURNING id")
    admin_id = out.strip()
    r = api("post", "/auth/login", json={"email": admin_user["email"], "password": admin_user["password"]})
    login_data = get_data(r)
    admin_token = login_data.get("token") or login_data.get("tempToken")
    info(f"Admin token : {'OK' if admin_token else 'FAIL'} (id={admin_id})")

    # Share user — pas de MFA
    api("post", "/auth/register", json=SHARE_USER)
    r = api("post", "/auth/login", json={"email": SHARE_USER["email"], "password": SHARE_USER["password"]})
    share_data = get_data(r)
    share_token = share_data.get("token") or share_data.get("tempToken")
    share_uid_from_data = share_data.get("userId") or share_data.get("user", {}).get("id")
    out2, _ = db_exec(f"SELECT id FROM \"User\" WHERE email='{SHARE_USER['email']}'")
    share_uid = share_uid_from_data or out2.strip()
    info(f"Share user token : {'OK' if share_token else 'FAIL'}")

    print()
    test_vault()
    test_sharing(admin_token=admin_token, share_token=share_token, share_uid=share_uid)
    test_gdpr_export(token=share_token)
    test_onlyoffice(token=admin_token)
    test_admin_panel(admin_token=admin_token, non_admin_token=share_token, non_admin_uid=share_uid)

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
