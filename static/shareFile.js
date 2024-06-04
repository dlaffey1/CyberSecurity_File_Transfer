document.addEventListener('DOMContentLoaded', async () => {
    const fileLists = await getFileLists();
    const fileSelect = document.getElementById('file_select');
    const owned_files = fileLists.owned_files;

    for (let i = 0; i < owned_files.length; i++) {
        const option = document.createElement('option');
        option.value = owned_files[i].label;
        option.textContent = owned_files[i].label;
        fileSelect.appendChild(option);
    }

    const form = document.getElementById('form');
    form.addEventListener('submit', handleSubmit);
});

async function handleSubmit(event) {
    event.preventDefault();
    document.getElementById('submit').setAttribute('disabled', '');

    try {
        const recipentUsername =
            document.getElementById('recipient_username').value;
        const fileLabel = document.getElementById('file_select').value;

        const keyPassword = document.getElementById('keyPassword').value;
        const myEncryptedFileKey = await getEncryptedFileKey(fileLabel);
        const encryptPrivKey = await getPrivKeyFromDB('encrypt', keyPassword);

        const fileKey = await decryptFileKey(
            myEncryptedFileKey,
            encryptPrivKey,
        );
        const recipientPublicKey = await getPublicKey(
            recipentUsername,
            'encrypt',
        );

        await encryptAndUploadFileKey(
            fileKey,
            fileLabel,
            recipentUsername,
            recipientPublicKey,
        );
    } finally {
        document.getElementById('submit').removeAttribute('disabled');
    }
}

async function encryptAndUploadFileKey(
    fileKey,
    fileLabel,
    recipentUsername,
    recipientPublicKey,
) {
    const recipientEncryptedFileKey = await encryptFileKey(
        fileKey,
        recipientPublicKey,
    );

    const response = await fetch(`${URL_PREFIX}/shareFileKey`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient_username: recipentUsername,
            file_label: fileLabel,
            encrypted_key: ABToB64(recipientEncryptedFileKey),
        }),
    });

    if (response.ok) {
        alert(`File ${fileLabel} shared with ${recipentUsername} successfully`);
        form.reset();
    } else {
        const errorData = await response.json();
        console.log(response);
        alert(`Error: ${errorData.description}`);
    }
}

async function getEncryptedFileKey(fileLabel) {
    const fileKeyResponse = await fetch(
        `${URL_PREFIX}/getMyFileKey/${fileLabel}`,
    );

    if (!fileKeyResponse.ok) {
        const error = await fileKeyResponse.json();
        alert(`Something went wrong ${error.msg}`);
        throw new Error('Failed to retrieve file key from server');
    }

    const fileKeyData = await fileKeyResponse.json();

    return B64ToAB(fileKeyData['key']);
}
