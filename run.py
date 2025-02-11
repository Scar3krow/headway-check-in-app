import os
from app import create_app

# Set the default environment to "development" if not already set
os.environ.setdefault("ENVIRONMENT", "development")

# Create the Flask app
app = create_app()

if __name__ == "__main__":
    # Get the environment variable
    environment = os.getenv("ENVIRONMENT", "development")

    # Set the appropriate port (default 5000) & enable debug mode for development
    port = int(os.getenv("PORT", 5000))
    debug = environment == "development"  # Enable debug mode only in development

    print(f"🔧 Running Flask in {environment} mode on port {port}...")

    app.run(host="0.0.0.0", port=port, debug=debug)
