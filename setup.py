import secrets
import os

if not os.path.isdir("instance"):
    os.mkdir("instance")

secret_key = secrets.token_hex()
with open(".env", "w") as env_file:
    env_file.writelines(
        [
            f"SECRET_KEY = '{secret_key}'\n",
            "HOST = '127.0.0.1'\n",
            "PORT = '5000'\n",
            "URL_PREFIX = ''\n",
        ]
    )
    
print("instance/ and .env generated")
