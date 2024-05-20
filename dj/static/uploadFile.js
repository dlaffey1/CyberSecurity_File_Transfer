document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        console.log(event);
    });
});

async function getFileAsArrayBuffer() {
    const file = document.getElementById("file-selector").files[0];
    const fileArray = await file.arrayBuffer();

    const encoder = new TextEncoder();
    const fileNameArray = encoder.encode(file.name);
    const fileTypeArray = encoder.encode(file.type);

    return [fileArray, fileNameArray, fileTypeArray];
}

async function getEncryptedFile(key) {
    const [fileAB, fileNameAB, fileTypeAB] = await getFileAsArrayBuffer();
    const counter = window.crypto.getRandomValues(new Uint8Array(16));

    const encryptedFile = await window.crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        fileAB
    );

    const encryptedFileName = await window.crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        fileNameAB
    );

    const encryptedFileType = await window.crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        fileTypeAB
    );

    return [encryptedFile, encryptedFileName, encryptedFileType, counter];
}

async function generateNewKey() {
    const key = await window.crypto.subtle.generateKey(
        {
            name: "AES-CTR",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
    return key;
}

async function prepareFile() {
    const encryptKeyPair = await getKeyPairFromDB("encrypt");
    const sigKeyPair = await getKeyPairFromDB("sig");

    const fileKey = await generateNewKey();

    const file = document.getElementById("file-selector").files[0];

    const counter = window.crypto.getRandomValues(new Uint8Array(16));

    const [encryptedFile, encryptedFileName, encryptedFileType] =
        await encryptFile(fileKey, counter, file);

    const fileKeyAsArrayBuffer = await window.crypto.subtle.exportKey(
        "raw",
        fileKey
    );

    const encryptedFileKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        encryptKeyPair.publicKey,
        fileKeyAsArrayBuffer
    );

    const fileSignature = await window.crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 },
        sigKeyPair.privateKey,
        encryptedFile
    );

    const newFile = await decryptFile(fileKey, counter, encryptedFile, encryptedFileName, encryptedFileType);
    console.log(newFile);

    return [encryptedFileKey, counter, encryptedFile, fileSignature];
}
