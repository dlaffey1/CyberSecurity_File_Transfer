import base64
import math
import os
import secrets
from datetime import datetime, timedelta
from typing import List

from dotenv import load_dotenv
from flask import (Flask, abort, flash, jsonify, redirect, render_template,
                   request, session, url_for)
from sqlalchemy import (DateTime, ForeignKey, Integer, String, Text,
                        UniqueConstraint, create_engine, func, select)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (DeclarativeBase, Mapped, Session, mapped_column,
                            relationship)
from werkzeug.security import check_password_hash, generate_password_hash

if not load_dotenv():
    print("No env variables file found, generating secret key automatically...")
    secret_key = secrets.token_hex()
    with open(".env", "w") as env_file:
        env_file.write(f"SECRET_KEY = '{secret_key}'")
        env_file.write(f"HOST = '127.0.0.1'")
    print("Secret key generated")

UPLOAD_FOLDER = "instance/uploaded_files"
MAX_FILE_SIZE_IN_GB = 10
DATABASE_URI = "sqlite:///instance/db.sqlite3"

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
app.permanent_session_lifetime = timedelta(hours=1)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    h_pwd: Mapped[str] = mapped_column(String(162), nullable=False)
    pub_sig_key: Mapped[str] = mapped_column(String(736), nullable=False)
    pub_encrypt_key: Mapped[str] = mapped_column(String(736), nullable=False)

    files: Mapped[List["File"]] = relationship(back_populates="user")
    file_keys: Mapped[List["FileKey"]] = relationship(back_populates="user")

    def __repr__(self):
        return f"User(id={self.id!r})"


class File(Base):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    path: Mapped[str] = mapped_column(String(200), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    sig: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="files")
    file_keys: Mapped["FileKey"] = relationship(back_populates="file")

    __table_args__ = (UniqueConstraint("user_id", "label", name="unique_file"),)

    def __repr__(self):
        return f"File(id={self.id!r})"


class FileKey(Base):
    __tablename__ = "file_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("files.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    key: Mapped[str] = mapped_column(Text, nullable=False)
    counter: Mapped[str] = mapped_column(Text, nullable=False)

    file: Mapped["File"] = relationship(back_populates="file_keys")
    user: Mapped["User"] = relationship(back_populates="file_keys")

    __table_args__ = (
        UniqueConstraint("user_id", "file_id", name="unique_user_file_pair"),
    )

    def __repr__(self):
        return f"FileKey(id={self.id!r})"


engine = create_engine(DATABASE_URI)
Base.metadata.create_all(engine)
db_session = Session(engine)


@app.errorhandler(400)
def handle_400_error(error):
    response = jsonify({"error": "Bad Request", "description": error})
    response.status_code = 400
    return response


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if session.get("user_id", False):
        return redirect(url_for("index"))

    if request.method == "POST":
        username = request.form["username"]
        pwd = request.form["password"]
        pub_sig_key = request.form["pub_sig_key"]
        pub_encrypt_key = request.form["pub_encrypt_key"]

        h_pwd = generate_password_hash(password=pwd)
        try:
            new_user = User(
                username=username,
                h_pwd=h_pwd,
                pub_sig_key=pub_sig_key,
                pub_encrypt_key=pub_encrypt_key,
            )
            db_session.add(new_user)
            db_session.commit()
        except IntegrityError:
            flash(f"The username '{username}' is taken")
            db_session.rollback()
            return render_template("signup.html")

        flash(f"User {username} successfully registered")
        return redirect(url_for("login"))

    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        pwd = request.form["password"]

        stmt = select(User).where(User.username.is_(username))
        user = db_session.scalar(stmt)

        if user is None:
            flash("Invalid credentials. Try again")
            return redirect(url_for("login"))

        if check_password_hash(user.h_pwd, pwd):
            session["user_id"] = user.id
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

        try:
            file_key = data["file_key"]
            file_counter = data["file_counter"]

            file_label = data["file_label"]
            file_name = data["file_name"]
            file_type = data["file_type"]
            file_size = data["file_size"]
            file_sig = data["file_sig"]
            file_content = base64.b64decode(data["file"])
        except KeyError as e:
            abort(400, description=f"Missing item from payload: {e}")

        if int(file_size) > 2**30 * MAX_FILE_SIZE_IN_GB:
            abort(400, description="File is too large")

        user_folder_path = os.path.join(UPLOAD_FOLDER, session["username"])
        if not os.path.exists(user_folder_path):
            os.makedirs(user_folder_path)

        file_path = os.path.join(user_folder_path, file_label)

        try:
            file = File(
                user_id=session["user_id"],
                path=file_path,
                label=file_label,
                name=file_name,
                type=file_type,
                sig=file_sig,
            )

            db_session.add(file)
            db_session.commit()
        except IntegrityError:
            db_session.rollback()
            abort(400, description=f"File with label '{file_label}' already exists")

        with open(file_path, "wb") as f:
            f.write(file_content)

        try:
            new_file_key = FileKey(
                file_id=file.id,
                user_id=session["user_id"],
                key=file_key,
                counter=file_counter,
            )

            db_session.add(new_file_key)
            db_session.commit()
        except:
            db_session.rollback()
            abort(400, description="Error adding file key information to DB")

    return render_template("uploadFile.html")


@app.route("/downloadFile/", methods=["GET"])
def download_file():
    if not session.get("user_id", False):
        return redirect(url_for("login"))

    return render_template("downloadFile.html")


@app.route("/downloadFile/<username>/<file_label>", methods=["GET"])
def download_file_by_username_and_label(username, file_label):
    if not session.get("user_id", False):
        return redirect(url_for("login"))

    stmt = (
        select(File)
        .join(File.user)
        .join(File.file_keys)
        .where(User.username.is_(username))
        .where(File.label.is_(file_label))
        .where(FileKey.user_id.is_(session["user_id"]))
    )
    file = db_session.scalar(stmt)

    if file is None:
        abort(400, f"No file uploaded by '{username}' with label '{file_label}'")

    stmt = (
        select(FileKey)
        .where(FileKey.user_id.is_(session["user_id"]))
        .where(FileKey.file_id.is_(file.id))
    )
    file_key = db_session.scalar(stmt)

    if file_key is None:
        abort(400, f"No file decryption key found for user {session['username']}")

    user_folder_path = os.path.join(UPLOAD_FOLDER, username)
    file_path = os.path.join(user_folder_path, file_label)

    with open(file_path, "rb") as f:
        file_content = f.read()

    return jsonify(
        file=base64.b64encode(file_content).decode("utf-8"),
        file_label=file_label,
        name=file.name,
        type=file.type,
        sig=file.sig,
        key=file_key.key,
        counter=file_key.counter,
    )


@app.route("/shareFile", methods=["GET"])
def share_file():
    if not session.get("user_id", False):
        return redirect(url_for("login"))

    return render_template("shareFile.html")


@app.route("/shareFileKey", methods=["POST"])
def share_file_key():
    if not session.get("user_id", False):
        return redirect(url_for("login"))

    data = request.get_json()
    try:
        username = data["recipient_username"]
        label = data["file_label"]
        key = data["encrypted_key"]
        counter = data["counter"]
    except KeyError as e:
        return jsonify(msg=f"Missing item from payload: {e}"), 400

    stmt = select(User.id).where(User.username.is_(username))
    user_id = db_session.scalar(stmt)

    if user_id is None:
        flash(f"No user with username '{username}'")
        abort(400, f"No user with username '{username}'")

    stmt = (
        select(File.id)
        .join(File.user)
        .where(File.label.is_(label))
        .where(User.id.is_(session["user_id"]))
    )
    file_id = db_session.scalar(stmt)

    if file_id is None:
        flash(f"Something went wrong when retrieving the file '{label}'")
        abort(400, f"No file with label '{label}'")

    file_key = FileKey(file_id=file_id, user_id=user_id, key=key, counter=counter)

    try:
        db_session.add(file_key)
        db_session.commit()
    except IntegrityError:
        db_session.rollback()
        err_msg = (
            f"A key for file labeled '{label}' already belongs to user '{username}'"
        )
        flash(err_msg)
        abort(400, err_msg)

    flash(f"File labeled '{label}' was successfully shared with user '{username}'")

    return render_template("shareFile.html")


@app.route("/getMyFileKey/<file_label>", methods=["GET"])
def get_file_key(file_label):
    if not session.get("user_id", False):
        return jsonify(msg="User not logged in"), 400

    stmt = (
        select(FileKey.key, FileKey.counter)
        .join(FileKey.file)
        .where(FileKey.user_id.is_(session["user_id"]))
        .where(File.label.is_(file_label))
    )
    key, counter = db_session.execute(stmt).first() or (None, None)

    if key is None:
        return jsonify(msg="Key not found"), 400

    return jsonify(key=key, counter=counter)


@app.route("/getPublicKey/<key_type>/<username>", methods=["GET"])
def get_pub_key(key_type, username):
    if key_type == "sig":
        stmt = select(User.pub_sig_key).where(User.username.is_(username))
    elif key_type == "encrypt":
        stmt = select(User.pub_encrypt_key).where(User.username.is_(username))
    else:
        return jsonify(msg="Invalid key type, valid options: ['sig', 'encrypt']"), 400

    key = db_session.scalar(stmt)

    if key is None:
        return jsonify(msg=f"User with username {username} not found"), 400

    return jsonify(key=key)


@app.route("/currentUser", methods=["GET"])
def current_user():
    username = session.get("username", None)
    return jsonify(username=username)


@app.route("/files", methods=["GET"])
def get_files():
    if not session.get("user_id", False):
        return redirect(url_for("login"))

    current_user_id = session["user_id"]

    stmt = (
        select(User.username, File.label)
        .join(File.user)
        .where(User.id.is_(current_user_id))
    )
    data = db_session.execute(stmt).all()
    owned_files = [{"owner": u, "label": l} for u, l in data]

    stmt = (
        select(User.username, File.label)
        .join(File.user)
        .join(File.file_keys)
        .where(FileKey.user_id.is_(current_user_id))
        .where(File.user_id.is_not(current_user_id))
    )
    data = db_session.execute(stmt).all()
    received_files = [{"owner": u, "label": l} for u, l in data]

    all_files = owned_files + received_files

    return jsonify(
        owned_files=owned_files, received_files=received_files, all_files=all_files
    )


@app.route("/logout")
def logout():
    if not session.get("user_id", False):
        return redirect(url_for("login"))

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
    app.run(host=os.getenv("HOST"), port=2016, debug=True)
