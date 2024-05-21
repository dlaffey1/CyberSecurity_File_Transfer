document.addEventListener("DOMContentLoaded", async () => {
    const fileLabels = await getCurrentUserFileLabels();
    const fileSelect = document.getElementById("file_select");

    fileLabels.forEach(label => {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        fileSelect.appendChild(option);
    });
});
