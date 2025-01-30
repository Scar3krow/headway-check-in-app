import os
import jwt
import uuid
from flask import Blueprint, request, jsonify, send_from_directory
from flask_bcrypt import Bcrypt
from google.cloud import firestore
from datetime import datetime, timedelta, timezone
from firebase_admin import firestore

bcrypt = Bcrypt()
main_bp = Blueprint('main', __name__)
db = firestore.Client()

# 🔥 Path to React's build folder
FRONTEND_BUILD_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "build"))

# ✅ Ensure API calls are handled properly
API_PREFIXES = ("/api/", "/register", "/login", "/questions", "/submit-responses", "/past-responses")

SECRET_KEY = "Headway50!"  # Replace with a strong, unique key

# ✅ Token Validation Function
def validate_token():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, {"message": "Missing or invalid token"}, 401

    token = auth_header.split(" ")[1]
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return decoded_token, None, None
    except jwt.ExpiredSignatureError:
        return None, {"message": "Token expired"}, 401
    except jwt.InvalidTokenError:
        return None, {"message": "Invalid token"}, 401


# ✅ FIX: Only serve React frontend if the request is NOT for an API route
@main_bp.route("/", defaults={"path": ""})
@main_bp.route("/<path:path>")
def serve_react_frontend(path):
    """Serve React frontend, except for API routes."""
    if any(path.startswith(prefix.lstrip("/")) for prefix in API_PREFIXES):
        return jsonify({"error": "Invalid API call, check your frontend API URL"}), 404
    
    return send_from_directory(FRONTEND_BUILD_PATH, "index.html")

# ✅ FIX: Ensure static files (JS, CSS) load correctly
@main_bp.route("/static/<path:filename>")
def serve_static_files(filename):
    """Serve static files like JS, CSS, images."""
    return send_from_directory(os.path.join(FRONTEND_BUILD_PATH, "static"), filename)

@main_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    first_name = data.get('first_name', '').strip().capitalize()
    last_name = data.get('last_name', '').strip().capitalize()
    email = data.get('email', '').strip().lower()
    password = data.get('password')
    role = data.get('role', 'client')  # Default role is 'client'
    invite_code = data.get('invite_code', '').strip()  # For clinicians/admins
    assigned_clinician_id = data.get('assigned_clinician_id')  # For clients

    # Validate required fields
    if not first_name or not last_name or not password or not email:
        return jsonify({'message': 'All fields are required.'}), 400

    # Validate role
    if role not in ['client', 'clinician', 'admin']:
        return jsonify({'message': 'Invalid role specified.'}), 400

    # Password validation
    errors = []
    if len(password) < 6:
        errors.append("Password must be at least 6 characters long.")
    if not any(char.isdigit() or char in "@$!%*?&" for char in password):
        errors.append("Password must contain at least one digit or special character.")

    if errors:
        return jsonify({'message': " ".join(errors)}), 400

    # Check if email is already registered
    users_ref = db.collection('users')
    if users_ref.where('email', '==', email).get():
        return jsonify({'message': 'Email already registered'}), 400

    # Validate invite code for clinicians/admins
    if role in ['clinician', 'admin']:
        if not invite_code:
            return jsonify({'message': 'Invite code is required for this role.'}), 400

        # Verify invite code in Firestore
        try:
            invites_ref = db.collection('invites').where('invite_code', '==', invite_code).where('role', '==', role).stream()
            invite = next(invites_ref)  # Get the first matching invite
            invite_data = invite.to_dict()

            # Check if invite is already used
            if invite_data.get('used', False):
                return jsonify({'message': 'This invite code has already been used.'}), 400

            # Mark invite code as used
            db.collection('invites').document(invite.id).update({'used': True})
        except StopIteration:
            return jsonify({'message': 'Invalid or expired invite code.'}), 400

    # Ensure clients have an assigned clinician
    if role == 'client' and not assigned_clinician_id:
        return jsonify({'message': 'Assigned clinician ID is required for clients.'}), 400

    # Hash the password and save the user
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_ref = users_ref.add({
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'password': hashed_password,
        'role': role,
        'assigned_clinician_id': assigned_clinician_id if role == 'client' else None,
    })

    user_id = user_ref[1].id  # Firestore's auto-generated document ID

    # Add the user to the corresponding collection
    if role == 'clinician':
        db.collection('clinicians').document(user_id).set({
            'id': user_id,
            'name': f"{first_name} {last_name}"
        })
    elif role == 'admin':
        db.collection('admins').document(user_id).set({
            'id': user_id,
            'name': f"{first_name} {last_name}"
        })

    return jsonify({'message': 'User registered successfully', 'role': role}), 201


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
                'id': user_doc.id,  # Include user ID in token payload
                'role': user_data['role'],
                'exp': datetime.utcnow() + timedelta(hours=48)  # Token expires in 48 hours
            }
            access_token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")
            return jsonify({
                'access_token': access_token,
                'role': user_data['role'],
                'user_id': user_doc.id  # Include user_id in response
            }), 200

    return jsonify({'message': 'Invalid credentials'}), 401


@main_bp.route('/questions', methods=['GET'])
def get_questions():
    """Fetch all questions."""
    try:
        questions_ref = db.collection('questions').stream()
        questions = [{'id': q.id, 'text': q.to_dict().get('text')} for q in questions_ref]
        return jsonify(questions), 200
    except Exception as e:
        return jsonify({'message': 'Failed to fetch questions', 'error': str(e)}), 500


@main_bp.route('/submit-responses', methods=['POST'])
def submit_responses():
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return jsonify(error_response), status_code

    data = request.get_json()

    # Validate payload
    if not data or 'responses' not in data or not isinstance(data['responses'], list):
        return jsonify({'message': '"responses" must be a list.'}), 400

    # Generate a unique session ID for this submission
    session_id = str(uuid.uuid4())
    user_id = decoded_token['id']
    timestamp = firestore.SERVER_TIMESTAMP

    for response in data['responses']:
        if 'question_id' not in response or 'response_value' not in response:
            return jsonify({'message': 'Each response must have "question_id" and "response_value".'}), 400

        # Add the response to Firestore
        db.collection('responses').add({
            'user_id': user_id,
            'session_id': session_id,
            'question_id': response['question_id'],
            'response_value': response['response_value'],
            'timestamp': timestamp
        })

    return jsonify({'message': 'Responses submitted successfully', 'session_id': session_id}), 201

@main_bp.route('/past-responses', methods=['GET'])
def past_responses():
    # Validate the token and decode it
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return jsonify(error_response), status_code

    user_role = decoded_token.get('role')
    user_id = decoded_token.get('id')

    # Get the user_id from query params (for clinician access) or use the token's user_id
    query_user_id = request.args.get('user_id') if user_role == 'clinician' else user_id

    # Fetch responses for the given user_id
    responses_ref = db.collection('responses').where('user_id', '==', query_user_id).stream()
    responses = []
    for r in responses_ref:
        response_data = r.to_dict()
        responses.append({
            'question_id': response_data.get('question_id'),
            'response_value': response_data.get('response_value'),
            'session_id': response_data.get('session_id'),
            'timestamp': response_data.get('timestamp').isoformat() if response_data.get('timestamp') else None,
        })

    if not responses:
        print(f"No responses found for user: {query_user_id}")
        return jsonify({'message': 'No responses available for this user'}), 404

    print(f"User ID: {query_user_id}, Responses: {responses}")
    return jsonify(responses), 200

@main_bp.route('/submit-answer', methods=['POST'])
def submit_answer():
    """Submit an answer to Firestore."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return jsonify(error_response), status_code

    data = request.get_json()
    if not data or 'answer' not in data:
        return jsonify({'message': 'Invalid payload. "answer" is required.'}), 400

    db.collection('answers').add({
        'answer': data['answer'],
        'submitted_by': decoded_token['id'],
        'submitted_at': firestore.SERVER_TIMESTAMP
    })

    return jsonify({'message': 'Answer submitted successfully'}), 201

@main_bp.route('/search-users', methods=['GET'])
def search_users():
    """Search users by first name or last name."""
    query = request.args.get('query', '').lower()
    if not query:
        return jsonify({'message': 'Query parameter is required'}), 400

    # Search users by first_name or last_name
    users_ref = db.collection('users').stream()
    matching_users = [
        {
            'id': user.id,
            'first_name': user.to_dict().get('first_name', ''),
            'last_name': user.to_dict().get('last_name', ''),
        }
        for user in users_ref
        if query in user.to_dict().get('first_name', '').lower() or
           query in user.to_dict().get('last_name', '').lower()
    ]

    return jsonify(matching_users), 200

@main_bp.route('/search-clients', methods=['GET'])
def search_clients():
    """Allow clinicians to search for their own clients."""
    query = request.args.get('query', '').lower()
    token = request.headers.get('Authorization', '').split('Bearer ')[-1]

    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        clinician_id = decoded_token.get('id')

        if not clinician_id:
            return jsonify({'message': 'Unauthorized.'}), 403

        # Fetch clients assigned to the clinician
        clients_ref = db.collection('users') \
            .where('assigned_clinician_id', '==', clinician_id) \
            .where('role', '==', 'client') \
            .stream()

        matching_clients = []
        for client in clients_ref:
            client_data = client.to_dict()
            if query in client_data.get('first_name', '').lower() or query in client_data.get('last_name', '').lower():
                matching_clients.append({
                    'id': client.id,
                    'first_name': client_data.get('first_name', ''),
                    'last_name': client_data.get('last_name', ''),
                })

        return jsonify({'clients': matching_clients}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'message': 'Token expired.'}), 401
    except Exception as e:
        print(f"Error in /search-clients: {e}")
        return jsonify({'message': 'Failed to fetch clients.'}), 500


@main_bp.route('/user-info', methods=['GET'])
def get_user_info():
    """Fetch user information by user_id."""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'message': 'User ID is required'}), 400

    user_doc = db.collection('users').document(user_id).get()

    if not user_doc.exists:
        return jsonify({'message': 'User not found'}), 404

    user_data = user_doc.to_dict()
    return jsonify({
        'first_name': user_data.get('first_name', ''),
        'last_name': user_data.get('last_name', ''),
        'email': user_data.get('email', '')
    }), 200

@main_bp.route('/session-responses', methods=['GET'])
def session_responses():
    """Fetch responses for a specific session."""
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        return jsonify(error_response), status_code

    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({'message': 'Session ID is required'}), 400

    responses_ref = db.collection('responses').where('session_id', '==', session_id).stream()
    responses = []
    for r in responses_ref:
        response_data = r.to_dict()
        responses.append({
            'question_text': response_data.get('question_id'),  # Replace with actual question text if available
            'response_value': response_data.get('response_value'),
        })

    if not responses:
        return jsonify({'message': 'No responses available for this session'}), 404

    return jsonify(responses), 200

@main_bp.route('/session-details', methods=['GET'])
def session_details():
    """Fetch session details by session_id."""
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({'message': 'Session ID is required'}), 400

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
        return jsonify({'message': 'No responses found for this session'}), 404

    return jsonify(responses), 200

@main_bp.route('/validate-invite', methods=['POST'])
def validate_invite():
    data = request.get_json()
    invite_code = data.get('invite_code', '').strip()  # Ensure no spaces

    if not invite_code:
        return jsonify({'message': 'Invite code is required'}), 400

    # Search for the specific invite code
    print(f"Searching for invite code: {invite_code}")
    invites_ref = db.collection('invites').where('invite_code', '==', invite_code).stream()

    # Collect matching invites
    matching_invites = [doc.to_dict() for doc in invites_ref]
    print(f"Matching invites: {matching_invites}")

    if not matching_invites:
        return jsonify({'message': 'Invalid invite code'}), 400

    # Grab the first match (there should only be one)
    invite_data = matching_invites[0]
    print(f"Matched invite data: {invite_data}")

    # Check if the invite code has already been used
    if invite_data.get('used', False):
        return jsonify({'message': 'Invite code has already been used'}), 400

    return jsonify({'message': 'Invite code valid', 'role': invite_data.get("role", "unknown")}), 200

@main_bp.route('/mark-invite-used', methods=['POST'])
def mark_invite_used():
    """Mark an invite code as used."""
    data = request.get_json()
    invite_code = data.get('invite_code')

    if not invite_code:
        return jsonify({'message': 'Invite code is required'}), 400

    invite_ref = db.collection('invite_codes').where('code', '==', invite_code).stream()
    invite_doc = next(invite_ref, None)  # Fetch the first matching document

    if not invite_doc:
        return jsonify({'message': 'Invalid invite code.'}), 400

    invite_data = invite_doc.to_dict()

    if invite_data.get('used', False):
        return jsonify({'message': 'Invite code has already been used.'}), 400

    # Mark invite code as used
    db.collection('invite_codes').document(invite_doc.id).update({'used': True})
    return jsonify({'message': 'Invite code marked as used.'}), 200

@main_bp.route('/generate-invite', methods=['POST'])
def generate_invite():
    """Generate an invite code for a specific role."""
    data = request.json
    role = data.get('role')

    # Log the role being requested
    print(f"Generating invite code for role: {role}")

    if role not in ['clinician', 'admin']:
        return jsonify({'message': 'Invalid role provided.'}), 400

    # Authorization check
    decoded_token, error_response, status_code = validate_token()
    if error_response:
        print("Authorization failed:", error_response)  # Debug log
        return jsonify(error_response), status_code
    if decoded_token.get('role') != 'admin':
        print("User is not an admin.")  # Debug log
        return jsonify({'message': 'Unauthorized.'}), 403

    # Generate invite code
    try:
        invite_code = str(uuid.uuid4())
        db.collection('invites').document(invite_code).set({
            'invite_code': invite_code,
            'role': role,
            'used': False,
            'created_at': datetime.utcnow()
        })
        print(f"Invite code generated successfully: {invite_code}")  # Debug log
        return jsonify({'code': invite_code}), 200
    except Exception as e:
        print(f"Error generating invite code: {e}")  # Debug log
        return jsonify({'message': 'Failed to generate invite code.'}), 500

@main_bp.route('/remove-clinician', methods=['POST'])
def remove_clinician():
    """Remove a clinician by their ID."""
    data = request.get_json()
    clinician_id = data.get('clinician_id')

    if not clinician_id:
        return jsonify({'message': 'Clinician ID is required'}), 400

    try:
        # Remove from 'users' collection
        users_ref = db.collection('users').document(clinician_id)
        if not users_ref.get().exists:
            return jsonify({'message': 'Clinician not found in users collection'}), 404
        users_ref.delete()

        # Remove from 'clinicians' collection
        clinicians_ref = db.collection('clinicians').document(clinician_id)
        if not clinicians_ref.get().exists:
            return jsonify({'message': 'Clinician not found in clinicians collection'}), 404
        clinicians_ref.delete()

        return jsonify({'message': 'Clinician removed successfully'}), 200
    except Exception as e:
        print(f"Error removing clinician: {e}")
        return jsonify({'message': 'An error occurred while removing the clinician'}), 500

@main_bp.route('/remove-admin', methods=['POST'])
def remove_admin():
    """Remove an admin by their ID."""
    data = request.get_json()
    admin_id = data.get('admin_id')

    if not admin_id:
        return jsonify({'message': 'Admin ID is required'}), 400

    try:
        # Remove from 'users' collection
        users_ref = db.collection('users').document(admin_id)
        if not users_ref.get().exists:
            return jsonify({'message': 'Admin not found in users collection'}), 404
        users_ref.delete()

        # Remove from 'admins' collection
        admins_ref = db.collection('admins').document(admin_id)
        if not admins_ref.get().exists:
            return jsonify({'message': 'Admin not found in admins collection'}), 404
        admins_ref.delete()

        return jsonify({'message': 'Admin removed successfully'}), 200
    except Exception as e:
        print(f"Error removing admin: {e}")
        return jsonify({'message': 'An error occurred while removing the admin'}), 500


@main_bp.route('/get-clinicians', methods=['GET'])
def get_clinicians():
    """Fetch all clinicians."""
    try:
        clinicians_ref = db.collection('clinicians').stream()
        # Extract `id` and `name` fields from each document
        clinicians = [{"id": c.id, "name": c.to_dict().get("name", "")} for c in clinicians_ref]

        if not clinicians:  # Handle case where no clinicians exist
            return jsonify({"message": "No clinicians found", "clinicians": []}), 200

        return jsonify({"clinicians": clinicians}), 200

    except Exception as e:
        print("Error fetching clinicians:", str(e))
        return jsonify({"message": "Failed to fetch clinicians"}), 500
    
@main_bp.route('/get-admins', methods=['GET'])
def get_admins():
    """Fetch all admins."""
    try:
        # Fetch documents from the 'admins' collection
        admins_ref = db.collection('admins').stream()

        # Extract `id` and `name` fields from each document
        admins = [{"id": a.id, "name": a.to_dict().get("name", "")} for a in admins_ref]

        if not admins:  # Handle case where no admins exist
            return jsonify({"message": "No admins found", "admins": []}), 200

        return jsonify({"admins": admins}), 200

    except Exception as e:
        print("Error fetching admins:", str(e))
        return jsonify({"message": "Failed to fetch admins"}), 500


@main_bp.route('/clinician-data', methods=['GET'])
def get_clinician_data():
    """Fetch clinician data for analysis."""
    clinician_id = request.args.get('clinician_id')

    if not clinician_id:
        return jsonify({'message': 'Clinician ID is required'}), 400

    try:
        # Get clients assigned to the clinician, excluding the clinician themselves
        clients_ref = db.collection('users').where('assigned_clinician_id', '==', clinician_id).stream()
        clients = [
            {**client.to_dict(), 'user_id': client.id} 
            for client in clients_ref 
            if client.to_dict().get('role') != 'clinician'  # Exclude the clinician themselves
        ]
        total_clients = len(clients)

        print(f"Total clients for clinician {clinician_id}: {total_clients}")

        if total_clients == 0:
            return jsonify({
                'total_clients': 0,
                'percent_improved': 0,
                'percent_clinically_significant': 0,
                'percent_improved_last_6_months': 0,
                'percent_clinically_significant_last_6_months': 0,
            }), 200

        # Helper functions
        def calculate_overall_scores(client):
            """Calculate overall scores for the first and latest sessions for a client."""
            try:
                # Fetch all responses for the client
                responses = db.collection('responses').where('user_id', '==', client['user_id']).stream()

                # Group responses by session_id
                sessions = {}
                for resp in responses:
                    data = resp.to_dict()
                    session_id = data.get('session_id')
                    response_value = data.get('response_value')
                    timestamp = data.get('timestamp')

                    # Ensure all timestamps are UTC-aware
                    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)

                    if session_id and response_value is not None and timestamp:
                        if session_id not in sessions:
                            sessions[session_id] = {'responses': [], 'timestamp': timestamp}
                        sessions[session_id]['responses'].append(response_value)
                    else:
                        print(f"Skipping invalid response data: {data}")  # Debug for invalid/missing fields

                # Sort sessions by timestamp
                sorted_sessions = sorted(
                    sessions.values(),
                    key=lambda x: x['timestamp']
                )

                # Debug: Check sorted sessions
                print(f"Sorted Sessions for {client['user_id']}: {sorted_sessions}")

                if len(sorted_sessions) < 2:
                    return None, None  # Not enough data to calculate improvement

                # Calculate scores for the first and latest sessions
                first_session_score = sum(sorted_sessions[0]['responses']) - 10
                latest_session_score = sum(sorted_sessions[-1]['responses']) - 10

                # Debug: Check scores
                print(f"First session score: {first_session_score}, Latest session score: {latest_session_score}")

                return first_session_score, latest_session_score

            except Exception as e:
                print(f"Error in calculate_overall_scores for {client['user_id']}: {e}")
                return None, None

        def is_clinically_significant(initial, latest):
            return initial > 18 and (initial - latest) >= 12

        def is_within_last_6_months(timestamp):
            six_months_ago = datetime.utcnow().replace(tzinfo=timezone.utc) - timedelta(days=182)
            return timestamp >= six_months_ago

        # Compute statistics
        improved = 0
        clinically_significant = 0
        improved_last_6_months = 0
        clinically_significant_last_6_months = 0

        for client in clients:
            initial, latest = calculate_overall_scores(client)
            print(f"Client {client['user_id']} - Initial: {initial}, Latest: {latest}")

            if initial is not None and latest is not None:
                # Check overall improvement
                if latest < initial:
                    improved += 1

                if is_clinically_significant(initial, latest):
                    clinically_significant += 1

                # Check for responses in the last 6 months
                responses_in_last_6_months = db.collection('responses') \
                    .where('user_id', '==', client['user_id']).stream()
                has_recent_responses = any(
                    is_within_last_6_months(resp.to_dict()['timestamp']) for resp in responses_in_last_6_months
                )
                if has_recent_responses:
                    if latest < initial:
                        improved_last_6_months += 1
                    if is_clinically_significant(initial, latest):
                        clinically_significant_last_6_months += 1

        return jsonify({
            'total_clients': total_clients,
            'percent_improved': (improved / total_clients) * 100,
            'percent_clinically_significant': (clinically_significant / total_clients) * 100,
            'percent_improved_last_6_months': (improved_last_6_months / total_clients) * 100,
            'percent_clinically_significant_last_6_months': (clinically_significant_last_6_months / total_clients) * 100,
        }), 200
    except Exception as e:
        print(f"Error in /clinician-data: {e}")
        return jsonify({'message': 'Failed to fetch clinician data.'}), 500

"""@main_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')

    user_ref = db.collection('users').where('email', '==', email).get()
    if not user_ref:
        return jsonify({'message': 'If this email exists, a reset link will be sent.'}), 200

    user = user_ref[0]
    reset_token = str(uuid.uuid4())
    db.collection('password_resets').add({
        'email': email,
        'token': reset_token,
        'expires_at': datetime.utcnow() + timedelta(minutes=30)
    })

    # Send reset email (implement email sending logic here)
    send_reset_email(email, reset_token)

    return jsonify({'message': 'If this email exists, a reset link will be sent.'}), 200

@main_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    token = data.get('token')
    new_password = data.get('password')

    # Validate token
    reset_ref = db.collection('password_resets').where('token', '==', token).get()
    if not reset_ref or reset_ref[0].to_dict()['expires_at'] < datetime.utcnow():
        return jsonify({'message': 'Invalid or expired token.'}), 400

    reset_data = reset_ref[0].to_dict()
    email = reset_data['email']

    # Update password
    user_ref = db.collection('users').where('email', '==', email).get()
    if not user_ref:
        return jsonify({'message': 'User not found.'}), 404

    hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.collection('users').document(user_ref[0].id).update({'password': hashed_password})

    return jsonify({'message': 'Password updated successfully.'}), 200 """

