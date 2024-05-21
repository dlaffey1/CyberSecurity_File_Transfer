import base64
from datetime import datetime, timedelta, timezone
import math
from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
    session,
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os

load_dotenv()


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///db.sqlite3"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.permanent_session_lifetime = timedelta(hours=1)

db = SQLAlchemy(app)

UPLOAD_FOLDER = "uploaded_files"
MAX_FILE_SIZE_IN_GB = 10

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


class Users(db.Model):
    user_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False, unique=True)
    h_pwd = db.Column(db.String(162), nullable=False)
    pub_sig_key = db.Column(db.String(736), nullable=False)
    pub_encrypt_key = db.Column(db.String(736), nullable=False)

    def __init__(self, username, h_pwd, pub_sig_key, pub_encrypt_key) -> None:
        self.username = username
        self.h_pwd = h_pwd
        self.pub_sig_key = pub_sig_key
        self.pub_encrypt_key = pub_encrypt_key


class Files(db.Model):
    file_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    path = db.Column(db.String(200), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    name = db.Column(db.Text, nullable=False)
    type = db.Column(db.Text, nullable=False)
    sig = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False)

    def __init__(self, user_id, path, label, name, type, sig) -> None:
        self.user_id = user_id
        self.path = path
        self.label = label
        self.name = name
        self.type = type
        self.sig = sig
        self.created_at = datetime.now(timezone.utc)


class FileKeys(db.Model):
    key_id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    key = db.Column(db.Text, nullable=False)
    counter = db.Column(db.Text, nullable=False)

    def __init__(self, file_id, user_id, key, counter) -> None:
        self.file_id = file_id
        self.user_id = user_id
        self.key = key
        self.counter = counter


with app.app_context():
    db.create_all()


@app.errorhandler(400)
def handle_400_error(error):
    response = jsonify({"error": "Bad Request", "description": error.description})
    response.status_code = 400
    return response


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form["username"]
        pwd = request.form["password"]
        pub_sig_key = request.form["pub_sig_key"]
        pub_encrypt_key = request.form["pub_encrypt_key"]

        h_pwd = generate_password_hash(password=pwd)

        new_user = Users(
            username=username,
            h_pwd=h_pwd,
            pub_sig_key=pub_sig_key,
            pub_encrypt_key=pub_encrypt_key,
        )
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
            session["user_id"] = user.user_id
            session["username"] = user.username
            return redirect(url_for("index"))
        else:
            flash("Invalid credentials. Try again")
            return redirect(url_for("login"))

    return render_template("login.html")


@app.route("/uploadFile", methods=["GET", "POST"])
def upload_file():
    if not session.get("user_id", False):
        return redirect(url_for("login"))

    if request.method == "POST":
        data = request.get_json()

        if int(data["file_size"]) > 2**30 * MAX_FILE_SIZE_IN_GB:
            abort(400, description="File is too large")

        try:
            file_key = data["file_key"]
            file_counter = data["file_counter"]

            file_label = data["file_label"]
            file_name = data["file_name"]
            file_type = data["file_type"]
            file_sig = data["file_sig"]
            file_content = base64.b64decode(data["file"])
        except KeyError as e:
            abort(400, description="Missing item from payload")

        file = db.session.execute(
            db.select(Files)
            .filter_by(user_id=session["user_id"])
            .filter_by(label=file_label)
        ).first()

        if file is not None:
            abort(400, description=f"File with label '{file_label}' already exists")

        user_folder_path = os.path.join(UPLOAD_FOLDER, session["username"])

        if not os.path.exists(user_folder_path):
            os.makedirs(user_folder_path)

        file_path = os.path.join(user_folder_path, file_label)

        with open(file_path, "wb") as f:
            f.write(file_content)

        try:
            new_file = Files(
                user_id=session["user_id"],
                path=file_path,
                label=file_label,
                name=file_name,
                type=file_type,
                sig=file_sig,
            )
            db.session.add(new_file)
        except:
            abort(400, description="Error adding file information to DB")

        db.session.commit()

        try:
            new_file_key = FileKeys(
                file_id=new_file.file_id,
                user_id=session["user_id"],
                key=file_key,
                counter=file_counter,
            )
            db.session.add(new_file_key)
        except:
            abort(400, description="Error adding file key information to DB")
        db.session.commit()

    return render_template("uploadFile.html")


@app.route("/downloadFile/", methods=["GET"])
def download_file():

    if not session.get("user_id", False):
        return redirect(url_for("login"))

    return render_template("downloadFile.html")


@app.route("/downloadFile/<file_label>", methods=["GET"])
def download_file_by_label(file_label):

    if file_label is not None:
        user_id = session["user_id"]
        file = db.session.execute(db.select(Files).filter_by(user_id=user_id).filter_by(label=file_label)).scalar()  # type: ignore

        file_key = db.session.execute(
            db.select(FileKeys)
            .filter_by(user_id=user_id)
            .filter_by(file_id=file.file_id)  # type: ignore
        ).scalar()

        user_folder_path = os.path.join(UPLOAD_FOLDER, session["username"])
        file_path = os.path.join(user_folder_path, file_label)

        with open(file_path, "rb") as f:
            file_content = f.read()

    return jsonify(
        file=base64.b64encode(file_content).decode('utf-8'),
        file_label=file_label,
        file_name=file.name,
        file_type=file.type,
        file_sig=file.sig,
        file_key=file_key.key,
        file_counter=file_key.counter,
    )


@app.route("/currentUser", methods=["GET"])
def current_user():
    username = session.get("username", None)
    return jsonify(username=username)


@app.route("/files", methods=["GET"])
def get_files():
    user_id = session.get("user_id", None)
    result = db.session.execute(db.select(Files.label).filter_by(user_id=user_id))  # type: ignore

    file_labels = [row[0] for row in result]
    return jsonify(file_labels=file_labels)


@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully!")
    return redirect(url_for("index"))


def convert_size(size_bytes):
    if size_bytes == 0:
        return "0B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return "%s %s" % (s, size_name[i])


if __name__ == "__main__":
    app.run(debug=True)
