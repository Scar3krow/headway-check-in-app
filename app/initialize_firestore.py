from google.cloud import firestore
from werkzeug.security import generate_password_hash
import uuid
from datetime import datetime

def initialize_firestore():
    db = firestore.Client()

    # ============================
    # 🔹 USERS INITIALIZATION
    # ============================
    users_ref = db.collection('users')
    
    # Default Users (Admin, Clinician, Clients)
    default_users = [
        {
            "email": "admin@example.com",
            "password": generate_password_hash("AdminPass123"),
            "role": "admin",
            "name": "Admin User",
            "created_at": datetime.utcnow(),
            "last_login": None,
        },
        {
            "email": "clinician@example.com",
            "password": generate_password_hash("ClinicianPass123"),
            "role": "clinician",
            "name": "Dr. Clinician",
            "assigned_clients": [],  # List of client IDs (to be assigned below)
            "created_at": datetime.utcnow(),
            "last_login": None,
        },
        {
            "email": "client1@example.com",
            "password": generate_password_hash("ClientPass123"),
            "role": "client",
            "name": "Client One",
            "assigned_clinician_id": None,  # Will be assigned later
            "past_sessions": [],
            "created_at": datetime.utcnow(),
            "last_login": None,
        },
        {
            "email": "client2@example.com",
            "password": generate_password_hash("ClientPass123"),
            "role": "client",
            "name": "Client Two",
            "assigned_clinician_id": None,  # Will be assigned later
            "past_sessions": [],
            "created_at": datetime.utcnow(),
            "last_login": None,
        }
    ]

    print("Checking users collection...")
    
    for user_data in default_users:
        user_query = users_ref.where("email", "==", user_data["email"]).stream()
        user_doc = next(iter(user_query), None)

        if user_doc is None:
            user_id = str(uuid.uuid4())  # Generate unique ID
            users_ref.document(user_id).set(user_data)
            print(f"Added {user_data['role']}: {user_data['email']}")
        else:
            print(f"User {user_data['email']} already exists.")

    # Assign clients to clinician
    clinician_doc = users_ref.where("role", "==", "clinician").limit(1).stream()
    clinician_doc = next(iter(clinician_doc), None)

    if clinician_doc:
        clinician_id = clinician_doc.id
        client_docs = users_ref.where("role", "==", "client").stream()

        assigned_clients = []
        for client_doc in client_docs:
            client_id = client_doc.id
            assigned_clients.append(client_id)

            users_ref.document(client_id).update({"assigned_clinician_id": clinician_id})
            print(f"Assigned {client_doc.to_dict().get('name')} to Clinician {clinician_doc.to_dict().get('name')}")

        users_ref.document(clinician_id).update({"assigned_clients": assigned_clients})

    # ============================
    # 🔹 QUESTIONS INITIALIZATION
    # ============================
    questions_ref = db.collection("questions")
    existing_questions = list(questions_ref.stream())

    default_questions = [
        {"text": "I have felt tense, anxious, or nervous."},
        {"text": "I have felt I have someone to turn to for support when needed."},
        {"text": "I have felt able to cope when things go wrong."},
        {"text": "Talking to people has felt too much for me."},
        {"text": "I have felt panic or terror."},
        {"text": "I made plans to end my life."},
        {"text": "I have had difficulty getting to sleep or staying asleep."},
        {"text": "I have felt despairing or helpless."},
        {"text": "I have felt unhappy."},
        {"text": "Unwanted images or memories have been distressing me."},
    ]

    if len(existing_questions) < len(default_questions):
        print("Updating questions collection...")
        
        # Delete existing questions
        for question in existing_questions:
            questions_ref.document(question.id).delete()

        # Add the default questions
        for question in default_questions:
            questions_ref.add(question)
        
        print("Questions collection has been updated.")
    else:
        print("Questions collection already contains all required questions.")

    # ============================
    # 🔹 INVITES INITIALIZATION
    # ============================
    invites_ref = db.collection("invites")
    print("Invites collection is ready.")

if __name__ == "__main__":
    initialize_firestore()
