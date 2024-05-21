document.addEventListener("DOMContentLoaded", async () => {
    const fileLabels = await fetch("/files");
    const result = await fileLabels.json();
    const options = result.file_labels;

    const selectElement = document.getElementById("my_files");

    for (let i = 0; i < options.length; i++) {
        const option = document.createElement("option");
        option.value = options[i];
        option.textContent = options[i];
        selectElement.appendChild(option);
    }

    const form = document.getElementById("form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        downloadAndDecryptFile(selectElement.value);
    });
});

async function downloadAndDecryptFile(fileLabel) {
    const response = await fetch("/downloadFile/" + fileLabel);
    const request = await response.json();
    console.log(request);
}
