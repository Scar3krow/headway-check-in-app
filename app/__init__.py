import os
import json
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from google.cloud import firestore
from google.oauth2 import service_account
from firebase_admin import credentials, initialize_app

bcrypt = Bcrypt()

# ✅ Use the Render Secret File Path
CREDENTIALS_PATH = "/etc/secrets/secret_key.json"

# ✅ Ensure the file exists before proceeding
if not os.path.exists(CREDENTIALS_PATH):
    raise RuntimeError(f"Missing Firebase credentials file at {CREDENTIALS_PATH}")

# ✅ Load Firebase Credentials Correctly
credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
db = firestore.Client(credentials=credentials)

# ✅ Initialize Firebase Admin SDK
cred = credentials.Certificate(CREDENTIALS_PATH)
initialize_app(cred)

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
