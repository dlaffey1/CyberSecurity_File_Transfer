from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///server.db"
db = SQLAlchemy(app)

if __name__ == '__main__':
    from routes import send_file, get_file
    app.run(debug=True)
