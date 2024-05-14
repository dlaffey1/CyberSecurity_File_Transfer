from flask import request, jsonify
from app import app
from models import File
from utils import encrypt_file, decrypt_file

@app.route('/send_file', methods=['POST'])
def send_file():
    file = request.files['file']
    encrypted_file = encrypt_file(file)
    file = File(file_name=file.filename, encrypted_data=encrypted_file)
    db.session.add(file)
    db.session.commit()
    return jsonify({'message': 'File sent successfully'})

@app.route('/get_file', methods=['POST'])
def get_file():
    p = int(request.form['p'])
    g = int(request.form['g'])
    private_key_dh = int(request.form['private_key_dh'])
    public_key_dh = pow(g, private_key_dh, p)
    shared_secret = pow(public_key_dh, private_key_dh, p)
    file = File.query.first()
    encrypted_file = file.encrypted_data
    decrypted_file = decrypt_file(encrypted_file, shared_secret)
    return decrypted_file