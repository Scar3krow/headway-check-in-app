from google.cloud import firestore
from werkzeug.security import generate_password_hash
import uuid
from datetime import datetime

def initialize_firestore():
    """
    Initializes Firestore with the required collections and default data.
    
    Collections created/updated:
      - users: Contains all user documents.
          * For every user: first_name, last_name, email, password, role, created_at.
          * For clients: an assigned_clinician_id field is set.
      - admins: For quick lookup of admin users.
      - clinicians: For quick lookup of clinician users (with is_admin flag).
      - questions: Contains 10 default questions.
      - invites: Contains at least one sample invite.
    
    Note: The sessions subcollection for each user is created when a user logs in.
    """
    db = firestore.Client()

    # -----------------------------
    # USERS COLLECTION INITIALIZATION
    # -----------------------------
    users_ref = db.collection("users")

    # --- Create Default Admin if none exist ---
    admin_query = list(users_ref.where("role", "==", "admin").stream())
    if not admin_query:
        admin_id = str(uuid.uuid4())
        default_admin = {
            "first_name": "Admin",
            "last_name": "User",
            "email": "admin@example.com",
            "password": generate_password_hash("AdminPass123"),
            "role": "admin",
            "assigned_clinician_id": None,  # Not applicable for admin
            "created_at": datetime.utcnow()
        }
        users_ref.document(admin_id).set(default_admin)
        print(f"Default admin created: admin@example.com (ID: {admin_id})")

        # Add to the 'admins' collection
        admins_ref = db.collection("admins")
        admins_ref.document(admin_id).set({
            "id": admin_id,
            "name": f"{default_admin['first_name']} {default_admin['last_name']}"
        })
        print("Admin added to the 'admins' collection.")
    else:
        admin_id = list(admin_query)[0].id
        print("Default admin already exists.")

    # --- Create Default Clinician if none exist ---
    clinician_query = list(users_ref.where("role", "==", "clinician").stream())
    if not clinician_query:
        clinician_id = str(uuid.uuid4())
        default_clinician = {
            "first_name": "Clinician",
            "last_name": "User",
            "email": "clinician@example.com",
            "password": generate_password_hash("ClinicianPass123"),
            "role": "clinician",
            "assigned_clinician_id": None,  # Clinicians are not assigned to another clinician
            "created_at": datetime.utcnow()
        }
        users_ref.document(clinician_id).set(default_clinician)
        print(f"Default clinician created: clinician@example.com (ID: {clinician_id})")

        # Add to the 'clinicians' collection
        clinicians_ref = db.collection("clinicians")
        clinicians_ref.document(clinician_id).set({
            "id": clinician_id,
            "name": f"{default_clinician['first_name']} {default_clinician['last_name']}",
            "is_admin": False,  # This clinician is not an admin
            "assigned_clinician_id": None
        })
        print("Clinician added to the 'clinicians' collection.")
    else:
        clinician_id = list(clinician_query)[0].id
        print("Default clinician already exists.")

    # --- Create Default Client if none exist ---
    client_query = list(users_ref.where("role", "==", "client").stream())
    if not client_query:
        client_id = str(uuid.uuid4())
        default_client = {
            "first_name": "Client",
            "last_name": "User",
            "email": "client@example.com",
            "password": generate_password_hash("ClientPass123"),
            "role": "client",
            "assigned_clinician_id": clinician_id,  # Assign client to the default clinician
            "created_at": datetime.utcnow()
        }
        users_ref.document(client_id).set(default_client)
        print(f"Default client created: client@example.com (ID: {client_id})")
    else:
        print("Default client(s) already exist.")

from firebase_admin import firestore

# Initialize Firestore
db = firestore.client()

# -----------------------------
# QUESTIONNAIRES COLLECTION INITIALIZATION
# -----------------------------
questionnaires_ref = db.collection("questionnaires")
default_questionnaire_id = "default_questionnaire"  # Hard coded fixed ID for the primary questionnaire, update if going to multiple questionnaires.

# Check if default questionnaire exists
questionnaire_doc = questionnaires_ref.document(default_questionnaire_id).get()
if not questionnaire_doc.exists:
    print("Creating default questionnaire...")
    questionnaires_ref.document(default_questionnaire_id).set({
        "id": default_questionnaire_id,
        "name": "Standard Check-In",
    })
    print("Default questionnaire created.")
else:
    print("Default questionnaire already exists.")

# -----------------------------
# INITIALIZE QUESTIONNAIRES COLLECTION
# -----------------------------
questionnaires_ref = db.collection("questionnaires")
existing_questionnaires = list(questionnaires_ref.stream())

# Ensure "default_questionnaire" exists
if not any(q.id == "default_questionnaire" for q in existing_questionnaires):
    questionnaires_ref.document("default_questionnaire").set({
        "id": "default_questionnaire",
        "name": "Standard Check-In"
    })
    print("Added default questionnaire.")

    # -----------------------------
    # UPDATE QUESTIONS COLLECTION TO INCLUDE questionnaire_id
    # -----------------------------
    questions_ref = db.collection("questions")
    existing_questions = list(questions_ref.stream())

    default_questions = [
        {"text": "I have felt tense, anxious, or nervous.", "questionnaire_id": "default_questionnaire"},
        {"text": "I have felt I have someone to turn to for support when needed.", "questionnaire_id": "default_questionnaire"},
        {"text": "I have felt able to cope when things go wrong.", "questionnaire_id": "default_questionnaire"},
        {"text": "Talking to people has felt too much for me.", "questionnaire_id": "default_questionnaire"},
        {"text": "I have felt panic or terror.", "questionnaire_id": "default_questionnaire"},
        {"text": "I made plans to end my life.", "questionnaire_id": "default_questionnaire"},
        {"text": "I have had difficulty getting to sleep or staying asleep.", "questionnaire_id": "default_questionnaire"},
        {"text": "I have felt despairing or helpless.", "questionnaire_id": "default_questionnaire"},
        {"text": "I have felt unhappy.", "questionnaire_id": "default_questionnaire"},
        {"text": "Unwanted images or memories have been distressing me.", "questionnaire_id": "default_questionnaire"},
    ]

    # Update existing questions with questionnaire_id
    for question in existing_questions:
        questions_ref.document(question.id).update({"questionnaire_id": "default_questionnaire"})

    print("Questions updated with questionnaire_id.")

    # Add missing questions if needed
    existing_question_texts = [q.to_dict()["text"] for q in existing_questions]
    for question in default_questions:
        if question["text"] not in existing_question_texts:
            questions_ref.add(question)

    print("Questions collection has been updated.")

    # -----------------------------
    # INVITES COLLECTION INITIALIZATION
    # -----------------------------
    invites_ref = db.collection("invites")
    existing_invites = list(invites_ref.stream())
    if not existing_invites:
        print("Initializing invites collection...")
        sample_invite = {
            "invite_code": str(uuid.uuid4()),
            "role": "clinician",  # Example: an invite for a clinician
            "used": False,
            "created_at": datetime.utcnow()
        }
        invites_ref.document(sample_invite["invite_code"]).set(sample_invite)
        print("Sample invite created.")
    else:
        print("Invites collection already initialized.")

    print("Firestore initialization completed successfully!")

if __name__ == "__main__":
    initialize_firestore()
