/**
 * Detects if the user is on a mobile device
 * @returns {boolean} true if mobile device detected
 */
function isMobileDevice() {

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
/**
 * Displays a temporary status message on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type=\'info\'] - The type of message (info, error, warning, success).
 */
function showStatus(message, type = 'info') {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) {
        console.error('#status-indicator element not found.');
        return;
    }
    indicator.textContent = message;
    indicator.className = 'active ' + type;
    setTimeout(() => { indicator.classList.remove('active', type); }, 3000);
}

/**
 * Resizes an image file to a maximum dimension.
 * @param {File} file - The image file to resize.
 * @param {number} maxDimPx - The maximum dimension (width or height) in pixels.
 * @returns {Promise<string>} A promise that resolves with the data URL of the resized image (JPEG format).
 */
function resizeImage(file, maxDimPx) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                let newWidth, newHeight;

                if (width > height) {
                    if (width > maxDimPx) {
                        newWidth = maxDimPx;
                        newHeight = height * (maxDimPx / width);
                    } else {
                        newWidth = width;
                        newHeight = height;
                    }
                } else {
                    if (height > maxDimPx) {
                        newHeight = maxDimPx;
                        newWidth = width * (maxDimPx / height);
                    } else {
                        newWidth = width;
                        newHeight = height;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
            };
            img.onerror = (error) => {
                console.error("Error loading image for resizing:", error);
                reject(new Error("Could not load image for resizing."));
            };
            img.src = event.target.result;
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject(new Error("Could not read file."));
        };
        reader.readAsDataURL(file);
    });
}