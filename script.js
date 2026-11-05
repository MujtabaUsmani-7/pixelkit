
const fileInput = document.getElementById('file-input');
const dropArea = document.getElementById('drop-area');
const editor = document.getElementById('editor');
const fileThumb = document.getElementById('file-thumb');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const quality = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const compressSettings = document.getElementById('compress-settings');
const resizeSettings = document.getElementById('resize-settings');
const processButton = document.getElementById('process-button');
const result = document.getElementById('result');

let selectedFile = null;
let currentMode = 'compress';
let imageObject = null;
let currentObjectUrl = null;

document.getElementById('year').textContent = new Date().getFullYear();

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function setMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    compressSettings.classList.toggle('hidden', mode !== 'compress');
    resizeSettings.classList.toggle('hidden', mode !== 'resize');

    processButton.innerHTML = mode === 'compress'
        ? 'Compress image <span>→</span>'
        : 'Resize image <span>→</span>';

    result.classList.add('hidden');
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

document.querySelectorAll('[data-tool]').forEach(button => {
    button.addEventListener('click', () => {
        setMode(button.dataset.tool);
        document.getElementById('workspace')
            .scrollIntoView({ behavior: 'smooth' });
    });
});

quality.addEventListener('input', () => {
    qualityValue.textContent = quality.value + '%';
});

function loadFile(file) {
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Please choose a JPG, PNG, or WebP image.');
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        alert('Please choose an image smaller than 20 MB.');
        return;
    }

    selectedFile = file;

    const url = URL.createObjectURL(file);
    imageObject = new Image();

    imageObject.onload = () => {
        document.getElementById('width').value =
            imageObject.naturalWidth;

        document.getElementById('height').value =
            imageObject.naturalHeight;

        fileThumb.style.backgroundImage = `url("${url}")`;
        fileName.textContent = file.name;

        fileSize.textContent =
            `${formatBytes(file.size)} · ${imageObject.naturalWidth} × ${imageObject.naturalHeight}px`;

        dropArea.classList.add('hidden');
        editor.classList.remove('hidden');
        result.classList.add('hidden');
    };

    imageObject.onerror = () => {
        alert('Could not open this image. Try another file.');
    };

    imageObject.src = url;
}

fileInput.addEventListener('change', event => {
    loadFile(event.target.files[0]);
});

['dragenter', 'dragover'].forEach(type => {
    dropArea.addEventListener(type, event => {
        event.preventDefault();
        dropArea.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach(type => {
    dropArea.addEventListener(type, event => {
        event.preventDefault();
        dropArea.classList.remove('dragover');
    });
});

dropArea.addEventListener('drop', event => {
    loadFile(event.dataTransfer.files[0]);
});

document.getElementById('remove-file').addEventListener('click', () => {
    selectedFile = null;
    imageObject = null;
    fileInput.value = '';

    editor.classList.add('hidden');
    dropArea.classList.remove('hidden');
    result.classList.add('hidden');

    fileThumb.style.backgroundImage = '';

    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
});

document.getElementById('keep-ratio').addEventListener('change', event => {
    if (!imageObject || !event.target.checked) return;

    const width = Number(document.getElementById('width').value);

    document.getElementById('height').value = Math.round(
        width * imageObject.naturalHeight / imageObject.naturalWidth
    );
});

document.getElementById('width').addEventListener('input', () => {
    if (!imageObject ||
        !document.getElementById('keep-ratio').checked) return;

    const width = Number(document.getElementById('width').value);

    document.getElementById('height').value = width > 0
        ? Math.round(width * imageObject.naturalHeight / imageObject.naturalWidth)
        : '';
});

function canvasToBlob(canvas, type, qualityValue) {
    return new Promise(resolve => {
        canvas.toBlob(resolve, type, qualityValue);
    });
}

processButton.addEventListener('click', async () => {
    if (!selectedFile || !imageObject) return;

    let width = imageObject.naturalWidth;
    let height = imageObject.naturalHeight;

    if (currentMode === 'resize') {
        width = Number(document.getElementById('width').value);
        height = Number(document.getElementById('height').value);

        if (!Number.isInteger(width) ||
            !Number.isInteger(height) ||
            width < 1 || height < 1 ||
            width > 10000 || height > 10000) {
            alert('Enter valid dimensions between 1 and 10,000 pixels.');
            return;
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.drawImage(imageObject, 0, 0, width, height);

    processButton.disabled = true;
    processButton.textContent =
        currentMode === 'compress' ? 'Compressing...' : 'Resizing...';

    try {
        let outputBlob;
        let outputName;
        let message;
        let downloadLabel;

        if (currentMode === 'compress') {

            // Export as WebP for better compression.
            outputBlob = await canvasToBlob(
                canvas,
                'image/webp',
                Number(quality.value) / 100
            );

            if (!outputBlob || outputBlob.type !== 'image/webp') {
                throw new Error('WebP export is not supported by this browser.');
            }

            // Never claim compression if the file becomes larger.
            if (outputBlob.size >= selectedFile.size) {

                outputBlob = selectedFile;
                outputName = selectedFile.name;

                message =
                    `Original image (${formatBytes(selectedFile.size)}) is already smaller. We kept the original instead of offering a larger file.`;

                downloadLabel = 'Download original image ↓';

            } else {

                outputName =
                    selectedFile.name.replace(/\.[^.]+$/, '') +
                    '-compressed.webp';

                const saved = Math.round(
                    (1 - outputBlob.size / selectedFile.size) * 100
                );

                message =
                    `Success! ${formatBytes(selectedFile.size)} → ${formatBytes(outputBlob.size)}. ${saved}% smaller.`;

                downloadLabel = 'Download compressed WebP ↓';
            }

        } else {

            const type = selectedFile.type === 'image/png'
                ? 'image/png'
                : 'image/jpeg';

            outputBlob = await canvasToBlob(canvas, type, 0.92);

            if (!outputBlob) {
                throw new Error('Could not create the resized image.');
            }

            outputName =
                selectedFile.name.replace(/\.[^.]+$/, '') +
                (type === 'image/png' ? '-resized.png' : '-resized.jpg');

            message =
                `Resized image: ${width} × ${height}px. Output size: ${formatBytes(outputBlob.size)}.`;

            downloadLabel = 'Download resized image ↓';
        }

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
        }

        currentObjectUrl = URL.createObjectURL(outputBlob);

        result.classList.remove('hidden');
        result.textContent = '';

        const messageNode = document.createElement('div');
        messageNode.textContent = message;

        const downloadLink = document.createElement('a');
        downloadLink.href = currentObjectUrl;
        downloadLink.download = outputName;
        downloadLink.textContent = downloadLabel;

        result.appendChild(messageNode);
        result.appendChild(downloadLink);

    } catch (error) {
        alert(error.message || 'Image processing failed.');
    } finally {
        processButton.disabled = false;

        processButton.innerHTML =
            currentMode === 'compress'
                ? 'Compress image <span>→</span>'
                : 'Resize image <span>→</span>';
    }
});
