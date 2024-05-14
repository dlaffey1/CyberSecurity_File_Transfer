from flask import Flask
from models import db
from routes import send_file, get_file

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///server.db"
db.init_app(app)

if __name__ == '__main__':
    app.run(debug=True)
