import os
import sys
import json
from flask import Flask, render_template, send_from_directory, jsonify, request

app = Flask(__name__, template_folder='templates', static_folder='static')

SETTINGS_FILE = 'calibration_settings.json'
DEFAULT_CALIBRATION = {
    "xOffset": 1920.0,
    "yOffset": 1070.0,
    "xScale": 10.6667,
    "yScale": 10.6667
}

# Serve index.html
@app.route('/')
def index():
    return render_template('index.html')

# Serve map.jpg directly from root
@app.route('/map.jpg')
def serve_map():
    return send_from_directory('.', 'map.jpg')

# Serve countries.geojson directly from root
@app.route('/countries.geojson')
def serve_geojson():
    return send_from_directory('.', 'countries.geojson')

# Load calibration settings from disk
@app.route('/api/get_calibration', methods=['GET'])
def get_calibration():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
            return jsonify(data)
        except Exception as e:
            print("Error reading calibration file, using defaults:", e)
    return jsonify(DEFAULT_CALIBRATION)

# Save calibration settings to disk
@app.route('/api/save_calibration', methods=['POST'])
def save_calibration():
    try:
        data = request.get_json()
        # Validate keys
        required_keys = ["xOffset", "yOffset", "xScale", "yScale"]
        if not all(k in data for k in required_keys):
            return jsonify({"status": "error", "message": "Missing parameters"}), 400
        
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(data, f, indent=4)
        return jsonify({"status": "success", "message": "Calibration settings saved successfully!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Save uploaded map image to disk
@app.route('/api/upload_map', methods=['POST'])
def upload_map():
    try:
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "No file part"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No selected file"}), 400
        
        # Save directly as map.jpg (overwriting)
        file.save('map.jpg')
        return jsonify({"status": "success", "message": "Background map image updated successfully!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Print launch message
    print("=" * 60)
    print("  AERO-GLIDE FLIGHT PATH ANIMATOR IS RUNNING!")
    print("  URL: http://127.0.0.1:5000")
    print("  Press Ctrl+C to stop the server")
    print("=" * 60)
    
    # Run the Flask app on localhost, port 5000
    app.run(host='127.0.0.1', port=5000, debug=False)
