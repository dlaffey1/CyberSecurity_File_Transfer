# from flask import Flask, request, jsonify
# from models import db, File
# from utils import decrypt_file, encrypt_file, generate_aes_key, aes_encrypt_file
# from app import app
# # Create the Flask app instance
# app = Flask(__name__)

# # Define the route for sending a file
# @app.route('/send_file', methods=['POST'])
# def send_file():
#     file = request.files['file']
    
#     # Encrypt the file with RSA
#     encrypted_file_rsa = encrypt_file(file)
    
#     # Perform Diffie-Hellman key exchange to obtain the shared secret
#     p = int(request.form['p'])
#     g = int(request.form['g'])
#     private_key_dh = int(request.form['private_key_dh'])
#     public_key_dh = pow(g, private_key_dh, p)
#     shared_secret = pow(public_key_dh, private_key_dh, p)
    
#     # Generate AES key from the shared secret
#     aes_key = generate_aes_key(shared_secret)
    
#     # Encrypt the file with AES using the shared secret
#     encrypted_file_aes = aes_encrypt_file(file.read(), aes_key)
    
#     # Save the encrypted file and metadata to the database
#     new_file = File(file_name=file.filename, encrypted_data_aes=encrypted_file_aes, encrypted_data_rsa=encrypted_file_rsa)
#     db.session.add(new_file)
#     db.session.commit()
    
#     return jsonify({'message': 'File sent successfully'})

# # Define the route for getting the file
# @app.route('/get_file', methods=['POST'])
# def get_file():
#     # Extract parameters from the request
#     p = int(request.form['p'])
#     g = int(request.form['g'])
#     private_key_dh = int(request.form['private_key_dh'])
    
#     # Calculate shared secret using Diffie-Hellman key exchange
#     public_key_dh = pow(g, private_key_dh, p)
#     shared_secret = pow(public_key_dh, private_key_dh, p)
    
#     # Retrieve encrypted file and metadata from the database
#     file = File.query.first()
#     encrypted_file_aes = file.encrypted_data_aes
#     encrypted_file_rsa = file.encrypted_data_rsa
    
#     # Decrypt the file with RSA to obtain the AES key
#     aes_key = decrypt_file(encrypted_file_rsa)
    
#     # Decrypt the file with AES using the obtained AES key
#     decrypted_file = aes_decrypt_file(encrypted_file_aes, aes_key)
    
#     # Return the decrypted file to the client
#     return decrypted_file

# if __name__ == '__main__':
#     # Run the app in debug mode
#     app.run(debug=True)
