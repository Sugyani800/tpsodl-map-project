// static/js/map.js

let map;
let allRawData = {}; // Stores all original GeoJSON data
let currentActiveLayers = {}; // Stores Leaflet layers (standard colored ones) currently added to map
let layerControl; // Reference to the Leaflet layer control
let history = []; // Stores map states for back navigation

let thematicLayer = null; // The actual L.geoJson layer for unpaid bills
let currentThematicLayerName = "Unpaid Bills (Sections)"; // The name used in the layer control
let isThematicLayerActive = false; // Flag to indicate if the thematic layer is currently on the map

// --- Initialization ---
function initializeMap(
  circlesData,
  divisionsData,
  subdivisionsData,
  sectionsData
) {
  console.log("Initializing map...");
  map = L.map("map").setView([20.27, 85.84], 9); // Centered near Bhubaneswar, Odisha

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Store all raw data globally for filtering
  allRawData["circle"] = circlesData;
  allRawData["division"] = divisionsData;
  allRawData["subdivision"] = subdivisionsData;
  allRawData["section"] = sectionsData;

  // Add custom control for navigation buttons
  addCustomControl();

  // Initial state: Show all Circles with other levels as togglable overlays
  displayInitialState();
}

// --- Styling and Popup Functions ---
function getDefaultStyle() {
  return {
    weight: 2,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  };
}

function getFeatureColor(level) {
  switch (level) {
    case "circle":
      return "#ff7800"; // Orange
    case "division":
      return "#007bff"; // Blue
    case "subdivision":
      return "#28a745"; // Green
    case "section":
      return "#dc3545"; // Red (default for sections when thematic is off)
    default:
      return "#6c757d"; // Gray
  }
}

// NEW: Function to get color based on unpaid percentage
function getUnpaidColor(unpaid_percentage) {
  // Define a color scale from light to dark based on percentage
  return unpaid_percentage > 40
    ? "#800026" // Dark red
    : unpaid_percentage > 30
    ? "#BD0026"
    : unpaid_percentage > 20
    ? "#E31A1C"
    : unpaid_percentage > 10
    ? "#FC4E2A"
    : unpaid_percentage > 5
    ? "#FD8D3C"
    : "#FFEDA0"; // Light yellow for very low unpaid
}

/**
 * Determines the style of a feature based on its level and whether thematic layering is active.
 * This is called for ALL features whenever the style needs to be updated.
 * @param {object} feature - The GeoJSON feature object.
 * @returns {object} Leaflet style object.
 */
function styleFeature(feature) {
  const level = feature.properties.level;

  // If thematic layer is globally active AND this specific feature is a 'section'
  // AND it has unpaid percentage data, apply thematic styling.
  if (
    isThematicLayerActive &&
    level === "section" && // Thematic layer is specifically for sections
    feature.properties.unpaid_percentage !== undefined
  ) {
    return {
      ...getDefaultStyle(),
      fillColor: getUnpaidColor(feature.properties.unpaid_percentage),
      fillOpacity: 0.9,
      weight: 1,
    };
  }
  // Otherwise, use default color for the level
  const color = getFeatureColor(level);
  return {
    ...getDefaultStyle(),
    fillColor: color,
  };
}

function onEachFeature(feature, layer) {
  if (feature.properties) {
    let popupContent = `<b>Name:</b> ${feature.properties.name || "N/A"}`;
    if (feature.properties.description) {
      popupContent += `<br><b>Description:</b> ${feature.properties.description}`;
    }
    if (feature.properties.Area) {
      popupContent += `<br><b>Area:</b> ${feature.properties.Area}`;
    }
    if (feature.properties.level) {
      popupContent += `<br><b>Level:</b> ${feature.properties.level}`;
    }
    // Added parent info to popup
    if (feature.properties.parent_circle_name) {
      popupContent += `<br><b>Parent Circle:</b> ${feature.properties.parent_circle_name}`;
    }
    if (feature.properties.parent_division_name) {
      popupContent += `<br><b>Parent Division:</b> ${feature.properties.parent_division_name}`;
    }
    if (feature.properties.parent_subdivision_name) {
      popupContent += `<br><b>Parent Sub-Division:</b> ${feature.properties.parent_subdivision_name}`;
    }

    // Add unpaid bill data to popup if available
    if (feature.properties.unpaid_percentage !== undefined) {
      popupContent += `<br><br><b>Unpaid Bills:</b><br>`;
      popupContent += `   Percentage: ${feature.properties.unpaid_percentage}%<br>`;
      popupContent += `   Count: ${feature.properties.unpaid_count}`;
    }

    layer.bindPopup(popupContent);

    // Add click listener for drill-down/focus logic
    layer.on({
      click: function (e) {
        const clickedFeatureLevel = feature.properties.level;
        const clickedFeatureName = feature.properties.name;
        const bounds = e.target.getBounds();

        console.log(`Clicked: ${clickedFeatureName} (${clickedFeatureLevel})`);

        // Sections are the lowest level for drill-down.
        // If a section is clicked, we only zoom to it, no further drill-down of child layers.
        if (clickedFeatureLevel === "section") {
          map.fitBounds(bounds, { padding: [20, 20] });
          return; // Do not push history or change display state
        }

        // Save current state before new display for 'Back' button
        history.push({
          focusedLevel: currentFocusedLevel,
          focusedName: currentFocusedName,
          // Capture the *names* of active overlay layers (e.g., "Divisions", "Sections")
          activeOverlayNames: Array.from(layerControl._overLayers)
            .filter(([name, layerObj]) => map.hasLayer(layerObj.layer))
            .map(([name, layerObj]) => name),
          thematicLayerActive: isThematicLayerActive, // Save thematic layer's active state
        });

        // Display the next level of detail
        displayFocusedArea(clickedFeatureLevel, clickedFeatureName, bounds);
      },
      mouseover: function (e) {
        e.target.setStyle({
          weight: 3,
          color: "#666",
          dashArray: "",
          fillOpacity: 0.9,
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          e.target.bringToFront();
        }
      },
      mouseout: function (e) {
        // Reset style based on whether thematic layer is active for sections or not
        e.target.setStyle(styleFeature(feature));
      },
    });
  }
}

// --- Layer Management & Display Functions ---
let currentFocusedLevel = "circle"; // What level is currently the primary focus
let currentFocusedName = null; // The name of the focused feature (e.g., 'Mayurbhanj Circle')

/**
 * Removes all GeoJSON layers currently on the map and resets state.
 */
function clearAllActiveLayers() {
  console.log("Clearing all active layers.");
  // Remove all standard layers
  for (const level in currentActiveLayers) {
    if (
      currentActiveLayers[level] &&
      map.hasLayer(currentActiveLayers[level])
    ) {
      map.removeLayer(currentActiveLayers[level]);
    }
  }
  currentActiveLayers = {}; // Reset active layers

  // Remove the thematic layer if it exists and is on map
  if (thematicLayer && map.hasLayer(thematicLayer)) {
    map.removeLayer(thematicLayer);
  }
  thematicLayer = null; // Clear thematic layer object reference
  isThematicLayerActive = false; // Reset thematic active flag

  // Remove the old layer control before adding a new one
  if (layerControl) {
    map.removeControl(layerControl);
    console.log("Removed old layer control.");
  }
}

/**
 * Displays the primary focused area and dynamically populates layer control with relevant children.
 * @param {string} focusedLevel - The level of the feature to focus on ('circle', 'division', etc.).
 * @param {string|null} focusedName - The name of the specific feature to focus on. Null for initial 'all circles' view.
 * @param {L.LatLngBounds|null} [boundsToFit=null] - The bounds to zoom to. If null, calculated from new layers.
 * @param {string[]} [preselectedOverlayNames=[]] - Names of overlay layers (e.g., "Divisions", "Sections") to initially turn on from history.
 * @param {boolean} [preselectedThematicActive=false] - Whether the thematic layer was active in previous state.
 */
function displayFocusedArea(
  focusedLevel,
  focusedName,
  boundsToFit = null,
  preselectedOverlayNames = [],
  preselectedThematicActive = false
) {
  console.log(
    `Displaying focused area: Level=${focusedLevel}, Name=${focusedName}, PreselectedOverlays=${preselectedOverlayNames}, ThematicActive=${preselectedThematicActive}`
  );
  clearAllActiveLayers(); // Remove all existing layers and thematic layer

  currentFocusedLevel = focusedLevel;
  currentFocusedName = focusedName;
  isThematicLayerActive = preselectedThematicActive; // Restore thematic state

  let overallBounds = null; // This will hold the bounds for fitting the map

  let baseLayersForControl = {}; // For radio buttons (only one active at a time)
  let overlayMapsForControl = {}; // For checkboxes (multiple can be active)

  // --- Step 1: Add the primary visible layer (base layer for the control) ---
  let primaryDisplayData = { type: "FeatureCollection", features: [] };
  if (focusedName === null) {
    // Initial "All Circles" view: 'Circles' is the base layer
    if (allRawData["circle"] && allRawData["circle"].features) {
      primaryDisplayData = allRawData["circle"];
    }
    if (primaryDisplayData.features.length > 0) {
      const circleLayer = L.geoJson(primaryDisplayData, {
        style: styleFeature,
        onEachFeature: onEachFeature,
      }).addTo(map); // Add to map by default
      baseLayersForControl["Circles"] = circleLayer; // Add to base layers control
      currentActiveLayers["circle"] = circleLayer; // Keep track of active layer
      overallBounds = circleLayer.getBounds();
    } else {
      console.warn("No circle data available for initial display.");
    }
  } else {
    // Focused view: The specific focused feature becomes the primary layer
    if (allRawData[focusedLevel] && allRawData[focusedLevel].features) {
      primaryDisplayData.features = allRawData[focusedLevel].features.filter(
        (f) => f.properties.name === focusedName
      );
    }
    if (primaryDisplayData.features.length > 0) {
      const focusedLayer = L.geoJson(primaryDisplayData, {
        style: styleFeature,
        onEachFeature: onEachFeature,
      }).addTo(map); // Add to map by default
      baseLayersForControl[
        focusedLevel.charAt(0).toUpperCase() + focusedLevel.slice(1)
      ] = focusedLayer; // Add to base layers control
      currentActiveLayers[focusedLevel] = focusedLayer; // Keep track of active layer
      overallBounds = focusedLayer.getBounds();
    } else {
      console.warn(
        `Focused feature ${focusedLevel}:${focusedName} not found. Attempting to go back.`
      );
      // Only go back if history is available, otherwise it would loop
      if (history.length > 0) goBackInHistory();
      else map.setView([20.27, 85.84], 9); // Fallback to default view
      return;
    }
  }

  // --- Step 2: Prepare child layers as overlays ---
  let childLevelsToAdd = [];
  if (focusedLevel === "circle") {
    childLevelsToAdd = ["division", "subdivision", "section"];
  } else if (focusedLevel === "division") {
    childLevelsToAdd = ["subdivision", "section"];
  } else if (focusedLevel === "subdivision") {
    childLevelsToAdd = ["section"];
  }
  // If focusedLevel is 'section', no child levels to add as overlays.

  childLevelsToAdd.forEach((childLevel) => {
    let filteredChildFeatures = [];

    if (focusedName === null) {
      // Initial "All Circles" view, show all children of all types
      filteredChildFeatures = allRawData[childLevel].features;
    } else {
      // Drill-down view, filter children by parent
      if (childLevel === "division") {
        filteredChildFeatures = allRawData["division"].features.filter(
          (f) => f.properties.parent_circle_name === focusedName
        );
      } else if (childLevel === "subdivision") {
        // Need to filter subdivisions that belong to divisions of the focused circle/division
        if (focusedLevel === "circle") {
          const divisionsInCircle = allRawData["division"].features.filter(
            (f) => f.properties.parent_circle_name === focusedName
          );
          const divisionNames = divisionsInCircle.map((d) => d.properties.name);
          filteredChildFeatures = allRawData["subdivision"].features.filter(
            (f) => divisionNames.includes(f.properties.parent_division_name)
          );
        } else if (focusedLevel === "division") {
          filteredChildFeatures = allRawData["subdivision"].features.filter(
            (f) => f.properties.parent_division_name === focusedName
          );
        }
      } else if (childLevel === "section") {
        // Need to filter sections that belong to subdivisions of the focused circle/division/subdivision
        if (focusedLevel === "circle") {
          const divisionsInCircle = allRawData["division"].features.filter(
            (f) => f.properties.parent_circle_name === focusedName
          );
          const divisionNames = divisionsInCircle.map((d) => d.properties.name);
          const subDivisionsInCircle = allRawData[
            "subdivision"
          ].features.filter((f) =>
            divisionNames.includes(f.properties.parent_division_name)
          );
          const subdivisionNames = subDivisionsInCircle.map(
            (s) => s.properties.name
          );
          filteredChildFeatures = allRawData["section"].features.filter((f) =>
            subdivisionNames.includes(f.properties.parent_subdivision_name)
          );
        } else if (focusedLevel === "division") {
          const subDivisionsInDivision = allRawData[
            "subdivision"
          ].features.filter(
            (f) => f.properties.parent_division_name === focusedName
          );
          const subdivisionNames = subDivisionsInDivision.map(
            (s) => s.properties.name
          );
          filteredChildFeatures = allRawData["section"].features.filter((f) =>
            subdivisionNames.includes(f.properties.parent_subdivision_name)
          );
        } else if (focusedLevel === "subdivision") {
          filteredChildFeatures = allRawData["section"].features.filter(
            (f) => f.properties.parent_subdivision_name === focusedName
          );
        }
      }
    }

    if (filteredChildFeatures.length > 0) {
      const childGeoJsonLayer = L.geoJson(
        { type: "FeatureCollection", features: filteredChildFeatures },
        {
          style: styleFeature,
          onEachFeature: onEachFeature,
        }
      );
      const layerName =
        childLevel.charAt(0).toUpperCase() + childLevel.slice(1) + "s";
      overlayMapsForControl[layerName] = childGeoJsonLayer;

      // If preselected (from history) OR if it's the 'sections' layer and thematic is active for sections,
      // add them to map and extend bounds.
      if (preselectedOverlayNames.includes(layerName)) {
        // This handles standard layers like "Divisions", "Subdivisions", "Sections"
        childGeoJsonLayer.addTo(map);
        currentActiveLayers[childLevel] = childGeoJsonLayer;
        if (childGeoJsonLayer.getBounds().isValid()) {
          if (overallBounds && overallBounds.isValid()) {
            overallBounds.extend(childGeoJsonLayer.getBounds());
          } else {
            overallBounds = childGeoJsonLayer.getBounds();
          }
        }
      }
    } else {
      console.log(
        `No features found for child level ${childLevel} under ${
          focusedName || "all circles"
        }.`
      );
    }
  });

  // --- Step 3: Prepare "Unpaid Bills (Sections)" as an overlay ---
  // This layer should always represent sections *within the current focused area*
  const sectionLevelData = allRawData["section"];
  if (sectionLevelData && sectionLevelData.features.length > 0) {
    let thematicFeatures = [];
    if (focusedName === null) {
      // If no specific area is focused, thematic layer shows ALL sections
      thematicFeatures = sectionLevelData.features;
    } else {
      // Filter sections based on the current focused area
      // Re-use filtering logic for sections based on focusedLevel and focusedName
      if (focusedLevel === "circle") {
        const divisionsInCircle = allRawData["division"].features.filter(
          (f) => f.properties.parent_circle_name === focusedName
        );
        const divisionNames = divisionsInCircle.map((d) => d.properties.name);
        const subDivisionsInCircle = allRawData["subdivision"].features.filter(
          (f) => divisionNames.includes(f.properties.parent_division_name)
        );
        const subdivisionNames = subDivisionsInCircle.map(
          (s) => s.properties.name
        );
        thematicFeatures = sectionLevelData.features.filter((f) =>
          subdivisionNames.includes(f.properties.parent_subdivision_name)
        );
      } else if (focusedLevel === "division") {
        const subDivisionsInDivision = allRawData[
          "subdivision"
        ].features.filter(
          (f) => f.properties.parent_division_name === focusedName
        );
        const subdivisionNames = subDivisionsInDivision.map(
          (s) => s.properties.name
        );
        thematicFeatures = sectionLevelData.features.filter((f) =>
          subdivisionNames.includes(f.properties.parent_subdivision_name)
        );
      } else if (focusedLevel === "subdivision") {
        thematicFeatures = sectionLevelData.features.filter(
          (f) => f.properties.parent_subdivision_name === focusedName
        );
      }
    }

    // Only create the thematic layer if there are relevant sections
    if (thematicFeatures.length > 0) {
      thematicLayer = L.geoJson(
        { type: "FeatureCollection", features: thematicFeatures },
        {
          style: styleFeature, // This will apply getUnpaidColor because `isThematicLayerActive` is set from history
          onEachFeature: onEachFeature,
        }
      );
      overlayMapsForControl[currentThematicLayerName] = thematicLayer;

      // If thematic layer was active in previous history state, add it back to map
      if (isThematicLayerActive) {
        // Use the restored state
        thematicLayer.addTo(map);
        console.log("Added preselected Unpaid Bills (Sections) layer.");
        if (thematicLayer.getBounds().isValid()) {
          if (overallBounds && overallBounds.isValid()) {
            overallBounds.extend(thematicLayer.getBounds());
          } else {
            overallBounds = thematicLayer.getBounds();
          }
        }
      }
    } else {
      console.log(`No sections found for thematic layer under current focus.`);
    }
  }

  // --- Step 4: Update Layer Control ---
  // Layer control handles adding/removing layers based on user interaction.
  layerControl = L.control
    .layers(baseLayersForControl, overlayMapsForControl, {
      collapsed: false, // Keep it open for easier debugging
    })
    .addTo(map);
  console.log("New layer control added.");

  // Set up listeners for the dynamically created checkboxes in the layer control
  layerControl.on("overlayadd", function (e) {
    console.log(`Overlay '${e.name}' added.`);
    if (e.name === currentThematicLayerName) {
      isThematicLayerActive = true;
      // Iterate through ALL layers on the map and re-style sections
      map.eachLayer(function (layer) {
        if (
          layer.feature &&
          layer.feature.properties &&
          layer.feature.properties.level === "section"
        ) {
          layer.setStyle(styleFeature(layer.feature));
        }
      });
    } else {
      let normalizedName = e.name.toLowerCase();
      if (normalizedName.endsWith("s")) {
        normalizedName = normalizedName.slice(0, -1);
      }
      currentActiveLayers[normalizedName] = e.layer;
      // Re-style any sections within this newly added layer (if thematic is OFF)
      e.layer.eachLayer(function (layer) {
        if (
          layer.feature &&
          layer.feature.properties &&
          layer.feature.properties.level === "section" &&
          !isThematicLayerActive
        ) {
          layer.setStyle(styleFeature(layer.feature));
        }
      });
    }

    // Adjust map bounds to include the added layer
    if (e.layer.getBounds().isValid()) {
      let currentViewBounds = map.getBounds();
      currentViewBounds.extend(e.layer.getBounds());
      map.fitBounds(currentViewBounds, { padding: [20, 20] });
    }
  });

  layerControl.on("overlayremove", function (e) {
    console.log(`Overlay '${e.name}' removed.`);
    if (e.name === currentThematicLayerName) {
      isThematicLayerActive = false; // Mark thematic layer as inactive
      // Iterate through ALL layers on the map and re-style sections back to default
      map.eachLayer(function (layer) {
        if (
          layer.feature &&
          layer.feature.properties &&
          layer.feature.properties.level === "section"
        ) {
          layer.setStyle(styleFeature(layer.feature));
        }
      });
    } else {
      let normalizedName = e.name.toLowerCase();
      if (normalizedName.endsWith("s")) {
        normalizedName = normalizedName.slice(0, -1);
      }
      delete currentActiveLayers[normalizedName];
      // Re-style any sections within this removed layer (if thematic is OFF)
      e.layer.eachLayer(function (layer) {
        if (
          layer.feature &&
          layer.feature.properties &&
          layer.feature.properties.level === "section" &&
          !isThematicLayerActive
        ) {
          layer.setStyle(styleFeature(layer.feature));
        }
      });
    }

    // Recalculate bounds from *all currently active layers*
    let newOverallBounds = null;
    let hasActiveLayers = false;

    // Iterate through currentActiveLayers (standard layers)
    for (const levelKey in currentActiveLayers) {
      if (currentActiveLayers[levelKey].getBounds().isValid()) {
        if (newOverallBounds) {
          newOverallBounds.extend(currentActiveLayers[levelKey].getBounds());
        } else {
          newOverallBounds = currentActiveLayers[levelKey].getBounds();
        }
        hasActiveLayers = true;
      }
    }
    // Check if thematic layer is still active and on map
    if (
      thematicLayer &&
      map.hasLayer(thematicLayer) &&
      thematicLayer.getBounds().isValid()
    ) {
      if (newOverallBounds) {
        newOverallBounds.extend(thematicLayer.getBounds());
      } else {
        newOverallBounds = thematicLayer.getBounds();
      }
      hasActiveLayers = true;
    }

    if (hasActiveLayers && newOverallBounds && newOverallBounds.isValid()) {
      map.fitBounds(newOverallBounds, { padding: [20, 20] });
      console.log(
        "Map fit to new bounds after removing layer:",
        newOverallBounds
      );
    } else {
      // If no layers are active, fit to the currently focused area's bounds, or default to initial view
      if (currentFocusedName) {
        let focusedFeatureData = allRawData[currentFocusedLevel].features.find(
          (f) => f.properties.name === currentFocusedName
        );
        if (focusedFeatureData) {
          const tempLayer = L.geoJson(focusedFeatureData);
          if (tempLayer.getBounds().isValid()) {
            map.fitBounds(tempLayer.getBounds(), { padding: [20, 20] });
          } else {
            map.setView([20.27, 85.84], 9); // Fallback if single feature has invalid bounds
          }
        } else {
          map.setView([20.27, 85.84], 9); // Fallback if focused feature not found
        }
      } else {
        map.setView([20.27, 85.84], 9); // Initial default view
      }
    }
  });

  // --- Step 5: Set map bounds ---
  console.log("Attempting to fit map bounds...");
  if (boundsToFit && boundsToFit.isValid()) {
    map.fitBounds(boundsToFit, { padding: [20, 20] });
  } else if (overallBounds && overallBounds.isValid()) {
    map.fitBounds(overallBounds, { padding: [20, 20] });
  } else {
    map.setView([20.27, 85.84], 9);
    console.warn(
      "No valid bounds found for map.fitBounds. Setting default view."
    );
  }

  // --- Step 6: Update UI text ---
  let displayTxt = "Current View: ";
  if (focusedName) {
    displayTxt += `${focusedName} (${
      focusedLevel.charAt(0).toUpperCase() + focusedLevel.slice(1)
    })`;
  } else {
    displayTxt += `All Circles`;
  }
  document.getElementById("current-level-display").innerText = displayTxt;
  console.log("UI display text updated.");

  updateBackButtonVisibility();
}

// --- Navigation Controls ---
function addCustomControl() {
  const customControl = L.control({ position: "topright" });

  customControl.onAdd = function (map) {
    const div = L.DomUtil.create("div", "info level-control");
    div.innerHTML = `
      <div id="current-level-display">Current View: All Circles</div>
      <button id="backButton" class="map-control-button" style="display: none;">Back</button>
      <button id="resetToCircles" class="map-control-button">Show All Circles</button>
    `;
    // Prevent map events from firing when interacting with the control
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.on(div, "wheel", L.DomEvent.stopPropagation); // Stop zoom on scroll
    return div;
  };
  customControl.addTo(map);

  document.getElementById("resetToCircles").addEventListener("click", () => {
    console.log("Reset to Circles button clicked.");
    history = []; // Clear history
    displayInitialState();
  });
  document
    .getElementById("backButton")
    .addEventListener("click", goBackInHistory);
}

function goBackInHistory() {
  console.log("Back button clicked. History length:", history.length);
  if (history.length > 0) {
    const prevState = history.pop();
    console.log("Going back to previous state:", prevState);

    let prevBounds = null;
    if (prevState.focusedName) {
      let prevFeatureData = allRawData[prevState.focusedLevel].features.find(
        (f) => f.properties.name === prevState.focusedName
      );
      if (prevFeatureData) {
        prevBounds = L.geoJson(prevFeatureData).getBounds();
      }
    }

    displayFocusedArea(
      prevState.focusedLevel,
      prevState.focusedName,
      prevBounds,
      prevState.activeOverlayNames,
      prevState.thematicLayerActive
    );
  } else {
    console.log("History is empty. Resetting to initial state.");
    displayInitialState();
  }
}

function updateBackButtonVisibility() {
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.style.display = history.length > 0 ? "block" : "none";
  }
}

function displayInitialState() {
  console.log("Displaying initial state (all circles).");
  history = []; // Ensure history is empty for initial state
  displayFocusedArea("circle", null, null, [], false); // Initial state: no preselected overlays, thematic off
}
