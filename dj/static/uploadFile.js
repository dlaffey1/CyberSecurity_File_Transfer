document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = document.getElementById("file").files[0];
        console.log(file);

        const fileKey = await generateFileKey();
        const counter = window.crypto.getRandomValues(new Uint8Array(16));

        const encryptedFileData = await encryptFileData(fileKey, counter, file);
        const fileSig = await signEncryptedFile(encryptedFileData.file);
        const encryptedFileKey = await encryptFileKey(fileKey);

        // const response = await fetch("/uploadFile", {
        //     method: "POST",
        //     headers: {
        //         "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify({
        //         test: "test",
        //         hello: "World",
        //     }),
        // });
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

async function encryptFileData(fileKey, counter, file) {
    const [encryptedFile, encryptedFileName, encryptedFileType] =
        await encryptFile(fileKey, counter, file);

    return {
        file: encryptedFile,
        fileName: encryptedFileName,
        fileType: encryptedFileType
    };
}

async function signEncryptedFile(encryptedFile) {
    const sigKeyPair = await getKeyPairFromDB("sig");

    return await window.crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 },
        sigKeyPair.privateKey,
        encryptedFile
    );
}

async function encryptFileKey(fileKey) {
    const encryptKeyPair = await getKeyPairFromDB("encrypt");

    const fileKeyAB = await window.crypto.subtle.exportKey("raw", fileKey);
    return await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        encryptKeyPair.publicKey,
        fileKeyAB
    );
}
