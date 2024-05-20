function hello() {
    console.log("Hello World!");
}

function keyToB64(exportedKey) {
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

    return [keyToB64(keyPubExp), keyToB64(keyPrivExp)];
}

function ArrayBufferFromB64(keyInB64) {
    const binaryString = window.atob(keyInB64);
    const buf = new ArrayBuffer(binaryString.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < binaryString.length; i++) {
        bufView[i] = binaryString.charCodeAt(i);
    }
    return buf;
}

async function keyPairFromB64(algorithm, publicKeyB64, privateKeyB64, usages) {
    const importedSigPubKey = await window.crypto.subtle.importKey(
        "spki",
        ArrayBufferFromB64(publicKeyB64),
        {
            name: algorithm,
            hash: "SHA-256",
        },
        true,
        usages.publicKey
    );
    const importedSigPrivKey = await window.crypto.subtle.importKey(
        "pkcs8",
        ArrayBufferFromB64(privateKeyB64),
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

async function sigKeyPairFromB64(publicKeyB64, privateKeyB64) {
    const keyUsages = { publicKey: ["verify"], privateKey: ["sign"] };
    return await keyPairFromB64(
        "RSA-PSS",
        publicKeyB64,
        privateKeyB64,
        keyUsages
    );
}

async function encryptKeyPairFromB64(publicKeyB64, privateKeyB64) {
    const keyUsages = { publicKey: ["encrypt"], privateKey: ["decrypt"] };
    return await keyPairFromB64(
        "RSA-OAEP",
        publicKeyB64,
        privateKeyB64,
        keyUsages
    );
}

async function getKeyPairsFromDB(keyType) {
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
                const keyPair = encryptKeyPairFromB64(pubKeyB64, privKeyB64);

                resolve(keyPair);
            };
        };
    });
}
