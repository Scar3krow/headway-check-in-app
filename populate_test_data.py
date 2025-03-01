import random
import uuid
from datetime import datetime, timezone
from google.cloud import firestore
import os

import firebase_admin
from firebase_admin import credentials, firestore
from werkzeug.security import generate_password_hash
from google.oauth2 import service_account

# Configuration for test data
NUM_CLINICIANS = 10
NUM_ADMIN_CLINICIANS = 2  # out of 10, the first 2 will be admins
NUM_CLIENTS_PER_CLINICIAN = 10
NUM_SESSIONS_PER_CLIENT = 10
NUM_QUESTIONS = 10  # Assume the questionnaire has 10 questions
QUESTIONNAIRE_ID = "default_questionnaire"
DEFAULT_PASSWORD = "Headway!"

if os.getenv("RENDER"):
    CREDENTIALS_PATH = "/etc/secrets/secret_key.json"
else:
    CREDENTIALS_PATH = os.path.join(os.getcwd(), "secret_key.json")

if not os.path.exists(CREDENTIALS_PATH):
    raise RuntimeError(f"Missing Firebase credentials file at {CREDENTIALS_PATH}")

# Load credentials using the google.oauth2 service_account
cred = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)

# Initialize Firebase Admin SDK if not already initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS_PATH))

# Initialize Firestore client with these credentials
db = firestore.Client(credentials=cred)


def create_admin(admin_number, clinician_first_name):
    # Name format: "AdminX_of_[clinician_first_name] Test"
    name = f"Admin{admin_number}_of_{clinician_first_name} Test"
    email = f"admin{admin_number}_{clinician_first_name.lower()}@example.com"
    hashed_password = generate_password_hash(DEFAULT_PASSWORD, method="scrypt")
    user_data = {
        "first_name": name.split("_of_")[0],
        "last_name": "Test",
        "email": email,
        "password": hashed_password,
        "role": "admin",
        "created_at": datetime.utcnow()
    }
    # Create document with an auto-generated ID in "users"
    user_ref = db.collection("users").document()
    user_ref.set(user_data)
    user_id = user_ref.id
    # Add to 'admins' collection
    db.collection("admins").document(user_id).set({
        "id": user_id,
        "name": name
    })
    # Also add to 'clinicians' collection (admins have clinician privileges)
    db.collection("clinicians").document(user_id).set({
        "id": user_id,
        "name": name,
        "is_admin": True,
        "assigned_clinician_id": None
    })
    return user_id, name

def create_clinician(clinician_number):
    # Name format: "ClinicianX Test"
    name = f"Clinician{clinician_number} Test"
    email = f"clinician{clinician_number}@example.com"
    hashed_password = generate_password_hash(DEFAULT_PASSWORD, method="scrypt")
    user_data = {
        "first_name": f"Clinician{clinician_number}",
        "last_name": "Test",
        "email": email,
        "password": hashed_password,
        "role": "clinician",
        "created_at": datetime.utcnow()
    }
    user_ref = db.collection("users").document()
    user_ref.set(user_data)
    user_id = user_ref.id
    # Add to 'clinicians' collection
    db.collection("clinicians").document(user_id).set({
        "id": user_id,
        "name": name,
        "is_admin": False,
        "assigned_clinician_id": None
    })
    return user_id, f"Clinician{clinician_number}"

def create_client(client_number, clinician_first_name, clinician_id):
    # Name format: "ClientX_of_[clinician_first_name] Test"
    name = f"Client{client_number}_of_{clinician_first_name} Test"
    email = f"client{client_number}_{clinician_first_name.lower()}@example.com"
    hashed_password = generate_password_hash(DEFAULT_PASSWORD, method="scrypt")
    user_data = {
        "first_name": f"Client{client_number}",
        "last_name": f"of_{clinician_first_name} Test",
        "email": email,
        "password": hashed_password,
        "role": "client",
        "assigned_clinician_id": clinician_id,
        "created_at": datetime.utcnow()
    }
    user_ref = db.collection("users").document()
    user_ref.set(user_data)
    user_id = user_ref.id
    return user_id, name

def create_session_for_client(user_id):
    # Create a unique session ID using timestamp and a short random hex
    session_id = f"session_{int(datetime.utcnow().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}"
    timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)
    
    # Build summary responses for each question.
    summary_responses = []
    for i in range(1, NUM_QUESTIONS + 1):
        response_value = random.randint(1, 5)  # Generate a random response
        summary_responses.append({
            "questionnaire_id": QUESTIONNAIRE_ID,
            "question_id": f"q{i}",
            "response_value": response_value,
            "timestamp": timestamp,
        })
    
    # Create session data with summary_responses
    session_data = {
        "questionnaire_id": QUESTIONNAIRE_ID,
        "timestamp": timestamp,
        "summary_responses": summary_responses
    }
    session_ref = db.collection("user_data").document(user_id).collection("sessions").document(session_id)
    session_ref.set(session_data)
    
    # For each question, create a response document in the "responses" subcollection using the same summary data.
    for i, response in enumerate(summary_responses, start=1):
        response_doc_id = f"response_{i}"
        session_ref.collection("responses").document(response_doc_id).set(response)
    
    return session_id

def populate_test_data():
    clinician_ids = []
    # Create clinicians (first NUM_ADMIN_CLINICIANS will be admins)
    for i in range(1, NUM_CLINICIANS + 1):
        if i <= NUM_ADMIN_CLINICIANS:
            user_id, name = create_admin(i, f"Clinician{i}")
            print(f"Created admin: {name} with ID: {user_id}")
            clinician_ids.append((user_id, f"Clinician{i}"))
        else:
            user_id, name = create_clinician(i)
            print(f"Created clinician: {name} with ID: {user_id}")
            clinician_ids.append((user_id, f"Clinician{i}"))

    # For each clinician, create clients
    for clinician_id, clinician_name in clinician_ids:
        for j in range(1, NUM_CLIENTS_PER_CLINICIAN + 1):
            client_id, client_name = create_client(j, clinician_name, clinician_id)
            print(f"Created client: {client_name} with ID: {client_id}")
            # For each client, create NUM_SESSIONS_PER_CLIENT sessions
            for k in range(1, NUM_SESSIONS_PER_CLIENT + 1):
                session_id = create_session_for_client(client_id)
                print(f"Created session {session_id} for client {client_name}")

if __name__ == "__main__":
    populate_test_data()
