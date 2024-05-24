document.addEventListener("DOMContentLoaded", async () => {
    const fileLists = await getFileLists();
    const fileSelect = document.getElementById("file_select");
    const owned_files = fileLists.owned_files;

    for (let i = 0; i < owned_files.length; i++) {
        const option = document.createElement("option");
        option.value = owned_files[i].label;
        option.textContent = owned_files[i].label;
        fileSelect.appendChild(option);
    }

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
        const error = await fileKeyResponse.json();
        alert(`Something went wrong ${error.msg}`);
        return;
    }

    const fileKeyData = await fileKeyResponse.json();

    const fileKey = await decryptFileKey(fileKeyData["key"]);
    const counter = fileKeyData["counter"];
    const recipientPublicKey = await getPublicKey(recipentUsername, "encrypt");

    const encryptedFileKey = await encryptFileKey(fileKey, recipientPublicKey);

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
