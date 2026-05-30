/**
 * AeroGlide - 60fps Interactive HTML5 Canvas Flight Path Animator
 * Upgraded with exact coordinates calibration, dynamic video exporter, 
 * pulsing scanline overlays, dynamic color theme selection, and real-time HUD telemetry.
 */

// --- Global Application State ---
const state = {
    countries: [],         // Parsed GeoJSON country list
    selectedOrigin: null,  // Feature for departure
    selectedDest: null,    // Feature for arrival
    mapLoaded: false,
    geojsonLoaded: false,
    
    // Animation Playback Parameters
    animation: {
        progress: 0,       // 0.0 to 1.0
        isPlaying: false,
        speed: 0.8,        // Multiplier
        loop: true,
        lastTime: 0,
        particles: []      // Jet engine spark particles
    },
    
    // Interactive Camera Viewport
    camera: {
        x: 1920,           // Current map focus X (pixels)
        y: 1070,           // Current map focus Y (pixels)
        zoom: 0.35,        // Current scale
        targetX: 1920,
        targetY: 1070,
        targetZoom: 0.35,
        isPanning: false,
        startX: 0,
        startY: 0,
        dragStartX: 0,
        dragStartY: 0,
        lockToPath: true
    },

    // Dynamic Customizable Styles
    styles: {
        themeName: 'red',
        accentColor: '#ff3344',
        accentColorGlow: 'rgba(255, 51, 68, 0.45)',
        accentColorDim: 'rgba(255, 51, 68, 0.15)',
        trajectoryColor: '#ff3344',
        trajectoryColorGlow: 'rgba(255, 51, 68, 0.6)'
    }
};

// --- Constant Assets & Layout Configurations ---
const MAP_IMAGE_URL = '/map.jpg';
const GEOJSON_URL = '/countries.geojson';
const MAP_WIDTH = 3840;
const MAP_HEIGHT = 2160;

// Dynamic Boundary Calibration Parameters (Linked to Dev Sliders)
// Target state represents the slider/control values set by the user
const calibrationTarget = {
    xOffset: 1920.0,
    yOffset: 1070.0,
    xScale: 10.6667,
    yScale: 11.0000,
    rotation: 0.0,
    skewX: 0.0,
    skewY: 0.0
};

// Current render state represents the eased value used for actual rendering on Canvas
const calibration = { ...calibrationTarget };

const imageCalibrationTarget = {
    xOffset: 0.0,
    yOffset: 0.0,
    xScale: 1.0,
    yScale: 1.0,
    rotation: 0.0,
    skewX: 0.0,
    skewY: 0.0
};

const imageCalibration = { ...imageCalibrationTarget };

const imageEffectsTarget = {
    brightness: 100.0,
    contrast: 100.0,
    saturation: 100.0,
    opacity: 100.0,
    blur: 0.0,
    hueRotate: 0.0,
    grayscale: 0.0,
    invert: 0.0
};

const imageEffects = { ...imageEffectsTarget };

let activeLayer = 'vector'; // 'vector' or 'image'
let aspectLock = true;

// Centroid Manual Overrides for Aesthetic Integrity
const COUNTRY_CENTROID_OVERRIDES = {
    "United States of America": [-98.5795, 39.8283], // contiguous center (avoids Alaska pull)
    "United States": [-98.5795, 39.8283],
    "Canada": [-106.3468, 56.1304],
    "Russia": [95.3188, 61.5240], // centered on main landmass
    "China": [104.1954, 35.8617],
    "Australia": [133.7751, -25.2744],
    "Brazil": [-51.9253, -14.2350],
    "France": [2.2137, 46.2276], // contiguous mainland
    "Norway": [10.4689, 62.4720],
    "United Kingdom": [-1.9130, 54.3781],
    "Japan": [138.2529, 36.2048],
    "New Zealand": [172.6362, -41.2784],
    "Chile": [-71.5429, -35.6751],
    "Argentina": [-63.6167, -38.4161],
    "South Africa": [25.0479, -29.0852]
};

// Theme Presets Configuration
const THEME_PRESETS = {
    red: {
        accentColor: '#ff3344',
        accentColorGlow: 'rgba(255, 51, 68, 0.45)',
        accentColorDim: 'rgba(255, 51, 68, 0.15)',
        trajectoryColor: '#ff3344',
        trajectoryColorGlow: 'rgba(255, 51, 68, 0.6)'
    },
    cyan: {
        accentColor: '#06b6d4',
        accentColorGlow: 'rgba(6, 182, 212, 0.45)',
        accentColorDim: 'rgba(6, 182, 212, 0.15)',
        trajectoryColor: '#06b6d4',
        trajectoryColorGlow: 'rgba(6, 182, 212, 0.6)'
    },
    emerald: {
        accentColor: '#10b981',
        accentColorGlow: 'rgba(16, 185, 129, 0.45)',
        accentColorDim: 'rgba(16, 185, 129, 0.15)',
        trajectoryColor: '#10b981',
        trajectoryColorGlow: 'rgba(16, 185, 129, 0.6)'
    },
    amber: {
        accentColor: '#f59e0b',
        accentColorGlow: 'rgba(245, 158, 11, 0.45)',
        accentColorDim: 'rgba(245, 158, 11, 0.15)',
        trajectoryColor: '#f59e0b',
        trajectoryColorGlow: 'rgba(245, 158, 11, 0.6)'
    },
    violet: {
        accentColor: '#8b5cf6',
        accentColorGlow: 'rgba(139, 92, 246, 0.45)',
        accentColorDim: 'rgba(139, 92, 246, 0.15)',
        trajectoryColor: '#8b5cf6',
        trajectoryColorGlow: 'rgba(139, 92, 246, 0.6)'
    }
};

// --- Setup Document Elements ---
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const mapImg = new Image();

// Load the custom top-down white passenger airplane image
const planeImg = new Image();
planeImg.src = '/static/airplane.png';

// UI Control Queries
const originInput = document.getElementById('origin-input');
const destInput = document.getElementById('destination-input');
const originDropdown = document.getElementById('origin-suggestions');
const destDropdown = document.getElementById('destination-suggestions');
const clearOriginBtn = document.getElementById('clear-origin');
const clearDestBtn = document.getElementById('clear-destination');

const playBtn = document.getElementById('play-btn');
const resetBtn = document.getElementById('reset-btn');
const downloadBtn = document.getElementById('download-btn');
const timelineScrubber = document.getElementById('timeline-scrubber');
const timelineFill = document.getElementById('timeline-fill');
const timelinePct = document.getElementById('timeline-pct');
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
const loopToggle = document.getElementById('loop-toggle');
const cameraLock = document.getElementById('camera-lock');
const themeSelect = document.getElementById('color-theme');
const zoomFramingSelect = document.getElementById('zoom-framing');
const cameraZoomSlider = document.getElementById('camera-zoom-slider');
const cameraZoomVal = document.getElementById('camera-zoom-val');

const statsPanel = document.getElementById('stats-panel');
const distanceVal = document.getElementById('distance-val');
const durationVal = document.getElementById('duration-val');
const headingVal = document.getElementById('heading-val');
const statusVal = document.getElementById('status-val');

// Real-Time HUD and Video Overlay Panel
const hudPanel = document.getElementById('hud-display');
const hudOrigin = document.getElementById('hud-origin');
const hudDest = document.getElementById('hud-dest');
const hudDist = document.getElementById('hud-dist');
const hudHeading = document.getElementById('hud-heading');
const recordingOverlay = document.getElementById('recording-overlay');
const recordingProgress = document.getElementById('rec-progress');

const recenterBtn = document.getElementById('recenter-btn');
const focusFlightBtn = document.getElementById('focus-countries-btn');
const toastNotification = document.getElementById('notification-banner');

// Calibration Slider Selectors
const calXOffset = document.getElementById('cal-x-offset');
const calYOffset = document.getElementById('cal-y-offset');
const calXScale = document.getElementById('cal-x-scale');
const calYScale = document.getElementById('cal-y-scale');
const valXOffset = document.getElementById('val-x-offset');
const valYOffset = document.getElementById('val-y-offset');
const valXScale = document.getElementById('val-x-scale');
const valYScale = document.getElementById('val-y-scale');
const saveCalibrationBtn = document.getElementById('save-calibration-btn');
const outlineAllToggle = document.getElementById('outline-all-toggle');

// Map Transform Studio Panel UI Queries
const openCalibrationBtn = document.getElementById('open-calibration-btn');
const closeCalibrationBtn = document.getElementById('close-calibration-btn');
const calibrationToolbar = document.getElementById('calibration-toolbar');

const btnSelectVectorLayer = document.getElementById('btn-select-vector-layer');
const btnSelectImageLayer = document.getElementById('btn-select-image-layer');

const btnNudgeUp = document.getElementById('btn-nudge-up');
const btnNudgeDown = document.getElementById('btn-nudge-down');
const btnNudgeLeft = document.getElementById('btn-nudge-left');
const btnNudgeRight = document.getElementById('btn-nudge-right');

const toolbarValX = document.getElementById('toolbar-val-x');
const toolbarValY = document.getElementById('toolbar-val-y');
const toolbarValXs = document.getElementById('toolbar-val-xs');
const toolbarValYs = document.getElementById('toolbar-val-ys');

const btnAspectLock = document.getElementById('btn-aspect-lock');
const btnStretchXDec = document.getElementById('btn-stretch-x-dec');
const btnStretchXInc = document.getElementById('btn-stretch-x-inc');
const btnStretchYDec = document.getElementById('btn-stretch-y-dec');
const btnStretchYInc = document.getElementById('btn-stretch-y-inc');

const proportionalZoomSlider = document.getElementById('proportional-zoom-slider');
const proportionalZoomVal = document.getElementById('proportional-zoom-val');

const activeLayerIndicator = document.getElementById('active-layer-indicator');
const toolbarSaveBtn = document.getElementById('toolbar-save-btn');
const toolbarDoneBtn = document.getElementById('toolbar-done-btn');

// Background Image Effects Slider Queries
const effectBrightness = document.getElementById('effect-brightness');
const valBrightness = document.getElementById('val-brightness');
const effectContrast = document.getElementById('effect-contrast');
const valContrast = document.getElementById('val-contrast');
const effectSaturation = document.getElementById('effect-saturation');
const valSaturation = document.getElementById('val-saturation');
const effectOpacity = document.getElementById('effect-opacity');
const valOpacity = document.getElementById('val-opacity');
const effectBlur = document.getElementById('effect-blur');
const valBlur = document.getElementById('val-blur');
const effectHue = document.getElementById('effect-hue');
const valHue = document.getElementById('val-hue');
const btnResetEffects = document.getElementById('btn-reset-effects');

// Premium Sidebar Map Transform & Image Editor Studio Queries
const sidebarBtnVectorLayer = document.getElementById('sidebar-btn-vector-layer');
const sidebarBtnImageLayer = document.getElementById('sidebar-btn-image-layer');
const sidebarActiveLayerName = document.getElementById('sidebar-active-layer-name');

const workspaceXOffset = document.getElementById('workspace-x-offset');
const valWorkspaceXOffset = document.getElementById('val-workspace-x-offset');
const workspaceYOffset = document.getElementById('workspace-y-offset');
const valWorkspaceYOffset = document.getElementById('val-workspace-y-offset');
const workspaceXScale = document.getElementById('workspace-x-scale');
const valWorkspaceXScale = document.getElementById('val-workspace-x-scale');
const workspaceYScale = document.getElementById('workspace-y-scale');
const valWorkspaceYScale = document.getElementById('val-workspace-y-scale');

const workspaceRotation = document.getElementById('workspace-rotation');
const valWorkspaceRotation = document.getElementById('val-workspace-rotation');
const workspaceSkewX = document.getElementById('workspace-skew-x');
const valWorkspaceSkewX = document.getElementById('val-workspace-skew-x');
const workspaceSkewY = document.getElementById('workspace-skew-y');
const valWorkspaceSkewY = document.getElementById('val-workspace-skew-y');

const workspaceBtnAspectLock = document.getElementById('workspace-btn-aspect-lock');

const workspaceBrightness = document.getElementById('workspace-brightness');
const valWorkspaceBrightness = document.getElementById('val-workspace-brightness');
const workspaceContrast = document.getElementById('workspace-contrast');
const valWorkspaceContrast = document.getElementById('val-workspace-contrast');
const workspaceSaturation = document.getElementById('workspace-saturation');
const valWorkspaceSaturation = document.getElementById('val-workspace-saturation');
const workspaceOpacity = document.getElementById('workspace-opacity');
const valWorkspaceOpacity = document.getElementById('val-workspace-opacity');
const workspaceBlur = document.getElementById('workspace-blur');
const valWorkspaceBlur = document.getElementById('val-workspace-blur');
const workspaceHue = document.getElementById('workspace-hue');
const valWorkspaceHue = document.getElementById('val-workspace-hue');
const workspaceGrayscale = document.getElementById('workspace-grayscale');
const valWorkspaceGrayscale = document.getElementById('val-workspace-grayscale');
const workspaceInvert = document.getElementById('workspace-invert');
const valWorkspaceInvert = document.getElementById('val-workspace-invert');

const workspaceBtnResetEffects = document.getElementById('workspace-btn-reset-effects');
const workspaceBtnSave = document.getElementById('workspace-btn-save');
const workspaceBtnResetLayout = document.getElementById('workspace-btn-reset-layout');
const workspaceBtnAutoAlign = document.getElementById('workspace-btn-auto-align');

// Sidebar Presets & Adjustments Groups & Buttons
const workspacePresetsGroup = document.getElementById('workspace-presets-group');
const workspaceImageAdjustmentsGroup = document.getElementById('workspace-image-adjustments-group');
const btnPreset100 = document.getElementById('btn-preset-100');
const btnPreset200 = document.getElementById('btn-preset-200');
const btnPresetCenter = document.getElementById('btn-preset-center');
const btnPresetFlipH = document.getElementById('btn-preset-flip-h');
const btnPresetFlipV = document.getElementById('btn-preset-flip-v');

const workspaceMapUpload = document.getElementById('workspace-map-upload');
const workspaceBtnUploadMap = document.getElementById('workspace-btn-upload-map');

// Canvas Recorder Variables
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let totalDistance = 0;

// --- Helper Functions ---

/**
 * Project latitude & longitude coordinates to Map Pixel Coordinates
 */
function projectCoords(lon, lat) {
    // 1. Raw projection coordinates centered on equator/meridian intersection
    const x_scaled = lon * calibration.xScale;
    const y_scaled = -lat * calibration.yScale;
    
    // 2. Apply Skew transformations (Horizontal / Vertical skew angles in radians)
    const skewXRad = (calibration.skewX || 0.0) * Math.PI / 180;
    const skewYRad = (calibration.skewY || 0.0) * Math.PI / 180;
    const x_skewed = x_scaled + y_scaled * Math.tan(skewXRad);
    const y_skewed = y_scaled + x_scaled * Math.tan(skewYRad);
    
    // 3. Apply Rotation matrix (around rotation center)
    const rotRad = (calibration.rotation || 0.0) * Math.PI / 180;
    const x_rotated = x_skewed * Math.cos(rotRad) - y_skewed * Math.sin(rotRad);
    const y_rotated = x_skewed * Math.sin(rotRad) + y_skewed * Math.cos(rotRad);
    
    // 4. Apply Translation Offset shifts
    const x = calibration.xOffset + x_rotated;
    const y = calibration.yOffset + y_rotated;
    
    return { x, y };
}

/**
 * Calculate bounding box of a country feature in map pixels
 */
function getFeatureBoundingBox(feature) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const processRing = (ring) => {
        for (const pt of ring) {
            const proj = projectCoords(pt[0], pt[1]);
            if (proj.x < minX) minX = proj.x;
            if (proj.y < minY) minY = proj.y;
            if (proj.x > maxX) maxX = proj.x;
            if (proj.y > maxY) maxY = proj.y;
        }
    };

    if (feature.geometry.type === "Polygon") {
        for (const ring of feature.geometry.coordinates) {
            processRing(ring);
        }
    } else if (feature.geometry.type === "MultiPolygon") {
        for (const poly of feature.geometry.coordinates) {
            for (const ring of poly) {
                processRing(ring);
            }
        }
    }
    
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Get country centroid, checking for overrides or computing polygon average
 */
function getCountryCentroid(feature) {
    const name = feature.properties.NAME || feature.properties.ADMIN;
    if (COUNTRY_CENTROID_OVERRIDES[name]) {
        return COUNTRY_CENTROID_OVERRIDES[name];
    }

    let totalLon = 0, totalLat = 0, totalPts = 0;

    const processCoords = (coords) => {
        let rLon = 0, rLat = 0, rPts = 0;
        for (const ring of coords) {
            for (const pt of ring) {
                rLon += pt[0];
                rLat += pt[1];
                rPts++;
            }
        }
        return { lon: rLon, lat: rLat, count: rPts };
    };

    if (feature.geometry.type === "Polygon") {
        const res = processCoords(feature.geometry.coordinates);
        return [res.lon / res.count, res.lat / res.count];
    } else if (feature.geometry.type === "MultiPolygon") {
        // Find largest polygon by vertex count to avoid remote island distortions
        let maxCount = 0;
        let bestCentroid = [0, 0];
        for (const polyCoords of feature.geometry.coordinates) {
            const res = processCoords(polyCoords);
            if (res.count > maxCount) {
                maxCount = res.count;
                bestCentroid = [res.lon / res.count, res.lat / res.count];
            }
        }
        return bestCentroid;
    }
    return [0, 0];
}

/**
 * Calculate Great Circle Distance (Orthodromic Distance) in km (Haversine formula)
 */
function calculateDistance(lon1, lat1, lon2, lat2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Calculate initial compass heading in degrees
 */
function calculateHeading(lon1, lat1, lon2, lat2) {
    const lon1Rad = lon1 * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lon2Rad = lon2 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(lon2Rad - lon1Rad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad);
    
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

/**
 * Show a floating Toast message
 */
function showToast(message) {
    if (toastNotification) {
        toastNotification.querySelector('.toast-message').textContent = message;
        toastNotification.classList.remove('hidden');
        setTimeout(() => {
            toastNotification.classList.add('hidden');
        }, 4500);
    }
}

/**
 * Synchronize the on-screen values inside the Map Transform Studio toolbar and Sidebar card
 */
function syncTransformToolbarUI() {
    const isVector = activeLayer === 'vector';
    const target = isVector ? calibrationTarget : imageCalibrationTarget;
    
    // Update active tab buttons styling (Transform Studio Floating Toolbar)
    if (btnSelectVectorLayer && btnSelectImageLayer) {
        if (isVector) {
            btnSelectVectorLayer.classList.add('active');
            btnSelectImageLayer.classList.remove('active');
        } else {
            btnSelectVectorLayer.classList.remove('active');
            btnSelectImageLayer.classList.add('active');
        }
    }

    // Update active tab buttons styling (Sidebar Studio Card)
    if (sidebarBtnVectorLayer && sidebarBtnImageLayer) {
        if (isVector) {
            sidebarBtnVectorLayer.classList.add('active');
            sidebarBtnImageLayer.classList.remove('active');
        } else {
            sidebarBtnVectorLayer.classList.remove('active');
            sidebarBtnImageLayer.classList.add('active');
        }
    }
    
    // Update active layer indicator texts
    if (activeLayerIndicator) {
        activeLayerIndicator.textContent = isVector ? "Outlines" : "Map Image";
    }
    if (sidebarActiveLayerName) {
        sidebarActiveLayerName.textContent = isVector ? "Outlines" : "Map Image";
    }

    // Toggle Sidebar Presets & Adjustments visibility dynamically based on active workspace tab
    if (workspacePresetsGroup && workspaceImageAdjustmentsGroup) {
        if (isVector) {
            workspacePresetsGroup.style.display = 'none';
            workspaceImageAdjustmentsGroup.style.display = 'none';
        } else {
            workspacePresetsGroup.style.display = 'flex';
            workspaceImageAdjustmentsGroup.style.display = 'flex';
        }
    }
    
    // Update aspect lock button styling (Transform Studio Floating Toolbar)
    if (btnAspectLock) {
        if (aspectLock) {
            btnAspectLock.classList.add('active');
        } else {
            btnAspectLock.classList.remove('active');
        }
    }

    // Update aspect lock button styling (Sidebar Studio Card)
    if (workspaceBtnAspectLock) {
        if (aspectLock) {
            workspaceBtnAspectLock.classList.add('active');
            workspaceBtnAspectLock.innerHTML = "🔗 Locked";
        } else {
            workspaceBtnAspectLock.classList.remove('active');
            workspaceBtnAspectLock.innerHTML = "🔓 Unlocked";
        }
    }
    
    // Update readouts (Transform Studio Floating Toolbar)
    if (toolbarValX) toolbarValX.textContent = target.xOffset.toFixed(1);
    if (toolbarValY) toolbarValY.textContent = target.yOffset.toFixed(1);
    if (toolbarValXs) toolbarValXs.textContent = target.xScale.toFixed(3);
    if (toolbarValYs) toolbarValYs.textContent = target.yScale.toFixed(3);

    // Update sliders and readouts (Sidebar Studio Card)
    if (workspaceXOffset) {
        workspaceXOffset.value = target.xOffset;
        if (valWorkspaceXOffset) valWorkspaceXOffset.textContent = target.xOffset.toFixed(1);
    }
    if (workspaceYOffset) {
        workspaceYOffset.value = target.yOffset;
        if (valWorkspaceYOffset) valWorkspaceYOffset.textContent = target.yOffset.toFixed(1);
    }
    if (workspaceXScale) {
        workspaceXScale.value = target.xScale;
        if (valWorkspaceXScale) valWorkspaceXScale.textContent = target.xScale.toFixed(3);
    }
    if (workspaceYScale) {
        workspaceYScale.value = target.yScale;
        if (valWorkspaceYScale) valWorkspaceYScale.textContent = target.yScale.toFixed(3);
    }
    if (workspaceRotation) {
        workspaceRotation.value = target.rotation;
        if (valWorkspaceRotation) valWorkspaceRotation.textContent = target.rotation.toFixed(1) + '°';
    }
    if (workspaceSkewX) {
        workspaceSkewX.value = target.skewX;
        if (valWorkspaceSkewX) valWorkspaceSkewX.textContent = target.skewX.toFixed(1) + '°';
    }
    if (workspaceSkewY) {
        workspaceSkewY.value = target.skewY;
        if (valWorkspaceSkewY) valWorkspaceSkewY.textContent = target.skewY.toFixed(1) + '°';
    }
    
    // Update proportional zoom slider value
    if (proportionalZoomSlider && proportionalZoomVal) {
        let percentage = 100;
        if (isVector) {
            percentage = (target.xScale / 10.6667) * 100;
        } else {
            percentage = target.xScale * 100;
        }
        proportionalZoomSlider.value = percentage.toFixed(1);
        proportionalZoomVal.textContent = percentage.toFixed(1) + '%';
    }
    
    // If vector is updated, sync the developer sliders too
    if (isVector) {
        if (calXOffset) calXOffset.value = calibrationTarget.xOffset;
        if (calYOffset) calYOffset.value = calibrationTarget.yOffset;
        if (calXScale) calXScale.value = calibrationTarget.xScale;
        if (calYScale) calYScale.value = calibrationTarget.yScale;
        
        if (valXOffset) valXOffset.textContent = calibrationTarget.xOffset.toFixed(1);
        if (valYOffset) valYOffset.textContent = calibrationTarget.yOffset.toFixed(1);
        if (valXScale) valXScale.textContent = calibrationTarget.xScale.toFixed(3);
        if (valYScale) valYScale.textContent = calibrationTarget.yScale.toFixed(3);
    }
    
    updateEffectsUI();
}

/**
 * Synchronize Background Image effects slider values and text readouts
 */
function updateEffectsUI() {
    // 1. Floating Transform Panel Sliders
    if (effectBrightness && valBrightness) {
        effectBrightness.value = imageEffectsTarget.brightness;
        valBrightness.textContent = imageEffectsTarget.brightness + '%';
    }
    if (effectContrast && valContrast) {
        effectContrast.value = imageEffectsTarget.contrast;
        valContrast.textContent = imageEffectsTarget.contrast + '%';
    }
    if (effectSaturation && valSaturation) {
        effectSaturation.value = imageEffectsTarget.saturation;
        valSaturation.textContent = imageEffectsTarget.saturation + '%';
    }
    if (effectOpacity && valOpacity) {
        effectOpacity.value = imageEffectsTarget.opacity;
        valOpacity.textContent = imageEffectsTarget.opacity + '%';
    }
    if (effectBlur && valBlur) {
        effectBlur.value = imageEffectsTarget.blur;
        valBlur.textContent = imageEffectsTarget.blur.toFixed(1) + 'px';
    }
    if (effectHue && valHue) {
        effectHue.value = imageEffectsTarget.hueRotate;
        valHue.textContent = imageEffectsTarget.hueRotate + '°';
    }
    
    // 2. Sidebar Dedicated Map Adjustments Sliders
    if (workspaceBrightness && valWorkspaceBrightness) {
        workspaceBrightness.value = imageEffectsTarget.brightness;
        valWorkspaceBrightness.textContent = imageEffectsTarget.brightness + '%';
    }
    if (workspaceContrast && valWorkspaceContrast) {
        workspaceContrast.value = imageEffectsTarget.contrast;
        valWorkspaceContrast.textContent = imageEffectsTarget.contrast + '%';
    }
    if (workspaceSaturation && valWorkspaceSaturation) {
        workspaceSaturation.value = imageEffectsTarget.saturation;
        valWorkspaceSaturation.textContent = imageEffectsTarget.saturation + '%';
    }
    if (workspaceOpacity && valWorkspaceOpacity) {
        workspaceOpacity.value = imageEffectsTarget.opacity;
        valWorkspaceOpacity.textContent = imageEffectsTarget.opacity + '%';
    }
    if (workspaceBlur && valWorkspaceBlur) {
        workspaceBlur.value = imageEffectsTarget.blur;
        valWorkspaceBlur.textContent = imageEffectsTarget.blur.toFixed(1) + 'px';
    }
    if (workspaceHue && valWorkspaceHue) {
        workspaceHue.value = imageEffectsTarget.hueRotate;
        valWorkspaceHue.textContent = imageEffectsTarget.hueRotate + '°';
    }
    if (workspaceGrayscale && valWorkspaceGrayscale) {
        workspaceGrayscale.value = imageEffectsTarget.grayscale;
        valWorkspaceGrayscale.textContent = imageEffectsTarget.grayscale + '%';
    }
    if (workspaceInvert && valWorkspaceInvert) {
        workspaceInvert.value = imageEffectsTarget.invert;
        valWorkspaceInvert.textContent = imageEffectsTarget.invert + '%';
    }
}

/**
 * Scale and stretch active layer dimensions, supporting aspect locking
 */
function adjustStretch(dimension, delta) {
    const isVector = activeLayer === 'vector';
    const target = isVector ? calibrationTarget : imageCalibrationTarget;
    const ratio = isVector ? (11.0000 / 10.6667) : 1.0;
    
    if (dimension === 'x') {
        target.xScale += delta;
        if (isVector) {
            target.xScale = Math.max(0.01, Math.min(100.0, target.xScale));
            if (aspectLock) {
                target.yScale = target.xScale * ratio;
            }
        } else {
            target.xScale = Math.max(0.01, Math.min(100.0, target.xScale));
            if (aspectLock) {
                target.yScale = target.xScale * ratio;
            }
        }
    } else {
        target.yScale += delta;
        if (isVector) {
            target.yScale = Math.max(0.01, Math.min(100.0, target.yScale));
            if (aspectLock) {
                target.xScale = target.yScale / ratio;
            }
        } else {
            target.yScale = Math.max(0.01, Math.min(100.0, target.yScale));
            if (aspectLock) {
                target.xScale = target.yScale / ratio;
            }
        }
    }
    
    syncTransformToolbarUI();
}

// --- Canvas Engine Initialization ---

function initCanvas() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Add Mouse drag-to-pan
    canvas.addEventListener('mousedown', (e) => {
        if (isRecording) return; // disable during recording
        state.camera.isPanning = true;
        state.camera.startX = e.clientX;
        state.camera.startY = e.clientY;
        state.camera.dragStartX = state.camera.targetX;
        state.camera.dragStartY = state.camera.targetY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!state.camera.isPanning || isRecording) return;
        const dx = e.clientX - state.camera.startX;
        const dy = e.clientY - state.camera.startY;
        
        // Translate screen drag delta to map coordinate drag delta (relative to current scale)
        state.camera.targetX = state.camera.dragStartX - dx / state.camera.zoom;
        state.camera.targetY = state.camera.dragStartY - dy / state.camera.zoom;
        
        // Break active camera centering lock if user drags
        if (state.camera.lockToPath && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
            state.camera.lockToPath = false;
            cameraLock.checked = false;
        }
    });

    window.addEventListener('mouseup', () => {
        state.camera.isPanning = false;
    });

    // Add scroll-to-zoom towards mouse pointer
    canvas.addEventListener('wheel', (e) => {
        if (isRecording) return; // disable during recording
        e.preventDefault();
        
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.max(0.12, Math.min(3.5, state.camera.targetZoom * zoomFactor));
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Find point under mouse in map space
        const mapMouseX = (mouseX - canvas.width / 2) / state.camera.zoom + state.camera.x;
        const mapMouseY = (mouseY - canvas.height / 2) / state.camera.zoom + state.camera.y;
        
        state.camera.targetZoom = newZoom;
        state.camera.targetX = mapMouseX - (mouseX - canvas.width / 2) / newZoom;
        state.camera.targetY = mapMouseY - (mouseY - canvas.height / 2) / newZoom;
        
        // Sync zoom-follow slider value to match manual wheel zoom
        cameraZoomSlider.value = newZoom.toFixed(2);
        cameraZoomVal.textContent = newZoom.toFixed(2) + 'x';

        // Break camera centering lock on zoom
        if (state.camera.lockToPath) {
            state.camera.lockToPath = false;
            cameraLock.checked = false;
        }
    }, { passive: false });
}

function resizeCanvas() {
    if (isRecording) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// --- Autocomplete Search Inputs Engine ---

function setupAutocomplete() {
    const handleInput = (inputEl, dropdownEl, clearBtn) => {
        const query = inputEl.value.trim().toLowerCase();
        
        if (query.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }

        if (query.length < 1) {
            dropdownEl.innerHTML = '';
            dropdownEl.classList.add('hidden');
            return;
        }

        // Filter countries based on Name properties
        const matches = state.countries.filter(c => {
            const name = (c.properties.NAME || c.properties.ADMIN || "").toLowerCase();
            const formal = (c.properties.FORMAL_EN || "").toLowerCase();
            return name.includes(query) || formal.includes(query);
        });

        // Limit results to top 8 for UI neatness
        const slice = matches.slice(0, 8);
        
        if (slice.length === 0) {
            dropdownEl.innerHTML = '<div class="suggestion-item" style="cursor:default;color:#64748b;">No countries found</div>';
            dropdownEl.classList.remove('hidden');
            return;
        }

        dropdownEl.innerHTML = '';
        slice.forEach(country => {
            const name = country.properties.NAME || country.properties.ADMIN;
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = name;
            item.addEventListener('click', () => {
                inputEl.value = name;
                dropdownEl.classList.add('hidden');
                
                if (inputEl === originInput) {
                    state.selectedOrigin = country;
                } else {
                    state.selectedDest = country;
                }
                
                routeUpdated();
            });
            dropdownEl.appendChild(item);
        });
        dropdownEl.classList.remove('hidden');
    };

    originInput.addEventListener('input', () => handleInput(originInput, originDropdown, clearOriginBtn));
    destInput.addEventListener('input', () => handleInput(destInput, destDropdown, clearDestBtn));

    // Clear Button Operations
    clearOriginBtn.addEventListener('click', () => {
        originInput.value = '';
        state.selectedOrigin = null;
        clearOriginBtn.classList.add('hidden');
        originDropdown.classList.add('hidden');
        routeUpdated();
    });

    clearDestBtn.addEventListener('click', () => {
        destInput.value = '';
        state.selectedDest = null;
        clearDestBtn.classList.add('hidden');
        destDropdown.classList.add('hidden');
        routeUpdated();
    });

    // Close suggestion boxes when clicking outside
    document.addEventListener('click', (e) => {
        if (!originInput.contains(e.target) && !originDropdown.contains(e.target)) {
            originDropdown.classList.add('hidden');
        }
        if (!destInput.contains(e.target) && !destDropdown.contains(e.target)) {
            destDropdown.classList.add('hidden');
        }
    });
}

// --- Flight Path Logic and Geometry ---

/**
 * Handle updates when origin/destination selection changes
 */
function routeUpdated() {
    if (state.selectedOrigin && state.selectedDest) {
        if (state.selectedOrigin === state.selectedDest) {
            showToast("Departure and arrival countries must be different!");
            state.selectedDest = null;
            destInput.value = '';
            clearDestBtn.classList.add('hidden');
            disableFlightControls();
            return;
        }

        // Calculate and Show details
        const c1 = getCountryCentroid(state.selectedOrigin);
        const c2 = getCountryCentroid(state.selectedDest);
        
        const dist = calculateDistance(c1[0], c1[1], c2[0], c2[1]);
        totalDistance = dist;
        const heading = calculateHeading(c1[0], c1[1], c2[0], c2[1]);
        
        // Speed estimate: Standard commercial jet (850 km/h) + 0.5 hour taxiing
        const hrs = (dist / 850) + 0.5;
        const hPart = Math.floor(hrs);
        const mPart = Math.round((hrs - hPart) * 60);

        const distStr = `${Math.round(dist).toLocaleString()} km`;
        const headingStr = `${Math.round(heading)}° (${getCompassDirection(heading)})`;

        distanceVal.textContent = distStr;
        durationVal.textContent = `${hPart}h ${mPart}m`;
        headingVal.textContent = headingStr;
        statusVal.textContent = "Ready";
        statsPanel.classList.remove('hidden');

        // Update glowing HUD telemetry overlays (Bottom Left)
        const name1 = state.selectedOrigin.properties.NAME || state.selectedOrigin.properties.ADMIN;
        const name2 = state.selectedDest.properties.NAME || state.selectedDest.properties.ADMIN;
        hudOrigin.textContent = name1.toUpperCase();
        hudDest.textContent = name2.toUpperCase();
        hudDist.textContent = distStr;
        hudHeading.textContent = headingStr;
        hudPanel.classList.remove('hidden');

        // Enable Playback Buttons
        playBtn.removeAttribute('disabled');
        resetBtn.removeAttribute('disabled');
        downloadBtn.removeAttribute('disabled');
        timelineScrubber.removeAttribute('disabled');
        focusFlightBtn.removeAttribute('disabled');

        state.animation.progress = 0;
        state.animation.isPlaying = false;
        playBtn.innerHTML = '<span class="btn-icon">▶</span> Play';
        
        updateScrubberUI();

        // Lock camera and focus on the flight path
        if (state.camera.lockToPath) {
            focusOnFlightPath();
        }
    } else {
        disableFlightControls();
    }
}

function disableFlightControls() {
    statsPanel.classList.add('hidden');
    hudPanel.classList.add('hidden');
    playBtn.setAttribute('disabled', 'true');
    resetBtn.setAttribute('disabled', 'true');
    downloadBtn.setAttribute('disabled', 'true');
    timelineScrubber.setAttribute('disabled', 'true');
    focusFlightBtn.setAttribute('disabled', 'true');
    
    state.animation.isPlaying = false;
    state.animation.progress = 0;
    playBtn.innerHTML = '<span class="btn-icon">▶</span> Play';
    updateScrubberUI();
}

function getCompassDirection(heading) {
    const sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return sectors[index];
}

/**
 * Frame camera bounds to fit both selected centroids perfectly, respecting zoom focus options
 */
function focusOnFlightPath() {
    if (!state.selectedOrigin || !state.selectedDest) return;

    const c1 = getCountryCentroid(state.selectedOrigin);
    const c2 = getCountryCentroid(state.selectedDest);
    
    const p1 = projectCoords(c1[0], c1[1]);
    const p2 = projectCoords(c2[0], c2[1]);

    // Midpoint coordinate
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;

    // Boundary box sizes
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);

    // Zoom framing select configuration
    const framingVal = zoomFramingSelect.value;
    let marginScale = 1.6; // balanced default
    if (framingVal === 'close') {
        marginScale = 1.0; // tight zoom close-up
    } else if (framingVal === 'wide') {
        marginScale = 2.5; // far-out overview
    }

    const zoomX = canvas.width / (dx * marginScale || 500);
    const zoomY = canvas.height / (dy * marginScale || 500);
    
    // Smooth target coordinates
    state.camera.targetX = cx;
    state.camera.targetY = cy;
    
    // Bounds of focus zoom
    const minZ = 0.15;
    const maxZ = framingVal === 'close' ? 2.5 : 1.8;
    const computedZoom = Math.max(minZ, Math.min(maxZ, Math.min(zoomX, zoomY)));
    state.camera.targetZoom = computedZoom;

    // Sync camera zoom follow slider value to match active zoom framing
    cameraZoomSlider.value = computedZoom.toFixed(2);
    cameraZoomVal.textContent = computedZoom.toFixed(2) + 'x';
}

// --- Bezier Geometry & Trajectory ---

/**
 * Returns point on quadratic Bezier curve at factor t (0.0 to 1.0)
 */
function getBezierPoint(p0, p1, p2, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
}

/**
 * Returns derivative direction vector on quadratic Bezier curve at t
 */
function getBezierDerivative(p0, p1, p2, t) {
    return {
        x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
        y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    };
}

/**
 * Returns the control point to curve the path upward
 */
function getFlightBezierControlPoint(p0, p2) {
    // Midpoint
    const mx = (p0.x + p2.x) / 2;
    const my = (p0.y + p2.y) / 2;

    // Curve height is proportional to coordinate distance
    const dx = p2.x - p0.x;
    const dy = p2.y - p0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Create an arch pointing upward (negative Y offset on map)
    const archHeight = Math.max(150, dist * 0.22);
    
    return {
        x: mx,
        y: my - archHeight
    };
}

// --- Particle Trail Spark System ---

function spawnTrailParticles(tipX, tipY, angle, zoom) {
    // Spawn 2-3 spark particles behind the engine tip
    const count = Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
        // Base exhaust velocity is opposite to direction of travel
        const exhaustAngle = angle + Math.PI + (Math.random() - 0.5) * 0.4;
        const speed = (2 + Math.random() * 4) / zoom;
        
        // Match active theme accent color for sparks
        const baseHue = state.styles.themeName === 'red' ? 15 :
                        state.styles.themeName === 'cyan' ? 185 :
                        state.styles.themeName === 'emerald' ? 145 :
                        state.styles.themeName === 'amber' ? 38 : 265;

        state.animation.particles.push({
            x: tipX,
            y: tipY,
            vx: Math.cos(exhaustAngle) * speed,
            vy: Math.sin(exhaustAngle) * speed,
            life: 0,
            maxLife: 20 + Math.floor(Math.random() * 30),
            size: (2.2 + Math.random() * 3.5) / zoom,
            opacity: 0.8 + Math.random() * 0.2,
            color: `hsl(${baseHue + (Math.random() - 0.5) * 15}, 95%, ${50 + Math.random() * 30}%)`
        });
    }
}

function updateAndDrawParticles(ctx) {
    const active = [];
    
    for (const p of state.animation.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        
        // Slow down slightly (friction)
        p.vx *= 0.95;
        p.vy *= 0.95;

        if (p.life < p.maxLife) {
            const lifeRatio = p.life / p.maxLife;
            const currentOpacity = p.opacity * (1 - lifeRatio);
            const currentSize = p.size * (1 - lifeRatio * 0.5);

            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = currentOpacity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            active.push(p);
        }
    }
    
    state.animation.particles = active;
}

// --- Main Drawing and Rendering Pipeline ---

/**
 * Draws all features of a country boundary (glowing theme outline + fill + scanline waves)
 */
function drawCountryBoundary(ctx, feature, fillColor, strokeColor, glowColor) {
    ctx.save();
    
    const time = Date.now();
    
    // Shaded pulsing base fill opacity (gently oscillates using sine)
    const pulseOpacity = 0.15 + 0.12 * Math.sin(time / 450);
    ctx.fillStyle = fillColor.replace(/rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[\d\.]+)?\)/, `rgba($1, $2, $3, ${pulseOpacity})`);
    
    // Dynamic pulsing boundary glow
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8 / state.camera.zoom;
    ctx.lineJoin = 'round';
    
    if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10 + 6 * Math.sin(time / 200); // outline pulses
    }

    const pathPolygon = (polygon) => {
        ctx.beginPath();
        let isFirst = true;
        for (const ring of polygon) {
            for (const pt of ring) {
                const projected = projectCoords(pt[0], pt[1]);
                if (isFirst) {
                    ctx.moveTo(projected.x, projected.y);
                    isFirst = false;
                } else {
                    ctx.lineTo(projected.x, projected.y);
                }
            }
        }
        ctx.closePath();
    };

    const drawCombinedPolygon = () => {
        if (feature.geometry.type === "Polygon") {
            pathPolygon(feature.geometry.coordinates);
            ctx.fill();
            ctx.stroke();
        } else if (feature.geometry.type === "MultiPolygon") {
            for (const polyCoords of feature.geometry.coordinates) {
                pathPolygon(polyCoords);
                ctx.fill();
                ctx.stroke();
            }
        }
    };

    // 1. Draw outline and base fill
    drawCombinedPolygon();

    // 2. Futuristic sweeping diagonal scanlines (masked within country shape)
    const bbox = getFeatureBoundingBox(feature);
    if (bbox) {
        ctx.save();
        // Create clipping mask of country polygons
        ctx.beginPath();
        const clipPoly = (polygon) => {
            let isFirst = true;
            for (const ring of polygon) {
                for (const pt of ring) {
                    const projected = projectCoords(pt[0], pt[1]);
                    if (isFirst) {
                        ctx.moveTo(projected.x, projected.y);
                        isFirst = false;
                    } else {
                        ctx.lineTo(projected.x, projected.y);
                    }
                }
            }
            ctx.closePath();
        };

        if (feature.geometry.type === "Polygon") {
            clipPoly(feature.geometry.coordinates);
        } else if (feature.geometry.type === "MultiPolygon") {
            for (const polyCoords of feature.geometry.coordinates) {
                clipPoly(polyCoords);
            }
        }
        ctx.clip(); // Mask is locked!

        // Draw sweeping diagonal scanning bands
        const sweepRange = bbox.width + bbox.height;
        const sweepSpeed = 0.15; // Sweep velocity
        const sweepOffset = (time * sweepSpeed) % sweepRange;
        const sweepLineX = bbox.minX + sweepOffset;

        // Glowing thicker stripe
        ctx.strokeStyle = strokeColor.replace(/rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[\d\.]+)?\)/, 'rgba($1, $2, $3, 0.12)');
        ctx.lineWidth = 25 / state.camera.zoom;
        ctx.beginPath();
        ctx.moveTo(sweepLineX - 30 / state.camera.zoom, bbox.minY - 10);
        ctx.lineTo(sweepLineX - bbox.height - 30 / state.camera.zoom, bbox.maxY + 10);
        ctx.stroke();

        // High-glowing razor sweeping line
        ctx.strokeStyle = strokeColor.replace(/rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[\d\.]+)?\)/, 'rgba($1, $2, $3, 0.6)');
        ctx.lineWidth = 2.5 / state.camera.zoom;
        ctx.beginPath();
        ctx.moveTo(sweepLineX, bbox.minY - 10);
        ctx.lineTo(sweepLineX - bbox.height, bbox.maxY + 10);
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();
}

/**
 * High-performance 60fps main render loop
 */
function animateFrame(timestamp) {
    if (!state.animation.lastTime) state.animation.lastTime = timestamp;
    const dt = (timestamp - state.animation.lastTime) / 1000;
    state.animation.lastTime = timestamp;

    // lerp Easing calculations for calibration and image layers
    const ease = (curr, target, factor) => curr + (target - curr) * factor;
    
    calibration.xOffset = ease(calibration.xOffset, calibrationTarget.xOffset, 0.18);
    calibration.yOffset = ease(calibration.yOffset, calibrationTarget.yOffset, 0.18);
    calibration.xScale = ease(calibration.xScale, calibrationTarget.xScale, 0.18);
    calibration.yScale = ease(calibration.yScale, calibrationTarget.yScale, 0.18);
    calibration.rotation = ease(calibration.rotation, calibrationTarget.rotation, 0.18);
    calibration.skewX = ease(calibration.skewX, calibrationTarget.skewX, 0.18);
    calibration.skewY = ease(calibration.skewY, calibrationTarget.skewY, 0.18);

    imageCalibration.xOffset = ease(imageCalibration.xOffset, imageCalibrationTarget.xOffset, 0.18);
    imageCalibration.yOffset = ease(imageCalibration.yOffset, imageCalibrationTarget.yOffset, 0.18);
    imageCalibration.xScale = ease(imageCalibration.xScale, imageCalibrationTarget.xScale, 0.18);
    imageCalibration.yScale = ease(imageCalibration.yScale, imageCalibrationTarget.yScale, 0.18);
    imageCalibration.rotation = ease(imageCalibration.rotation, imageCalibrationTarget.rotation, 0.18);
    imageCalibration.skewX = ease(imageCalibration.skewX, imageCalibrationTarget.skewX, 0.18);
    imageCalibration.skewY = ease(imageCalibration.skewY, imageCalibrationTarget.skewY, 0.18);

    imageEffects.brightness = ease(imageEffects.brightness, imageEffectsTarget.brightness, 0.18);
    imageEffects.contrast = ease(imageEffects.contrast, imageEffectsTarget.contrast, 0.18);
    imageEffects.saturation = ease(imageEffects.saturation, imageEffectsTarget.saturation, 0.18);
    imageEffects.opacity = ease(imageEffects.opacity, imageEffectsTarget.opacity, 0.18);
    imageEffects.blur = ease(imageEffects.blur, imageEffectsTarget.blur, 0.18);
    imageEffects.hueRotate = ease(imageEffects.hueRotate, imageEffectsTarget.hueRotate, 0.18);
    imageEffects.grayscale = ease(imageEffects.grayscale, imageEffectsTarget.grayscale, 0.18);
    imageEffects.invert = ease(imageEffects.invert, imageEffectsTarget.invert, 0.18);

    // 1. Camera interpolation (smooth zoom/pan transitions)
    state.camera.x += (state.camera.targetX - state.camera.x) * 0.08;
    state.camera.y += (state.camera.targetY - state.camera.y) * 0.08;
    state.camera.zoom += (state.camera.targetZoom - state.camera.zoom) * 0.08;

    // 2. Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Apply active camera transformations
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    // --- Draw Base Layer: World map Image ---
    if (state.mapLoaded) {
        ctx.save();
        // 1. Move to translation center pivot (so rotation and skew are centered around map origin)
        const dw = MAP_WIDTH * imageCalibration.xScale;
        const dh = MAP_HEIGHT * imageCalibration.yScale;
        ctx.translate(imageCalibration.xOffset + dw / 2, imageCalibration.yOffset + dh / 2);
        
        // 2. Apply Skew transformations
        const skewXRad = (imageCalibration.skewX || 0.0) * Math.PI / 180;
        const skewYRad = (imageCalibration.skewY || 0.0) * Math.PI / 180;
        ctx.transform(1, Math.tan(skewYRad), Math.tan(skewXRad), 1, 0, 0);
        
        // 3. Apply Rotation angle
        const rotRad = (imageCalibration.rotation || 0.0) * Math.PI / 180;
        ctx.rotate(rotRad);
        
        // 4. Apply image effects (including new grayscale and invert parameters)
        ctx.filter = `brightness(${imageEffects.brightness}%) contrast(${imageEffects.contrast}%) saturate(${imageEffects.saturation}%) opacity(${imageEffects.opacity}%) blur(${imageEffects.blur}px) hue-rotate(${imageEffects.hueRotate}deg) grayscale(${imageEffects.grayscale}%) invert(${imageEffects.invert}%)`;
        
        // 5. Draw image centered on the pivot
        ctx.drawImage(
            mapImg, 
            -dw / 2, 
            -dh / 2, 
            dw, 
            dh
        );
        ctx.restore();
    }

    // --- Draw Intermediate Layer: Global Wireframe (Show Calibration) ---
    // If "Outline All Countries" is checked, outline the entire world in subtle, theme-matching neon wireframe!
    if (outlineAllToggle && outlineAllToggle.checked && state.geojsonLoaded) {
        state.countries.forEach(country => {
            if (country !== state.selectedOrigin && country !== state.selectedDest) {
                drawCountryBoundary(
                    ctx, 
                    country, 
                    'rgba(255, 255, 255, 0.005)',   // faint fill
                    state.styles.accentColorDim,   // matching theme boundary wireframe
                    null                            // no heavy shadow glow (for 60fps performance!)
                );
            }
        });
    }

    // --- Draw Selected Countries Pulsing Highlights ---
    if (state.selectedOrigin) {
        drawCountryBoundary(
            ctx, 
            state.selectedOrigin, 
            state.styles.accentColorDim, 
            state.styles.accentColor, 
            state.styles.accentColorGlow
        );
    }
    if (state.selectedDest) {
        drawCountryBoundary(
            ctx, 
            state.selectedDest, 
            state.styles.accentColorDim, 
            state.styles.accentColor, 
            state.styles.accentColorGlow
        );
    }

    // --- Draw Top Layer: Flight Path and Sparks ---
    if (state.selectedOrigin && state.selectedDest) {
        const c1 = getCountryCentroid(state.selectedOrigin);
        const c2 = getCountryCentroid(state.selectedDest);
        
        const p0 = projectCoords(c1[0], c1[1]);
        const p2 = projectCoords(c2[0], c2[1]);
        const p1 = getFlightBezierControlPoint(p0, p2);

        const currentT = state.animation.progress;

        // Draw planned flight route (dashed, translucent white line)
        ctx.save();
        ctx.beginPath();
        const tipPtStart = getBezierPoint(p0, p1, p2, currentT);
        ctx.moveTo(tipPtStart.x, tipPtStart.y);
        const dashSteps = Math.ceil((1 - currentT) * 100);
        for (let i = 1; i <= dashSteps; i++) {
            const t = currentT + (i / dashSteps) * (1 - currentT);
            const pt = getBezierPoint(p0, p1, p2, t);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2.2 / state.camera.zoom;
        ctx.setLineDash([8 / state.camera.zoom, 6 / state.camera.zoom]);
        ctx.stroke();
        ctx.restore();

        // Draw traveled route (solid glowing color theme line)
        if (currentT > 0.001) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            const drawSteps = Math.ceil(currentT * 100);
            for (let i = 1; i <= drawSteps; i++) {
                const t = (i / drawSteps) * currentT;
                const pt = getBezierPoint(p0, p1, p2, t);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = state.styles.trajectoryColor;
            ctx.lineWidth = 3.5 / state.camera.zoom;
            ctx.shadowColor = state.styles.trajectoryColorGlow;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.restore();
        }

        // Update & Render sparks engine trail
        updateAndDrawParticles(ctx);

        // Calculate current tip coordinates and derivative flight angle
        const tipPt = getBezierPoint(p0, p1, p2, currentT);
        const deriv = getBezierDerivative(p0, p1, p2, currentT);
        const angle = Math.atan2(deriv.y, deriv.x);

        // Spawn engine spark particles when playing
        if (state.animation.isPlaying && currentT > 0 && currentT < 0.999) {
            spawnTrailParticles(tipPt.x, tipPt.y, angle, state.camera.zoom);
        }

        // --- DRAW Sleek Passenger Airplane Image ---
        ctx.save();
        ctx.translate(tipPt.x, tipPt.y);
        
        // The nose of the passenger plane in the provided PNG image points straight UP.
        // So we rotate by the slope derivative angle + 90 degrees (Math.PI / 2) to align it perfectly along the heading direction!
        ctx.rotate(angle + Math.PI / 2);
        
        ctx.shadowColor = state.styles.trajectoryColorGlow;
        ctx.shadowBlur = 15;

        // Custom size dependent on camera zoom level to maintain crisp visual scale
        const planeSize = 36 / state.camera.zoom;

        // Check if the custom airplane image is fully loaded, otherwise fall back to dynamic vector model
        if (planeImg.complete && planeImg.naturalWidth !== 0) {
            ctx.drawImage(planeImg, -planeSize / 2, -planeSize / 2, planeSize, planeSize);
        } else {
            // Backup sleek vector commercial jet model
            ctx.fillStyle = state.styles.trajectoryColor;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.0 / state.camera.zoom;

            // Fuselage Body Nose-to-Tail
            ctx.beginPath();
            ctx.moveTo(14 / state.camera.zoom, 0); // Nose tip
            ctx.quadraticCurveTo(8 / state.camera.zoom, -3.2 / state.camera.zoom, 3 / state.camera.zoom, -3.2 / state.camera.zoom);
            ctx.lineTo(-12 / state.camera.zoom, -3.2 / state.camera.zoom);
            ctx.quadraticCurveTo(-15 / state.camera.zoom, -3.2 / state.camera.zoom, -16 / state.camera.zoom, 0);
            ctx.quadraticCurveTo(-15 / state.camera.zoom, 3.2 / state.camera.zoom, -12 / state.camera.zoom, 3.2 / state.camera.zoom);
            ctx.lineTo(3 / state.camera.zoom, 3.2 / state.camera.zoom);
            ctx.quadraticCurveTo(8 / state.camera.zoom, 3.2 / state.camera.zoom, 14 / state.camera.zoom, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Main Wing Left
            ctx.beginPath();
            ctx.moveTo(1 / state.camera.zoom, -3.2 / state.camera.zoom);
            ctx.lineTo(-8 / state.camera.zoom, -19 / state.camera.zoom);
            ctx.lineTo(-12 / state.camera.zoom, -19 / state.camera.zoom);
            ctx.lineTo(-4 / state.camera.zoom, -3.2 / state.camera.zoom);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Main Wing Right
            ctx.beginPath();
            ctx.moveTo(1 / state.camera.zoom, 3.2 / state.camera.zoom);
            ctx.lineTo(-8 / state.camera.zoom, 19 / state.camera.zoom);
            ctx.lineTo(-12 / state.camera.zoom, 19 / state.camera.zoom);
            ctx.lineTo(-4 / state.camera.zoom, 3.2 / state.camera.zoom);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();

        // Increment animation progress
        if (state.animation.isPlaying) {
            const increment = (state.animation.speed * dt * 0.18); 
            state.animation.progress = Math.min(1.0, state.animation.progress + increment);
            
            updateScrubberUI();

            // Handle active camera target locks
            if (state.camera.lockToPath) {
                state.camera.targetX = tipPt.x;
                state.camera.targetY = tipPt.y;
                
                // Directly bind camera target zoom to the interactive camera-zoom slider value!
                state.camera.targetZoom = parseFloat(cameraZoomSlider.value);
            }

            // Sync screen recording tracking progress percentage
            if (isRecording) {
                recordingProgress.textContent = (state.animation.progress * 100).toFixed(0) + '%';
            }

            if (state.animation.progress >= 1.0) {
                if (isRecording) {
                    // Stop video capture automatically at final index!
                    state.animation.isPlaying = false;
                    mediaRecorder.stop();
                } else if (state.animation.loop) {
                    state.animation.progress = 0;
                    state.animation.particles = [];
                } else {
                    state.animation.isPlaying = false;
                    playBtn.innerHTML = '<span class="btn-icon">▶</span> Play';
                    statusVal.textContent = "Finished";
                }
            }
        }
    } else {
        // Render normal idle active particle engine if any exist
        updateAndDrawParticles(ctx);
    }

    ctx.restore();
    requestAnimationFrame(animateFrame);
}

// --- Scrubber & Timeline Updates ---

function updateScrubberUI() {
    const pct = (state.animation.progress * 100).toFixed(1);
    timelineScrubber.value = (state.animation.progress * 100);
    timelinePct.textContent = `${pct}%`;
    timelineFill.style.width = `${pct}%`;

    // Dynamic HUD Telemetry calculation (Bottom Left)
    if (state.selectedOrigin && state.selectedDest) {
        const remainingDist = Math.max(0, totalDistance * (1 - state.animation.progress));
        hudDist.textContent = `${Math.round(remainingDist).toLocaleString()} km`;

        // Compass Heading mapping during Bezier flight
        const c1 = getCountryCentroid(state.selectedOrigin);
        const c2 = getCountryCentroid(state.selectedDest);
        const p0 = projectCoords(c1[0], c1[1]);
        const p2 = projectCoords(c2[0], c2[1]);
        const p1 = getFlightBezierControlPoint(p0, p2);
        
        const deriv = getBezierDerivative(p0, p1, p2, state.animation.progress);
        
        // Convert screen Y coordinate space derivative (pointing down) to normal polar compass space
        let angleDeg = Math.atan2(deriv.x, -deriv.y) * 180 / Math.PI;
        const compHeading = (angleDeg + 360) % 360;
        hudHeading.textContent = `${Math.round(compHeading)}° (${getCompassDirection(compHeading)})`;
    }
}

// --- Setup Document Events & Observers ---

function setupUIEventListeners() {
    // Play/Pause Operations
    playBtn.addEventListener('click', () => {
        if (!state.selectedOrigin || !state.selectedDest) return;
        
        state.animation.isPlaying = !state.animation.isPlaying;
        if (state.animation.isPlaying) {
            playBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
            statusVal.textContent = "In Flight";
            
            // If starting from finished, reset to zero
            if (state.animation.progress >= 0.99) {
                state.animation.progress = 0;
                state.animation.particles = [];
            }
        } else {
            playBtn.innerHTML = '<span class="btn-icon">▶</span> Play';
            statusVal.textContent = "Paused";
        }
    });

    // Reset Operations
    resetBtn.addEventListener('click', () => {
        state.animation.isPlaying = false;
        state.animation.progress = 0;
        state.animation.particles = [];
        playBtn.innerHTML = '<span class="btn-icon">▶</span> Play';
        statusVal.textContent = "Ready";
        updateScrubberUI();
        
        if (state.camera.lockToPath) {
            focusOnFlightPath();
        }
    });

    // Scrubber Scrubbing Operations
    timelineScrubber.addEventListener('input', () => {
        state.animation.progress = parseFloat(timelineScrubber.value) / 100;
        updateScrubberUI();
        
        // Dynamic stats update
        if (state.animation.progress > 0 && state.animation.progress < 1) {
            statusVal.textContent = "Scrubbing";
        } else if (state.animation.progress >= 1) {
            statusVal.textContent = "Finished";
        } else {
            statusVal.textContent = "Ready";
        }

        // Camera track on scrub
        if (state.camera.lockToPath && state.selectedOrigin && state.selectedDest) {
            const c1 = getCountryCentroid(state.selectedOrigin);
            const c2 = getCountryCentroid(state.selectedDest);
            const p0 = projectCoords(c1[0], c1[1]);
            const p2 = projectCoords(c2[0], c2[1]);
            const p1 = getFlightBezierControlPoint(p0, p2);
            const tipPt = getBezierPoint(p0, p1, p2, state.animation.progress);
            state.camera.targetX = tipPt.x;
            state.camera.targetY = tipPt.y;
        }
    });

    // Speed Slider Operations
    speedSlider.addEventListener('input', () => {
        const speed = parseFloat(speedSlider.value);
        state.animation.speed = speed;
        speedLabel.textContent = `${speed.toFixed(2)}x`;
    });

    // Toggle Switches
    loopToggle.addEventListener('change', () => {
        state.animation.loop = loopToggle.checked;
    });

    cameraLock.addEventListener('change', () => {
        state.camera.lockToPath = cameraLock.checked;
        if (state.camera.lockToPath) {
            if (state.animation.isPlaying && state.selectedOrigin && state.selectedDest) {
                // Focus on flight tip
                const c1 = getCountryCentroid(state.selectedOrigin);
                const c2 = getCountryCentroid(state.selectedDest);
                const p0 = projectCoords(c1[0], c1[1]);
                const p2 = projectCoords(c2[0], c2[1]);
                const p1 = getFlightBezierControlPoint(p0, p2);
                const tipPt = getBezierPoint(p0, p1, p2, state.animation.progress);
                state.camera.targetX = tipPt.x;
                state.camera.targetY = tipPt.y;
            } else {
                focusOnFlightPath();
            }
        }
    });

    // Recenter Camera Shortcut
    recenterBtn.addEventListener('click', () => {
        state.camera.targetX = 1920;
        state.camera.targetY = 1070;
        state.camera.targetZoom = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_HEIGHT) * 0.95;
        
        state.camera.lockToPath = false;
        cameraLock.checked = false;
        
        // Sync zoom follow slider
        cameraZoomSlider.value = state.camera.targetZoom.toFixed(2);
        cameraZoomVal.textContent = state.camera.targetZoom.toFixed(2) + 'x';
    });

    // Focus Shortcut
    focusFlightBtn.addEventListener('click', () => {
        focusOnFlightPath();
        state.camera.lockToPath = true;
        cameraLock.checked = true;
    });

    // Dynamic Color Theme Switcher
    themeSelect.addEventListener('change', () => {
        const selectedTheme = themeSelect.value;
        const preset = THEME_PRESETS[selectedTheme];
        
        if (preset) {
            state.styles.themeName = selectedTheme;
            state.styles.accentColor = preset.accentColor;
            state.styles.accentColorGlow = preset.accentColorGlow;
            state.styles.accentColorDim = preset.accentColorDim;
            state.styles.trajectoryColor = preset.trajectoryColor;
            state.styles.trajectoryColorGlow = preset.trajectoryColorGlow;

            // Bind new CSS custom properties to immediately re-render sidebar panel accents
            document.documentElement.style.setProperty('--accent-red', preset.accentColor);
            document.documentElement.style.setProperty('--accent-red-glow', preset.accentColorGlow);
            document.documentElement.style.setProperty('--accent-red-dim', preset.accentColorDim);
        }
    });

    // Camera Focus Zoom Mode Selector
    zoomFramingSelect.addEventListener('change', () => {
        if (state.selectedOrigin && state.selectedDest) {
            focusOnFlightPath();
        }
    });

    // Camera Zoom Follow Slider Drag
    cameraZoomSlider.addEventListener('input', () => {
        const val = parseFloat(cameraZoomSlider.value);
        cameraZoomVal.textContent = val.toFixed(2) + 'x';
        state.camera.targetZoom = val;
    });

    // Collapsible Developer Calibration Card Controls (Guarded for null safety)
    const devCardHeader = document.getElementById('dev-card-header');
    const devContent = document.getElementById('dev-content');
    if (devCardHeader && devContent) {
        const collapseArrow = devCardHeader.querySelector('.collapse-arrow');
        devCardHeader.addEventListener('click', () => {
            const isHidden = devContent.style.display === 'none';
            if (isHidden) {
                devContent.style.display = 'flex';
                if (collapseArrow) collapseArrow.style.transform = 'rotate(180deg)';
            } else {
                devContent.style.display = 'none';
                if (collapseArrow) collapseArrow.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Bind real-time dynamic boundary calibration sliders (Guarded for null safety)
    const updateCalibrationReadout = () => {
        if (valXOffset) valXOffset.textContent = calibrationTarget.xOffset.toFixed(1);
        if (valYOffset) valYOffset.textContent = calibrationTarget.yOffset.toFixed(1);
        if (valXScale) valXScale.textContent = calibrationTarget.xScale.toFixed(3);
        if (valYScale) valYScale.textContent = calibrationTarget.yScale.toFixed(3);
        
        // Refresh centroids and telemetry calculations instantly
        if (state.selectedOrigin && state.selectedDest) {
            updateScrubberUI();
        }
    };

    const updateCalibrationFromSliders = () => {
        if (calXOffset && calYOffset && calXScale && calYScale) {
            calibrationTarget.xOffset = parseFloat(calXOffset.value);
            calibrationTarget.yOffset = parseFloat(calYOffset.value);
            calibrationTarget.xScale = parseFloat(calXScale.value);
            calibrationTarget.yScale = parseFloat(calYScale.value);
            updateCalibrationReadout();
        }
    };
    
    [calXOffset, calYOffset, calXScale, calYScale].forEach(slider => {
        if (slider) {
            slider.addEventListener('input', updateCalibrationFromSliders);
        }
    });

    // Photoshop Direct Keyboard Shortcuts (Arrow keys & WASD key nudge bindings!)
    window.addEventListener('keydown', (e) => {
        // Prevent nudges if user is actively entering text inside country search bars
        if (document.activeElement === originInput || document.activeElement === destInput) {
            return;
        }

        // Keycap visual highlights on physical keypresses
        const key = e.key.toLowerCase();
        let capEl = null;
        if (key === 'w') capEl = document.querySelector('.key-cap.key-w');
        else if (key === 'a') capEl = document.querySelector('.key-cap.key-a');
        else if (key === 's') capEl = document.querySelector('.key-cap.key-s');
        else if (key === 'd') capEl = document.querySelector('.key-cap.key-d');
        else if (e.key === 'ArrowUp') capEl = document.querySelector('.key-cap.key-arrowup');
        else if (e.key === 'ArrowDown') capEl = document.querySelector('.key-cap.key-arrowdown');
        else if (e.key === 'ArrowLeft') capEl = document.querySelector('.key-cap.key-arrowleft');
        else if (e.key === 'ArrowRight') capEl = document.querySelector('.key-cap.key-arrowright');
        
        if (capEl) {
            capEl.classList.add('key-pressed');
        }

        const stepSize = e.shiftKey ? 5.0 : 0.5;       // Nudge 5px if holding Shift, otherwise 0.5px
        const scaleStep = e.shiftKey ? 0.01 : 0.001;   // Scale 0.01 if holding Shift, otherwise 0.001
        let updated = false;

        const target = activeLayer === 'vector' ? calibrationTarget : imageCalibrationTarget;
        const isVector = activeLayer === 'vector';
        const ratio = isVector ? (11.0000 / 10.6667) : 1.0;

        switch (e.key) {
            // Photoshop Arrow Key Shifts (Horizontal & Vertical move)
            case 'ArrowLeft':
                target.xOffset -= stepSize;
                updated = true;
                e.preventDefault();
                break;
            case 'ArrowRight':
                target.xOffset += stepSize;
                updated = true;
                e.preventDefault();
                break;
            case 'ArrowUp':
                target.yOffset -= stepSize;
                updated = true;
                e.preventDefault();
                break;
            case 'ArrowDown':
                target.yOffset += stepSize;
                updated = true;
                e.preventDefault();
                break;
                
            // Photoshop W/A/S/D Stretches (Horizontal & Vertical scaling stretch)
            case 'a':
            case 'A':
                target.xScale -= scaleStep;
                if (isVector) {
                    target.xScale = Math.max(0.01, target.xScale);
                    if (aspectLock) target.yScale = target.xScale * ratio;
                } else {
                    target.xScale = Math.max(0.01, target.xScale);
                    if (aspectLock) target.yScale = target.xScale * ratio;
                }
                updated = true;
                break;
            case 'd':
            case 'D':
                target.xScale += scaleStep;
                if (isVector) {
                    target.xScale = Math.min(100.0, target.xScale);
                    if (aspectLock) target.yScale = target.xScale * ratio;
                } else {
                    target.xScale = Math.min(100.0, target.xScale);
                    if (aspectLock) target.yScale = target.xScale * ratio;
                }
                updated = true;
                break;
            case 'w':
            case 'W':
                target.yScale += scaleStep;
                if (isVector) {
                    target.yScale = Math.min(100.0, target.yScale);
                    if (aspectLock) target.xScale = target.yScale / ratio;
                } else {
                    target.yScale = Math.min(100.0, target.yScale);
                    if (aspectLock) target.xScale = target.yScale / ratio;
                }
                updated = true;
                break;
            case 's':
            case 'S':
                target.yScale -= scaleStep;
                if (isVector) {
                    target.yScale = Math.max(0.01, target.yScale);
                    if (aspectLock) target.xScale = target.yScale / ratio;
                } else {
                    target.yScale = Math.max(0.01, target.yScale);
                    if (aspectLock) target.xScale = target.yScale / ratio;
                }
                updated = true;
                break;
        }

        if (updated) {
            syncTransformToolbarUI();
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        let capEl = null;
        if (key === 'w') capEl = document.querySelector('.key-cap.key-w');
        else if (key === 'a') capEl = document.querySelector('.key-cap.key-a');
        else if (key === 's') capEl = document.querySelector('.key-cap.key-s');
        else if (key === 'd') capEl = document.querySelector('.key-cap.key-d');
        else if (e.key === 'ArrowUp') capEl = document.querySelector('.key-cap.key-arrowup');
        else if (e.key === 'ArrowDown') capEl = document.querySelector('.key-cap.key-arrowdown');
        else if (e.key === 'ArrowLeft') capEl = document.querySelector('.key-cap.key-arrowleft');
        else if (e.key === 'ArrowRight') capEl = document.querySelector('.key-cap.key-arrowright');
        
        if (capEl) {
            capEl.classList.remove('key-pressed');
        }
    });

    // Map Transform Studio Interactive Controls
    if (openCalibrationBtn) {
        openCalibrationBtn.addEventListener('click', () => {
            if (calibrationToolbar) {
                calibrationToolbar.classList.remove('hidden');
                
                // Automatically turn on outlines for accurate alignment!
                if (outlineAllToggle) {
                    outlineAllToggle.checked = true;
                }
                
                syncTransformToolbarUI();
                showToast("Map Transform Studio Active! Use Arrows / WASD to align.");
            }
        });
    }
    
    if (closeCalibrationBtn) {
        closeCalibrationBtn.addEventListener('click', () => {
            if (calibrationToolbar) {
                calibrationToolbar.classList.add('hidden');
            }
        });
    }
    
    if (toolbarDoneBtn) {
        toolbarDoneBtn.addEventListener('click', () => {
            if (calibrationToolbar) {
                calibrationToolbar.classList.add('hidden');
                showToast("Calibration workspace closed. Let's fly!");
            }
        });
    }

    if (btnSelectVectorLayer) {
        btnSelectVectorLayer.addEventListener('click', () => {
            activeLayer = 'vector';
            syncTransformToolbarUI();
        });
    }
    
    if (btnSelectImageLayer) {
        btnSelectImageLayer.addEventListener('click', () => {
            activeLayer = 'image';
            syncTransformToolbarUI();
        });
    }

    if (btnAspectLock) {
        btnAspectLock.addEventListener('click', () => {
            aspectLock = !aspectLock;
            syncTransformToolbarUI();
        });
    }

    if (btnNudgeUp) {
        btnNudgeUp.addEventListener('click', (e) => {
            const step = e.shiftKey ? 5.0 : 0.5;
            const target = activeLayer === 'vector' ? calibrationTarget : imageCalibrationTarget;
            target.yOffset -= step;
            syncTransformToolbarUI();
        });
    }
    
    if (btnNudgeDown) {
        btnNudgeDown.addEventListener('click', (e) => {
            const step = e.shiftKey ? 5.0 : 0.5;
            const target = activeLayer === 'vector' ? calibrationTarget : imageCalibrationTarget;
            target.yOffset += step;
            syncTransformToolbarUI();
        });
    }
    
    if (btnNudgeLeft) {
        btnNudgeLeft.addEventListener('click', (e) => {
            const step = e.shiftKey ? 5.0 : 0.5;
            const target = activeLayer === 'vector' ? calibrationTarget : imageCalibrationTarget;
            target.xOffset -= step;
            syncTransformToolbarUI();
        });
    }
    
    if (btnNudgeRight) {
        btnNudgeRight.addEventListener('click', (e) => {
            const step = e.shiftKey ? 5.0 : 0.5;
            const target = activeLayer === 'vector' ? calibrationTarget : imageCalibrationTarget;
            target.xOffset += step;
            syncTransformToolbarUI();
        });
    }

    if (btnStretchXDec) {
        btnStretchXDec.addEventListener('click', (e) => {
            const step = e.shiftKey ? 0.01 : 0.001;
            adjustStretch('x', -step);
        });
    }
    
    if (btnStretchXInc) {
        btnStretchXInc.addEventListener('click', (e) => {
            const step = e.shiftKey ? 0.01 : 0.001;
            adjustStretch('x', step);
        });
    }
    
    if (btnStretchYDec) {
        btnStretchYDec.addEventListener('click', (e) => {
            const step = e.shiftKey ? 0.01 : 0.001;
            adjustStretch('y', -step);
        });
    }
    
    if (btnStretchYInc) {
        btnStretchYInc.addEventListener('click', (e) => {
            const step = e.shiftKey ? 0.01 : 0.001;
            adjustStretch('y', step);
        });
    }

    if (proportionalZoomSlider) {
        proportionalZoomSlider.addEventListener('input', () => {
            const val = parseFloat(proportionalZoomSlider.value) / 100;
            const isVector = activeLayer === 'vector';
            const target = isVector ? calibrationTarget : imageCalibrationTarget;
            
            if (isVector) {
                target.xScale = 10.6667 * val;
                target.yScale = 11.0000 * val;
            } else {
                target.xScale = 1.0 * val;
                target.yScale = 1.0 * val;
            }
            
            syncTransformToolbarUI();
        });
    }

    // Save Settings Button Event Listener (Flask API post + localStorage backup)
    const triggerSaveSettings = () => {
        const payload = {
            xOffset: calibrationTarget.xOffset,
            yOffset: calibrationTarget.yOffset,
            xScale: calibrationTarget.xScale,
            yScale: calibrationTarget.yScale,
            rotation: calibrationTarget.rotation,
            skewX: calibrationTarget.skewX,
            skewY: calibrationTarget.skewY,
            imageXOffset: imageCalibrationTarget.xOffset,
            imageYOffset: imageCalibrationTarget.yOffset,
            imageXScale: imageCalibrationTarget.xScale,
            imageYScale: imageCalibrationTarget.yScale,
            imageRotation: imageCalibrationTarget.rotation,
            imageSkewX: imageCalibrationTarget.skewX,
            imageSkewY: imageCalibrationTarget.skewY,
            effectBrightness: imageEffectsTarget.brightness,
            effectContrast: imageEffectsTarget.contrast,
            effectSaturation: imageEffectsTarget.saturation,
            effectOpacity: imageEffectsTarget.opacity,
            effectBlur: imageEffectsTarget.blur,
            effectHue: imageEffectsTarget.hueRotate,
            effectGrayscale: imageEffectsTarget.grayscale,
            effectInvert: imageEffectsTarget.invert
        };
        
        // Browser localStorage fallback
        localStorage.setItem('aeroglide_calibration', JSON.stringify(payload));
        
        // Write persistently to local JSON file calibration_settings.json via Flask server
        fetch('/api/save_calibration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast("Calibration settings saved to disk!");
            } else {
                showToast("Saved to local storage. Server error: " + data.message);
            }
        })
        .catch(err => {
            showToast("Saved to browser local storage cache!");
            console.error("Save settings error:", err);
        });
    };

    if (saveCalibrationBtn) {
        saveCalibrationBtn.addEventListener('click', triggerSaveSettings);
    }
    
    if (toolbarSaveBtn) {
        toolbarSaveBtn.addEventListener('click', triggerSaveSettings);
    }

    if (workspaceBtnSave) {
        workspaceBtnSave.addEventListener('click', triggerSaveSettings);
    }

    // Bind real-time input event listeners for background map adjustments
    const bindSliderEffect = (sliderEl, readoutEl, stateKey, suffix) => {
        if (sliderEl) {
            sliderEl.addEventListener('input', () => {
                imageEffectsTarget[stateKey] = parseFloat(sliderEl.value);
                if (readoutEl) readoutEl.textContent = sliderEl.value + suffix;
                syncTransformToolbarUI();
            });
        }
    };

    bindSliderEffect(effectBrightness, valBrightness, 'brightness', '%');
    bindSliderEffect(effectContrast, valContrast, 'contrast', '%');
    bindSliderEffect(effectSaturation, valSaturation, 'saturation', '%');
    bindSliderEffect(effectOpacity, valOpacity, 'opacity', '%');
    bindSliderEffect(effectBlur, valBlur, 'blur', 'px');
    bindSliderEffect(effectHue, valHue, 'hueRotate', '°');

    if (btnResetEffects) {
        btnResetEffects.addEventListener('click', () => {
            imageEffectsTarget.brightness = 100.0;
            imageEffectsTarget.contrast = 100.0;
            imageEffectsTarget.saturation = 100.0;
            imageEffectsTarget.opacity = 100.0;
            imageEffectsTarget.blur = 0.0;
            imageEffectsTarget.hueRotate = 0.0;
            imageEffectsTarget.grayscale = 0.0;
            imageEffectsTarget.invert = 0.0;
            syncTransformToolbarUI();
            showToast("Background image adjustments reset to default!");
        });
    }

    // Bind Premium Sidebar Workspace Segmented layer tabs
    if (sidebarBtnVectorLayer) {
        sidebarBtnVectorLayer.addEventListener('click', () => {
            activeLayer = 'vector';
            syncTransformToolbarUI();
        });
    }

    if (sidebarBtnImageLayer) {
        sidebarBtnImageLayer.addEventListener('click', () => {
            activeLayer = 'image';
            syncTransformToolbarUI();
        });
    }

    if (workspaceBtnAspectLock) {
        workspaceBtnAspectLock.addEventListener('click', () => {
            aspectLock = !aspectLock;
            syncTransformToolbarUI();
        });
    }

    // Bind Premium Sidebar Studio transform sliders
    const updateWorkspaceFromSliders = () => {
        const isVector = activeLayer === 'vector';
        const target = isVector ? calibrationTarget : imageCalibrationTarget;
        const ratio = isVector ? (11.0000 / 10.6667) : 1.0;
        
        target.xOffset = parseFloat(workspaceXOffset.value);
        target.yOffset = parseFloat(workspaceYOffset.value);
        
        const newX = parseFloat(workspaceXScale.value);
        const newY = parseFloat(workspaceYScale.value);
        
        if (newX !== target.xScale) {
            target.xScale = newX;
            if (aspectLock) target.yScale = newX * ratio;
        } else if (newY !== target.yScale) {
            target.yScale = newY;
            if (aspectLock) target.xScale = newY / ratio;
        } else {
            target.xScale = newX;
            target.yScale = newY;
        }
        
        target.rotation = parseFloat(workspaceRotation.value);
        target.skewX = parseFloat(workspaceSkewX.value);
        target.skewY = parseFloat(workspaceSkewY.value);
        
        syncTransformToolbarUI();
    };

    [workspaceXOffset, workspaceYOffset, workspaceXScale, workspaceYScale, workspaceRotation, workspaceSkewX, workspaceSkewY].forEach(slider => {
        if (slider) slider.addEventListener('input', updateWorkspaceFromSliders);
    });

    // Bind Premium Sidebar Studio dedicated map picture adjustments
    const updateWorkspaceEffects = () => {
        imageEffectsTarget.brightness = parseFloat(workspaceBrightness.value);
        imageEffectsTarget.contrast = parseFloat(workspaceContrast.value);
        imageEffectsTarget.saturation = parseFloat(workspaceSaturation.value);
        imageEffectsTarget.opacity = parseFloat(workspaceOpacity.value);
        imageEffectsTarget.blur = parseFloat(workspaceBlur.value);
        imageEffectsTarget.hueRotate = parseFloat(workspaceHue.value);
        imageEffectsTarget.grayscale = parseFloat(workspaceGrayscale.value);
        imageEffectsTarget.invert = parseFloat(workspaceInvert.value);
        
        syncTransformToolbarUI();
    };

    [workspaceBrightness, workspaceContrast, workspaceSaturation, workspaceOpacity, workspaceBlur, workspaceHue, workspaceGrayscale, workspaceInvert].forEach(slider => {
        if (slider) slider.addEventListener('input', updateWorkspaceEffects);
    });

    if (workspaceBtnResetEffects) {
        workspaceBtnResetEffects.addEventListener('click', () => {
            imageEffectsTarget.brightness = 100.0;
            imageEffectsTarget.contrast = 100.0;
            imageEffectsTarget.saturation = 100.0;
            imageEffectsTarget.opacity = 100.0;
            imageEffectsTarget.blur = 0.0;
            imageEffectsTarget.hueRotate = 0.0;
            imageEffectsTarget.grayscale = 0.0;
            imageEffectsTarget.invert = 0.0;
            syncTransformToolbarUI();
            showToast("Background map picture color adjustments reset!");
        });
    }

    if (workspaceBtnResetLayout) {
        workspaceBtnResetLayout.addEventListener('click', () => {
            const isVector = activeLayer === 'vector';
            if (isVector) {
                calibrationTarget.xOffset = 1920.0;
                calibrationTarget.yOffset = 1070.0;
                calibrationTarget.xScale = 10.6667;
                calibrationTarget.yScale = 11.0000;
                calibrationTarget.rotation = 0.0;
                calibrationTarget.skewX = 0.0;
                calibrationTarget.skewY = 0.0;
            } else {
                imageCalibrationTarget.xOffset = 0.0;
                imageCalibrationTarget.yOffset = 0.0;
                imageCalibrationTarget.xScale = 1.0;
                imageCalibrationTarget.yScale = 1.0;
                imageCalibrationTarget.rotation = 0.0;
                imageCalibrationTarget.skewX = 0.0;
                imageCalibrationTarget.skewY = 0.0;
            }
            syncTransformToolbarUI();
            showToast("Active layer translation matrix reset!");
        });
    }

    // Wire up Auto-Align Outlines with Default Map Image Presets
    if (workspaceBtnAutoAlign) {
        workspaceBtnAutoAlign.addEventListener('click', () => {
            // Snaps outlines layer calibration to optimal map matching preset
            calibrationTarget.xOffset = 1920.0;
            calibrationTarget.yOffset = 1070.0;
            calibrationTarget.xScale = 10.6667;
            calibrationTarget.yScale = 11.0000;
            calibrationTarget.rotation = 0.0;
            calibrationTarget.skewX = 0.0;
            calibrationTarget.skewY = 0.0;

            // Snaps background map image layer calibration to default center values
            imageCalibrationTarget.xOffset = 0.0;
            imageCalibrationTarget.yOffset = 0.0;
            imageCalibrationTarget.xScale = 1.0;
            imageCalibrationTarget.yScale = 1.0;
            imageCalibrationTarget.rotation = 0.0;
            imageCalibrationTarget.skewX = 0.0;
            imageCalibrationTarget.skewY = 0.0;

            syncTransformToolbarUI();
            showToast("Outlines automatically aligned with default map!");
        });
    }

    // Wire up Show All Outlines toggle checkbox state indicators
    if (outlineAllToggle) {
        outlineAllToggle.addEventListener('change', () => {
            showToast(outlineAllToggle.checked ? "All country outlines overlay shown." : "Only active route outlines shown.");
        });
    }

    // Wire up Photoshop-grade Transform Presets in Picture Workspace
    if (btnPreset100) {
        btnPreset100.addEventListener('click', () => {
            imageCalibrationTarget.xScale = 1.0;
            imageCalibrationTarget.yScale = 1.0;
            syncTransformToolbarUI();
            showToast("Background image scale reset to 100%!");
        });
    }
    if (btnPreset200) {
        btnPreset200.addEventListener('click', () => {
            imageCalibrationTarget.xScale = 2.0;
            imageCalibrationTarget.yScale = 2.0;
            syncTransformToolbarUI();
            showToast("Background image scale doubled to 200%!");
        });
    }
    if (btnPresetCenter) {
        btnPresetCenter.addEventListener('click', () => {
            imageCalibrationTarget.xOffset = 0.0;
            imageCalibrationTarget.yOffset = 0.0;
            syncTransformToolbarUI();
            showToast("Background image centered!");
        });
    }
    if (btnPresetFlipH) {
        btnPresetFlipH.addEventListener('click', () => {
            imageCalibrationTarget.xScale = -imageCalibrationTarget.xScale;
            syncTransformToolbarUI();
            showToast("Background image flipped horizontally!");
        });
    }
    if (btnPresetFlipV) {
        btnPresetFlipV.addEventListener('click', () => {
            imageCalibrationTarget.yScale = -imageCalibrationTarget.yScale;
            syncTransformToolbarUI();
            showToast("Background image flipped vertically!");
        });
    }

    // Wire up Custom Background Map Image Uploader
    if (workspaceBtnUploadMap && workspaceMapUpload) {
        workspaceBtnUploadMap.addEventListener('click', () => {
            workspaceMapUpload.click();
        });

        workspaceMapUpload.addEventListener('change', () => {
            const file = workspaceMapUpload.files[0];
            if (!file) return;

            // 1. Instant local visual feedback
            const reader = new FileReader();
            reader.onload = (e) => {
                mapImg.src = e.target.result;
                showToast("Loading new background map instantly...");
            };
            reader.readAsDataURL(file);

            // 2. Upload file persistently to Flask server
            const formData = new FormData();
            formData.append('file', file);

            showToast("Saving custom map image to server...");
            fetch('/api/upload_map', {
                method: 'POST',
                body: formData
            })
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    showToast("Background map saved persistently to disk!");
                } else {
                    showToast("Preview loaded. Server save failed: " + data.message);
                }
            })
            .catch(err => {
                console.error("Map upload error:", err);
                showToast("Preview active. Failed to persist map on server.");
            });
        });
    }

    // Canvas WebM Exporter Button
    downloadBtn.addEventListener('click', () => {
        startCanvasRecording();
    });
}

// --- Dynamic Canvas HTML5 Screen Recorder (MediaRecorder API) ---

function toggleUIControls(disable) {
    const inputs = [
        originInput, destInput, speedSlider, loopToggle, 
        cameraLock, recenterBtn, focusFlightBtn, playBtn, 
        resetBtn, timelineScrubber, themeSelect, zoomFramingSelect, 
        downloadBtn, cameraZoomSlider, calXOffset, calYOffset, calXScale, 
        calYScale, saveCalibrationBtn, outlineAllToggle
    ];
    inputs.forEach(el => {
        if (el) {
            if (disable) {
                el.setAttribute('disabled', 'true');
            } else {
                el.removeAttribute('disabled');
            }
        }
    });
}

function startCanvasRecording() {
    if (!state.selectedOrigin || !state.selectedDest) return;

    isRecording = true;
    recordedChunks = [];
    
    // Store original responsive physical buffer sizes
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    
    // Temporarily lock physical canvas buffer to Full HD (1920x1080) for high-resolution video output
    canvas.width = 1920;
    canvas.height = 1080;
    
    // Disable panels, show the pulsing recording banner overlay
    toggleUIControls(true);
    recordingProgress.textContent = '0%';
    recordingOverlay.classList.remove('hidden');

    // Setup perfect start framing for the new 1920x1080 coordinates space
    state.animation.isPlaying = false;
    state.animation.progress = 0;
    state.animation.particles = [];
    state.camera.lockToPath = true;
    cameraLock.checked = true;
    
    // Recalculate zoom framing target inside 1920x1080 space
    focusOnFlightPath();

    // A small buffer delay of 950ms to let the camera pan smoothly to starting coordinates
    setTimeout(() => {
        // Capture canvas rendering stream at 60fps
        const stream = canvas.captureStream(60);
        
        // Setup cross-browser MediaRecorder container codecs with high bitrate (15 Mbps) for crystal clear HD
        let options = { 
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 15000000 // 15 Mbps for ultra crisp resolution!
        };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { 
                mimeType: 'video/webm;codecs=vp8',
                videoBitsPerSecond: 15000000 
            };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { 
                mimeType: 'video/webm',
                videoBitsPerSecond: 15000000 
            };
        }

        mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            // Build raw binary blob from the parts
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            
            // Build dynamic filename using country names
            const name1 = (state.selectedOrigin.properties.NAME || "origin").replace(/\s+/g, '_');
            const name2 = (state.selectedDest.properties.NAME || "destination").replace(/\s+/g, '_');

            const dl = document.createElement('a');
            dl.href = videoUrl;
            dl.download = `aeroglide-flight-${name1}-to-${name2}.webm`;
            document.body.appendChild(dl);
            dl.click();
            document.body.removeChild(dl);
            
            URL.revokeObjectURL(videoUrl);
            
            // Restore responsive canvas physical buffer dimensions
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Re-enable interface controls and clear banner
            isRecording = false;
            recordingOverlay.classList.add('hidden');
            toggleUIControls(false);
            
            // Recalculate camera zoom framing for responsive screen
            focusOnFlightPath();
            
            // Resume default loop state
            state.animation.isPlaying = false;
            playBtn.innerHTML = '<span class="btn-icon">▶</span> Play';
            statusVal.textContent = "Finished";
            
            showToast("High-definition flight video downloaded!");
        };

        // Start capture recorder
        mediaRecorder.start();
        
        // Trigger flight playback
        state.animation.isPlaying = true;
        playBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
        statusVal.textContent = "Recording...";
        
    }, 950);
}

// --- Load Calibration Settings from server on boot ---
function loadCalibrationSettings() {
    fetch('/api/get_calibration')
        .then(res => {
            if (!res.ok) throw new Error("Server error fetching settings");
            return res.json();
        })
        .then(data => {
            // Load values to active target state
            calibrationTarget.xOffset = data.xOffset;
            calibrationTarget.yOffset = data.yOffset;
            calibrationTarget.xScale = data.xScale;
            calibrationTarget.yScale = data.yScale;
            calibrationTarget.rotation = data.rotation !== undefined ? data.rotation : 0.0;
            calibrationTarget.skewX = data.skewX !== undefined ? data.skewX : 0.0;
            calibrationTarget.skewY = data.skewY !== undefined ? data.skewY : 0.0;
            
            imageCalibrationTarget.xOffset = data.imageXOffset !== undefined ? data.imageXOffset : 0.0;
            imageCalibrationTarget.yOffset = data.imageYOffset !== undefined ? data.imageYOffset : 0.0;
            imageCalibrationTarget.xScale = data.imageXScale !== undefined ? data.imageXScale : 1.0;
            imageCalibrationTarget.yScale = data.imageYScale !== undefined ? data.imageYScale : 1.0;
            imageCalibrationTarget.rotation = data.imageRotation !== undefined ? data.imageRotation : 0.0;
            imageCalibrationTarget.skewX = data.imageSkewX !== undefined ? data.imageSkewX : 0.0;
            imageCalibrationTarget.skewY = data.imageSkewY !== undefined ? data.imageSkewY : 0.0;
            
            imageEffectsTarget.brightness = data.effectBrightness !== undefined ? data.effectBrightness : 100.0;
            imageEffectsTarget.contrast = data.effectContrast !== undefined ? data.effectContrast : 100.0;
            imageEffectsTarget.saturation = data.effectSaturation !== undefined ? data.effectSaturation : 100.0;
            imageEffectsTarget.opacity = data.effectOpacity !== undefined ? data.effectOpacity : 100.0;
            imageEffectsTarget.blur = data.effectBlur !== undefined ? data.effectBlur : 0.0;
            imageEffectsTarget.hueRotate = data.effectHue !== undefined ? data.effectHue : 0.0;
            imageEffectsTarget.grayscale = data.effectGrayscale !== undefined ? data.effectGrayscale : 0.0;
            imageEffectsTarget.invert = data.effectInvert !== undefined ? data.effectInvert : 0.0;
            
            // Instantly sync current render state to targets (prevents start-drift artifact)
            Object.assign(calibration, calibrationTarget);
            Object.assign(imageCalibration, imageCalibrationTarget);
            Object.assign(imageEffects, imageEffectsTarget);

            // Sync Dev Slider UI
            if (calXOffset) calXOffset.value = calibrationTarget.xOffset;
            if (calYOffset) calYOffset.value = calibrationTarget.yOffset;
            if (calXScale) calXScale.value = calibrationTarget.xScale;
            if (calYScale) calYScale.value = calibrationTarget.yScale;
            
            if (valXOffset) valXOffset.textContent = calibrationTarget.xOffset.toFixed(1);
            if (valYOffset) valYOffset.textContent = calibrationTarget.yOffset.toFixed(1);
            if (valXScale) valXScale.textContent = calibrationTarget.xScale.toFixed(3);
            if (valYScale) valYScale.textContent = calibrationTarget.yScale.toFixed(3);
            
            syncTransformToolbarUI();
            console.log("[AeroGlide] Calibration loaded from disk:", calibrationTarget, imageCalibrationTarget, imageEffectsTarget);
        })
        .catch(err => {
            console.warn("[AeroGlide] Failed to fetch server settings, reading browser local cache:", err);
            // Fallback to browser cache
            const saved = localStorage.getItem('aeroglide_calibration');
            if (saved) {
                const data = JSON.parse(saved);
                calibrationTarget.xOffset = data.xOffset;
                calibrationTarget.yOffset = data.yOffset;
                calibrationTarget.xScale = data.xScale;
                calibrationTarget.yScale = data.yScale;
                calibrationTarget.rotation = data.rotation !== undefined ? data.rotation : 0.0;
                calibrationTarget.skewX = data.skewX !== undefined ? data.skewX : 0.0;
                calibrationTarget.skewY = data.skewY !== undefined ? data.skewY : 0.0;
                 
                imageCalibrationTarget.xOffset = data.imageXOffset !== undefined ? data.imageXOffset : 0.0;
                imageCalibrationTarget.yOffset = data.imageYOffset !== undefined ? data.imageYOffset : 0.0;
                imageCalibrationTarget.xScale = data.imageXScale !== undefined ? data.imageXScale : 1.0;
                imageCalibrationTarget.yScale = data.imageYScale !== undefined ? data.imageYScale : 1.0;
                imageCalibrationTarget.rotation = data.imageRotation !== undefined ? data.imageRotation : 0.0;
                imageCalibrationTarget.skewX = data.imageSkewX !== undefined ? data.imageSkewX : 0.0;
                imageCalibrationTarget.skewY = data.imageSkewY !== undefined ? data.imageSkewY : 0.0;
                 
                imageEffectsTarget.brightness = data.effectBrightness !== undefined ? data.effectBrightness : 100.0;
                imageEffectsTarget.contrast = data.effectContrast !== undefined ? data.effectContrast : 100.0;
                imageEffectsTarget.saturation = data.effectSaturation !== undefined ? data.effectSaturation : 100.0;
                imageEffectsTarget.opacity = data.effectOpacity !== undefined ? data.effectOpacity : 100.0;
                imageEffectsTarget.blur = data.effectBlur !== undefined ? data.effectBlur : 0.0;
                imageEffectsTarget.hueRotate = data.effectHue !== undefined ? data.effectHue : 0.0;
                imageEffectsTarget.grayscale = data.effectGrayscale !== undefined ? data.effectGrayscale : 0.0;
                imageEffectsTarget.invert = data.effectInvert !== undefined ? data.effectInvert : 0.0;
                
                // Instantly sync current render state to targets (prevents start-drift artifact)
                Object.assign(calibration, calibrationTarget);
                Object.assign(imageCalibration, imageCalibrationTarget);
                Object.assign(imageEffects, imageEffectsTarget);

                if (calXOffset) calXOffset.value = calibrationTarget.xOffset;
                if (calYOffset) calYOffset.value = calibrationTarget.yOffset;
                if (calXScale) calXScale.value = calibrationTarget.xScale;
                if (calYScale) calYScale.value = calibrationTarget.yScale;
                
                if (valXOffset) valXOffset.textContent = calibrationTarget.xOffset.toFixed(1);
                if (valYOffset) valYOffset.textContent = calibrationTarget.yOffset.toFixed(1);
                if (valXScale) valXScale.textContent = calibrationTarget.xScale.toFixed(3);
                if (valYScale) valYScale.textContent = calibrationTarget.yScale.toFixed(3);
                
                syncTransformToolbarUI();
            }
        });
}

// --- Data Fetching and Initialization ---

function loadAssets() {
    // 1. Fetch map image
    mapImg.src = MAP_IMAGE_URL;
    mapImg.onload = () => {
        state.mapLoaded = true;
        // Default initial camera frame (fit map beautifully)
        state.camera.targetZoom = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_HEIGHT) * 0.95;
        state.camera.zoom = state.camera.targetZoom;
        state.camera.x = 1920;
        state.camera.y = 1070;
        state.camera.targetX = 1920;
        state.camera.targetY = 1070;
    };
    mapImg.onerror = () => {
        showToast("Error loading high-res world map image.");
    };

    // 2. Fetch GeoJSON
    fetch(GEOJSON_URL)
        .then(response => {
            if (!response.ok) throw new Error("HTTP error " + response.status);
            return response.json();
        })
        .then(geojson => {
            state.countries = geojson.features.sort((a, b) => {
                const nameA = a.properties.NAME || a.properties.ADMIN || "";
                const nameB = b.properties.NAME || b.properties.ADMIN || "";
                return nameA.localeCompare(nameB);
            });
            state.geojsonLoaded = true;
            setupAutocomplete();
        })
        .catch(err => {
            console.error("GeoJSON Load Error:", err);
            showToast("Failed to load country boundary polygons.");
        });
}

// --- Document Startup Entry ---
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupUIEventListeners();
    loadCalibrationSettings();
    loadAssets();
    
    // Start hardware-accelerated 60fps render loop
    requestAnimationFrame(animateFrame);
    
    showToast("AeroGlide Upgraded! Outline alignment tool active.");
});
