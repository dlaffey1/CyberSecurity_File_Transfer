import os
import secrets
import shutil
import sys

serverEnv = len(sys.argv) > 1 and sys.argv[1] == "server"

if serverEnv:
    host = "0.0.0.0"
    port = 2016
    url_prefix = "/script"
else:
    host = "127.0.0.1"
    port = 5000
    url_prefix = ""

if os.path.exists("instance"):
    shutil.rmtree("instance")
os.mkdir("instance")

secret_key = secrets.token_hex()
with open(".env", "w") as env_file:
    env_file.writelines(
        [
            f"SECRET_KEY = '{secret_key}'\n",
            f"HOST = {host}\n",
            f"PORT = {port}\n",
            f"URL_PREFIX = {url_prefix}\n",
        ]
    )


with open("./static/constants.js", "w") as file:
    file.write(f"const URL_PREFIX = '{url_prefix}';\n")

environment_name = "Server Environment" if serverEnv else "Development Environment"
msg = f"{environment_name} defaults instantiated"
print(msg)
