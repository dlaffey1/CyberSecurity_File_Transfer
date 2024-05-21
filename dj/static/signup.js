document.addEventListener("DOMContentLoaded", function () {
    const copyButtons = document.getElementsByClassName("copy-button");

    for (let button of copyButtons) {
        // Remove 'copy-' from button's id so it aligns with the element containing the key
        const keyElementId = button.id.slice(5);
        button.addEventListener("click", function () {
            copyKey(keyElementId);
        });
    }

    const passwordInput = document.getElementById("password");
    const requirementsList = document.getElementById("passwordRequirements");
    const togglePasswordBtn = document.getElementById("togglePassword");
    const submitBtn = document.getElementById("submit");

    passwordInput.addEventListener("blur", () => {
        const password = passwordInput.value;
        while (requirementsList.firstChild) {
            requirementsList.removeChild(requirementsList.firstChild);
        }

        const { valid, requirements } = checkPasswordRequirements(password);

        if (!valid) {
            submitBtn.setAttribute("disabled", true);
        }

        requirements.forEach((req) => {
            const li = document.createElement("li");
            li.textContent = req;
            requirementsList.appendChild(li);
        });
    });

    togglePasswordBtn.addEventListener("click", function () {
        const type =
            passwordInput.getAttribute("type") === "password"
                ? "text"
                : "password";
        passwordInput.setAttribute("type", type);
        togglePasswordBtn.textContent =
            type === "password" ? "Show Password" : "Hide Password";
    });
});

function checkPasswordRequirements(password) {
    const minLength = 16;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
        password
    );

    let requirements = [];

    if (password.length < minLength) {
        requirements.push(
            `Password should be at least ${minLength} characters long.`
        );
    }
    if (!hasUpperCase) {
        requirements.push(
            "Password should contain at least one uppercase letter."
        );
    }
    if (!hasLowerCase) {
        requirements.push(
            "Password should contain at least one lowercase letter."
        );
    }
    if (!hasDigit) {
        requirements.push("Password should contain at least one digit.");
    }
    if (!hasSpecialChar) {
        requirements.push(
            "Password should contain at least one special character."
        );
    }

    return {
        valid:
            password.length >= minLength &&
            hasUpperCase &&
            hasLowerCase &&
            hasDigit &&
            hasSpecialChar,
        requirements: requirements,
    };
}

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

async function generateKeypairs() {
    const modulusLength = 4096;

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
        const transaction = db.transaction(["encrypt", "sig"], "readwrite");
        const encryptKeyPair = transaction.objectStore("encrypt");
        const sigKeyPair = transaction.objectStore("sig");

        encryptKeyPair.put(encryptPubKeyB64, "public");
        encryptKeyPair.put(encryptPrivKeyB64, "private");

        sigKeyPair.put(sigPubKeyB64, "public");
        sigKeyPair.put(sigPrivKeyB64, "private");
    };
}
