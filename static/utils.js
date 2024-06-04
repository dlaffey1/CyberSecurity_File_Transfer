// Function to convert an ArrayBuffer to a Base64 string
function ABToB64(arrayBuffer) {
    let fullString = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 8192; // Process data in chunks to avoid stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        fullString += String.fromCharCode.apply(null, chunk);
    }
    return window.btoa(fullString);
}

// Function to convert a Base64 string to an ArrayBuffer
function B64ToAB(stringInB64) {
    const binaryString = window.atob(stringInB64);
    const buf = new ArrayBuffer(binaryString.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < binaryString.length; i++) {
        bufView[i] = binaryString.charCodeAt(i);
    }
    return buf;
}

// Function to convert a key pair to Base64 strings
async function keyPairToB64(keyPair) {
    const keyPubExp = await window.crypto.subtle.exportKey(
        'spki',
        keyPair.publicKey,
    );

    const keyPrivExp = await window.crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
    );

    return [ABToB64(keyPubExp), ABToB64(keyPrivExp)];
}

// Function to convert Base64 strings to a key pair
async function keyPairFromB64(publicKeyB64, privateKeyB64, keyType) {
    let usages, algorithm;

    switch (keyType) {
        case 'sig':
            usages = { publicKey: ['verify'], privateKey: ['sign'] };
            algorithm = 'RSA-PSS';
            break;

        case 'encrypt':
            usages = { publicKey: ['encrypt'], privateKey: ['decrypt'] };
            algorithm = 'RSA-OAEP';
            break;
    }

    const importedSigPubKey = await window.crypto.subtle.importKey(
        'spki',
        B64ToAB(publicKeyB64),
        {
            name: algorithm,
            hash: 'SHA-256',
        },
        true,
        usages.publicKey,
    );
    const importedSigPrivKey = await window.crypto.subtle.importKey(
        'pkcs8',
        B64ToAB(privateKeyB64),
        {
            name: algorithm,
            hash: 'SHA-256',
        },
        true,
        usages.privateKey,
    );

    return {
        publicKey: importedSigPubKey,
        privateKey: importedSigPrivKey,
    };
}

// Function to save private keys to IndexedDB
async function savePrivKeysToDB(
    encryptPrivKey,
    sigPrivKey,
    username,
    password,
) {
    const encryptKeySalt = window.crypto.getRandomValues(new Uint8Array(16));
    const encryptCounter = window.crypto.getRandomValues(new Uint8Array(16));
    const wrappedEncryptPrivKey = await wrapPrivateKey(
        encryptPrivKey,
        password,
        encryptKeySalt,
        encryptCounter,
    );

    const sigKeySalt = window.crypto.getRandomValues(new Uint8Array(16));
    const sigCounter = window.crypto.getRandomValues(new Uint8Array(16));
    const wrappedSigPrivKey = await wrapPrivateKey(
        sigPrivKey,
        password,
        sigKeySalt,
        sigCounter,
    );

    const db_name = 'harambe|' + username;
    const idb = window.indexedDB.open(db_name);

    idb.onerror = (event) => {
        console.log("Couldn't open IndexedDB");
    };

    idb.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore('encrypt');
        db.createObjectStore('sig');
    };

    idb.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['encrypt', 'sig'], 'readwrite');
        const encryptPrivKey = transaction.objectStore('encrypt');
        const sigPrivKey = transaction.objectStore('sig');

        encryptPrivKey.put(wrappedEncryptPrivKey, 'key');
        encryptPrivKey.put(encryptKeySalt, 'keySalt');
        encryptPrivKey.put(encryptCounter, 'counter');

        sigPrivKey.put(wrappedSigPrivKey, 'key');
        sigPrivKey.put(sigKeySalt, 'keySalt');
        sigPrivKey.put(sigCounter, 'counter');
    };
}

// Function to get private key from IndexedDB
async function getPrivKeyFromDB(keyType, password) {
    const currentUser = await getCurrentUsername();
    if (currentUser === null) {
        throw new Error("Can't open db with null username");
    }

    return new Promise((resolve, reject) => {
        const dbName = 'harambe|' + currentUser;
        const idb = window.indexedDB.open(dbName);

        idb.onerror = (event) => {
            console.log("Couldn't open IndexedDB");
            reject(`Couldn't access DB: ${event.target.errorcode}`);
        };

        idb.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([keyType], 'readonly');
            const keyStore = transaction.objectStore(keyType);

            const keyRequest = keyStore.get('key');
            const saltRequest = keyStore.get('keySalt');
            const counterRequest = keyStore.get('counter');

            Promise.all(
                [keyRequest, saltRequest, counterRequest].map((request) => {
                    return new Promise((resolve, reject) => {
                        request.onerror = (event) =>
                            reject(
                                `Couldn't access keys: ${event.target.errorCode}`,
                            );

                        request.onsuccess = (event) => {
                            resolve(event.target.result);
                        };
                    });
                }),
            )
                .then(([wrappedPrivKey, keySalt, counter]) => {
                    unwrapPrivateKey(
                        wrappedPrivKey,
                        password,
                        keySalt,
                        counter,
                        keyType,
                    )
                        .then((unwrappedPrivKey) => resolve(unwrappedPrivKey))
                        .catch((error) => reject(error));
                })
                .catch((error) => {
                    reject(error);
                });
        };
    });
}

// Function to wrap a private key
async function wrapPrivateKey(privateKey, password, keySalt, counter) {
    const wrappingKey = await passwordToWrappingKey(password, keySalt);

    const encryptedPrivateKey = await window.crypto.subtle.wrapKey(
        'pkcs8',
        privateKey,
        wrappingKey,
        {
            name: 'AES-CTR',
            counter: counter,
            length: 64,
        },
    );
    return encryptedPrivateKey;
}

// Function to unwrap a private key
async function unwrapPrivateKey(
    encryptedPrivateKey,
    password,
    keySalt,
    counter,
    keyType,
) {
    let usages, algorithm;

    switch (keyType) {
        case 'sig':
            usages = ['sign'];
            algorithm = 'RSA-PSS';
            break;

        case 'encrypt':
            usages = ['decrypt'];
            algorithm = 'RSA-OAEP';
            break;
    }

    const wrappingKey = await passwordToWrappingKey(password, keySalt);
    const privateKey = await window.crypto.subtle.unwrapKey(
        'pkcs8',
        encryptedPrivateKey,
        wrappingKey,
        {
            name: 'AES-CTR',
            counter: counter,
            length: 64,
        },
        {
            name: algorithm,
            hash: 'SHA-256',
        },
        true,
        usages,
    );
    return privateKey;
}

// Function to derive a wrapping key from a password
async function passwordToWrappingKey(password, keySalt) {
    const encoder = new TextEncoder();
    const passcodeAB = encoder.encode(password);

    // NOTE: Very much not a key, this is just used to generate the key
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        passcodeAB,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey'],
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: keySalt,
            iterations: 100_000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-CTR', length: 256 },
        true,
        ['wrapKey', 'unwrapKey'],
    );
    return wrappingKey;
}

// Function to convert file data to ArrayBuffers
async function fileDataToABs(file) {
    const fileArray = await file.arrayBuffer();

    const encoder = new TextEncoder();
    const fileNameArray = encoder.encode(file.name);
    const fileTypeArray = encoder.encode(file.type);

    return [fileArray, fileNameArray, fileTypeArray];
}

// Function to encrypt file data
async function encryptFileData(key, counter, file) {
    const [fileAB, fileNameAB, fileTypeAB] = await fileDataToABs(file);

    const encrypt = async (data) => {
        return await window.crypto.subtle.encrypt(
            {
                name: 'AES-CTR',
                counter,
                length: 64,
            },
            key,
            data,
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

// Function to decrypt file data
async function decryptFileData(key, counter, encryptedFileData) {
    const decrypt = async (data) => {
        return await window.crypto.subtle.decrypt(
            {
                name: 'AES-CTR',
                counter,
                length: 64,
            },
            key,
            data,
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

// Function to encrypt a file key using RSA-OAEP
async function encryptFileKey(fileKey, publicKey) {
    const fileKeyAB = await window.crypto.subtle.exportKey('raw', fileKey);
    return await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        fileKeyAB,
    );
}

// Function to decrypt a file key using RSA-OAEP
async function decryptFileKey(encryptedFileKey, privateKey) {
    const fileKeyAB = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedFileKey,
    );
    return await window.crypto.subtle.importKey(
        'raw',
        fileKeyAB,
        'AES-CTR',
        true,
        ['encrypt', 'decrypt'],
    );
}

// Function to get the current username
async function getCurrentUsername() {
    const response = await fetch(`${URL_PREFIX}/currentUser`);
    const obj = await response.json();
    return obj.username;
}

// Function to get file lists
async function getFileLists() {
    const file_lists = await fetch(`${URL_PREFIX}/files`);
    return await file_lists.json();
}

// Function to get the public key for a given username and key type
async function getPublicKey(username, keyType) {
    const publicKeyResponse = await (
        await fetch(`${URL_PREFIX}/getPublicKey/${keyType}/${username}`)
    ).json();
    const publicKeyB64 = publicKeyResponse['key'];

    let name, usages;
    if (keyType == 'encrypt') {
        name = 'RSA-OAEP';
        usages = ['encrypt'];
    } else if (keyType == 'sig') {
        name = 'RSA-PSS';
        usages = ['verify'];
    } else {
        throw new Error('Key type is invalid');
    }

    return await window.crypto.subtle.importKey(
        'spki',
        B64ToAB(publicKeyB64),
        {
            name: name,
            hash: 'SHA-256',
        },
        true,
        usages,
    );
}

// Function to sign an encrypted file
async function signEncryptedFile(encryptedFile, sigPrivKey) {
    return await window.crypto.subtle.sign(
        { name: 'RSA-PSS', saltLength: 32 },
        sigPrivKey,
        encryptedFile,
    );
}

// Function to verify the signature of an encrypted file
async function verifyEncryptedFile(encryptedFile, signature, publicKey) {
    return await window.crypto.subtle.verify(
        { name: 'RSA-PSS', saltLength: 32 },
        publicKey,
        signature,
        encryptedFile,
    );
}

function togglePasswordVis(passwordInput) {
    const type =
        passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
}
