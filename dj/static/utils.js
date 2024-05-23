function hello() {
    console.log("Hello World!");
}

function ABToB64(arrayBuffer) {
    let fullString = "";
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 8192; // Process data in chunks to avoid stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        fullString += String.fromCharCode.apply(null, chunk);
    }
    return window.btoa(fullString);
}

function B64ToAB(stringInB64) {
    const binaryString = window.atob(stringInB64);
    const buf = new ArrayBuffer(binaryString.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < binaryString.length; i++) {
        bufView[i] = binaryString.charCodeAt(i);
    }
    return buf;
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

    return [ABToB64(keyPubExp), ABToB64(keyPrivExp)];
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
        B64ToAB(publicKeyB64),
        {
            name: algorithm,
            hash: "SHA-256",
        },
        true,
        usages.publicKey
    );
    const importedSigPrivKey = await window.crypto.subtle.importKey(
        "pkcs8",
        B64ToAB(privateKeyB64),
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
    const currentUser = await getCurrentUsername();

    return new Promise((resolve, reject) => {
        const dbName = "harambe|" + currentUser;
        const idb = window.indexedDB.open(dbName);

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

async function encryptFileData(key, counter, file) {
    const [fileAB, fileNameAB, fileTypeAB] = await fileDataToABs(file);

    const encrypt = async (data) => {
        return await window.crypto.subtle.encrypt(
            {
                name: "AES-CTR",
                counter,
                length: 64,
            },
            key,
            data
        );
    };

    const encryptedFile = await encrypt(fileAB);
    const encryptedFileName = await encrypt(fileNameAB);
    const encryptedFileType = await encrypt(fileTypeAB);

    return {
        file: encryptedFile,
        name: encryptedFileName,
        type: encryptedFileType,
    };
}

async function decryptFileData(key, counter, encryptedFileData) {
    const decrypt = async (data) => {
        return await window.crypto.subtle.decrypt(
            {
                name: "AES-CTR",
                counter,
                length: 64,
            },
            key,
            data
        );
    };

    const decryptedFile = await decrypt(encryptedFileData.file);
    const decryptedFileName = await decrypt(encryptedFileData.name);
    const decryptedFileType = await decrypt(encryptedFileData.type);

    const decoder = new TextDecoder();
    const fileName = decoder.decode(decryptedFileName);
    const fileType = decoder.decode(decryptedFileType);

    const file = new File([decryptedFile], fileName, {
        type: fileType,
    });

    return file;
}

async function encryptFileKey(fileKey, publicKey) {
    const fileKeyAB = await window.crypto.subtle.exportKey("raw", fileKey);
    return await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        fileKeyAB
    );
}

async function decryptFileKey(encryptedFileKey) {
    const encryptKeyPair = await getKeyPairFromDB("encrypt");

    const fileKeyAB = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        encryptKeyPair.privateKey,
        encryptedFileKey
    );
    return await window.crypto.subtle.importKey(
        "raw",
        fileKeyAB,
        "AES-CTR",
        true,
        ["encrypt", "decrypt"]
    );
}

async function getCurrentUsername() {
    const response = await fetch("/currentUser");
    const obj = await response.json();
    return obj.username;
}

async function getFileLists() {
    const file_lists = await fetch("/files");
    return await file_lists.json();
}
}
