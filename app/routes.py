import os
import jwt
import uuid
from flask import Blueprint, request, jsonify, make_response, redirect
from google.cloud import firestore
from datetime import datetime, timedelta, timezone
from firebase_admin import firestore
from google.cloud.firestore import SERVER_TIMESTAMP
from werkzeug.security import generate_password_hash, check_password_hash

main_bp = Blueprint('main', __name__)
db = firestore.Client()

# Dynamically set the frontend URL based on the environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")

if ENVIRONMENT == "experimental":
    FRONTEND_URL = "https://headway-check-in-app-1-experimental.onrender.com"
elif ENVIRONMENT == "development":
    FRONTEND_URL = "http://localhost:3000"
else:
    FRONTEND_URL = "https://headway-check-in-app-1.onrender.com"

# ✅ Ensure API calls are handled properly
API_PREFIXES = ("/api/", "/register", "/login", "/questions", "/past-responses")

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

    # Use Werkzeug’s generate_password_hash with method='scrypt'
    hashed_password = generate_password_hash(password, method='scrypt')
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

    auth_header = request.headers.get('Authorization')
    extra_data = {}
    if auth_header:
        extra_data = {
            'redirectTo': '/login',
            'shouldLogout': True
        }

    return cors_enabled_response({
        'message': 'User registered successfully',
        'role': role,
        **extra_data
    }, 201)


@main_bp.route('/login', methods=['POST'])
def login():
    """Login and issue a JWT tied to a specific device. Archived clients cannot login."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password')

        if not email or not password:
            return cors_enabled_response({'message': 'Email and password are required.'}, 400)

        # Search for the user in the active users collection.
        users_ref = db.collection('users')
        user_docs = list(users_ref.where('email', '==', email).stream())
        
        if not user_docs:
            # If no active user is found, check in the archived users collection.
            archived_ref = db.collection('archived_users')
            archived_docs = list(archived_ref.where('email', '==', email).stream())
            if archived_docs:
                return cors_enabled_response({'message': 'Unable to login due to not being an active client.'}, 401)
            else:
                return cors_enabled_response({'message': 'Invalid credentials'}, 401)
        
        user_doc = user_docs[0]
        user_data = user_doc.to_dict()
        print("User data found for login:", user_data)

        if 'password' not in user_data:
            raise Exception("User document is missing the 'password' field.")

        # Use Werkzeug's check_password_hash for scrypt
        if check_password_hash(user_data['password'], password):
            device_token = str(uuid.uuid4())
            token_payload = {
                'id': user_doc.id,
                'role': user_data['role'],
                'exp': datetime.utcnow() + timedelta(hours=48),
                'device_token': device_token
            }
            access_token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")

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
        print("Exception in /login:", e)
        return cors_enabled_response({'message': 'Internal server error', 'error': str(e)}, 500)


@main_bp.route('/questions', methods=['GET'])
def get_questions():
    """Fetch questions based on questionnaire_id."""
    questionnaire_id = request.args.get('questionnaire_id', 'default_questionnaire') # Hard coded fixed ID for the primary questionnaire, update if going to multiple questionnaires.

    try:
        # ✅ Fetch questions linked to this questionnaire
        questions_ref = db.collection('questions').where('questionnaire_id', '==', questionnaire_id).stream()
        questions = [{"id": q.id, "text": q.to_dict().get("text", "")} for q in questions_ref]

        return cors_enabled_response(questions, 200)
    except Exception as e:
        print(f"Error fetching questions: {e}")
        return cors_enabled_response({'message': 'Failed to fetch questions', 'error': str(e)}, 500)

  
@main_bp.route('/questionnaires', methods=['GET'])
def get_questionnaires():
    """Fetch all available questionnaires."""
    try:
        questionnaires_ref = db.collection('questionnaires').stream()
        questionnaires = [{"id": q.id, "name": q.to_dict().get("name", "Unnamed Questionnaire")} for q in questionnaires_ref]

        return cors_enabled_response(questionnaires, 200)
    except Exception as e:
        print(f"Error fetching questionnaires: {e}")
        return cors_enabled_response({'message': 'Failed to fetch questionnaires', 'error': str(e)}, 500)

@main_bp.route('/user-data/<user_id>/sessions/<session_id>/responses', methods=['POST'])
def store_user_responses(user_id, session_id):
    """Store responses inside `user_data/{user_id}/sessions/{session_id}/responses` and update session summary."""
    try:
        # 🔐 Validate token
        decoded_token, error_response, status_code = validate_token()
        if error_response:
            return cors_enabled_response(error_response, status_code)

        # 🔐 Ensure the user can only submit their own responses
        if decoded_token['id'] != user_id:
            return cors_enabled_response({'message': 'Unauthorized access'}, 403)

        # 🚫 Prevent archived clients from submitting responses.
        archived_client = db.collection("archived_users").document(user_id).get()
        if archived_client.exists:
            return cors_enabled_response({'message': 'Archived clients cannot submit responses'}, 403)

        # 📥 Get request data
        data = request.get_json()
        if not data or 'responses' not in data or not isinstance(data['responses'], list):
            return cors_enabled_response({'message': '"responses" must be a list.'}, 400)

        timestamp = SERVER_TIMESTAMP
        questionnaire_id = data.get("questionnaire_id", "default_questionnaire")  # Default if not provided

        # 🔹 Build summary responses list
        summary_responses = []
        for response in data['responses']:
            if 'question_id' not in response or 'response_value' not in response:
                return cors_enabled_response({'message': 'Each response must have "question_id" and "response_value".'}, 400)
            summary_responses.append({
                "question_id": response["question_id"],
                "response_value": response["response_value"],
            })

        # 🔹 Reference session document
        session_ref = db.collection("user_data").document(user_id).collection("sessions").document(session_id)

        # ✅ Ensure session document exists and update it with summary responses
        if not session_ref.get().exists:
            session_ref.set({
                "questionnaire_id": questionnaire_id,
                "timestamp": timestamp,
                "summary_responses": summary_responses
            })
        else:
            # If the session already exists, update the summary responses field
            session_ref.update({
                "summary_responses": summary_responses
            })

        # 🔹 Reference responses subcollection
        responses_ref = session_ref.collection("responses")

        # 🔹 Store each individual response
        for response in data['responses']:
            response_doc_id = f"response_{response['question_id']}"
            responses_ref.document(response_doc_id).set({
                "question_id": response["question_id"],
                "response_value": response["response_value"],
            })

        return cors_enabled_response({'message': 'Responses stored successfully'}, 201)

    except Exception as e:
        print("Exception in /user-data/{user_id}/sessions/{session_id}/responses:", e)
        return cors_enabled_response({'message': 'Internal server error', 'error': str(e)}, 500)


@main_bp.route('/past-responses', methods=['GET'])
def past_responses():
    """Fetch past responses for a user from active and/or archived sessions using summary data."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role')
    user_id = decoded_token.get('id')
    query_user_id = request.args.get('user_id')
    questionnaire_id = request.args.get('questionnaire_id', None)  # Optional filter
    # New parameter: source can be 'active' (default), 'archived', or 'all'
    source = request.args.get('source', 'active').strip().lower()

    try:
        # Role-based access control.
        if user_role in ['admin', 'clinician']:
            if not query_user_id:
                return cors_enabled_response({'message': 'Must specify a user_id'}, 400)
            if user_role == 'clinician':
                # Use the appropriate collection based on the source parameter.
                if source == 'archived':
                    client_doc = db.collection('archived_users').document(query_user_id).get()
                else:
                    client_doc = db.collection('users').document(query_user_id).get()
                if not client_doc.exists or client_doc.to_dict().get('assigned_clinician_id') != user_id:
                    return cors_enabled_response({'message': 'Unauthorized'}, 403)
        elif user_role == 'client':
            if query_user_id and query_user_id != user_id:
                return cors_enabled_response({'message': 'Unauthorized'}, 403)
            query_user_id = user_id  # Force clients to only access their own data
        else:
            return cors_enabled_response({'message': 'Unauthorized'}, 403)

        # Helper function to get sessions from a specified collection (active or archived).
        def get_sessions_from_collection(collection_name):
            sessions_ref = db.collection(collection_name).document(query_user_id).collection('sessions')
            if questionnaire_id:
                query_obj = sessions_ref.where("questionnaire_id", "==", questionnaire_id).order_by("timestamp", direction=firestore.Query.ASCENDING)
            else:
                query_obj = sessions_ref.order_by("timestamp", direction=firestore.Query.ASCENDING)
            return list(query_obj.stream())

        sessions_list = []
        if source == 'active':
            sessions_list = get_sessions_from_collection('user_data')
        elif source == 'archived':
            sessions_list = get_sessions_from_collection('archived_user_data')
        elif source == 'all':
            active_sessions = get_sessions_from_collection('user_data')
            archived_sessions = get_sessions_from_collection('archived_user_data')
            sessions_list = active_sessions + archived_sessions
            sessions_list.sort(key=lambda s: s.to_dict().get("timestamp"))
        else:
            return cors_enabled_response({'message': 'Invalid source parameter'}, 400)

        responses_list = [
            {
                "session_id": session.id,
                "timestamp": session.to_dict().get("timestamp"),
                "questionnaire_id": session.to_dict().get("questionnaire_id"),
                "summary_responses": session.to_dict().get("summary_responses", [])
            }
            for session in sessions_list
        ]

        if not responses_list:
            return cors_enabled_response({'message': 'No responses available'}, 404)

        return cors_enabled_response(responses_list, 200)

    except Exception as e:
        print(f"Error fetching past responses: {e}")
        return cors_enabled_response({'message': 'Error retrieving past responses'}, 500)


@main_bp.route('/user-data/<user_id>/sessions/<session_id>', methods=['GET'])
def get_session_responses(user_id, session_id):
    "Fetch session responses for a given session, ensuring correct role-based access control. Supports both active and archived sessions via the 'source' parameter."
    try:
        decoded_token, error_response, status_code = validate_token()
        if error_response:
            return error_response

        requestor_role = decoded_token.get('role')
        requestor_id = decoded_token.get('id')

        # Determine source: "active" (default) or "archived"
        source = request.args.get('source', 'active').strip().lower()
        if source == "archived":
            session_ref = db.collection("archived_user_data").document(user_id).collection("sessions").document(session_id)
        else:
            session_ref = db.collection("user_data").document(user_id).collection("sessions").document(session_id)

        session_snapshot = session_ref.get()
        if not session_snapshot.exists:
            return cors_enabled_response({'message': 'Session not found'}, 404)

        # Enforce Role-Based Access Control
        if requestor_role == "client" and user_id != requestor_id:
            print(f"Unauthorized: Client {requestor_id} attempted to access session {session_id} (owned by {user_id})")
            return cors_enabled_response({'message': 'Unauthorized: Clients can only access their own sessions.'}, 403)

        if requestor_role == "clinician":
            # When searching active sessions, check the active users collection.
            # For archived sessions, assume clinician can view if the active user was assigned to them.
            client_doc = db.collection('users').document(user_id).get()
            if client_doc.exists:
                assigned_clinician = client_doc.to_dict().get('assigned_clinician_id')
                if assigned_clinician != requestor_id:
                    print(f"Unauthorized: Clinician {requestor_id} is not assigned to client {user_id}")
                    return cors_enabled_response({'message': 'Unauthorized access to session'}, 403)
            else:
                # If not found in active users, try archived_users.
                client_doc = db.collection('archived_users').document(user_id).get()
                if client_doc.exists:
                    assigned_clinician = client_doc.to_dict().get('assigned_clinician_id')
                    if assigned_clinician != requestor_id:
                        print(f"Unauthorized: Clinician {requestor_id} is not assigned to archived client {user_id}")
                        return cors_enabled_response({'message': 'Unauthorized access to session'}, 403)

        # Fetch session document data.
        session_data = session_snapshot.to_dict()
        if not session_data:
            return cors_enabled_response({'message': 'Session data not found'}, 404)

        # Use the denormalized summary_responses field.
        summary_responses = session_data.get('summary_responses', [])
        questionnaire_id = session_data.get('questionnaire_id', "default_questionnaire")
        timestamp = session_data.get('timestamp')

        if not summary_responses:
            return cors_enabled_response({'message': 'No responses found for this session'}, 404)

        result = {
            "questionnaire_id": questionnaire_id,
            "timestamp": timestamp,
            "summary_responses": summary_responses
        }

        return cors_enabled_response(result, 200)

    except Exception as e:
        print(f"Error fetching session responses: {e}")
        return cors_enabled_response({'message': 'Error retrieving session responses'}, 500)
    

@main_bp.route('/search-users', methods=['GET'])
def search_users():
    """Search users by first name or last name with filtering for archived status."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role')
    user_id = decoded_token.get('id')
    query = request.args.get('query', '').strip().lower()
    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)

    # Retrieve filter parameter; default to "non_archived"
    filter_param = request.args.get('filter', 'non_archived').strip().lower()

    matching_users = []
    try:
        if user_role == 'admin':
            if filter_param in ['non_archived', 'active']:
                # Search active users from the 'users' collection.
                users_ref = db.collection('users').stream()
                matching_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': False
                    }
                    for user in users_ref
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'archived':
                # Search archived users from the 'archived_users' collection.
                archived_ref = db.collection('archived_users').stream()
                matching_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': True
                    }
                    for user in archived_ref
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'all':
                # Search both active and archived users.
                active_ref = db.collection('users').stream()
                archived_ref = db.collection('archived_users').stream()
                active_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': False
                    }
                    for user in active_ref
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
                archived_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': True
                    }
                    for user in archived_ref
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
                matching_users = active_users + archived_users
            else:
                return cors_enabled_response({'message': 'Invalid filter parameter'}, 400)

        elif user_role == 'clinician':
            # Clinicians can only search among their assigned clients.
            if filter_param in ['non_archived', 'active']:
                assigned_clients = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
                matching_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': False
                    }
                    for user in assigned_clients
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'archived':
                assigned_clients = db.collection('archived_users').where('assigned_clinician_id', '==', user_id).stream()
                matching_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': True
                    }
                    for user in assigned_clients
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'all':
                active_ref = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
                archived_ref = db.collection('archived_users').where('assigned_clinician_id', '==', user_id).stream()
                active_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': False
                    }
                    for user in active_ref
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
                archived_users = [
                    {
                        'id': user.id,
                        'first_name': user.to_dict().get('first_name', ''),
                        'last_name': user.to_dict().get('last_name', ''),
                        'role': user.to_dict().get('role', ''),
                        'is_archived': True
                    }
                    for user in archived_ref
                    if query in user.to_dict().get('first_name', '').lower() or 
                       query in user.to_dict().get('last_name', '').lower()
                ]
                matching_users = active_users + archived_users
            else:
                return cors_enabled_response({'message': 'Invalid filter parameter'}, 400)
        else:
            return cors_enabled_response({'message': 'Unauthorized: Clients cannot search for other users'}, 403)

        return cors_enabled_response({'users': matching_users}, 200)

    except Exception as e:
        print(f"Error searching users: {e}")
        return cors_enabled_response({'message': 'Error retrieving user search results'}, 500)


@main_bp.route('/search-clients', methods=['GET'])
def search_clients():
    """Allow clinicians (and admins) to search for clients with filtering by archived status."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role')
    user_id = decoded_token.get('id')
    query = request.args.get('query', '').strip().lower()
    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)

    # Retrieve the filter parameter; default to "non_archived"
    filter_param = request.args.get('filter', 'non_archived').strip().lower()

    try:
        matching_clients = []
        if user_role == 'admin':
            # For admins, search among all clients without assignment restrictions.
            if filter_param in ['non_archived', 'active']:
                clients_ref = db.collection('users').where('role', '==', 'client').stream()
                matching_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': False
                    }
                    for client in clients_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'archived':
                archived_ref = db.collection('archived_users').stream()
                matching_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': True
                    }
                    for client in archived_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'all':
                active_ref = db.collection('users').where('role', '==', 'client').stream()
                archived_ref = db.collection('archived_users').stream()
                active_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': False
                    }
                    for client in active_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
                archived_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': True
                    }
                    for client in archived_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
                matching_clients = active_clients + archived_clients
            else:
                return cors_enabled_response({'message': 'Invalid filter parameter'}, 400)

        elif user_role == 'clinician':
            # Clinicians can only search among their assigned clients.
            if filter_param in ['non_archived', 'active']:
                clients_ref = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
                matching_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': False
                    }
                    for client in clients_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'archived':
                archived_ref = db.collection('archived_users').where('assigned_clinician_id', '==', user_id).stream()
                matching_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': True
                    }
                    for client in archived_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
            elif filter_param == 'all':
                active_ref = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
                archived_ref = db.collection('archived_users').where('assigned_clinician_id', '==', user_id).stream()
                active_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': False
                    }
                    for client in active_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
                archived_clients = [
                    {
                        'id': client.id,
                        'first_name': client.to_dict().get('first_name', ''),
                        'last_name': client.to_dict().get('last_name', ''),
                        'is_archived': True
                    }
                    for client in archived_ref
                    if query in client.to_dict().get('first_name', '').lower() or
                       query in client.to_dict().get('last_name', '').lower()
                ]
                matching_clients = active_clients + archived_clients
            else:
                return cors_enabled_response({'message': 'Invalid filter parameter'}, 400)
        else:
            return cors_enabled_response({'message': 'Unauthorized: Clients cannot search for other users'}, 403)

        return cors_enabled_response({'clients': matching_clients}, 200)

    except Exception as e:
        print(f"Error searching clients: {e}")
        return cors_enabled_response({'message': 'Error retrieving client search results'}, 500)


@main_bp.route('/search-all-clients', methods=['GET'])
def search_all_clients():
    """Admin search for all clients with filtering for archived vs. non-archived clients using smart matching."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    if decoded_token.get('role') != "admin":
        return cors_enabled_response({'message': 'Unauthorized: Only admins can search all clients'}, 403)

    # Get the query and filter parameters.
    query = request.args.get('query', '').strip().lower()
    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)
    
    filter_param = request.args.get('filter', 'non_archived').strip().lower()

    # Split the query into tokens for partial matching.
    tokens = query.split()

    try:
        matching_clients = []

        # Helper function: returns True if every token is found in the client's combined name.
        def match_client(user):
            data = user.to_dict()
            combined = (data.get('first_name', '') + " " + data.get('last_name', '')).lower()
            return all(token in combined for token in tokens)

        if filter_param in ['non_archived', 'active']:
            # Search active clients from the "users" collection.
            users_ref = db.collection('users').where('role', '==', 'client').stream()
            matching_clients = [
                {
                    'id': user.id,
                    'first_name': user.to_dict().get('first_name', ''),
                    'last_name': user.to_dict().get('last_name', ''),
                    'is_archived': False
                }
                for user in users_ref if match_client(user)
            ]
        elif filter_param == 'archived':
            # Search archived clients from the "archived_users" collection.
            archived_ref = db.collection('archived_users').stream()
            matching_clients = [
                {
                    'id': user.id,
                    'first_name': user.to_dict().get('first_name', ''),
                    'last_name': user.to_dict().get('last_name', ''),
                    'is_archived': True
                }
                for user in archived_ref if match_client(user)
            ]
        elif filter_param == 'all':
            # Search both active and archived clients.
            active_ref = db.collection('users').where('role', '==', 'client').stream()
            archived_ref = db.collection('archived_users').stream()
            active_clients = [
                {
                    'id': user.id,
                    'first_name': user.to_dict().get('first_name', ''),
                    'last_name': user.to_dict().get('last_name', ''),
                    'is_archived': False
                }
                for user in active_ref if match_client(user)
            ]
            archived_clients = [
                {
                    'id': user.id,
                    'first_name': user.to_dict().get('first_name', ''),
                    'last_name': user.to_dict().get('last_name', ''),
                    'is_archived': True
                }
                for user in archived_ref if match_client(user)
            ]
            matching_clients = active_clients + archived_clients
        else:
            return cors_enabled_response({'message': 'Invalid filter parameter'}, 400)

        return cors_enabled_response({'clients': matching_clients}, 200)

    except Exception as e:
        print(f"Error searching all clients: {e}")
        return cors_enabled_response({'message': 'Error retrieving all client search results'}, 500)



@main_bp.route('/user-info', methods=['GET'])
def get_user_info():
    """Fetch user information by user_id, optionally from the archived collection."""
    user_id = request.args.get('user_id')
    if not user_id:
        return cors_enabled_response({'message': 'User ID is required'}, 400)

    # Determine the initial collection based on the source parameter.
    source = request.args.get('source', 'active').strip().lower()
    if source == 'archived':
        collection_name = 'archived_users'
        is_archived = True
    else:
        collection_name = 'users'
        is_archived = False

    user_doc = db.collection(collection_name).document(user_id).get()

    # If not found in active and source is active, try the archived collection.
    if not user_doc.exists and source == 'active':
        archived_doc = db.collection('archived_users').document(user_id).get()
        if archived_doc.exists:
            user_doc = archived_doc
            is_archived = True
        else:
            return cors_enabled_response({'message': 'User not found'}, 404)
    elif not user_doc.exists:
        return cors_enabled_response({'message': 'User not found'}, 404)

    user_data = user_doc.to_dict()
    return cors_enabled_response({
        'first_name': user_data.get('first_name', ''),
        'last_name': user_data.get('last_name', ''),
        'email': user_data.get('email', ''),
        'is_archived': is_archived
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
        # Force logout from all devices: remove sessions from both active and archived collections.
        active_sessions_ref = db.collection('users').document(user_id).collection('sessions')
        for session in active_sessions_ref.stream():
            session.reference.delete()
        archived_sessions_ref = db.collection('archived_users').document(user_id).collection('sessions')
        for session in archived_sessions_ref.stream():
            session.reference.delete()

        # Fetch the user document from the `users` collection.
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return cors_enabled_response({'message': 'User not found'}, 404)

        user_data = user_doc.to_dict()
        user_role = user_data.get('role')  # Assumes roles are stored in `users`

        # Remove from `users` collection.
        db.collection('users').document(user_id).delete()

        # If the user is a clinician, remove from `clinicians`.
        db.collection('clinicians').document(user_id).delete()

        # If the user is an admin, also remove from `admins`.
        if user_role == "admin":
            db.collection('admins').document(user_id).delete()

        # Reassign clients if the user was a clinician or admin.
        if user_role in ["clinician", "admin"]:
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
    """Fetch all clinicians (excluding admins)."""
    try:
        clinicians_ref = db.collection('clinicians').stream()
        # Include the is_admin flag in the fetched data.
        clinicians = [
            {"id": c.id, "name": c.to_dict().get("name", ""), "is_admin": c.to_dict().get("is_admin", False)}
            for c in clinicians_ref
        ]
        # Filter out users that are admins.
        filtered_clinicians = [clin for clin in clinicians if not clin.get("is_admin")]
        
        return cors_enabled_response({"clinicians": filtered_clinicians or []}, 200)

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


#NEEDS TO BE UPDATED TO USE APPROPRIATE SEARCH FILTERS + SPED UP
@main_bp.route('/clinician-data', methods=['GET'])
def get_clinician_data():
    """Fetch clinician data for analysis based on the new Firestore structure."""
    try:
        decoded_token, error_response, status_code = validate_token()
        if error_response:
            return cors_enabled_response(error_response, status_code)

        # ✅ Ensure only admins can access
        if decoded_token.get('role') != 'admin':
            return cors_enabled_response({'message': 'Unauthorized: Only admins can access this data'}, 403)

        clinician_id = request.args.get('clinician_id')
        if not clinician_id:
            return cors_enabled_response({'message': 'Clinician ID is required'}, 400)

        # 🔍 **Fetch all clients assigned to the clinician**
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
        def calculate_scores(user_id):
            """Fetch all session scores for a user, sorted by timestamp."""
            try:
                sessions_ref = db.collection("user_data").document(user_id).collection("sessions").stream()
                session_scores = []

                for session_doc in sessions_ref:
                    session_id = session_doc.id
                    session_data = session_doc.to_dict()
                    timestamp = session_data.get("timestamp")

                    # 🔍 **Fetch all responses for this session**
                    responses_ref = db.collection("user_data").document(user_id).collection("sessions").document(session_id).collection("responses").stream()
                    responses = [resp.to_dict().get('response_value') for resp in responses_ref if 'response_value' in resp.to_dict()]

                    if responses:
                        total_score = sum(responses) - 10  # Adjusted for scaling
                        session_scores.append({"timestamp": timestamp, "score": total_score})

                # ✅ Sort sessions by timestamp (oldest first)
                session_scores.sort(key=lambda x: x["timestamp"])

                if len(session_scores) < 2:
                    return None, None

                return session_scores[0]["score"], session_scores[-1]["score"]

            except Exception as e:
                print(f"Error fetching scores for {user_id}: {e}")
                return None, None

        def is_clinically_significant(initial, latest):
            """Determine if a client shows clinically significant improvement."""
            return initial > 18 and (initial - latest) >= 12

        def is_recent(timestamp):
            """Check if the session is within the last 6 months."""
            six_months_ago = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=182)
            return timestamp and timestamp >= six_months_ago

        # 🔹 Compute Statistics
        improved = 0
        clinically_significant = 0
        improved_last_6_months = 0
        clinically_significant_last_6_months = 0

        for client in clients:
            initial, latest = calculate_scores(client['user_id'])

            if initial is not None and latest is not None:
                if latest < initial:
                    improved += 1
                if is_clinically_significant(initial, latest):
                    clinically_significant += 1

                # 🔍 Check if the latest session is within the last 6 months
                user_sessions_ref = db.collection('user_data').document(client['user_id']).collection('sessions').stream()
                has_recent_responses = any(is_recent(session.to_dict().get('timestamp')) for session in user_sessions_ref)

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


from datetime import datetime, timedelta, timezone

@main_bp.route('/overall-data', methods=['GET'])
def overall_data():
    """
    Calculate overall metrics for all clients (active and archived) across all clinicians:
      - % of clients improved
      - % of clients clinically significantly improved
      - % of clients improved in the past 6 months
      - % of clients clinically significantly improved in the past 6 months
    Accessible only by admins.
    Uses batch read operations to speed up retrieval.
    """
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)
    
    if decoded_token.get('role') != "admin":
        return cors_enabled_response({'message': 'Unauthorized: Only admins can access overall data'}, 403)
    
    try:
        # Query active clients from 'users' collection.
        active_clients_stream = db.collection('users').where('role', '==', 'client').stream()
        active_clients = []
        for client in active_clients_stream:
            data = client.to_dict()
            data['user_id'] = client.id
            data['is_archived'] = False
            active_clients.append(data)
        
        # Query archived clients from 'archived_users' collection.
        archived_clients_stream = db.collection('archived_users').stream()
        archived_clients = []
        for client in archived_clients_stream:
            data = client.to_dict()
            data['user_id'] = client.id
            data['is_archived'] = True
            archived_clients.append(data)
        
        # Combine both lists.
        clients = active_clients + archived_clients
        total_clients = len(clients)
        
        if total_clients == 0:
            return cors_enabled_response({
                'total_clients': 0,
                'percent_improved': 0,
                'percent_clinically_significant': 0,
                'percent_improved_last_6_months': 0,
                'percent_clinically_significant_last_6_months': 0,
            }, 200)
        
        # Helper function: use batch reads to fetch sessions and, if needed, responses.
        def calculate_scores_for_client(user_id, is_archived):
            """
            Retrieve all sessions for a client from the appropriate collection using batch reads.
            Returns a tuple of:
              (initial_score, latest_score, latest_session_timestamp)
            If fewer than 2 sessions are found, returns (None, None, None).
            """
            try:
                collection = "user_data" if not is_archived else "archived_user_data"
                sessions_coll = db.collection(collection).document(user_id).collection("sessions")
                # List all session document references.
                session_doc_refs = list(sessions_coll.list_documents())
                if not session_doc_refs:
                    return None, None, None
                # Batch read all session documents.
                sessions = db.get_all(session_doc_refs)
                session_scores = []
                for session in sessions:
                    session_data = session.to_dict()
                    timestamp = session_data.get("timestamp")
                    # Try to use precomputed summary_responses first.
                    responses = session_data.get("summary_responses")
                    if responses:
                        try:
                            # Convert each response value to float.
                            values = [float(r.get('response_value', 0)) for r in responses]
                        except Exception as ex:
                            values = []
                    else:
                        # If summary_responses is not available, batch-read the responses subcollection.
                        responses_coll = sessions_coll.document(session.id).collection("responses")
                        response_refs = list(responses_coll.list_documents())
                        responses_docs = db.get_all(response_refs)
                        values = []
                        for resp in responses_docs:
                            r_data = resp.to_dict()
                            if 'response_value' in r_data:
                                try:
                                    values.append(float(r_data.get('response_value')))
                                except:
                                    continue
                    if values:
                        total_score = sum(values) - 10  # Adjust as per your scaling.
                        session_scores.append({"timestamp": timestamp, "score": total_score})
                session_scores.sort(key=lambda x: x["timestamp"])
                if len(session_scores) < 2:
                    return None, None, None
                return session_scores[0]["score"], session_scores[-1]["score"], session_scores[-1]["timestamp"]
            except Exception as e:
                print(f"Error fetching scores for {user_id}: {e}")
                return None, None, None

        def is_clinically_significant(initial, latest):
            """Determine if a client shows clinically significant improvement."""
            return initial is not None and initial > 18 and (initial - latest) >= 12

        def is_recent(timestamp):
            """Check if the timestamp is within the past 6 months."""
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

        percent_improved = (improved / total_clients) * 100 if total_clients > 0 else 0
        percent_clinically_significant = (clinically_significant / total_clients) * 100 if total_clients > 0 else 0
        percent_improved_last_6 = (improved_last_6 / total_clients) * 100 if total_clients > 0 else 0
        percent_clinically_significant_last_6 = (clinically_significant_last_6 / total_clients) * 100 if total_clients > 0 else 0

        return cors_enabled_response({
            'total_clients': total_clients,
            'percent_improved': percent_improved,
            'percent_clinically_significant': percent_clinically_significant,
            'percent_improved_last_6_months': percent_improved_last_6,
            'percent_clinically_significant_last_6_months': percent_clinically_significant_last_6
        }, 200)

    except Exception as e:
        print(f"Error calculating overall data: {e}")
        return cors_enabled_response({'message': 'Error calculating overall data', 'error': str(e)}, 500)


    
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
    target_user_id = data.get('user_id')  # Admin specifies which user to log out

    if not target_user_id:
        return cors_enabled_response({'message': 'User ID is required'}, 400)

    # Ensure only admins (or the user themself) can log out other users.
    if decoded_token.get('role') != "admin" and decoded_token.get('id') != target_user_id:
        return cors_enabled_response({'message': 'Unauthorized: Cannot log out other users'}, 403)

    # Remove all sessions from active users.
    sessions_ref = db.collection('users').document(target_user_id).collection('sessions')
    for session in sessions_ref.stream():
        session.reference.delete()

    # Remove all sessions from archived users (if any).
    archived_sessions_ref = db.collection('archived_users').document(target_user_id).collection('sessions')
    for session in archived_sessions_ref.stream():
        session.reference.delete()

    return cors_enabled_response({'message': 'Logged out from all devices'}, 200)


@main_bp.route('/archive-client/<user_id>', methods=['POST'])
def archive_client(user_id):
    """
    Archive a client by moving their data from active collections (users and user_data)
    to archived collections (archived_users and archived_user_data). Once moved, the original
    documents are deleted. This version uses Firestore batch writes to minimize network round-trips.
    Additionally, it forces a logout from all devices by deleting active sessions.
    """
    try:
        # Validate token and role.
        decoded_token, error_response, status_code = validate_token()
        if error_response:
            return error_response

        requestor_role = decoded_token.get('role')
        if requestor_role not in ['clinician', 'admin']:
            return cors_enabled_response(
                {'message': 'Unauthorized: Only clinicians and admins can archive clients.'},
                403
            )

        # Set up batching.
        BATCH_LIMIT = 500
        op_count = 0
        batch = db.batch()

        def commit_batch_if_needed():
            nonlocal op_count, batch
            if op_count >= BATCH_LIMIT:
                batch.commit()
                batch = db.batch()
                op_count = 0

        # --- Force Logout: Delete all sessions from active user's "sessions" subcollection ---
        sessions_to_delete = list(db.collection("users").document(user_id).collection("sessions").stream())
        print(f"Deleting {len(sessions_to_delete)} active sessions for user {user_id} to force logout.")
        for session in sessions_to_delete:
            batch.delete(session.reference)
            op_count += 1
            commit_batch_if_needed()

        # --- Step 1: Archive the client's basic info from "users" to "archived_users" ---
        client_ref = db.collection("users").document(user_id)
        client_snapshot = client_ref.get()
        if not client_snapshot.exists:
            return cors_enabled_response({'message': 'Client not found.'}, 404)
        client_data = client_snapshot.to_dict()
        archived_user_ref = db.collection("archived_users").document(user_id)
        batch.set(archived_user_ref, client_data)
        op_count += 1
        commit_batch_if_needed()
        batch.delete(client_ref)
        op_count += 1
        commit_batch_if_needed()
        print(f"Archived client basic info for user {user_id}.")

        # --- Step 2: Archive the client's data from "user_data" to "archived_user_data" ---
        user_data_ref = db.collection("user_data").document(user_id)
        archived_user_data_ref = db.collection("archived_user_data").document(user_id)
        batch.set(archived_user_data_ref, {"archived_at": firestore.SERVER_TIMESTAMP}, merge=True)
        op_count += 1
        commit_batch_if_needed()

        # Process the sessions subcollection.
        sessions = list(user_data_ref.collection("sessions").stream())
        print(f"Found {len(sessions)} sessions for user {user_id}.")
        for session in sessions:
            session_data = session.to_dict()
            session_id = session.id
            archived_session_ref = archived_user_data_ref.collection("sessions").document(session_id)
            batch.set(archived_session_ref, session_data)
            op_count += 1
            commit_batch_if_needed()

            # Process each response in the session's "responses" subcollection.
            responses = list(session.reference.collection("responses").stream())
            print(f"Session {session_id} has {len(responses)} responses.")
            for response in responses:
                response_data = response.to_dict()
                response_id = response.id
                batch.set(archived_session_ref.collection("responses").document(response_id), response_data)
                op_count += 1
                commit_batch_if_needed()
                batch.delete(response.reference)
                op_count += 1
                commit_batch_if_needed()
            # Delete the original session document.
            batch.delete(session.reference)
            op_count += 1
            commit_batch_if_needed()

        # Delete the top-level user_data document if it exists.
        if user_data_ref.get().exists:
            batch.delete(user_data_ref)
            op_count += 1
            commit_batch_if_needed()

        # Commit any remaining operations.
        if op_count > 0:
            batch.commit()

        return cors_enabled_response({'message': 'Client archived successfully.'}, 200)

    except Exception as e:
        print(f"Error archiving client {user_id}: {e}")
        return cors_enabled_response({'message': 'Error archiving client.', 'error': str(e)}, 500)



@main_bp.route('/unarchive-client/<user_id>', methods=['POST'])
def unarchive_client(user_id):
    """
    Unarchive a client by moving their data from archived collections (archived_users and archived_user_data)
    back to active collections (users and user_data). Once moved, the archived documents are deleted.
    This version uses Firestore batch writes to minimize network calls.
    """
    try:
        # Validate token and ensure only clinicians or admins can perform unarchiving.
        decoded_token, error_response, status_code = validate_token()
        if error_response:
            return error_response

        requestor_role = decoded_token.get('role')
        if requestor_role not in ['clinician', 'admin']:
            return cors_enabled_response(
                {'message': 'Unauthorized: Only clinicians and admins can unarchive clients.'},
                403
            )

        # Set up batching
        BATCH_LIMIT = 500
        op_count = 0
        batch = db.batch()

        def commit_batch_if_needed():
            nonlocal op_count, batch
            if op_count >= BATCH_LIMIT:
                batch.commit()
                batch = db.batch()
                op_count = 0

        # 1. Unarchive the client's basic info: Move from archived_users to users.
        archived_user_ref = db.collection("archived_users").document(user_id)
        archived_user_snapshot = archived_user_ref.get()
        if not archived_user_snapshot.exists:
            return cors_enabled_response({'message': 'Archived client not found.'}, 404)

        client_data = archived_user_snapshot.to_dict()
        active_user_ref = db.collection("users").document(user_id)
        batch.set(active_user_ref, client_data)
        op_count += 1
        commit_batch_if_needed()
        batch.delete(archived_user_ref)
        op_count += 1
        commit_batch_if_needed()
        print(f"Unarchived client basic info for user {user_id}.")

        # 2. Unarchive the client's data: Move from archived_user_data to user_data.
        archived_user_data_ref = db.collection("archived_user_data").document(user_id)
        archived_user_data_snapshot = archived_user_data_ref.get()
        active_user_data_ref = db.collection("user_data").document(user_id)
        
        if archived_user_data_snapshot.exists:
            user_data = archived_user_data_snapshot.to_dict()
            # Copy top-level fields from the archived document to the active document.
            batch.set(active_user_data_ref, user_data)
            op_count += 1
            commit_batch_if_needed()
            print(f"Copied top-level archived_user_data for user {user_id}.")

            # Process each session in the archived_user_data subcollection.
            sessions = list(archived_user_data_ref.collection("sessions").stream())
            print(f"Found {len(sessions)} sessions in archived data for user {user_id}.")
            for session in sessions:
                session_data = session.to_dict()
                session_id = session.id
                active_session_ref = active_user_data_ref.collection("sessions").document(session_id)
                batch.set(active_session_ref, session_data)
                op_count += 1
                commit_batch_if_needed()
                print(f"Unarchived session {session_id} for user {user_id}.")

                # Process the responses subcollection under each session.
                responses = list(session.reference.collection("responses").stream())
                print(f"Session {session_id} has {len(responses)} responses in archived data.")
                for response in responses:
                    response_data = response.to_dict()
                    response_id = response.id
                    batch.set(active_session_ref.collection("responses").document(response_id), response_data)
                    op_count += 1
                    commit_batch_if_needed()
                    batch.delete(response.reference)
                    op_count += 1
                    commit_batch_if_needed()
                # Delete the archived session document.
                batch.delete(session.reference)
                op_count += 1
                commit_batch_if_needed()

            # Delete the top-level archived_user_data document.
            batch.delete(archived_user_data_ref)
            op_count += 1
            commit_batch_if_needed()
            print(f"Deleted archived_user_data for user {user_id}.")
        else:
            print(f"No archived user_data found for user {user_id}.")

        if op_count > 0:
            batch.commit()

        return cors_enabled_response({'message': 'Client unarchived successfully.'}, 200)

    except Exception as e:
        print(f"Error unarchiving client {user_id}: {e}")
        return cors_enabled_response({'message': 'Error unarchiving client.', 'error': str(e)}, 500)

@main_bp.route('/admin-search-clients', methods=['GET'])
def admin_search_clients():
    """
    Admin route to fetch the list of clients assigned to a specific clinician,
    optionally filtered by a search query, improvement metrics, and time.
    
    Query parameters:
      - clinician_id (optional): The clinician whose clients are to be listed. 
          If omitted or blank, returns clients for all clinicians.
      - query (optional): Text string to search for in client first/last names.
      - metric (optional): 
            "total_clients" (default) - no filtering, return all clients,
            "improved" - only return clients where latest < initial,
            "clinically_significant" - only return clients meeting a clinical threshold.
      - time (optional): "all" (default) or "6months" to only include clients whose latest session is within the past 6 months.
    """
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)
    
    if decoded_token.get('role') != 'admin':
        return cors_enabled_response({'message': 'Unauthorized: Only admins can access this data'}, 403)
    
    # Get the filters from query parameters.
    clinician_id = request.args.get('clinician_id', "").strip()  # Optional: blank means all clinicians.
    query_text = request.args.get('query', '').strip().lower()   # New search query parameter.
    metric = request.args.get('metric', 'total_clients').strip().lower()
    time_filter = request.args.get('time', 'all').strip().lower()
    
    try:
        # --- Step 1: Fetch clients based on clinician filter ---
        active_clients = []
        archived_clients = []
        if clinician_id:
            active_clients_stream = db.collection('users').where('assigned_clinician_id', '==', clinician_id).stream()
            archived_clients_stream = db.collection('archived_users').where('assigned_clinician_id', '==', clinician_id).stream()
        else:
            # If clinician_id is blank, get all clients.
            active_clients_stream = db.collection('users').stream()
            archived_clients_stream = db.collection('archived_users').stream()
        
        for client in active_clients_stream:
            data = client.to_dict()
            data['user_id'] = client.id
            data['is_archived'] = False
            active_clients.append(data)
            
        for client in archived_clients_stream:
            data = client.to_dict()
            data['user_id'] = client.id
            data['is_archived'] = True
            archived_clients.append(data)
        
        # Combine both lists.
        clients = active_clients + archived_clients

        # --- Step 2: If a search query is provided, filter by client name ---
        if query_text:
            filtered_by_query = []
            for client in clients:
                first_name = client.get('first_name', '').lower()
                last_name = client.get('last_name', '').lower()
                if query_text in first_name or query_text in last_name:
                    filtered_by_query.append(client)
            clients = filtered_by_query

        # --- Step 3: Define helper functions to calculate client scores ---
        def calculate_scores_for_client(user_id, is_archived):
            """
            Fetch sessions for a client from the appropriate parent collection,
            calculate the score for the earliest and the latest session (using summary_responses).
            Returns a tuple: (initial_score, latest_score, latest_timestamp) or (None, None, None) if insufficient data.
            """
            collection = "user_data" if not is_archived else "archived_user_data"
            sessions_ref = db.collection(collection).document(user_id).collection("sessions")
            sessions = list(sessions_ref.order_by("timestamp", direction=firestore.Query.ASCENDING).stream())
            if len(sessions) < 2:
                return None, None, None
            session_scores = []
            for session in sessions:
                s_data = session.to_dict()
                timestamp = s_data.get("timestamp")
                responses = s_data.get("summary_responses", [])
                try:
                    values = [float(r.get("response_value", 0)) for r in responses]
                except Exception:
                    values = []
                if values:
                    total_score = sum(values) - 10  # Adjust as needed.
                    session_scores.append({"timestamp": timestamp, "score": total_score})
            session_scores.sort(key=lambda x: x["timestamp"])
            if len(session_scores) < 2:
                return None, None, None
            return session_scores[0]["score"], session_scores[-1]["score"], session_scores[-1]["timestamp"]
        
        def is_clinically_significant(initial, latest):
            # Example criteria: initial > 18 and difference >= 12.
            return initial is not None and initial > 18 and (initial - latest) >= 12
        
        def is_recent(timestamp):
            six_months_ago = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=182)
            return timestamp and timestamp >= six_months_ago
        
        # --- Step 4: Filter clients based on metric and time ---
        filtered_clients = []
        if metric == "total_clients":
            filtered_clients = clients
        else:
            for client in clients:
                initial, latest, last_ts = calculate_scores_for_client(client['user_id'], client['is_archived'])
                if initial is None or latest is None:
                    continue  # Skip clients with insufficient data.
                if time_filter == "6months" and not is_recent(last_ts):
                    continue
                if metric == "improved":
                    if latest < initial:
                        client['improvement'] = initial - latest
                        filtered_clients.append(client)
                elif metric == "clinically_significant":
                    if is_clinically_significant(initial, latest):
                        client['improvement'] = initial - latest
                        filtered_clients.append(client)
                else:
                    return cors_enabled_response({'message': 'Invalid metric parameter'}, 400)
        
        return cors_enabled_response({'clients': filtered_clients}, 200)
    
    except Exception as e:
        print(f"Error in /admin-search-clients: {e}")
        return cors_enabled_response({'message': 'Error retrieving clients', 'error': str(e)}, 500)


