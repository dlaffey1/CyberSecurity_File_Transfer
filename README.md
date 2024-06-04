## How to run this project

1. Clone the repository
2. Navigate to the root directory of the project
3. Run the following commands (use python version 3.11 or higher):

#### To run the project locally in a development environment:
~~~
pip install -r requirements.txt
python setDefaults.py
python app.py
~~~

#### To run the project hosted on the glynny:
~~~
pip install -r requirements.txt
python setDefaults.py server
python app.py
~~~


### Using the web app

To use the site, you will need to create at least two users by following the instructions on the "sign up" page. Remember the account passwords and key wrapping passwords you set for each user.

Now, you can sign into the site as one of these new users, where you have 3 options, **"Upload File"**, **"Download File"** and **"Share File"**.

- **Upload file** allows the user to upload an encrypted file to the database.

- **Share file** allows the user to share files in their account with another account by providing the recipients username and selecting a file.

- **Download file** displays a dropdown of all files in the user's account, including shared files, and allows them to download them decrypted to their device.
