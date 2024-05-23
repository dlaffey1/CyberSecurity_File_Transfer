document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = document.getElementById("file_selector").files[0];
        const file_size = file.size;

        const file_label = document.getElementById("file_label").value;

        const fileKey = await generateFileKey();
        const fileCounter = window.crypto.getRandomValues(new Uint8Array(16));

        const encryptedFileData = await encryptFileData(
            fileKey,
            fileCounter,
            file
        );
        const fileSig = await signEncryptedFile(encryptedFileData.file);

        const encryptKeyPair = await getKeyPairFromDB("encrypt");
        const encryptedFileKey = await encryptFileKey(fileKey, encryptKeyPair.publicKey);

        const response = await fetch("/uploadFile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                file: ABToB64(encryptedFileData.file),
                file_size: file_size,
                file_label: file_label,
                file_name: ABToB64(encryptedFileData.name),
                file_type: ABToB64(encryptedFileData.type),
                file_sig: ABToB64(fileSig),
                file_key: ABToB64(encryptedFileKey),
                file_counter: ABToB64(fileCounter),
            }),
        });

        if (response.ok) {
            alert(`File '${file_label}' uploaded successfully`);
            form.reset();
        } else {
            const errorData = await response.json();
            alert(`Error: ${errorData.description}`);
            return;
        }
    });
});

async function generateFileKey() {
    return await window.crypto.subtle.generateKey(
        {
            name: "AES-CTR",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

async function signEncryptedFile(encryptedFile) {
    const sigKeyPair = await getKeyPairFromDB("sig");

    return await window.crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 },
        sigKeyPair.privateKey,
        encryptedFile
    );
}

function updateLabel(event) {
    const file = event.target.files[0];
    if (file.size > 2**30 * 10) {
        alert("File is too large (Maximum of 10GB)")
        document.getElementById("file_selector").value = null;
        return;
    }

    const fileName = file.name;
    const dotIndex = fileName.lastIndexOf(".");
    const fileNameWithoutExtension =
        dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;

    document.getElementById("file_label").value = fileNameWithoutExtension;
}
