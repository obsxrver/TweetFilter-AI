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

const MAX_MODEL_IMAGE_PIXELS = 700_000;

/** Caps image area without upscaling; accepts an uploaded file or a data URL. */
async function resizeImage(input, maxPixels = MAX_MODEL_IMAGE_PIXELS) {
    const dataUrl = typeof input === 'string' ? input : await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(input);
    });
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error('Could not decode image.'));
        image.onload = () => {
            try {
                const { naturalWidth: width, naturalHeight: height } = image;
                if (!width || !height) throw new Error('Image has no dimensions.');
                if (width * height <= maxPixels) return resolve(dataUrl);
                const scale = Math.sqrt(maxPixels / (width * height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.min(maxPixels, Math.max(1, Math.floor(width * scale)));
                canvas.height = Math.max(1, Math.min(Math.floor(height * scale), Math.floor(maxPixels / canvas.width)));
                const context = canvas.getContext('2d');
                context.imageSmoothingQuality = 'high';
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL(dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', 0.9));
            } catch (error) { reject(error); }
        };
        image.src = dataUrl;
    });
}
