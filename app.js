let cvReady = false;
let stream = null;
let originalImage = null; // cv.Mat
let processedImage = null; // cv.Mat
let currentFilter = 'none';

// Elements
const video = document.getElementById('video');
const canvasPreview = document.getElementById('canvas-preview');
const canvasProcessing = document.getElementById('canvas-processing');
const loadingScreen = document.getElementById('loading-screen');
const cameraView = document.getElementById('camera-view');
const previewContainer = document.getElementById('preview-container');

// OpenCV Ready Callback Handling
window.onOpenCvLoaded = () => {
    console.log('App: onOpenCvLoaded triggered');
    
    // In some builds, cv is already global, in others it's Module
    if (typeof cv !== 'undefined') {
        console.log('App: OpenCV.js is fully ready');
        cvReady = true;
        loadingScreen.style.display = 'none';
        startCamera();
    } else {
        console.log('App: cv not global yet, waiting...');
        setTimeout(window.onOpenCvLoaded, 100);
    }
};

// If OpenCV.js finished loading before app.js, trigger manually
if (window.cvReadyPending) {
    window.onOpenCvLoaded();
}

// Camera Management
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 4096 },
                height: { ideal: 2160 }
            },
            audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // Check for torch/flash support
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
            document.getElementById('toggle-flash').classList.remove('hidden');
        }
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert("Camera access denied or not available. Please ensure you are using HTTPS and have given permission.");
    }
}

// Capture Logic
document.getElementById('capture').addEventListener('click', () => {
    const canvas = canvasProcessing;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    processCapturedImage(canvas);
});

// Process Image with OpenCV
function processCapturedImage(sourceCanvas) {
    if (!cvReady) return;

    // Convert source to Mat
    let src = cv.imread(sourceCanvas);
    originalImage = src.clone();
    
    // Auto-detect and crop
    let cropped = autoCrop(src);
    processedImage = cropped;
    
    showPreview();
    applyFilter('none');
}

function autoCrop(src) {
    let dst = new cv.Mat();
    let gray = new cv.Mat();
    let blurred = new cv.Mat();
    let edges = new cv.Mat();
    
    // Pre-processing
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 75, 200);
    
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    let maxArea = 0;
    let maxContourIndex = -1;
    for (let i = 0; i < contours.size(); ++i) {
        let area = cv.contourArea(contours.get(i));
        if (area > maxArea) {
            maxArea = area;
            maxContourIndex = i;
        }
    }

    if (maxContourIndex !== -1) {
        let contour = contours.get(maxContourIndex);
        let peri = cv.arcLength(contour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);
        
        if (approx.rows === 4) {
            // Found a rectangle, perform perspective transform
            let result = fourPointTransform(src, approx);
            
            // Cleanup
            gray.delete(); blurred.delete(); edges.delete();
            contours.delete(); hierarchy.delete(); approx.delete();
            return result;
        }
        approx.delete();
    }

    // Fallback: if no 4-point contour found, return original
    gray.delete(); blurred.delete(); edges.delete();
    contours.delete(); hierarchy.delete();
    return src.clone();
}

function fourPointTransform(src, ptsMat) {
    // Sort points: top-left, top-right, bottom-right, bottom-left
    let pts = [];
    for (let i = 0; i < 4; i++) {
        pts.push({ x: ptsMat.data32S[i * 2], y: ptsMat.data32S[i * 2 + 1] });
    }

    // Sort by Y-coordinate
    pts.sort((a, b) => a.y - b.y);
    let top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
    let bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
    
    let tl = top[0], tr = top[1], br = bottom[1], bl = bottom[0];

    // Calculate dimensions
    let widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
    let widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
    let maxWidth = Math.max(widthA, widthB);

    let heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
    let heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
    let maxHeight = Math.max(heightA, heightB);

    let dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        maxWidth - 1, 0,
        maxWidth - 1, maxHeight - 1,
        0, maxHeight - 1
    ]);
    
    let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl.x, tl.y,
        tr.x, tr.y,
        br.x, br.y,
        bl.x, bl.y
    ]);

    let M = cv.getPerspectiveTransform(srcPts, dstPts);
    let dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight));
    
    M.delete(); srcPts.delete(); dstPts.delete();
    return dst;
}

// UI Transition
function showPreview() {
    cameraView.style.display = 'none';
    previewContainer.style.display = 'flex';
    // Pause video to save battery
    video.pause();
}

document.getElementById('back-to-camera').addEventListener('click', () => {
    previewContainer.style.display = 'none';
    cameraView.style.display = 'flex';
    video.play();
    if (processedImage) processedImage.delete();
    if (originalImage) originalImage.delete();
});

// Filters
function applyFilter(filter) {
    currentFilter = filter;
    let dst = new cv.Mat();
    
    if (filter === 'none') {
        dst = processedImage.clone();
    } else if (filter === 'gray') {
        cv.cvtColor(processedImage, dst, cv.COLOR_RGBA2GRAY);
    } else if (filter === 'bw') {
        let gray = new cv.Mat();
        cv.cvtColor(processedImage, gray, cv.COLOR_RGBA2GRAY);
        // Adaptive threshold for best text results in dim light
        cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
        gray.delete();
    } else if (filter === 'enhance') {
        // Simple magic enhancement (CLAHE for contrast)
        let lab = new cv.Mat();
        cv.cvtColor(processedImage, lab, cv.COLOR_RGBA2RGB); // Actually needs LAB for CLAHE but let's do simpler
        // Let's just do brightness/contrast adjustment
        processedImage.convertTo(dst, -1, 1.2, 10); // alpha=1.2 (contrast), beta=10 (brightness)
    }

    cv.imshow(canvasPreview, dst);
    dst.delete();
    
    // Update active UI
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'text-white');
        btn.classList.add('text-gray-400');
        btn.querySelector('div').classList.remove('border-blue-500', 'border-2');
    });
    const activeBtn = document.getElementById(`filter-${filter}`);
    activeBtn.classList.add('active', 'text-white');
    activeBtn.classList.remove('text-gray-400');
    activeBtn.querySelector('div').classList.add('border-blue-500', 'border-2');
}

// Filter Event Listeners
document.getElementById('filter-none').onclick = () => applyFilter('none');
document.getElementById('filter-gray').onclick = () => applyFilter('gray');
document.getElementById('filter-bw').onclick = () => applyFilter('bw');
document.getElementById('filter-enhance').onclick = () => applyFilter('enhance');

// Save PDF
document.getElementById('save-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const imgData = canvasPreview.toDataURL('image/jpeg', 0.8);
    
    // Calculate aspect ratio
    const width = canvasPreview.width;
    const height = canvasPreview.height;
    const orientation = width > height ? 'l' : 'p';
    
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'px',
        format: [width, height]
    });
    
    doc.addImage(imgData, 'JPEG', 0, 0, width, height);
    doc.save("scanned_document.pdf");
});

// Flash Toggle
document.getElementById('toggle-flash').addEventListener('click', async () => {
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    await track.applyConstraints({
        advanced: [{ torch: !settings.torch }]
    });
});

// Gallery Picker (Optional fallback)
document.getElementById('gallery').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            canvasProcessing.width = img.width;
            canvasProcessing.height = img.height;
            const ctx = canvasProcessing.getContext('2d');
            ctx.drawImage(img, 0, 0);
            processCapturedImage(canvasProcessing);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
};
