from datetime import timedelta
from flask import Flask, flash, redirect, render_template, request, url_for, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import Mapped, mapped_column
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from os import getenv

load_dotenv()

app = Flask(__name__)
app.secret_key = getenv("SECRET_KEY")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///db.sqlite3"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.permanent_session_lifetime = timedelta(hours=1)

db = SQLAlchemy(app)


class Users(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False, unique=True)
    h_pwd = db.Column(db.String(200), nullable=False)

    def __init__(self, username, h_pwd) -> None:
        self.username = username
        self.h_pwd = h_pwd


with app.app_context():
    db.create_all()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form["username"]
        pwd = request.form["password"]

        h_pwd = generate_password_hash(password=pwd)
        
        new_user = Users(username=username, h_pwd=h_pwd)
        db.session.add(new_user)
        db.session.commit()
        
        flash(f"User {username} successfully registered")
        return redirect(url_for("login"))

    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        pwd = request.form["password"]
        
        user = Users.query.filter_by(username=username).first()
        if user is None:
            flash("Invalid credentials. Try again")
            return redirect(url_for("login"))   
        
        if check_password_hash(user.h_pwd, pwd):
            session['currentUser'] = user.id
            return redirect(url_for("index"))
        else:
            flash("Invalid credentials. Try again")
            return redirect(url_for("login"))
    
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("currentUser", None)
    flash("Logged out successfully!")
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=True)
