document.addEventListener("DOMContentLoaded", async () => {
    const fileLabels = await getCurrentUserFileLabels();
    const fileSelect = document.getElementById("file_select");

    fileLabels.forEach((label) => {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        fileSelect.appendChild(option);
    });

    const form = document.getElementById("form");
    form.addEventListener("submit", handleSubmit);
});

async function handleSubmit(event) {
    event.preventDefault();
    const form = document.getElementById("form");

    const recipentUsername =
        document.getElementById("recipient_username").value;
    const fileLabel = document.getElementById("file_select").value;

    const fileKeyResponse = await fetch(`/getMyFileKey/${fileLabel}`);

    if (!fileKeyResponse.ok) {
        alert("Something went wrong");
    }

    const fileKeyData = await fileKeyResponse.json();

    const fileKey = await decryptFileKey(fileKeyData["key"]);
    const counter = fileKeyData["counter"];

    const publicKeyResponse = await (
        await fetch(`/getPublicKey/encrypt/${recipentUsername}`)
    ).json();
    const publicKeyB64 = publicKeyResponse["key"];

    const publicKey = await window.crypto.subtle.importKey(
        "spki",
        B64ToAB(publicKeyB64),
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["encrypt"]
    );

    const encryptedFileKey = await encryptFileKey(fileKey, publicKey);

    const response = await fetch("/shareFileKey", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            recipient_username: recipentUsername,
            file_label: fileLabel,
            encrypted_key: ABToB64(encryptedFileKey),
            counter: counter,
        }),
    });

    if (response.ok) {
        alert(`File ${fileLabel} shared with ${recipentUsername} successfully`);
        form.reset();
    } else {
        const errorData = await response.json();
        console.log(response);
        alert(`Error: ${errorData.description}`);
    }
}
