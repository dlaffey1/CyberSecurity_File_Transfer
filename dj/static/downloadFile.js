document.addEventListener("DOMContentLoaded", async () => {
    const fileLists = await getFileLists();
    const fileSelect = document.getElementById("file_select");
    const allFiles = fileLists.all_files;

    for (let i = 0; i < allFiles.length; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `${allFiles[i].label} - ${allFiles[i].owner}`;
        fileSelect.appendChild(option);
    }

    const form = document.getElementById("form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fileIndex = fileSelect.value;
        downloadAndDecryptFile(
            allFiles[fileIndex].owner,
            allFiles[fileIndex].label
        );
    });
});

async function downloadAndDecryptFile(username, fileLabel) {
    const response = await (
        await fetch(`/downloadFile/${username}/${fileLabel}`)
    ).json();
    const [encrypedFileKey, fileCounter, fileSig, encryptedFileData] =
        unpackFileData(response);

    const signatureIsValid = await verifyEncryptedFile(
        encryptedFileData.file,
        fileSig
    );

    if (!signatureIsValid) {
        alert("Error: File corruption. File signature is not valid");
        return;
    }

    const fileKey = await decryptFileKey(encrypedFileKey);
    const file = await decryptFileData(fileKey, fileCounter, encryptedFileData);

    download(file, file.name);
}

function unpackFileData(fileData) {
    return [
        B64ToAB(fileData.key),
        B64ToAB(fileData.counter),
        B64ToAB(fileData.sig),
        {
            file: B64ToAB(fileData.file),
            name: B64ToAB(fileData.name),
            type: B64ToAB(fileData.type),
        },
    ];
}

async function verifyEncryptedFile(encryptedFile, signature) {
    const sigKeyPair = await getKeyPairFromDB("sig");

    return await window.crypto.subtle.verify(
        { name: "RSA-PSS", saltLength: 32 },
        sigKeyPair.publicKey,
        signature,
        encryptedFile
    );
}
