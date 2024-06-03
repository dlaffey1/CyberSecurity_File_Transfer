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
        const keyPassword = document.getElementById("keyPassword").value;

        const fileIndex = fileSelect.value;
        await downloadAndDecryptFile(
            allFiles[fileIndex].owner,
            allFiles[fileIndex].label,
            keyPassword
        );
    });
});

async function downloadAndDecryptFile(username, fileLabel, keyPassword) {
    const response = await (
        await fetch(`${URL_PREFIX}/downloadFile/${username}/${fileLabel}`)
    ).json();
    const [encrypedFileKey, fileCounter, fileSig, encryptedFileData] =
        unpackFileData(response);

    const publicKey = await getPublicKey(username, "sig");

    const signatureIsValid = await verifyEncryptedFile(
        encryptedFileData.file,
        fileSig,
        publicKey
    );

    if (!signatureIsValid) {
        alert("Error: File corruption. File signature is not valid");
        return;
    }

    let encryptPrivKey;
    try {
        encryptPrivKey = await getPrivKeyFromDB("encrypt", keyPassword);
    } catch {
        alert(
            "Couldn't retrive private key. Please re-enter key wrapping password"
        );
    }

    const fileKey = await decryptFileKey(encrypedFileKey, encryptPrivKey);
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
