let encryptKeyPair;
let sigKeyPair;

document.addEventListener('DOMContentLoaded', function () {
    addHiddenCopyButtons();
    addPasswordRequirements();

    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');

    togglePasswordBtn.addEventListener('click', () => {
        const type =
            passwordInput.getAttribute('type') === 'password'
                ? 'text'
                : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.textContent =
            type === 'password' ? 'Show Password' : 'Hide Password';
    });

    const qrButton = document.getElementById('qrButton');

    qrButton.addEventListener('click', () => {
        const otpSecret = otplib.authenticator.generateSecret();
        const username = document.getElementById('username').value;

        const otpSecretInput = document.getElementById('otpSecret');
        otpSecretInput.value = otpSecret;

        const otpauthURL = generateOTPAuthURL('Harambe', username, otpSecret);

        console.log(otpauthURL);
        renderQRCode(otpauthURL);
    });

    const form = document.getElementById('form');

    form.addEventListener('submit', async () => {
        const username = document.getElementById('username').value;
        const keyPassword = document.getElementById('keyPassword').value;
        console.log('Key password', keyPassword);
        savePrivKeysToDB(
            encryptKeyPair.privateKey,
            sigKeyPair.privateKey,
            username,
            keyPassword,
        );
    });
});

function addHiddenCopyButtons() {
    const copyButtons = document.getElementsByClassName('copy-button');

    for (let button of copyButtons) {
        // Remove 'copy-' from button's id so it aligns with the element containing the key
        const keyElementId = button.id.slice(5);
        button.addEventListener('click', function () {
            copyKey(keyElementId);
        });
    }
}

function addPasswordRequirements() {
    const passwordInput = document.getElementById('password');
    const requirementsList = document.getElementById('passwordRequirements');
    const submitBtn = document.getElementById('submit');

    passwordInput.addEventListener('blur', () => {
        const password = passwordInput.value;
        while (requirementsList.firstChild) {
            requirementsList.removeChild(requirementsList.firstChild);
        }

        const { valid, requirements } = checkPasswordRequirements(password);

        if (!valid) {
            submitBtn.setAttribute('disabled', "");
        } else {
            submitBtn.removeAttribute('disabled');
        }

        requirements.forEach((req) => {
            const li = document.createElement('li');
            li.textContent = req;
            requirementsList.appendChild(li);
        });
    });
}

function checkPasswordRequirements(password) {
    const minLength = 16;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
        password,
    );

    let requirements = [];

    if (password.length < minLength) {
        requirements.push(
            `Password should be at least ${minLength} characters long.`,
        );
    }
    if (!hasUpperCase) {
        requirements.push(
            'Password should contain at least one uppercase letter.',
        );
    }
    if (!hasLowerCase) {
        requirements.push(
            'Password should contain at least one lowercase letter.',
        );
    }
    if (!hasDigit) {
        requirements.push('Password should contain at least one digit.');
    }
    if (!hasSpecialChar) {
        requirements.push(
            'Password should contain at least one special character.',
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
    const copyButtons = document.getElementsByClassName('copy-button');
    for (button of copyButtons) {
        button.style.display = 'block';
    }
}

function copyKey(elementId) {
    var keyContent = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(keyContent);
    alert('Key copied to clipboard!');
}

async function generateKeypairs(username) {
    const modulusLength = 4096;

    encryptKeyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: modulusLength,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
    );

    sigKeyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-PSS',
            modulusLength: modulusLength,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['sign', 'verify'],
    );

    const [sigPubKeyB64, sigPrivKeyB64] = await keyPairToB64(sigKeyPair);
    const [encryptPubKeyB64, encryptPrivKeyB64] = await keyPairToB64(
        encryptKeyPair,
    );

    document.getElementById('pub-sig-key').textContent = sigPubKeyB64;
    document.getElementById('priv-sig-key').textContent = sigPrivKeyB64;
    document.getElementById('pub-encrypt-key').textContent = encryptPubKeyB64;
    document.getElementById('priv-encrypt-key').textContent = encryptPrivKeyB64;

    revealCopyButtons();
}

function renderQRCode(url) {
    const qrCodeContainer = document.getElementById('qrcode');
    qrCodeContainer.innerHTML = '';
    new QRCode('qrcode', url);
}

function generateOTPAuthURL(appName, username, secret) {
    return `otpauth://totp/${appName}:${username}?secret=${secret}`;
}
