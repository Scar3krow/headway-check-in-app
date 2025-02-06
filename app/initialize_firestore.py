from google.cloud import firestore
from werkzeug.security import generate_password_hash
import uuid
from datetime import datetime

def initialize_firestore():
    """
    Initializes Firestore with:
      - Users (including admin, clinician, and client documents)
      - Admins and Clinicians collections for lookup
      - A sessions subcollection will be created on first login (not pre-created)
      - Default questions (10 total)
      - A sample invite
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
            # "last_login": None  # Optionally add this field
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
            "is_admin": False,
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
            # "last_login": None  # Optionally add this field
        }
        users_ref.document(client_id).set(default_client)
        print(f"Default client created: client@example.com (ID: {client_id})")
    else:
        print("Default client(s) already exist.")

    # Note: The "sessions" subcollection for each user is created when a login occurs.
    # You do not need to pre-create it here, as Firestore creates a subcollection when the first document is added.

    # -----------------------------
    # QUESTIONS COLLECTION INITIALIZATION
    # -----------------------------
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
        # Add default questions
        for question in default_questions:
            questions_ref.add(question)
        print("Questions collection has been updated.")
    else:
        print("Questions collection already initialized.")

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
