document.addEventListener("DOMContentLoaded", function () {
    const copyButtons = document.getElementsByClassName("copy-button");

    for (let button of copyButtons) {
        // Remove 'copy-' from button's id so it aligns with the element containing the key
        const keyElementId = button.id.slice(5);
        button.addEventListener("click", function () {
            copyKey(keyElementId);
        });
    }
});

function revealCopyButtons() {
    const copyButtons = document.getElementsByClassName("copy-button");
    for (button of copyButtons) {
        button.style.display = "block";
    }
}

function copyKey(elementId) {
    var keyContent = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(keyContent);
    alert("Key copied to clipboard!");
}

function keyToB64(exportedKey) {
    const arrayOfKey = new Uint8Array(exportedKey);
    return window.btoa(String.fromCharCode(...arrayOfKey));
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

async function encryptText(text, key) {
    const enc = new TextEncoder();
    encodedText = enc.encode(text);
    return window.crypto.subtle.encrypt(
        {
            name: "RSA-OAEP",
        },
        key,
        encodedText
    );
}

async function decryptText(text, key) {}

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

async function keyPairFromB64() {}

var encryptKeyPair;
var sigKeyPair;

async function generateKeypairs() {
    encryptKeyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    sigKeyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-PSS",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"]
    );

    const [sigPubKeyB64, sigPrivKeyB64] = await keyPairToB64(sigKeyPair);
    const [encryptPubKeyB64, encryptPrivKeyB64] = await keyPairToB64(
        encryptKeyPair
    );

    document.getElementById("pub-sig-key").textContent = sigPubKeyB64;
    document.getElementById("priv-sig-key").textContent = sigPrivKeyB64;
    document.getElementById("pub-encrypt-key").textContent = encryptPubKeyB64;
    document.getElementById("priv-encrypt-key").textContent = encryptPrivKeyB64;

    const importedSigPubKey = await window.crypto.subtle.importKey(
        "spki",
        ArrayBufferFromB64(sigPubKeyB64),
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        true,
        ["verify"]
    );

    const exported2 = await window.crypto.subtle.exportKey(
        "spki",
        importedSigPubKey
    );

    console.log(sigPubKeyB64);
    console.log(keyToB64(exported2));

    saveToDB(encryptKeyPair, sigKeyPair);
    revealCopyButtons();
}

async function testEncrypt() {
    const [key64, _unused] = await keyPairToB64(encryptKeyPair);
    const ciphertext = await encryptText("Hello", encryptKeyPair.publicKey);
    const buf = new Uint8Array(ciphertext);
    const bString = String.fromCharCode(...buf);
    const b64 = window.btoa(bString);
    console.log("As binary string", window.atob(b64));
    console.log("To B64", b64);
    console.log("Back to binary string", window.atob(b64));
}

async function saveToDB(encryptKeyPair, sigKeyPair) {
    const [encryptPubKeyB64, encryptPrivKeyB64] = await keyPairToB64(
        encryptKeyPair
    );
    const [sigPubKeyB64, sigPrivKeyB64] = await keyPairToB64(sigKeyPair);

    const idb = window.indexedDB.open("harambe");

    idb.onerror = (event) => {
        console.log("Couldn't open IndexedDB");
    };

    idb.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("public-keys");
        db.createObjectStore("private-keys");
    };

    idb.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(
            ["public-keys", "private-keys"],
            "readwrite"
        );
        const pubKeys = transaction.objectStore("public-keys");
        const privKeys = transaction.objectStore("private-keys");

        pubKeys.put(encryptPubKeyB64, "encrypt");
        privKeys.put(encryptPrivKeyB64, "encrypt");

        privKeys.put(sigPrivKeyB64, "sig");
        pubKeys.put(sigPubKeyB64, "sig");
    };
}

async function getKeyPairsFromDB() {
    const idb = window.indexedDB.open("harambe");

    idb.onerror = (event) => {
        console.log("Couldn't open IndexedDB");
    };

    idb.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(
            ["public-keys", "private-keys"],
            "readonly"
        );
    };
}
