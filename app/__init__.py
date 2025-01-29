import os
import json
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from google.cloud import firestore
from google.oauth2 import service_account
import firebase_admin
from firebase_admin import credentials

bcrypt = Bcrypt()

# ✅ Detect if running in Render or Locally
if os.getenv("RENDER"):
    # Running on Render → Use secret file in /etc/secrets/
    CREDENTIALS_PATH = "/etc/secrets/secret_key.json"
else:
    # Running Locally → Look for secret_key.json in the `app` folder
    CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), "app", "secret_key.json")

# ✅ Ensure the credentials file exists
if not os.path.exists(CREDENTIALS_PATH):
    raise RuntimeError(f"Missing Firebase credentials file at {CREDENTIALS_PATH}")

# ✅ Load Google Service Account Credentials
cred = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)

# ✅ Initialize Firebase Admin SDK (only if not already initialized)
if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS_PATH))

# ✅ Firestore Initialization
db = firestore.Client(credentials=cred)

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
