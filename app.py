# app.py
from flask import Flask, render_template, jsonify
import json
import os
import random

app = Flask(__name__)

# Function to load GeoJSON data and add a 'level' property and simulated unpaid bill data
def load_geojson_data(level_name):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Map level names to their folder names (case-sensitive)
    folder_mapping = {
        'circle': 'Circle',
        'division': 'Division',
        'subdivision': 'Sub_Division', # IMPORTANT: Ensure this matches your folder name exactly!
        'section': 'Section'
    }
    
    folder_name = folder_mapping.get(level_name)
    if not folder_name:
        print(f"DEBUG: Error: Unknown level name '{level_name}' for GeoJSON loading.")
        return {"type": "FeatureCollection", "features": []}

    geojson_path = os.path.join(base_dir, 'data', folder_name, 'doc.geojson')
    
    print(f"DEBUG: Attempting to load GeoJSON from: {geojson_path}")

    if not os.path.exists(geojson_path):
        print(f"DEBUG: Error: GeoJSON file NOT FOUND at {geojson_path}. Please check your 'data' folder structure and file names.")
        return {"type": "FeatureCollection", "features": []}

    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"DEBUG: Successfully loaded {len(data.get('features', []))} features from {geojson_path}")
    except json.JSONDecodeError as e:
        print(f"DEBUG: Error decoding JSON from {geojson_path}: {e}. File content might be invalid JSON.")
        return {"type": "FeatureCollection", "features": []}
    except Exception as e:
        print(f"DEBUG: An unexpected error occurred while reading {geojson_path}: {e}")
        return {"type": "FeatureCollection", "features": []}

    # Add 'level' property and simulate unpaid bill data
    for feature in data.get('features', []):
        feature['properties']['level'] = level_name
        # Ensure 'name' property exists for all levels for display and linking
        if 'name' not in feature['properties'] or not feature['properties']['name']:
            feature['properties']['name'] = f"Unnamed {level_name.capitalize()} Feature {random.randint(1, 1000)}"

        if level_name == 'section':
            feature['properties']['unpaid_percentage'] = round(random.uniform(0, 50), 2)
            feature['properties']['unpaid_count'] = random.randint(10, 500)
        else:
            feature['properties'].pop('unpaid_percentage', None)
            feature['properties'].pop('unpaid_count', None)

    return data

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/map')
def map_page():
    # Load data for each level
    circles_data = load_geojson_data('circle')
    divisions_data = load_geojson_data('division')
    subdivisions_data = load_geojson_data('subdivision')
    sections_data = load_geojson_data('section')

    return render_template(
        'map.html',
        circles_data=json.dumps(circles_data),
        divisions_data=json.dumps(divisions_data),
        subdivisions_data=json.dumps(subdivisions_data),
        sections_data=json.dumps(sections_data)
    )

if __name__ == '__main__':
    app.run(debug=True)