import os
import json
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin if not already initialized.
if not firebase_admin._apps:
    # Adjust credential path as needed.
    CREDENTIALS_PATH = os.getenv("RENDER") or os.path.join(os.getcwd(), "secret_key.json")
    if not os.path.exists(CREDENTIALS_PATH):
        raise RuntimeError(f"Missing Firebase credentials file at {CREDENTIALS_PATH}")
    cred = credentials.Certificate(CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.Client()

def calculate_overall_metrics():
    # Query active clients (from 'users') and archived clients (from 'archived_users').
    active_clients = [
        {**client.to_dict(), 'user_id': client.id, 'is_archived': False}
        for client in db.collection('users').where('role', '==', 'client').stream()
    ]
    archived_clients = [
        {**client.to_dict(), 'user_id': client.id, 'is_archived': True}
        for client in db.collection('archived_users').stream()
    ]
    clients = active_clients + archived_clients
    total_clients = len(clients)

    if total_clients == 0:
        return {
            'total_clients': 0,
            'percent_improved': 0,
            'percent_clinically_significant': 0,
            'percent_improved_last_6_months': 0,
            'percent_clinically_significant_last_6_months': 0,
            'last_updated': datetime.utcnow().isoformat()
        }

    # Helper: for each client, fetch sessions from the proper parent collection.
    def calculate_scores_for_client(user_id, is_archived):
        collection = "user_data" if not is_archived else "archived_user_data"
        sessions_ref = db.collection(collection).document(user_id).collection("sessions").stream()
        session_scores = []
        for session in sessions_ref:
            session_data = session.to_dict()
            timestamp = session_data.get("timestamp")
            responses = session_data.get("summary_responses", [])
            try:
                values = [float(r.get('response_value', 0)) for r in responses]
            except Exception:
                values = []
            if values:
                total_score = sum(values) - 10  # Your scaling logic.
                session_scores.append({"timestamp": timestamp, "score": total_score})
        session_scores.sort(key=lambda x: x["timestamp"])
        if len(session_scores) < 2:
            return None, None, None
        return session_scores[0]["score"], session_scores[-1]["score"], session_scores[-1]["timestamp"]

    def is_clinically_significant(initial, latest):
        return initial is not None and initial > 18 and (initial - latest) >= 12

    def is_recent(timestamp):
        six_months_ago = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=182)
        return timestamp and timestamp >= six_months_ago

    improved = 0
    clinically_significant = 0
    improved_last_6 = 0
    clinically_significant_last_6 = 0

    for client in clients:
        initial, latest, last_ts = calculate_scores_for_client(client['user_id'], client['is_archived'])
        if initial is not None and latest is not None:
            if latest < initial:
                improved += 1
            if is_clinically_significant(initial, latest):
                clinically_significant += 1
            if is_recent(last_ts):
                if latest < initial:
                    improved_last_6 += 1
                if is_clinically_significant(initial, latest):
                    clinically_significant_last_6 += 1

    metrics = {
        'total_clients': total_clients,
        'percent_improved': (improved / total_clients) * 100,
        'percent_clinically_significant': (clinically_significant / total_clients) * 100,
        'percent_improved_last_6_months': (improved_last_6 / total_clients) * 100,
        'percent_clinically_significant_last_6_months': (clinically_significant_last_6 / total_clients) * 100,
        'last_updated': datetime.utcnow().isoformat()
    }
    return metrics

if __name__ == "__main__":
    metrics = calculate_overall_metrics()
    print("Calculated overall metrics:", metrics)
    # Write to Firestore.
    db.collection('overall_metrics').document('clients').set(metrics)
