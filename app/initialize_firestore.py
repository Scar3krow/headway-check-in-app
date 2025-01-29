from google.cloud import firestore
from werkzeug.security import generate_password_hash
import uuid

def initialize_firestore():
    db = firestore.Client()

    # Users Initialization
    users_ref = db.collection('users')
    existing_users = list(users_ref.stream())

    if len(existing_users) == 0:
        print("Initializing users collection...")
        test_users = [
            {
                'username': "test_client",
                'email': "test_client@example.com",
                'password': generate_password_hash("password123"),  # Hash the password
                'role': "client",
            },
            {
                'username': "test_clinician",
                'email': "test_clinician@example.com",
                'password': generate_password_hash("password123"),  # Hash the password
                'role': "clinician",
            },
            {
                'username': "test_admin",
                'email': "test_admin@example.com",
                'password': generate_password_hash("admin123"),  # Hash the password
                'role': "admin",
            },
        ]
        for user in test_users:
            users_ref.add(user)
        print("Test users have been added to the users collection.")
    else:
        print("Users collection already initialized.")

    # Questions Initialization
    questions_ref = db.collection('questions')
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

    # Invites Initialization
    invites_ref = db.collection('invites')
    existing_invites = list(invites_ref.stream())

    if len(existing_invites) == 0:
        print("Initializing invites collection...")
        test_invites = [
            {
                'invite_code': str(uuid.uuid4()),
                'role': "clinician",
                'used': False,
            },
            {
                'invite_code': str(uuid.uuid4()),
                'role': "admin",
                'used': False,
            },
        ]
        for invite in test_invites:
            invites_ref.add(invite)
        print("Test invite codes have been added to the invites collection:")
        for invite in test_invites:
            print(f"Role: {invite['role']}, Invite Code: {invite['invite_code']}")
    else:
        print("Invites collection already initialized.")

if __name__ == "__main__":
    initialize_firestore()
