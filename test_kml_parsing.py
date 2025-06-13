import os
from fastkml import kml, Folder, Document
from fastkml.features import Placemark
from fastkml.geometry import Point, LineString, Polygon

# Define the path to your KML file
KML_FILEPATH = os.path.join(os.path.dirname(__file__), 'data', 'Circle', 'doc.kml')

# Recursive helper to find all placemarks (copy-pasted from your app.py)
def find_placemarks(element):
    placemarks = []
    if isinstance(element, Placemark):
        placemarks.append(element)
    elif hasattr(element, 'features') and element.features is not None:
        # Note: .features is an attribute, not a method for fastkml Document/Folder
        for feature in element.features:
            placemarks.extend(find_placemarks(feature))
    return placemarks

# Main parsing logic
if __name__ == '__main__':
    print(f"Attempting to parse KML from: {KML_FILEPATH}")

    if not os.path.exists(KML_FILEPATH):
        print(f"Error: KML file not found at {KML_FILEPATH}")
        exit()

    try:
        with open(KML_FILEPATH, 'rb') as f:
            doc = f.read()

        k = kml.KML()
        k.from_string(doc)

        print(f"\n--- fastkml Root Element Info ---")
        print(f"Root element type: {type(k)}")
        print(f"Root element name (if any): {getattr(k, 'name', 'N/A')}")
        print(f"Does root element have features? {hasattr(k, 'features') and k.features is not None}")

        if hasattr(k, 'features') and k.features is not None:
            print(f"Number of direct features under root: {len(list(k.features))}")
            print("Direct features under root (types and names):")
            for i, feature in enumerate(k.features):
                print(f"  Feature {i+1}: Type = {type(feature)}, Name = {getattr(feature, 'name', 'N/A')}")
        else:
            print("Root element does not expose features directly or has no features.")

        print(f"\n--- Attempting to find all Placemarks recursively ---")
        all_placemarks = find_placemarks(k)
        print(f"Found {len(all_placemarks)} placemarks using recursive search.")

        if not all_placemarks:
            print("No placemarks were found by fastkml using recursive search.")
            print("This means either:")
            print("  1. The KML structure is not what fastkml expects (e.g., non-standard tags, malformed XML).")
            print("  2. The KML file is empty or contains only non-feature data (like Styles).")
            print("  3. There's an encoding issue fastkml can't handle despite XML validity.")
            print("  4. You might be accessing a different KML file than intended.")
        else:
            for i, placemark in enumerate(all_placemarks):
                print(f"\n--- Placemark {i+1}: {placemark.name or 'Unnamed'} ---")
                print(f"  Description: {placemark.description or 'N/A'}")

                found_geometry = False
                for geom in placemark.geometries():
                    found_geometry = True
                    print(f"  Geometry Type: {type(geom)}")
                    if isinstance(geom, Polygon):
                        print(f"    Polygon has outer boundary: {bool(geom.outer_boundary_is)}")
                        if geom.outer_boundary_is:
                            coords = list(geom.outer_boundary_is.coords)
                            print(f"    Number of coordinates: {len(coords)}")
                            print(f"    First 3 coordinates: {coords[:3]}")
                    elif isinstance(geom, LineString):
                        print(f"    LineString coordinates sample: {list(geom.coords)[:3]}...")
                    elif isinstance(geom, Point):
                        print(f"    Point coordinates: {geom.longitude}, {geom.latitude}")
                if not found_geometry:
                    print("  No geometry found for this placemark.")


    except Exception as e:
        print(f"\nAn unexpected error occurred during KML parsing: {e}")
        import traceback
        traceback.print_exc()