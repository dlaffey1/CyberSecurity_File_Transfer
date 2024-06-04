document.addEventListener('DOMContentLoaded', () => {
    const keyPasswordInput = document.getElementById('keyPassword');
    const toggleKeyPasswordBtn = document.getElementById('toggleKeyPassword');

    toggleKeyPasswordBtn.addEventListener('click', () =>
        togglePasswordVis(keyPasswordInput),
    );

    const form = document.getElementById('form');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        document.getElementById('submit').setAttribute('disabled', '');
        try {
            const file = document.getElementById('file_selector').files[0];
            const fileLabel = document.getElementById('file_label').value;
            const keyPassword = document.getElementById('keyPassword').value;

            const fileKey = await generateFileKey();
            const fileCounter = window.crypto.getRandomValues(
                new Uint8Array(16),
            );

            await encryptAndUploadFile(
                fileKey,
                fileCounter,
                file,
                fileLabel,
                keyPassword,
            );
        } finally {
            form.reset();
            document.getElementById('submit').removeAttribute('disabled');
        }
    });
});

async function encryptAndUploadFile(
    fileKey,
    fileCounter,
    file,
    fileLabel,
    keyPassword,
) {
    const encryptedFileData = await encryptFileData(fileKey, fileCounter, file);

    const sigPrivKey = await getPrivKeyFromDB('sig', keyPassword);
    const fileSig = await signEncryptedFile(encryptedFileData.file, sigPrivKey);

    const encryptPubKey = await getPublicKey(
        await getCurrentUsername(),
        'encrypt',
    );
    const encryptedFileKey = await encryptFileKey(fileKey, encryptPubKey);

    const response = await fetch(`${URL_PREFIX}/uploadFile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            file: ABToB64(encryptedFileData.file),
            file_size: file.size,
            file_label: fileLabel,
            file_name: ABToB64(encryptedFileData.name),
            file_type: ABToB64(encryptedFileData.type),
            file_sig: ABToB64(fileSig),
            file_key: ABToB64(encryptedFileKey),
            file_counter: ABToB64(fileCounter),
        }),
    });

    if (response.ok) {
        alert(`File '${fileLabel}' uploaded successfully`);
    } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.description}`);
    }
}

async function generateFileKey() {
    return await window.crypto.subtle.generateKey(
        {
            name: 'AES-CTR',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt'],
    );
}

function updateLabel(event) {
    const file = event.target.files[0];
    if (file.size > 2 ** 30 * 10) {
        alert('File is too large (Maximum of 10GB)');
        document.getElementById('file_selector').value = null;
        return;
    }

    const fileName = file.name;
    const dotIndex = fileName.lastIndexOf('.');
    const fileNameWithoutExtension =
        dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;

    document.getElementById('file_label').value = fileNameWithoutExtension;
}
