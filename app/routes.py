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

FRONTEND_URL = "https://headway-check-in-app-1.onrender.com"

# ✅ Ensure API calls are handled properly
API_PREFIXES = ("/api/", "/register", "/login", "/questions", "/submit-responses", "/past-responses")

SECRET_KEY = "Headway50!"  # Replace with a strong, unique key

def cors_enabled_response(data, status=200):
    """Wraps responses with proper CORS headers"""
    response = make_response(jsonify(data), status)
    response.headers["Access-Control-Allow-Origin"] = FRONTEND_URL
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

# ✅ Token Validation Function
def validate_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, cors_enabled_response({'message': 'Missing or invalid token'}, 401)

    token = auth_header.split(' ')[1]
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        
        decoded_token['role'] = decoded_token.get('role')
        
        return decoded_token, None, None
    except jwt.ExpiredSignatureError:
        return None, cors_enabled_response({'message': 'Token expired'}, 401)
    except jwt.InvalidTokenError:
        return None, cors_enabled_response({'message': 'Invalid token'}, 401)


@main_bp.route("/", defaults={"path": ""})
@main_bp.route("/<path:path>")
def redirect_to_frontend(path):
    """Redirects all frontend requests to the React app hosted separately."""
    return redirect(f"{FRONTEND_URL}/{path}")


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
    })

    user_id = user_ref[1].id

    # ✅ Ensure clinicians & admins are added to the clinicians collection
    if role in ['clinician', 'admin']:
        db.collection('clinicians').document(user_id).set({
            'id': user_id,
            'name': f"{first_name} {last_name}",
            'is_admin': True if role == 'admin' else False,  # Admins now have clinician access
            'assigned_clinician_id': assigned_clinician_id if role == 'admin' else None,
        })

    # ✅ Ensure admins are also in the admins collection
    if role == 'admin':
        db.collection('admins').document(user_id).set({
            'id': user_id,
            'name': f"{first_name} {last_name}"
        })

    return cors_enabled_response({'message': 'User registered successfully', 'role': role}, 201)


@main_bp.route('/login', methods=['POST'])
def login():
    """Login and issue a JWT."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password')

    users_ref = db.collection('users')
    user_doc = next(iter(users_ref.where('email', '==', email).stream()), None)

    if user_doc:
        user_data = user_doc.to_dict()
        if bcrypt.check_password_hash(user_data['password'], password):

            token_payload = {
                'id': user_doc.id,
                'role': user_data['role'],
                'exp': datetime.utcnow() + timedelta(hours=48),
            }
            access_token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")

            return cors_enabled_response({
                'access_token': access_token,
                'role': user_data['role'],
                'user_id': user_doc.id,
            }, 200)

    return cors_enabled_response({'message': 'Invalid credentials'}, 401)


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


@main_bp.route('/past-responses', methods=['GET'])
def past_responses():
    """Fetch past responses for a user."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    user_role = decoded_token.get('role')  
    user_id = decoded_token.get('id')

    # ✅ Admins can query any user
    if user_role == 'admin':
        query_user_id = request.args.get('user_id')  # Admin must provide user_id
        if not query_user_id:
            return cors_enabled_response({'message': 'Admin must specify a user_id'}, 400)

    # ✅ Clinicians can only query their assigned clients
    elif user_role == 'clinician':
        query_user_id = request.args.get('user_id')
        if not query_user_id:
            return cors_enabled_response({'message': 'Clinician must specify a user_id'}, 400)

        assigned_clients = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()
        assigned_client_ids = {client.id for client in assigned_clients}

        if query_user_id not in assigned_client_ids:
            return cors_enabled_response({'message': 'Unauthorized: Clinician can only view assigned clients'}, 403)

    # ✅ Clients can only access their own data
    else:
        query_user_id = user_id

    # Fetch responses for the given user_id
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
    """Fetch session details by session_id."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return cors_enabled_response(error_response, status_code)

    session_id = request.args.get('session_id')
    if not session_id:
        return cors_enabled_response({'message': 'Session ID is required'}, 400)

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
    query = request.args.get('query', '').lower()

    if not query:
        return cors_enabled_response({'message': 'Query parameter is required'}, 400)

    # ✅ Admins can search all clients
    if user_role == 'admin':
        clients_ref = db.collection('users').where('role', '==', 'client').stream()

    # ✅ Clinicians can only search their assigned clients
    elif user_role == 'clinician':
        clients_ref = db.collection('users').where('assigned_clinician_id', '==', user_id).stream()

    # ❌ Clients cannot search at all
    else:
        return cors_enabled_response({'message': 'Unauthorized: Clients cannot search for other users'}, 403)

    matching_clients = [
        {
            'id': client.id,
            'first_name': client.to_dict().get('first_name', ''),
            'last_name': client.to_dict().get('last_name', ''),
        }
        for client in clients_ref
        if query in client.to_dict().get('first_name', '').lower() or query in client.to_dict().get('last_name', '').lower()
    ]

    return cors_enabled_response({'clients': matching_clients}, 200)


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


@main_bp.route('/remove-clinician', methods=['POST'])
def remove_clinician():
    """Remove a clinician by their ID."""
    data = request.get_json()
    clinician_id = data.get('clinician_id')

    if not clinician_id:
        return cors_enabled_response({'message': 'Clinician ID is required'}, 400)

    try:
        users_ref = db.collection('users').document(clinician_id)
        if not users_ref.get().exists:
            return cors_enabled_response({'message': 'Clinician not found in users collection'}, 404)
        users_ref.delete()

        clinicians_ref = db.collection('clinicians').document(clinician_id)
        if not clinicians_ref.get().exists:
            return cors_enabled_response({'message': 'Clinician not found in clinicians collection'}, 404)
        clinicians_ref.delete()

        return cors_enabled_response({'message': 'Clinician removed successfully'}, 200)
    except Exception as e:
        return cors_enabled_response({'message': 'An error occurred while removing the clinician', 'error': str(e)}, 500)


@main_bp.route('/remove-admin', methods=['POST'])
def remove_admin():
    """Remove an admin by their ID."""
    data = request.get_json()
    admin_id = data.get('admin_id')

    if not admin_id:
        return cors_enabled_response({'message': 'Admin ID is required'}, 400)

    try:
        # ✅ Remove from 'users' collection
        users_ref = db.collection('users').document(admin_id)
        if not users_ref.get().exists:
            return cors_enabled_response({'message': 'Admin not found in users collection'}, 404)
        users_ref.delete()

        # ✅ Remove from 'admins' collection
        admins_ref = db.collection('admins').document(admin_id)
        if not admins_ref.get().exists:
            return cors_enabled_response({'message': 'Admin not found in admins collection'}, 404)
        admins_ref.delete()

        # ✅ If admin was also a clinician, remove from 'clinicians'
        clinicians_ref = db.collection('clinicians').document(admin_id)
        if clinicians_ref.get().exists:
            clinicians_ref.delete()

        return cors_enabled_response({'message': 'Admin removed successfully'}, 200)
    except Exception as e:
        return cors_enabled_response({'message': 'An error occurred while removing the admin', 'error': str(e)}, 500)


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
    clinician_id = request.args.get('clinician_id')

    if not clinician_id:
        return cors_enabled_response({'message': 'Clinician ID is required'}, 400)

    try:
        clients_ref = db.collection('users').where('assigned_clinician_id', '==', clinician_id).stream()
        clients = [
            {**client.to_dict(), 'user_id': client.id}
            for client in clients_ref if client.to_dict().get('role') != 'clinician'
        ]

        total_clients = len(clients)
        if total_clients == 0:
            return cors_enabled_response({
                'total_clients': 0,
                'percent_improved': 0,
                'percent_clinically_significant': 0,
                'percent_improved_last_6_months': 0,
                'percent_clinically_significant_last_6_months': 0,
            }, 200)

        return cors_enabled_response({
            'total_clients': total_clients,
        }, 200)

    except Exception as e:
        return cors_enabled_response({'message': 'Failed to fetch clinician data.', 'error': str(e)}, 500)

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
        'expires_at': datetime.utcnow() + timedelta(minutes=30)
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
