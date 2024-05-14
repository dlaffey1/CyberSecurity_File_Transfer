from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_name = db.Column(db.String(100), nullable=False)
    encrypted_data = db.Column(db.LargeBinary, nullable=False)

    def __repr__(self):
        return f"File('{self.file_name}')"