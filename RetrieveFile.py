import requests

url = 'http://127.0.0.1:5000/get_file'
data = {'p': 123, 'g': 456, 'private_key_dh': 789}  # Provide the necessary parameters for Diffie-Hellman key exchange
response = requests.post(url, data=data)

with open('File.txt', 'wb') as f:
    f.write(response.content)
