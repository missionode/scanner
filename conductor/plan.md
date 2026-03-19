# Document Scanner App Plan

This plan outlines the implementation of a mobile-first web application that captures documents, detects borders, crops/flattens the image, enhances quality, and exports to PDF.

## 1. Objectives
- Capture high-quality document photos from mobile devices.
- Automatically detect document edges and perform perspective correction.
- Provide image enhancement filters (Color, Grayscale, B&W).
- Export processed images as a single-page or multi-page PDF.

## 2. Tech Stack
- **HTML5/CSS3/JavaScript**: Core application.
- **Tailwind CSS**: Rapid UI development (mobile-first).
- **OpenCV.js**: Computer vision for edge detection and perspective transform.
- **jsPDF**: PDF generation.
- **MediaDevices API**: Accessing high-quality camera streams.

## 3. Key Components & Implementation Steps

### Phase 1: Project Setup & UI
- [ ] Create `index.html`, `styles.css`, and `app.js`.
- [ ] Set up Tailwind CSS via CDN.
- [ ] Create basic UI structure:
    - **Camera View**: Video feed + Capture button.
    - **Crop View**: Canvas with interactive handles to adjust edges (if auto-detection needs tuning).
    - **Preview View**: Filter options (Original, Gray, B&W) + Save/PDF buttons.

### Phase 2: High-Quality Camera Access
- [ ] Use `navigator.mediaDevices.getUserMedia` with `facingMode: "environment"`.
- [ ] Request highest available resolution (e.g., `ideal: 1920` or higher).
- [ ] Implement capture logic to grab a frame from the `<video>` to a `<canvas>`.

### Phase 3: Edge Detection & Perspective Transform (OpenCV.js)
- [ ] Load OpenCV.js asynchronously.
- [ ] **Edge Detection Logic**:
    - Convert to Grayscale -> Gaussian Blur -> Canny Edges.
    - Find Contours -> Filter by Area -> Approximate Polygon (4 points).
- [ ] **Perspective Transform**:
    - Use `cv.getPerspectiveTransform` and `cv.warpPerspective` to "flatten" the document.

### Phase 4: Image Enhancement
- [ ] Implement filters using OpenCV.js or Canvas API:
    - **Original**: No changes.
    - **Grayscale**: Remove color.
    - **B&W (Adaptive Thresholding)**: Best for text clarity in dim light.
    - **Color Enhancement**: Adjust brightness and contrast.

### Phase 5: PDF Export & Sharing
- [ ] Initialize `jsPDF`.
- [ ] Add the processed image to the PDF document.
- [ ] Use `doc.save()` for download and `navigator.share()` (if available) for mobile sharing.

## 4. Verification & Testing
- [ ] Test camera access on various mobile browsers (Chrome, Safari).
- [ ] Verify edge detection accuracy with different backgrounds.
- [ ] Confirm PDF quality and file size.
- [ ] Test offline capability (optional, but good for PWAs).
