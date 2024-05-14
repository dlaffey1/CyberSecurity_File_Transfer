import requests

url = 'http://127.0.0.1:5000/send_file'
files = {'file': open('File.txt', 'rb')}
response = requests.post(url, files=files)

# Print response status code
print("Response Status Code:", response.status_code)

# Print response content
print("Response Content:", response.content)

# Attempt to decode JSON response
try:
    json_response = response.json()
    print("Response JSON:", json_response)
except Exception as e:
    print("Error decoding JSON:", e)
