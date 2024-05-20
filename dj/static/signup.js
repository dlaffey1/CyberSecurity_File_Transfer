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

async function keyPairFromB64() {}

async function generateKeypairs() {
    const modulusLength = 2048;

    const encryptKeyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: modulusLength,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    const sigKeyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-PSS",
            modulusLength: modulusLength,
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

    const importedSigKeyPair = await sigKeyPairFromB64(sigPubKeyB64, sigPrivKeyB64);

    const [sigPubKey2, sigPrivKey2] = await keyPairToB64(importedSigKeyPair);

    saveToDB(encryptKeyPair, sigKeyPair);
    revealCopyButtons();
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
        db.createObjectStore("encrypt");
        db.createObjectStore("sig");
    };

    idb.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(
            ["encrypt", "sig"],
            "readwrite"
        );
        const encryptKeyPair = transaction.objectStore("encrypt");
        const sigKeyPair = transaction.objectStore("sig");

        encryptKeyPair.put(encryptPubKeyB64, "public");
        encryptKeyPair.put(encryptPrivKeyB64, "private");

        sigKeyPair.put(sigPubKeyB64, "public");
        sigKeyPair.put(sigPrivKeyB64, "private");
    };
}
