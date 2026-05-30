# ✈️ AeroGlide - Flight Path Animator

AeroGlide is a high-performance, 60fps interactive HTML5 Canvas Flight Path Animator and Map Studio. Designed with a premium dark-mode glassmorphic interface, it allows users to animate realistic curved orthodromic flight paths between countries, customize styling, fine-tune alignment layers, and export high-definition flight animation videos.

---

## 🌟 Key Features

### 🎮 Interactive Route Planning
- **Search & Auto-Complete**: Quickly search and select Departure (Origin) and Arrival (Destination) countries from a global wireframe boundary dataset.
- **Flight Path Generation**: Generates smooth quadratic Bezier trajectories resembling real-world aviation corridors.
- **Real-Time Flight HUD**: Bottom-left glassmorphic panel displays orthodromic distance (km), flight duration, initial heading, flight speed, and real-time telemetry updates.

### 🎨 Trajectory & Map Customizations
- **Styling Themes**: Swap between multiple high-fidelity neon color presets (Cyber Neon Red, Electric Cyan, Matrix Emerald, Solar Amber, Cosmic Violet).
- **Line Trace Choices**: Customize the flight trail left behind by the aircraft (Solid Glowing Line, Dashed, Dotted, or None).
- **Jet Engine Particles**: Toggle dynamic glowing engine trail spark particles that spray in real-time behind the passenger plane during flight.
- **Responsive Viewport Controls**: Drag to pan across the world, scroll to zoom, recenter the camera, or lock camera zoom tightly onto the plane's flight coordinates.

### 🛠️ Map Transform & Calibration Studio
- **Segmented Layer Control**: Select and modify the **🌐 Country Outlines Layer** or the **🖼️ Background Map Image Layer** independently.
- **High-Precision Calibration**: Smoothly ease X/Y offsets, X/Y scales, rotation angles, and horizontal/vertical skews at 60fps using custom linear interpolation (`lerp`) engines.
- **Fine-Tuning Nudges**: Click `-` and `+` arrows next to values in the sidebar for precise step-by-step calibrations.
- **Keyboard Inline Entry**: Click directly on any readout value in the sidebar to type in a precise value using your keyboard.
- **Background Map Adjustments**: Slide controls for real-time map brightness, contrast, saturation, opacity, blur focus, hue rotation, grayscale, and color inversion.
- **Auto-Align saved Preset**: Snaps the world coordinates back to your last saved custom calibration settings.
- **Dynamic Background Changer**: Instantly upload your own background map images with persist-to-server capability.

### 📹 Premium WebM Video Exporter
- Captures and records canvas streams at **60fps** using high-bitrate WebM codecs (VP9/VP8).
- **Hidden UI Exports**: All sidebar controllers and overlays are automatically excluded from the final recording, rendering only the crisp canvas buffer.
- **Stable Outlines**: Disables pulsating country outlines during recording to produce professional, clean flight presentations.
- **Lag-Free Camera Follow**: Instantly snaps and tracks the plane tip from frame 1, eliminating startup panning drift.
- **Live Recording Adjustments**: Change themes, customize trails, or zoom live while exporting without interrupting the recording stream!

---

## 🛠️ Technology Stack
- **Frontend**: Vanilla JavaScript (HTML5 Canvas 2D API), HSL-curated styling (Vanilla CSS3), responsive UI overlays.
- **Backend**: Python Flask microserver for persistent map assets uploading and custom calibration settings serialization.
- **Video Capture**: Browser HTML5 MediaStream Recording API (`MediaRecorder`).
- **Data Layers**: Custom light-weight GeoJSON dataset containing global administrative boundaries.

---

## 🚀 Setup & Installation

### Option A: PowerShell Launcher (Windows - Recommended)
Simply double-click the **`run.ps1`** script or run it inside a PowerShell console:
```powershell
.\run.ps1
```
This script will automatically:
1. Detect Python.
2. Initialize a secure Python virtual environment (`venv/`).
3. Upgrade pip and install all required dependencies silently.
4. Launch your default web browser directly to **`http://127.0.0.1:5000`**.
5. Start the background Flask server.

### Option B: Batch Launcher (Windows)
Double-click the **`run.bat`** file to quickly launch the virtual environment setup and start the server.

### Option C: Manual Setup (Any OS)
1. Install dependencies from `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the Flask server:
   ```bash
   python app.py
   ```
3. Open your browser and navigate to `http://127.0.0.1:5000`.

---

## ⌨️ Photoshop-grade Calibration Hotkeys
When **Align Map (Transform Mode)** is active, you can use physical keyboard hotkeys to adjust the active layer (Outlines or Background Map) in real-time:

| Hotkey | Action | Nudge Step | Nudge + Shift |
| :--- | :--- | :--- | :--- |
| **`▲ / ▼ / ◀ / ▶`** | Pan active layer Up, Down, Left, Right | `0.5px` | `5.0px` |
| **`W / S`** | Stretch / Contract Height (Y Scale) | `0.001` | `0.01` |
| **`A / D`** | Contract / Stretch Width (X Scale) | `0.001` | `0.01` |

---

## 📁 Repository Directory Structure
```
├── app.py                      # Flask microserver
├── calibration_settings.json   # Disk storage for custom calibrations
├── countries.geojson           # Global country outline datasets
├── map.jpg                     # Background map image asset
├── requirements.txt            # Python dependencies
├── run.bat                     # Quick Windows Batch launcher
├── run.ps1                     # PowerShell setup & launcher
├── static/
│   ├── airplane.png            # Airplane icon sprite
│   ├── app.js                  # Core JavaScript mapping engine
│   └── style.css               # Main styling sheets & glassmorphic layouts
└── templates/
    └── index.html              # Main application template layout
```

---

## 📜 License
AeroGlide is open-source software licensed under the **Apache-2.0 License**. Feel free to fork, distribute, and enhance the animator!
