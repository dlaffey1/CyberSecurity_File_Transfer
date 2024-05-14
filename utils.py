from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os

def encrypt_file(file_data, public_key):
    # Encrypt the file using RSA with the recipient's public key
    encrypted_file = public_key.encrypt(
        file_data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return encrypted_file

def decrypt_file(encrypted_file, private_key):
    # Decrypt the file using RSA with the private key
    decrypted_file = private_key.decrypt(
        encrypted_file,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return decrypted_file

def generate_aes_key(shared_secret):
    # Derive an AES key from the Diffie-Hellman shared secret
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256 bits key
        salt=os.urandom(16),
        iterations=100000,
        backend=default_backend()
    )
    aes_key = kdf.derive(shared_secret)
    
    return aes_key

def aes_encrypt_file(file_data, aes_key):
    # Generate a random IV (Initialization Vector)
    iv = os.urandom(16)
    
    # Initialize AES cipher with CBC mode and the generated AES key
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    
    # Create an encryptor object
    encryptor = cipher.encryptor()
    
    # Encrypt the file data
    encrypted_data = encryptor.update(file_data) + encryptor.finalize()
    
    # Return the IV and encrypted data
    return iv + encrypted_data

def aes_decrypt_file(encrypted_data, aes_key, iv):
    # Initialize AES cipher with CBC mode and the generated AES key
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    
    # Create a decryptor object
    decryptor = cipher.decryptor()
    
    # Decrypt the encrypted data
    decrypted_data = decryptor.update(encrypted_data) + decryptor.finalize()
    
    # Return the decrypted data
    return decrypted_data
