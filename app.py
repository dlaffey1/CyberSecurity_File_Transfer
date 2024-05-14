from flask import Flask
from models import db

# Initialize the Flask app
app = Flask(__name__)

# Configure the database URI
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///server.db"

# Initialize the database
db.init_app(app)

if __name__ == '__main__':
    # Run the app
    app.run(debug=True)
