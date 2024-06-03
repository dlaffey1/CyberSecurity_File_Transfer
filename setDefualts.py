import secrets
import os
import sys
import shutil

def set_defaults():

    # Check for "server" argument in run command to determine environment
    serverEnv = len(sys.argv) > 1 and sys.argv[1] == "server"

    if serverEnv:  # if server environment run on port 2016 (glynny)
        host = '0.0.0.0'
        port = 2016
        url_prefix = "/script"
    else:  # else run localhost
        host = '127.0.0.1'
        port = 5000
        url_prefix = ""

    # Remove existing "instance" directory if it exists and create a new one
    if os.path.exists("instance"):
        shutil.rmtree("instance")
    os.mkdir("instance")

    # Generate a random secret key and write the configuration values to a .env file
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

    # Print a message indicating the environment and defaults instantiated
    environment_name = "Server Environment" if serverEnv else "Development Environment"
    msg = f"{environment_name} defaults instantiated"
    print(msg)

# Call the set_defaults function to execute the code
set_defaults()
