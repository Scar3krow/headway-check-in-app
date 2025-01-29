from app import create_app
from app.initialize_firestore import initialize_firestore  # Reference the remaining script


app = create_app()

if __name__ == "__main__":
    # Initialize Firestore if needed
    initialize_firestore()
    app.run(debug=True)