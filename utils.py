from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os
import traceback

def encrypt_file(file_data, public_key):
    try:
        print("Starting encryption process...")
        print(f"File data length: {len(file_data)}")
        print(f"Public key: {public_key}")

        # Encrypt the file with RSA
        rsa_encrypted_data = public_key.encrypt(
            file_data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        # Perform Diffie-Hellman key exchange to obtain the shared secret
        p = int(os.environ.get('DH_P', '123456789'))  # Default value '123456789'
        g = int(os.environ.get('DH_G', '2'))  # Default value '2'
        private_key_dh = int(os.environ.get('DH_PRIVATE_KEY', '12345'))  # Default value '12345'
        public_key_dh = pow(g, private_key_dh, p)
        shared_secret = pow(public_key_dh, private_key_dh, p)

        # Generate AES key from the shared secret
        aes_key = generate_aes_key(shared_secret)

        # Encrypt the RSA-encrypted file with AES using the shared secret
        aes_encrypted_data = aes_encrypt_file(rsa_encrypted_data, aes_key)

        print("Encryption successful.")
        return aes_encrypted_data
    except Exception as e:
        print("Encryption failed.")
        print(f"Error: {e}")
        traceback.print_exc()
        raise ValueError("Encryption failed") from e

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
    # Convert the shared secret to bytes
    shared_secret_bytes = shared_secret.to_bytes((shared_secret.bit_length() + 7) // 8, 'big')
    
    # Derive an AES key from the Diffie-Hellman shared secret
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256 bits key
        salt=os.urandom(16),
        iterations=100000,
        backend=default_backend()
    )
    aes_key = kdf.derive(shared_secret_bytes)
    
    return aes_key


def aes_encrypt_file(file_data, aes_key):
    # Generate a random IV (Initialization Vector)
    iv = os.urandom(16)
    
    # Initialize AES cipher with CBC mode and the generated AES key
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    
    # Create an encryptor object
    encryptor = cipher.encryptor()
    
    # Pad the file data to ensure its length is a multiple of the block size
    padded_data = pad_data(file_data)
    
    # Encrypt the padded file data
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    
    # Return the IV and encrypted data
    return iv + encrypted_data

def pad_data(data):
    # Calculate the number of bytes needed for padding
    pad_length = 16 - (len(data) % 16)
    
    # Pad the data with bytes equal to the pad length
    padded_data = data + bytes([pad_length] * pad_length)
    
    return padded_data


def aes_decrypt_file(encrypted_data, aes_key, iv):
    # Initialize AES cipher with CBC mode and the given AES key and IV
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    
    # Create a decryptor object
    decryptor = cipher.decryptor()
    
    # Decrypt the encrypted data
    decrypted_data = decryptor.update(encrypted_data) + decryptor.finalize()
    
    # Unpad the decrypted data (assuming PKCS7 padding was used)
    unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
    unpadded_data = unpadder.update(decrypted_data) + unpadder.finalize()
    
    # Return the decrypted and unpadded data
    return unpadded_data
