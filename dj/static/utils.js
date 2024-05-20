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

async function sigKeyPairFromB64(publickKeyB64, privateKeyB64) {
    const importedSigPubKey = await window.crypto.subtle.importKey(
        "spki",
        ArrayBufferFromB64(publickKeyB64),
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        true,
        ["verify"]
    );
    const importedSigPrivKey = await window.crypto.subtle.importKey(
        "pkcs8",
        ArrayBufferFromB64(privateKeyB64),
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        true,
        ["sign"]
    );

    return {
        publicKey: importedSigPubKey,
        privateKey: importedSigPrivKey,
    };
}
