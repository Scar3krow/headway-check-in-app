import os
import json
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from google.cloud import firestore
from google.oauth2 import service_account
from firebase_admin import credentials, initialize_app

bcrypt = Bcrypt()

# Get Firebase credentials from an environment variable
FIREBASE_CREDENTIALS_JSON = os.getenv("FIREBASE_CREDENTIALS")

if not FIREBASE_CREDENTIALS_JSON:
    raise RuntimeError("Missing FIREBASE_CREDENTIALS environment variable.")

# Convert the environment variable back into a dictionary
firebase_credentials = json.loads(FIREBASE_CREDENTIALS_JSON)

# Initialize Firestore and Firebase Admin SDK
credentials = service_account.Credentials.from_service_account_info(firebase_credentials)
db = firestore.Client(credentials=credentials)

def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['CORS_HEADERS'] = 'Content-Type'

    # Enable CORS
    CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
    bcrypt.init_app(app)

    # Register routes
    from .routes import main_bp
    app.register_blueprint(main_bp)

    return app

# Initialize the Flask app
app = create_app()
