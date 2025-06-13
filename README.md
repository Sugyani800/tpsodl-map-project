# TPSODL Electricity Coverage Viewer
This project is a Flask-based web application designed to visualize electricity coverage data for TP Southern Odisha Distribution Limited (TPSODL) on an interactive map. It allows users to view geographical divisions, subdivisions, and sections, and potentially understand areas related to electricity coverage or outages.

## Features
* *Interactive Map:* Utilizes Leaflet.js to display geographical data.
* *Hierarchical Data View:* Visualizes data at different administrative levels (Circles, Divisions, Subdivisions, Sections).
* *Flask Backend:* Serves the web application and processes geospatial data (GeoJSON).
* *GeoJSON Integration:* Loads and displays geographical boundaries from GeoJSON files.

## Project Structure
tpsodl-map-project/
├── data/
│   ├── Circle/
│   │   └── doc.geojson
│   ├── Division/
│   │   └── doc.geojson
│   ├── Section/
│   │   └── doc.geojson
│   └── Sub_Division/
│       └── doc.geojson
├── static/
│   ├── css/
│   │   ├── map.css
│   │   └── style.css
│   ├── images/
│   │   └── tpsodl-new-logo.jpg
│   └── js/
│       └── map.js
├── templates/
│   ├── index.html
│   └── map.html
├── .gitignore
├── app.py
├── Procfile
├── requirements.txt
└── test_kml_parsing.py # (Optional: if this is a utility script, mention its purpose)


## Setup and Local Installation
Follow these steps to get a local copy of the project up and running on your machine.
### 1. Clone the Repository
First, clone the project repository to your local machine using the git clone command and navigate into the project directory.
### 2. Create a Virtual Environment
It's highly recommended to use a Python virtual environment to manage project dependencies. Create one using the python -m venv command.
### 3. Activate the Virtual Environment
Activate the newly created virtual environment. The specific command depends on your operating system (Windows, macOS/Linux). Your terminal prompt should change to indicate the environment is active.
### 4. Install Dependencies
Install all the required Python packages listed in requirements.txt using pip.
### 5. Run the Flask Application
Once dependencies are installed, you can start the Flask development server.
The application will typically be available at http://127.0.0.1:5000/ in your web browser.
### 6. View the Application
Open your web browser and navigate to http://127.0.0.1:5000/. You will see the welcome page. Click on "View Map" to see the interactive map.

## Deployment on Render (or similar PaaS)
This application is configured for deployment on platforms like Render.com.

### Prerequisites for Deployment
* A GitHub account with the project pushed to a repository (e.g., https://github.com/Sugyani800/tpsodl-map-project).
* A Render.com account.

### Deployment Steps
1.  **Ensure Procfile is Present:** The Procfile in the root of the repository specifies how to run the web service. It contains the command web: gunicorn app:app, which tells Render to use Gunicorn to serve the Flask application instance named app from the app.py file.
2.  **Ensure requirements.txt is Up-to-Date:** This file lists all Python dependencies, which Render will install during deployment.
3.  *Connect to Render:*
    * Log in to your Render.com dashboard.
    * Click "New" -> "Web Service."
    * Select "GitHub" and connect your GitHub account. Ensure you grant Render access to the tpsodl-map-project repository (select "Only select repositories" and choose your project).
4.  *Configure Web Service Settings on Render:*
    * *Name:* Give your service a unique name (e.g., tpsodl-map-viewer).
    * *Region:* Choose a region closest to your target audience.
    * *Branch:* main (or whichever branch you deploy from).
    * *Root Directory:* Leave blank.
    * *Runtime:* Python 3 (Render usually auto-detects).
    * *Build Command:* pip install -r requirements.txt
    * *Start Command:* gunicorn app:app
    * *Instance Type:* Free
5.  *Create Web Service:* Click "Create Web Service" and monitor the build logs on Render. Your application should be live at the provided Render URL once deployed successfully.

## Data
The geospatial data used in this project is stored in GeoJSON format within the data/ directory, categorized by administrative levels (Circle, Division, Sub_Division, Section).

## Technologies Used
* *Backend:* Flask (Python)
* *Web Server:* Gunicorn
* *Frontend:* HTML, CSS, JavaScript
* *Mapping Library:* Leaflet.js
* *Geospatial Libraries (Python):* geopandas, fiona, shapely, pyproj, folium, fastkml, pyogrio, numpy, pandas
* *Deployment:* Render.com

## Contributing
(Optional section - Add if you plan to accept contributions)
If you wish to contribute to this project, please fork the repository and create a pull request with your changes.
