async function getFileAsArrayBuffer() {
    const file = document.getElementById("file-selector").files[0];
    const fileArray = await file.arrayBuffer();

    return fileArray;
}

async function encryptFile(key) {
    const file = await getFileAsArrayBuffer();
    const counter = window.crypto.getRandomValues(new Uint8Array(16));
    console.log("file");
    console.log(file);

    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        file
    );

    return encrypted;
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
    const fileKey = await generateNewKey();
    const encryptedFile = await encryptFile(fileKey);
    const assymKeys = await getKeyPairsFromDB("encrypt");

    console.log(assymKeys);
    

    const encryptedFileKey = await window.crypto.subtle.wrapKey("raw", fileKey, )

}
