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

async function saveKeyPairsToDB(
    encryptKeyPair,
    sigKeyPair,
    username,
    passcode
) {
    const [encryptPubKeyB64, encryptPrivKeyB64] = await keyPairToB64(
        encryptKeyPair
    );
    const [sigPubKeyB64, sigPrivKeyB64] = await keyPairToB64(sigKeyPair);

    const db_name = "harambe|" + username;
    const idb = window.indexedDB.open(db_name);

    idb.onerror = (event) => {
        console.log("Couldn't open IndexedDB");
    };

    idb.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("encrypt");
        db.createObjectStore("sig");
    };

    idb.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["encrypt", "sig"], "readwrite");
        const encryptKeyPair = transaction.objectStore("encrypt");
        const sigKeyPair = transaction.objectStore("sig");

        encryptKeyPair.put(encryptPubKeyB64, "public");
        encryptKeyPair.put(encryptPrivKeyB64, "private");

        sigKeyPair.put(sigPubKeyB64, "public");
        sigKeyPair.put(sigPrivKeyB64, "private");
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

async function passwordToWrappingKey(password, keySalt) {
    const encoder = new TextEncoder();
    const passcodeAB = encoder.encode(password);

    // NOTE: Very much not a key, this is just used to generate the key
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        passcodeAB,
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: keySalt,
            iterations: 100_000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-CTR", length: 256 },
        true,
        ["wrapKey", "unwrapKey"]
    );
    return wrappingKey;
}

async function encryptPrivateKey(privateKey, password, keySalt, counter) {
    const wrappingKey = await passwordToWrappingKey(password, keySalt);

    const encryptedPrivateKey = await window.crypto.subtle.wrapKey(
        "pkcs8",
        privateKey,
        wrappingKey,
        {
            name: "AES-CTR",
            counter: counter,
            length: 64,
        }
    );
    return encryptedPrivateKey;
}

async function decryptPrivateKey(
    encryptedPrivateKey,
    password,
    keySalt,
    counter,
    keyType
) {
    let usage, algorithm;

    switch (keyType) {
        case "sig":
            usage = ["sign"];
            algorithm = "RSA-PSS";
            break;

        case "encrypt":
            usage = ["decrypt"];
            algorithm = "RSA-OAEP";
            break;
    }

    const wrappingKey = await passwordToWrappingKey(password, keySalt);

    const privateKey = await window.crypto.subtle.unwrapKey(
        "pkcs8",
        encryptedPrivateKey,
        wrappingKey,
        {
            name: "AES-CTR",
            counter: counter,
            length: 64,
        },
        {
            name: algorithm,
            hash: "SHA-256",
        },
        true,
        usage
    );
    return privateKey;
}

async function testPKEncryption() {
    const keypair = await getKeyPairFromDB("encrypt");
    const password = "1234";
    const keySalt = window.crypto.getRandomValues(new Uint8Array(16));
    const counter = window.crypto.getRandomValues(new Uint8Array(16));

    const originalPKAB = await window.crypto.subtle.exportKey("pkcs8", keypair.privateKey);
    const originalPKB64 = ABToB64(originalPKAB);

    const encryptedPKAB = await encryptPrivateKey(keypair.privateKey, password, keySalt, counter);
    const encryptedPKB64 = ABToB64(encryptedPKAB);

    const decryptedPK = await decryptPrivateKey(encryptedPKAB, password, keySalt, counter, "encrypt");
    const decryptedPKAB = await window.crypto.subtle.exportKey("pkcs8", decryptedPK);
    const decryptedPKB64 = ABToB64(decryptedPKAB);

    console.log("Original Key:");
    console.log(originalPKB64);
    console.log("Encrypted Key:");
    console.log(encryptedPKB64);
    console.log("Decrypted Key:");
    console.log(decryptedPKB64);
    console.log("Matching?");
    console.log(originalPKB64 === decryptedPKB64);
}

testPKEncryption();

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

async function decryptFileKey(encryptedFileKey, privateKey) {
    const fileKeyAB = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
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
    const response = await fetch(`${URL_PREFIX}/currentUser`);
    const obj = await response.json();
    return obj.username;
}

async function getFileLists() {
    const file_lists = await fetch(`${URL_PREFIX}/files`);
    return await file_lists.json();
}

async function getPublicKey(username, keyType) {
    const publicKeyResponse = await (
        await fetch(`${URL_PREFIX}/getPublicKey/${keyType}/${username}`)
    ).json();
    const publicKeyB64 = publicKeyResponse["key"];

    let name, usages;
    if (keyType == "encrypt") {
        name = "RSA-OAEP";
        usages = ["encrypt"];
    } else if (keyType == "sig") {
        name = "RSA-PSS";
        usages = ["verify"];
    } else {
        throw new Error("Key type is invalid");
    }

    return await window.crypto.subtle.importKey(
        "spki",
        B64ToAB(publicKeyB64),
        {
            name: name,
            hash: "SHA-256",
        },
        true,
        usages
    );
}
