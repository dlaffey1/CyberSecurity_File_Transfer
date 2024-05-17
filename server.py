from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from utils import decrypt_file, encrypt_file, generate_aes_key, aes_encrypt_file, aes_decrypt_file

app = Flask(__name__)

# Configure the database URI
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///server.db"

# Initialize the database
db = SQLAlchemy(app)

# Define the model
class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_name = db.Column(db.String(100), nullable=False)
    encrypted_data_rsa = db.Column(db.LargeBinary, nullable=False)
    encrypted_data_aes = db.Column(db.LargeBinary, nullable=False)
    aes_key = db.Column(db.LargeBinary, nullable=False)

# Generate RSA keys for file encryption and decryption
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)
public_key = private_key.public_key()

# Store the RSA keys in PEM format
private_key_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
public_key_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

# Define the route for sending a file
@app.route('/send_file', methods=['POST'])
def send_file():
    file = request.files['file']
    
    # Read file data
    file_data = file.read()
    
    # Encrypt the file with RSA
    encrypted_file_rsa = encrypt_file(file_data, public_key)
    
    # Perform Diffie-Hellman key exchange to obtain the shared secret
    p = int(request.form['p'])
    g = int(request.form['g'])
    private_key_dh = int(request.form['private_key_dh'])
    public_key_dh = pow(g, private_key_dh, p)
    shared_secret = pow(public_key_dh, private_key_dh, p)
    
    # Generate AES key from the shared secret
    aes_key = generate_aes_key(shared_secret)
    
    # Encrypt the file with AES using the shared secret
    encrypted_file_aes = aes_encrypt_file(file_data, aes_key)
    
    # Save the encrypted file, AES key, and metadata to the database
    new_file = File(file_name=file.filename, encrypted_data_aes=encrypted_file_aes, encrypted_data_rsa=encrypted_file_rsa, aes_key=aes_key)
    db.session.add(new_file)
    db.session.commit()
    
    return jsonify({'message': 'File sent successfully'})

# Define the route for getting the file
@app.route('/get_file', methods=['POST'])
def get_file():
    # Extract parameters from the request
    p = int(request.form['p'])
    g = int(request.form['g'])
    private_key_dh = int(request.form['private_key_dh'])
    
    # Calculate shared secret using Diffie-Hellman key exchange
    public_key_dh = pow(g, private_key_dh, p)
    shared_secret = pow(public_key_dh, private_key_dh, p)
    
    # Retrieve encrypted file, AES key, and metadata from the database
    file = File.query.first()
    encrypted_file_aes = file.encrypted_data_aes
    encrypted_file_rsa = file.encrypted_data_rsa
    aes_key = file.aes_key
    
    # Decrypt the file with RSA to obtain the AES key
    decrypted_aes_key = private_key.decrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # Decrypt the file with AES using the obtained AES key
    decrypted_file = aes_decrypt_file(encrypted_file_aes, decrypted_aes_key)
    
    # Return the decrypted file to the client
    return decrypted_file

if __name__ == '__main__':
    # Run the app in debug mode
    app.run(debug=True)
