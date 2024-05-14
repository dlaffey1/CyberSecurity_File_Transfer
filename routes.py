from flask import Flask, request, jsonify
from models import db, File
from utils import decrypt_file, encrypt_file

# Create the Flask app instance
app = Flask(__name__)


@app.route('/send_file', methods=['POST'])
def send_file():
    file = request.files['file']
    
    # Encrypt the file
    encrypted_file = encrypt_file(file)
    
    # Save the encrypted file to the database
    new_file = File(file_name=file.filename, encrypted_data=encrypted_file)
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
    
    # Retrieve encrypted file from the database
    file = File.query.first()
    encrypted_file = file.encrypted_data
    
    # Decrypt the file using AES decryption with the shared secret
    decrypted_file = decrypt_file(encrypted_file, shared_secret)
    
    # Return the decrypted file to the client
    return decrypted_file

if __name__ == '__main__':
    # Run the app in debug mode
    app.run(debug=True)
