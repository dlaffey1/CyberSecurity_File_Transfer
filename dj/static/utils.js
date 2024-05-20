function hello() {
    console.log("Hello World!");
}

function arrayBufferToB64(exportedKey) {
    const arrayOfKey = new Uint8Array(exportedKey);
    return window.btoa(String.fromCharCode(...arrayOfKey));
}

async function keyPairToB64(keyPair) {
    const keyPubExp = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
    );

    const keyPrivExp = await window.crypto.subtle.exportKey(
        "pkcs8",
        keyPair.privateKey
    );

    return [arrayBufferToB64(keyPubExp), arrayBufferToB64(keyPrivExp)];
}

function arrayBufferFromB64(stringInB64) {
    const binaryString = window.atob(stringInB64);
    const buf = new ArrayBuffer(binaryString.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < binaryString.length; i++) {
        bufView[i] = binaryString.charCodeAt(i);
    }
    return buf;
}

async function keyPairFromB64(publicKeyB64, privateKeyB64, keyType) {
    let usages, algorithm;

    switch (keyType) {
        case "sig":
            usages = { publicKey: ["verify"], privateKey: ["sign"] };
            algorithm = "RSA-PSS";
            break;

        case "encrypt":
            usages = { publicKey: ["encrypt"], privateKey: ["decrypt"] };
            algorithm = "RSA-OAEP";
            break;
    }

    const importedSigPubKey = await window.crypto.subtle.importKey(
        "spki",
        arrayBufferFromB64(publicKeyB64),
        {
            name: algorithm,
            hash: "SHA-256",
        },
        true,
        usages.publicKey
    );
    const importedSigPrivKey = await window.crypto.subtle.importKey(
        "pkcs8",
        arrayBufferFromB64(privateKeyB64),
        {
            name: algorithm,
            hash: "SHA-256",
        },
        true,
        usages.privateKey
    );

    return {
        publicKey: importedSigPubKey,
        privateKey: importedSigPrivKey,
    };
}

async function getKeyPairFromDB(keyType) {
    return new Promise((resolve, reject) => {
        const idb = window.indexedDB.open("harambe");

        idb.onerror = (event) => {
            console.log("Couldn't open IndexedDB");
            reject(`Couldn't access DB: ${event.target.errorcode}`);
        };

        idb.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([keyType], "readonly");
            const keyStore = transaction.objectStore(keyType);

            const keyRequest = keyStore.getAll();

            keyRequest.onerror = (event) => {
                reject(`Couldn't access keys: ${event.target.errorcode}`);
            };

            keyRequest.onsuccess = (event) => {
                const [privKeyB64, pubKeyB64] = event.target.result;
                const keyPair = keyPairFromB64(pubKeyB64, privKeyB64, keyType);

                resolve(keyPair);
            };
        };
    });
}

async function fileDataToABs(file) {
    const fileArray = await file.arrayBuffer();

    const encoder = new TextEncoder();
    const fileNameArray = encoder.encode(file.name);
    const fileTypeArray = encoder.encode(file.type);

    return [fileArray, fileNameArray, fileTypeArray];
}

async function encryptFile(key, counter, file) {
    const [fileAB, fileNameAB, fileTypeAB] = await fileDataToABs(file);

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

    return [encryptedFile, encryptedFileName, encryptedFileType];
}

async function decryptFile(
    key,
    counter,
    encryptedFile,
    encryptedFileName,
    encryptedFileType
) {
    const decryptedFile = await window.crypto.subtle.decrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        encryptedFile
    );
    const decryptedFileName = await window.crypto.subtle.decrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        encryptedFileName
    );
    const decryptedFileType = await window.crypto.subtle.decrypt(
        {
            name: "AES-CTR",
            counter,
            length: 64,
        },
        key,
        encryptedFileType
    );

    const decoder = new TextDecoder();
    const fileName = decoder.decode(decryptedFileName);
    const fileType = decoder.decode(decryptedFileType);

    const file = new File([decryptedFile], fileName, {
        type: fileType,
    });

    return file;
}
