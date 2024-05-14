from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import sqlite3
import os
import base64
import hashlib

def encrypt_file(file):
    # Read the file
    file_data = file.read()

    # Encrypt the file using RSA
    encrypted_file = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    ).encrypt(
        file_data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return encrypted_file

def decrypt_file(encrypted_file, shared_secret):
    # Decrypt the file using the shared secret
    decrypted_file = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    ).decrypt(
        encrypted_file,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return decrypted_file