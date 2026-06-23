// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const uploadSection = document.getElementById('uploadSection');
const editorSection = document.getElementById('editorSection');
const originalImage = document.getElementById('originalImage');
const resultImage = document.getElementById('resultImage');
const resultWrapper = document.getElementById('resultWrapper');
const loadingSpinner = document.getElementById('loadingSpinner');
const newImageBtn = document.getElementById('newImageBtn');
const downloadBtn = document.getElementById('downloadBtn');

let currentFile = null;
let bodyPixModel = null;

// Initialize BodyPix model
async function loadModel() {
    try {
        bodyPixModel = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log('BodyPix model loaded');
    } catch (error) {
        console.error('Failed to load model:', error);
        alert('Failed to load AI model. Please refresh the page.');
    }
}

// Load model on startup
loadModel();

// Event Listeners
selectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
newImageBtn.addEventListener('click', resetEditor);
downloadBtn.addEventListener('click', downloadResult);

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
});

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// Process the selected file
function processFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }
    
    currentFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        originalImage.src = e.target.result;
        uploadSection.hidden = true;
        editorSection.hidden = false;
        removeBackground(e.target.result);
    };

reader.readAsDataURL(file);
}

// Remove background using BodyPix
async function removeBackground(imageSrc) {
    loadingSpinner.hidden = false;
    resultImage.hidden = true;
    downloadBtn.disabled = true;
    
    try {
        // Create an image element
        const img = new Image();
        img.src = imageSrc;
        await new Promise((resolve) => { img.onload = resolve; });
        
        // Create canvas for processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Limit dimensions for performance
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = (height / width) * maxDim;
                width = maxDim;
            } else {
                width = (width / height) * maxDim;
                height = maxDim;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Segment person
        const segmentation = await bodyPixModel.segmentPerson(canvas, {
            internalResolution: 'medium',
            segmentationThreshold: 0.7
        });
        
        // Create output canvas with transparent background
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const outputCtx = outputCanvas.getContext('2d');
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width, height);
        
        // Apply mask
        for (let i = 0; i < segmentation.data.length; i++) {
            const pixelIndex = i * 4;
            if (segmentation.data[i] === 1) {
                // Person pixel - keep it
                outputData.data[pixelIndex] = imageData.data[pixelIndex];
                outputData.data[pixelIndex + 1] = imageData.data[pixelIndex + 1];
                outputData.data[pixelIndex + 2] = imageData.data[pixelIndex + 2];
                outputData.data[pixelIndex + 3] = imageData.data[pixelIndex + 3];
            } else {
                // Background pixel - make transparent
                outputData.data[pixelIndex] = 0;
                outputData.data[pixelIndex + 1] = 0;
                outputData.data[pixelIndex + 2] = 0;
                outputData.data[pixelIndex + 3] = 0;
            }
        }
        
        outputCtx.putImageData(outputData, 0, 0);
        
        // Display result
        resultImage.src = outputCanvas.toDataURL('image/png');
        resultImage.hidden = false;
        loadingSpinner.hidden = true;
        downloadBtn.disabled = false;
        
    } catch (error) {
        console.error('Error removing background:', error);
        loadingSpinner.hidden = true;
        alert('Error processing image. Please try again with a different image.');
    }
}

// Reset to upload new image
function resetEditor() {
    uploadSection.hidden = false;
    editorSection.hidden = true;
  fileInput.value = '';
    currentFile = null;
    originalImage.src = '';
    resultImage.src = '';
}

// Download the result
function downloadResult() {
    if (!resultImage.src) return;
    
    const link = document.createElement('a');
    link.download = 'removed-bg-' + (currentFile?.name || 'image.png');
    link.href = resultImage.src;
    link.click();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editorSection.hidden) {
        resetEditor();
    }
});

// Paste from clipboard
document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            processFile(file);
            break;
        }
    }
});
