from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_name = db.Column(db.String(100), nullable=False)
    encrypted_data_rsa = db.Column(db.LargeBinary, nullable=False)  # For RSA-encrypted file data
    encrypted_data_aes = db.Column(db.LargeBinary, nullable=False)  # For AES-encrypted file data
    aes_key = db.Column(db.LargeBinary, nullable=False)  # For AES key data

    def __repr__(self):
        return f"File('{self.file_name}')"
