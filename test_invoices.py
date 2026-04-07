import urllib.request
import json
import time

def post(path, data):
    req = urllib.request.Request(
        f'http://localhost:8001{path}', 
        data=json.dumps(data).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )
    return json.loads(urllib.request.urlopen(req).read().decode())

user = "test_user_42"

invoices = [
    {
        "file_id": "doc1",
        "file_name": "facture_orange_aout_2025.txt",
        "text": "Facture Orange SAS.\nPériode : Août 2025.\nService forfait de téléphonie mobile.\nÀ payer : 34 euros."
    },
    {
        "file_id": "doc2",
        "file_name": "facture_edf_sept_2025.txt",
        "text": "Facture d'électricité EDF.\nPériode : Septembre 2025.\nConsommation électrique de votre logment (420 kWh).\nMontant à régler : 120 euros."
    },
    {
        "file_id": "doc3",
        "file_name": "facture_orange_sept_2025.txt",
        "text": "Facture Orange SAS.\nPériode : Septembre 2025.\nService forfait de téléphonie mobile + hors forfait données.\nMontant prélevé : 45 euros."
    }
]

print("1. Intégration des fausses factures dans la base de données vectorielle...")
for inv in invoices:
    res = post("/embed", {"file_id": inv["file_id"], "user_id": user, "file_name": inv["file_name"], "text": inv["text"]})
    print(f" -> Indexé {inv['file_name']} (chunks: {res['chunks']})")

time.sleep(1) # Laisse le temps à ChromaDB de bien enregistrer en RAM/Disque

print("\n2. Test de recherche sémantique avec différentes requêtes...")

queries = [
    "Quel est le montant de la facture de téléphonie de septembre 2025 ?",
    "Combien j'ai payé d'électricité en septembre ?",
    "Période d'août 2025 pour la facture mobile"
]

for q in queries:
    print(f"\n=============================")
    print(f"QUESTION : {q}")
    
    # Étape A: Recherche de documents
    search_res = post("/search", {"user_id": user, "query": q, "limit": 2})
    print("Documents trouvés (ChromaDB Vector Search) :")
    for r in search_res["results"]:
        print(f"  - [{r['file_name']}] (distance={r['distance']}) : {r['text'][:50]}...")
        
    # Étape B: RAG LLM response
    print("\n -> Demande au LLM de formuler la réponse...")
    chat_res = post("/chat", {"user_id": user, "query": q})
    print(f"RÉPONSE D'OLLAMA : {chat_res['response']}")
    print("=============================\n")
