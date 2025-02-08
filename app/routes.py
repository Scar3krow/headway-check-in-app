import os
import jwt
import uuid
from flask import Blueprint, request, jsonify, make_response, redirect
from flask_bcrypt import Bcrypt
from google.cloud import firestore
from datetime import datetime, timedelta, timezone
from firebase_admin import firestore

bcrypt = Bcrypt()
main_bp = Blueprint('main', __name__)
db = firestore.Client()

# Dynamically set the frontend URL based on the environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")  # Default to 'production'

if ENVIRONMENT == "experimental":
    FRONTEND_URL = "https://headway-check-in-app-1-experimental.onrender.com"
else:
    FRONTEND_URL = "https://headway-check-in-app-1.onrender.com"

print(f"🔹 Running in {ENVIRONMENT} mode. Frontend URL: {FRONTEND_URL}")

# ✅ Ensure API calls are handled properly
API_PREFIXES = ("/api/", "/register", "/login", "/questions", "/submit-responses", "/past-responses")

SECRET_KEY = "Headway50!"  # Replace with a strong, unique key

def cors_enabled_response(data, status=200):
    """Wraps responses with proper CORS headers"""
    response = make_response(jsonify(data), status)
    response.headers["Access-Control-Allow-Origin"] = FRONTEND_URL
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, device-token"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

def validate_token():
    """Validate JWT token and ensure session exists in Firestore."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, cors_enabled_response({'message': 'Missing or invalid token'}, 401), 401

    token = auth_header.split(' ')[1]
    
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded_token.get('id')
        device_token = decoded_token.get('device_token')  # 🔥 Extract device token

        if not user_id or not device_token:
            return None, cors_enabled_response({'message': 'Invalid token payload'}, 401), 401

        # 🔥 Check if this device_token exists in Firestore under user's sessions
        session_ref = db.collection('users').document(user_id).collection('sessions').document(device_token).get()

        if not session_ref.exists:
            return None, cors_enabled_response({'message': 'Session expired or revoked'}, 401), 401

        return decoded_token, None, None

    except jwt.ExpiredSignatureError:
        return None, cors_enabled_response({'message': 'Token expired'}, 401), 401
    except jwt.InvalidTokenError:
        return None, cors_enabled_response({'message': 'Invalid token'}, 401), 401


@main_bp.route("/", defaults={"path": ""})
@main_bp.route("/<path:path>")
def catch_all(path):
    """Redirects API calls to Flask and everything else to the frontend."""
    if path.startswith("api/") or path in ["login", "register", "logout"]:
        return cors_enabled_response({"message": "Invalid API request"}, 404)

    # Redirect all other routes to React
    return redirect(FRONTEND_URL)


@main_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    first_name = data.get('first_name', '').strip().capitalize()
    last_name = data.get('last_name', '').strip().capitalize()
    email = data.get('email', '').strip().lower()
    password = data.get('password')
    role = data.get('role', 'client')
    invite_code = data.get('invite_code', '').strip()
    assigned_clinician_id = data.get('assigned_clinician_id')

    # Validate required fields
    if not first_name or not last_name or not password or not email:
        return cors_enabled_response({'message': 'All fields are required.'}, 400)

    if role not in ['client', 'clinician', 'admin']:
        return cors_enabled_response({'message': 'Invalid role specified.'}, 400)

    # Password validation
    errors = []
    if len(password) < 6:
        errors.append("Password must be at least 6 characters long.")
    if not any(char.isdigit() or char in "@$!%*?&" for char in password):
        errors.append("Password must contain at least one digit or special character.")

    if errors:
        return cors_enabled_response({'message': " ".join(errors)}, 400)

    users_ref = db.collection('users')
    if users_ref.where('email', '==', email).get():
        return cors_enabled_response({'message': 'Email already registered'}, 400)

    if role in ['clinician', 'admin']:
        if not invite_code:
            return cors_enabled_response({'message': 'Invite code is required for this role.'}, 400)

        try:
            invites_ref = db.collection('invites').where('invite_code', '==', invite_code).where('role', '==', role).stream()
            invite = next(invites_ref)
            invite_data = invite.to_dict()

            if invite_data.get('used', False):
                return cors_enabled_response({'message': 'This invite code has already been used.'}, 400)

            db.collection('invites').document(invite.id).update({'used': True})
        except StopIteration:
            return cors_enabled_response({'message': 'Invalid or expired invite code.'}, 400)

    if role == 'client' and not assigned_clinician_id:
        return cors_enabled_response({'message': 'Assigned clinician ID is required for clients.'}, 400)

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_ref = users_ref.add({
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'password': hashed_password,
        'role': role,
        'assigned_clinician_id': assigned_clinician_id if role == 'client' else None,
        'created_at': datetime.utcnow()
    })

    user_id = user_ref[1].id

    # Ensure clinicians & admins are added to the clinicians collection
    if role in ['clinician', 'admin']:
        db.collection('clinicians').document(user_id).set({
            'id': user_id,
            'name': f"{first_name} {last_name}",
            'is_admin': True if role == 'admin' else False,
            'assigned_clinician_id': assigned_clinician_id if role == 'admin' else None,
        })

    # Ensure admins are also in the admins collection
    if role == 'admin':
        db.collection('admins').document(user_id).set({
            'id': user_id,
            'name': f"{first_name} {last_name}"
        })

    # Check for an existing Authorization header (i.e. if a user is already logged in)
    auth_header = request.headers.get('Authorization')
    extra_data = {}
    if auth_header:
        # If an authorization header is present, instruct the frontend to log out the current user.
        extra_data = {
            'redirectTo': '/login',
            'shouldLogout': True
        }

    # Return a response instructing the frontend to navigate to the login page.
    return cors_enabled_response({
        'message': 'User registered successfully',
        'role': role,
        **extra_data
    }, 201)


@main_bp.route('/login', methods=['POST'])
def login():
    """Login and issue a JWT tied to a specific device."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password')

        # Ensure email and password are provided.
        if not email or not password:
            return cors_enabled_response({'message': 'Email and password are required.'}, 400)

        users_ref = db.collection('users')
        user_docs = list(users_ref.where('email', '==', email).stream())
        
        if not user_docs:
            # No user found for that email.
            return cors_enabled_response({'message': 'Invalid credentials'}, 401)
        
        user_doc = user_docs[0]
        user_data = user_doc.to_dict()
        print("User data found for login:", user_data)  # Debug: Check document structure

        # Ensure the user document contains a password field.
        if 'password' not in user_data:
            raise Exception("User document is missing the 'password' field.")

        # Validate the password
        if bcrypt.check_password_hash(user_data['password'], password):
            # Generate a unique device token for this login session.
            device_token = str(uuid.uuid4())

            # Create JWT payload with the device token.
            token_payload = {
                'id': user_doc.id,
                'role': user_data['role'],
                'exp': datetime.utcnow() + timedelta(hours=48),
                'device_token': device_token
            }
            access_token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")

            # Store this session in Firestore under users/{user_id}/sessions.
            user_sessions_ref = db.collection('users').document(user_doc.id).collection('sessions')
            user_sessions_ref.document(device_token).set({
                'device_token': device_token,
                'created_at': datetime.utcnow(),
            })

            return cors_enabled_response({
                'access_token': access_token,
                'role': user_data['role'],
                'user_id': user_doc.id,
                'device_token': device_token
            }, 200)
        else:
            return cors_enabled_response({'message': 'Invalid credentials'}, 401)

    except Exception as e:
        # Log the exception for debugging.
        print("Exception in /login:", e)
        return cors_enabled_response({'message': 'Internal server error', 'error': str(e)}, 500)


@main_bp.route('/questions', methods=['GET'])
def get_questions():
    """Fetch all questions."""
    try:
        questions_ref = db.collection('questions').stream()
        questions = [{'id': q.id, 'text': q.to_dict().get('text')} for q in questions_ref]
        return cors_enabled_response(questions, 200)
    except Exception as e:
        return cors_enabled_response({'message': 'Failed to fetch questions', 'error': str(e)}, 500)


@main_bp.route('/submit-responses', methods=['POST'])
def submit_responses():
    """Submit responses to Firestore."""
    try:
        decoded_token, error_response, status_code = validate_token()
        if error_response:
            return cors_enabled_response(error_response, status_code)

        data = request.get_json()
        if not data or 'responses' not in data or not isinstance(data['responses'], list):
            return cors_enabled_response({'message': '"responses" must be a list.'}, 400)

        session_id = str(uuid.uuid4())
        user_id = decoded_token['id']
        timestamp = firestore.SERVER_TIMESTAMP

        for response in data['responses']:
            if 'question_id' not in response or 'response_value' not in response:
                return cors_enabled_response({'message': 'Each response must have "question_id" and "response_value".'}, 400)

            db.collection('responses').add({
                'user_id': user_id,
                'session_id': session_id,
                'question_id': response['question_id'],
                'response_value': response['response_value'],
                'timestamp': timestamp
            })

        return cors_enabled_response({'message': 'Responses submitted successfully', 'session_id': session_id}, 201)
    except Exception as e:
        print("Exception in /submit-responses:", e)
        return cors_enabled_response({'message': 'Internal server error', 'error': str(e)}, 500)


@main_bp.route('/past-responses', methods=['GET'])
def past_responses():
    """Fetch past responses for a user."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role')  
    user_id = decoded_token.get('id')
    query_user_id = request.args.get('user_id')

    try:
        # ✅ **Admins can query any user (Must specify user_id)**
        if user_role == 'admin':
            if not query_user_id:
                return cors_enabled_response({'message': 'Admin must specify a user_id'}, 400)

        # ✅ **Clinicians can only query their assigned clients**
        elif user_role == 'clinician':
            if not query_user_id:
                return cors_enabled_response({'message': 'Clinician must specify a user_id'}, 400)

            # 🔍 **Check if user is assigned to the clinician**
            client_doc = db.collection('users').document(query_user_id).get()
            if not client_doc.exists or client_doc.to_dict().get('assigned_clinician_id') != user_id:
                return cors_enabled_response({'message': 'Unauthorized: You can only view assigned clients'}, 403)

        # ✅ **Clients can only access their own data**
        elif user_role == 'client':
            if query_user_id and query_user_id != user_id:
                return cors_enabled_response({'message': 'Unauthorized: Clients can only access their own data'}, 403)
            query_user_id = user_id  # Force clients to only access their own data

        else:
            return cors_enabled_response({'message': 'Unauthorized: Invalid role'}, 403)

        # 📥 **Fetch responses for the given user_id**
        responses_ref = db.collection('responses').where('user_id', '==', query_user_id).stream()
        responses = [
            {
                'question_id': r.to_dict().get('question_id'),
                'response_value': r.to_dict().get('response_value'),
                'session_id': r.to_dict().get('session_id'),
                'timestamp': r.to_dict().get('timestamp').isoformat() if r.to_dict().get('timestamp') else None
            }
            for r in responses_ref
        ]

        if not responses:
            return cors_enabled_response({'message': 'No responses available for this user'}, 404)

        return cors_enabled_response(responses, 200)

    except Exception as e:
        print(f"Error fetching past responses: {e}")
        return cors_enabled_response({'message': 'Error retrieving past responses'}, 500)


@main_bp.route('/submit-answer', methods=['POST'])
def submit_answer():
    """Submit an answer to Firestore."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    data = request.get_json()
    if not data or 'answer' not in data:
        return cors_enabled_response({'message': 'Invalid payload. "answer" is required.'}, 400)

    db.collection('answers').add({
        'answer': data['answer'],
        'submitted_by': decoded_token['id'],
        'submitted_at': firestore.SERVER_TIMESTAMP
    })

    return cors_enabled_response({'message': 'Answer submitted successfully'}, 201)


@main_bp.route('/session-details', methods=['GET'])
def session_details():
    "Fetch session details by session_id, with correct role-based access control."
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return error_response

    session_id = request.args.get('session_id')
    if not session_id:
        return cors_enabled_response({'message': 'Session ID is required'}, 400)

    user_role = decoded_token.get('role')
    user_id = decoded_token.get('id')

    # Fetch all responses with the given session_id
    responses_ref = db.collection('responses').where('session_id', '==', session_id).stream()
    responses = []
    mismatched_responses = []  # For debugging purposes

    for r in responses_ref:
        response_data = r.to_dict()
        response_user_id = response_data.get('user_id')

        # For client users, ensure that every response's user_id matches the logged-in client.
        if user_role == "client":
            if response_user_id != user_id:
                mismatched_responses.append({ "doc_id": r.id, "user_id": response_user_id })
                print(f"Unauthorized access: In session {session_id}, expected user_id {user_id} but found {response_user_id} in document {r.id}")
                return cors_enabled_response({'message': 'Unauthorized: You cannot view another user\'s session.'}, 403)
        # For clinicians, check that the client is assigned to them.
        elif user_role == "clinician":
            client_doc = db.collection('users').document(response_user_id).get()
            if client_doc.exists:
                client_data = client_doc.to_dict()
                assigned_clinician = client_data.get('assigned_clinician_id')
                if assigned_clinician != user_id:
                    print(f"Unauthorized access: Clinician {user_id} is not assigned to client {response_user_id} (document {r.id}).")
                    return cors_enabled_response({'message': 'Unauthorized access to session'}, 403)
        # Admins have unrestricted access

        responses.append({
            'question_id': response_data.get('question_id'),
            'response_value': response_data.get('response_value'),
            'timestamp': response_data.get('timestamp').isoformat() if response_data.get('timestamp') else None,
        })

    if not responses:
        return cors_enabled_response({'message': 'No responses found for this session'}, 404)

    return cors_enabled_response(responses, 200)

""""
@main_bp.route('/session-details', methods=['GET'])
def session_details():
    "Fetch session details by session_id, with correct role-based access control."
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return error_response

    session_id = request.args.get('session_id')
    if not session_id:
        return cors_enabled_response({'message': 'Session ID is required'}, 400)

    # No matter the role, simply fetch the responses.
    responses_ref = db.collection('responses').where('session_id', '==', session_id).stream()
    responses = []

    for r in responses_ref:
        response_data = r.to_dict()
        responses.append({
            'question_id': response_data.get('question_id'),
            'response_value': response_data.get('response_value'),
            'timestamp': response_data.get('timestamp').isoformat() if response_data.get('timestamp') else None,
        })

    if not responses:
        return cors_enabled_response({'message': 'No responses found for this session'}, 404)

    return cors_enabled_response(responses, 200)
"""

@main_bp.route('/search-users', methods=['GET'])
def search_users():
    """Search users by first name or last name."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role') 
    user_id = decoded_token.get('id')
    query = request.args.get('query', '').lower()

    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)

    # ✅ Admins can search all users
    if user_role == 'admin':
        users_ref = db.collection('users').stream()
        matching_users = [
            {
                'id': user.id,
                'first_name': user.to_dict().get('first_name', ''),
                'last_name': user.to_dict().get('last_name', ''),
                'role': user.to_dict().get('role', '')
            }
            for user in users_ref
            if query in user.to_dict().get('first_name', '').lower() or query in user.to_dict().get('last_name', '').lower()
        ]

    # ✅ Clinicians can only search assigned clients
    elif user_role == 'clinician':
        assigned_clients = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
        matching_users = [
            {
                'id': user.id,
                'first_name': user.to_dict().get('first_name', ''),
                'last_name': user.to_dict().get('last_name', ''),
                'role': user.to_dict().get('role', '')
            }
            for user in assigned_clients
            if query in user.to_dict().get('first_name', '').lower() or query in user.to_dict().get('last_name', '').lower()
        ]

    # ❌ Clients cannot search for other users
    else:
        return cors_enabled_response({'message': 'Unauthorized: Clients cannot search for other users'}, 403)

    return cors_enabled_response(matching_users, 200)


@main_bp.route('/search-clients', methods=['GET'])
def search_clients():
    """Allow clinicians and admins to search for clients."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role')
    user_id = decoded_token.get('id')
    query = request.args.get('query', '').strip().lower()

    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)

    try:
        # ✅ Admins can search all clients
        if user_role == 'admin':
            clients_ref = db.collection('users').where('role', '==', 'client').stream()

        # ✅ Clinicians can only search their assigned clients
        elif user_role == 'clinician':
            clients_ref = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()

        # ❌ Clients cannot search at all
        else:
            return cors_enabled_response({'message': 'Unauthorized: Clients cannot search for other users'}, 403)

        # 🔍 Filter clients matching the search query
        matching_clients = [
            {
                'id': client.id,
                'first_name': client.to_dict().get('first_name', ''),
                'last_name': client.to_dict().get('last_name', ''),
            }
            for client in clients_ref
            if query in client.to_dict().get('first_name', '').lower()
            or query in client.to_dict().get('last_name', '').lower()
        ]

        return cors_enabled_response({'clients': matching_clients}, 200)

    except Exception as e:
        print(f"Error searching clients: {e}")
        return cors_enabled_response({'message': 'Error retrieving client search results'}, 500)


@main_bp.route('/search-all-clients', methods=['GET'])
def search_all_clients():
    """Admin search for all clients."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    # ✅ Only admins can use this route
    if decoded_token.get('role') != "admin":
        return cors_enabled_response({'message': 'Unauthorized: Only admins can search all clients'}, 403)

    query = request.args.get('query', '').strip().lower()
    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)

    try:
        # 🔍 Fetch all clients from Firestore
        users_ref = db.collection('users').where('role', '==', 'client').stream()
        matching_clients = [
            {
                'id': user.id,
                'first_name': user.to_dict().get('first_name', ''),
                'last_name': user.to_dict().get('last_name', '')
            }
            for user in users_ref
            if query in user.to_dict().get('first_name', '').lower()
            or query in user.to_dict().get('last_name', '').lower()
        ]

        return cors_enabled_response({'clients': matching_clients}, 200)

    except Exception as e:
        print(f"Error searching all clients: {e}")
        return cors_enabled_response({'message': 'Error retrieving all client search results'}, 500)


@main_bp.route('/user-info', methods=['GET'])
def get_user_info():
    """Fetch user information by user_id."""
    user_id = request.args.get('user_id')
    if not user_id:
        return cors_enabled_response({'message': 'User ID is required'}, 400)

    user_doc = db.collection('users').document(user_id).get()

    if not user_doc.exists:
        return cors_enabled_response({'message': 'User not found'}, 404)

    user_data = user_doc.to_dict()
    return cors_enabled_response({
        'first_name': user_data.get('first_name', ''),
        'last_name': user_data.get('last_name', ''),
        'email': user_data.get('email', '')
    }, 200)


@main_bp.route('/validate-invite', methods=['POST'])
def validate_invite():
    """Validate invite code."""
    data = request.get_json()
    invite_code = data.get('invite_code', '').strip()

    if not invite_code:
        return cors_enabled_response({'message': 'Invite code is required'}, 400)

    invites_ref = db.collection('invites').where('invite_code', '==', invite_code).stream()
    matching_invites = [doc.to_dict() for doc in invites_ref]

    if not matching_invites:
        return cors_enabled_response({'message': 'Invalid invite code'}, 400)

    invite_data = matching_invites[0]
    if invite_data.get('used', False):
        return cors_enabled_response({'message': 'Invite code has already been used'}, 400)

    return cors_enabled_response({'message': 'Invite code valid', 'role': invite_data.get("role", "unknown")}, 200)

@main_bp.route('/mark-invite-used', methods=['POST'])
def mark_invite_used():
    """Mark an invite code as used."""
    data = request.get_json()
    invite_code = data.get('invite_code')

    if not invite_code:
        return cors_enabled_response({'message': 'Invite code is required'}, 400)

    invite_ref = db.collection('invite_codes').where('code', '==', invite_code).stream()
    invite_doc = next(invite_ref, None)  

    if not invite_doc:
        return cors_enabled_response({'message': 'Invalid invite code.'}, 400)

    invite_data = invite_doc.to_dict()
    if invite_data.get('used', False):
        return cors_enabled_response({'message': 'Invite code has already been used.'}, 400)

    db.collection('invite_codes').document(invite_doc.id).update({'used': True})
    return cors_enabled_response({'message': 'Invite code marked as used.'}, 200)


@main_bp.route('/generate-invite', methods=['POST'])
def generate_invite():
    """Generate an invite code for a specific role."""
    data = request.json
    role = data.get('role')

    if role not in ['clinician', 'admin']:
        return cors_enabled_response({'message': 'Invalid role provided.'}, 400)

    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)
    
    if decoded_token.get('role') != 'admin':
        return cors_enabled_response({'message': 'Unauthorized.'}, 403)

    try:
        invite_code = str(uuid.uuid4())
        db.collection('invites').document(invite_code).set({
            'invite_code': invite_code,
            'role': role,
            'used': False,
            'created_at': datetime.utcnow()
        })
        return cors_enabled_response({'code': invite_code}, 200)
    except Exception as e:
        return cors_enabled_response({'message': 'Failed to generate invite code.', 'error': str(e)}, 500)


@main_bp.route('/remove-user', methods=['POST'])
def remove_user():
    """Remove a user (clinician or admin) by their ID and reassign clients if applicable."""
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return cors_enabled_response({'message': 'User ID is required'}, 400)

    try:
        # Fetch the user document from the `users` collection
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return cors_enabled_response({'message': 'User not found'}, 404)

        user_data = user_doc.to_dict()
        user_role = user_data.get('role')  # Assumes roles are stored in `users`

        # ✅ Remove from `users` collection
        db.collection('users').document(user_id).delete()

        # ✅ If the user is a clinician, remove from `clinicians`
        db.collection('clinicians').document(user_id).delete()

        # ✅ If the user is an admin, also remove from `admins`
        if user_role == "admin":
            db.collection('admins').document(user_id).delete()

        # 🔄 **Reassign Clients if user was a clinician**
        if user_role == "clinician" or user_role == "admin":
            clients_ref = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
            client_updates = []
            for client in clients_ref:
                client_updates.append(client.id)
                db.collection('users').document(client.id).update({'assigned_clinician_id': None})

            return cors_enabled_response({
                'message': f'User {user_role} removed successfully',
                'clients_updated': client_updates  # For debugging purposes
            }, 200)

        return cors_enabled_response({'message': 'User removed successfully'}, 200)

    except Exception as e:
        print(f"Error removing user: {e}")
        return cors_enabled_response({'message': 'An error occurred while removing the user', 'error': str(e)}, 500)


@main_bp.route('/get-clinicians', methods=['GET'])
def get_clinicians():
    """Fetch all clinicians."""
    try:
        clinicians_ref = db.collection('clinicians').stream()
        clinicians = [{"id": c.id, "name": c.to_dict().get("name", "")} for c in clinicians_ref]

        return cors_enabled_response({"clinicians": clinicians or []}, 200)

    except Exception as e:
        return cors_enabled_response({"message": "Failed to fetch clinicians", "error": str(e)}, 500)


@main_bp.route('/get-admins', methods=['GET'])
def get_admins():
    """Fetch all admins."""
    try:
        admins_ref = db.collection('admins').stream()
        admins = [{"id": a.id, "name": a.to_dict().get("name", "")} for a in admins_ref]

        return cors_enabled_response({"admins": admins or []}, 200)

    except Exception as e:
        return cors_enabled_response({"message": "Failed to fetch admins", "error": str(e)}, 500)


@main_bp.route('/clinician-data', methods=['GET'])
def get_clinician_data():
    """Fetch clinician data for analysis."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    # ✅ Ensure only admins can access
    if decoded_token.get('role') != 'admin':
        return cors_enabled_response({'message': 'Unauthorized: Only admins can access this data'}, 403)

    clinician_id = request.args.get('clinician_id')
    if not clinician_id:
        return cors_enabled_response({'message': 'Clinician ID is required'}, 400)

    try:
        # 🔹 Get all clients assigned to this clinician
        clients_ref = db.collection('users').where('assigned_clinician_id', '==', clinician_id).stream()
        clients = [{**client.to_dict(), 'user_id': client.id} for client in clients_ref]

        total_clients = len(clients)

        if total_clients == 0:
            return cors_enabled_response({
                'total_clients': 0,
                'percent_improved': 0,
                'percent_clinically_significant': 0,
                'percent_improved_last_6_months': 0,
                'percent_clinically_significant_last_6_months': 0,
            }, 200)

        # 🛠 Helper Functions
        def calculate_scores(client):
            """Calculate first & latest session scores for a client."""
            try:
                responses = db.collection('responses').where('user_id', '==', client['user_id']).stream()
                sessions = {}

                for resp in responses:
                    data = resp.to_dict()
                    session_id = data.get('session_id')
                    response_value = data.get('response_value')
                    timestamp = data.get('timestamp')

                    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)

                    if session_id and response_value is not None and timestamp:
                        if session_id not in sessions:
                            sessions[session_id] = {'responses': [], 'timestamp': timestamp}
                        sessions[session_id]['responses'].append(response_value)

                sorted_sessions = sorted(sessions.values(), key=lambda x: x['timestamp'])

                if len(sorted_sessions) < 2:
                    return None, None

                first_score = sum(sorted_sessions[0]['responses']) - 10
                latest_score = sum(sorted_sessions[-1]['responses']) - 10

                return first_score, latest_score

            except Exception as e:
                print(f"Error calculating scores for {client['user_id']}: {e}")
                return None, None

        def is_clinically_significant(initial, latest):
            return initial > 18 and (initial - latest) >= 12

        def is_recent(timestamp):
            six_months_ago = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=182)
            return timestamp >= six_months_ago

        # 🔹 Compute Statistics
        improved, clinically_significant = 0, 0
        improved_last_6_months, clinically_significant_last_6_months = 0, 0

        for client in clients:
            initial, latest = calculate_scores(client)

            if initial is not None and latest is not None:
                if latest < initial:
                    improved += 1
                if is_clinically_significant(initial, latest):
                    clinically_significant += 1

                responses = db.collection('responses').where('user_id', '==', client['user_id']).stream()
                has_recent_responses = any(is_recent(resp.to_dict()['timestamp']) for resp in responses)

                if has_recent_responses:
                    if latest < initial:
                        improved_last_6_months += 1
                    if is_clinically_significant(initial, latest):
                        clinically_significant_last_6_months += 1

        return cors_enabled_response({
            'total_clients': total_clients,
            'percent_improved': (improved / total_clients) * 100,
            'percent_clinically_significant': (clinically_significant / total_clients) * 100,
            'percent_improved_last_6_months': (improved_last_6_months / total_clients) * 100,
            'percent_clinically_significant_last_6_months': (clinically_significant_last_6_months / total_clients) * 100,
        }, 200)

    except Exception as e:
        print(f"Error in /clinician-data: {e}")
        return cors_enabled_response({'message': 'Failed to fetch clinician data.', 'error': str(e)}, 500)
    
@main_bp.route('/logout-device', methods=['POST'])
def logout_device():
    """Log out the current device but keep other sessions active."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_id = decoded_token.get('id')
    device_token = decoded_token.get('device_token')

    if not device_token:
        return cors_enabled_response({'message': 'No device token found'}, 400)

    # 🔥 Check if the session exists before trying to delete
    session_ref = db.collection('users').document(user_id).collection('sessions').document(device_token)
    session_doc = session_ref.get()

    if not session_doc.exists:
        return cors_enabled_response({'message': 'Session not found'}, 404)

    session_ref.delete()
    return cors_enabled_response({'message': 'Logged out from this device successfully'}, 200)


@main_bp.route('/logout-all', methods=['POST'])
def logout_all():
    """Log out all devices for the specified user."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    data = request.get_json()
    target_user_id = data.get('user_id')  # ✅ Admin specifies which user to log out

    if not target_user_id:
        return cors_enabled_response({'message': 'User ID is required'}, 400)

    # 🔥 Ensure only admins can log out other users
    if decoded_token.get('role') != "admin" and decoded_token.get('id') != target_user_id:
        return cors_enabled_response({'message': 'Unauthorized: Cannot log out other users'}, 403)

    # 🔥 Remove **all** sessions for the specified user
    sessions_ref = db.collection('users').document(target_user_id).collection('sessions')
    for session in sessions_ref.stream():
        session.reference.delete()

    return cors_enabled_response({'message': 'Logged out from all devices'}, 200)


"""@main_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    ""Handle forgotten password request by sending a reset link.""
    data = request.json
    email = data.get('email')

    user_ref = db.collection('users').where('email', '==', email).get()
    if not user_ref:
        return cors_enabled_response({'message': 'If this email exists, a reset link will be sent.'}, 200)

    user = user_ref[0]
    reset_token = str(uuid.uuid4())
    db.collection('password_resets').add({
        'email': email,
        'token': reset_token,
        'expires_at': datetime.utcnow() + timedelta(minutes=0)
    })

    # 🔥 Send reset email (Implement actual email logic in send_reset_email)
    send_reset_email(email, reset_token)

    return cors_enabled_response({'message': 'If this email exists, a reset link will be sent.'}, 200)


@main_bp.route('/reset-password', methods=['POST'])
def reset_password():
    ""Reset the user's password using a valid reset token.""
    data = request.json
    token = data.get('token')
    new_password = data.get('password')

    # 🔍 Validate the token
    reset_ref = db.collection('password_resets').where('token', '==', token).get()
    if not reset_ref or reset_ref[0].to_dict()['expires_at'] < datetime.utcnow():
        return cors_enabled_response({'message': 'Invalid or expired token.'}, 400)

    reset_data = reset_ref[0].to_dict()
    email = reset_data['email']

    # 🔍 Find user by email
    user_ref = db.collection('users').where('email', '==', email).get()
    if not user_ref:
        return cors_enabled_response({'message': 'User not found.'}, 404)

    # 🔒 Securely hash the new password
    hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.collection('users').document(user_ref[0].id).update({'password': hashed_password})

    return cors_enabled_response({'message': 'Password updated successfully.'}, 200) """
