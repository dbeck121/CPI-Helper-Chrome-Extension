var plugin = {
  metadataVersion: "1.0.0",
  id: "iflowSearcher",
  name: "iFlow Searcher",
  version: "0.1.0",
  author: "Filip Krsmanovic",
  email: "krsm.filip@gmail.com",
  website: "https://www.linkedin.com/in/filip-krsmanovic/",
  description:
    "This plugin enables to search for a specified terms across both <b>Content Modifiers</b> and <b>Scripts</b>. The search covers <b>Script Content</b> and <b>Content Modifier</b> (Header Name, Header Source Value, Property Name, Property Source Value, and Message Body).<br>(*) Please note that Version 0.1.0 currently <b>supports only</b> iFlows in the Integration Suite on <b>Cloud Foundry</b>.",
  settings: {},

  messageSidebarContent: {
    onRender: (pluginHelper) => {
      if (!document.getElementById("plugin-button")) {
        // sets base url of tenant and iflow
        setBaseUrl(pluginHelper);

        return createSideBarButton();
      }
    },
  },
};

var baseUrl = "";
var iFlowUrl = "";

// function to create the button
function createSideBarButton() {
  var button = document.createElement("button");
  button.id = "plugin-button";
  button.innerText = "Open iFlow Searcher";
  button.addEventListener("click", () => {
    // opens dragable iFlow searcher element
    createDraggableSearchContainer();
  });

  return button;
}

// returns elements from iFlow entities by display name example: Content Modifier or GroovyScript / JavaScript
function extractElementsByDisplayName(json, names) {
  return json.propertyViewModel.listOfDefaultFlowElementModel.filter((element) => names.includes(element.displayName));
}

// searches elements values for search term: either in body, propertys or headers
function searchContentModifierValues(contentModifierElements, searchTerm) {
  const searchLower = searchTerm.toLowerCase(); // Convert search term to lowercase

  return contentModifierElements.filter((element) => {
    return (
      Object.values(element.allAttributes || {}).some((attr) => attr.value?.toLowerCase().includes(searchLower)) ||
      element.wrapContent?.value?.toLowerCase().includes(searchLower) ||
      element.allTableAttributes?.propertyTable?.value?.some((property) => property.Value.value?.toLowerCase().includes(searchLower)) ||
      element.wrapContent?.value?.toLowerCase().includes(searchLower) ||
      element.allTableAttributes?.propertyTable?.value?.some((property) => property.Name.value?.toLowerCase().includes(searchLower)) ||
      element.allTableAttributes?.headerTable?.value?.some((header) => header.Value.value?.toLowerCase().includes(searchLower)) ||
      element.allTableAttributes?.headerTable?.value?.some((header) => header.Name.value?.toLowerCase().includes(searchLower))
    );
  });
}

// goes through all script elements in the iflow and checks if it includes the search term
async function searchScripts(scriptElements, searchTerm) {
  const promises = scriptElements.map(async (element) => {
    const scriptUrl = iFlowUrl + `${element.allAttributes.script.value}`;
    try {
      const response = await fetch(scriptUrl, { method: "GET", headers: { Accept: "application/json" } });
      const script = await response.json();
      if (script.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        //toLowerCase() for case insensitive search
        return element;
      }
    } catch (error) {
      console.error("Error fetching script:", error);
      return null;
    }
  });

  const resultElements = await Promise.all(promises);
  return resultElements.filter((el) => el !== null && el !== undefined);
}

// resets all set styles in the DOM
function resetAllStyles() {
  document.querySelectorAll("g[id^='BPMNShape_'] rect.activity").forEach((rect) => {
    rect.style.fill = ""; // Reset fill for all elements
  });
}

// applies green fill to the found elements
function applyStylesToLiveDOM(foundElements) {
  foundElements.forEach((element) => {
    const selector = `g#BPMNShape_${element.id}`;
    const targetElement = document.querySelector(selector);

    if (targetElement) {
      // Find the rect inside the g element and apply fill color
      const rectElement = targetElement.querySelector("rect.activity");
      if (rectElement) {
        rectElement.style.fill = "#30914c"; // Apply fill to the rect
      }
    }
  });
}

// creates container for search bar
function createDraggableSearchContainer() {
  if (document.getElementById("draggable-container")) return; // Prevent multiple instances

  var container = document.createElement("div");
  container.id = "draggable-container";
  Object.assign(container.style, {
    position: "fixed",
    top: "50px",
    left: "50px",
    width: "200px",
    padding: "10px",
    background: "white",
    border: "1px solid #ccc",
    borderRadius: "5px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    cursor: "move",
    zIndex: "1000",
  });

  var header = document.createElement("div");
  header.textContent = "iFlow Searcher";
  Object.assign(header.style, {
    fontWeight: "bold",
    textAlign: "center",
    background: "#2084cf",
    borderBottom: "1px solid #ccc",
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 0",
    position: "relative",
  });

  var searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search Term...";
  var searchTerm;

  searchInput.addEventListener("input", function () {
    searchTerm = searchInput.value;
  });

  var searchButton = document.createElement("button");
  searchButton.textContent = "Search";
  Object.assign(searchButton.style, {
    background: "#ffffff",
    color: "#000000",
    border: "1px solid #3c3c3c",
    borderRadius: "4px",
    cursor: "pointer",
  });

  // search button event listener
  searchButton.addEventListener("click", function () {
    if (searchTerm != "" || searchTerm == null) {
      fetch(iFlowUrl)
        .then((response) => {
          // Check if the response is successful (status code 200-299)
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          // Parse the response body as JSON
          return response.json();
        })
        .then((data) => {
          // Once data is fetched and parsed, find the matching objects
          const scriptElements = extractElementsByDisplayName(data, ["Groovy Script", "JavaScript"]);
          const contentModifierElements = extractElementsByDisplayName(data, ["Content Modifier"]);

          const tcmElements = searchContentModifierValues(contentModifierElements, searchTerm);

          resetAllStyles();

          // Wait for searchScripts to finish, then combine and apply styles
          return searchScripts(scriptElements, searchTerm).then((sElements) => {
            // Combine both tcmElements and sElements into a single array
            const combinedElements = [...tcmElements, ...sElements];

            // Apply styles to the combined array of elements
            applyStylesToLiveDOM(combinedElements);
          });
        })
        .catch((error) => {
          // Handle any errors
          console.error("Error fetching or processing data:", error);
        });
    }
  });

  // hover effect
  // Add hover effect using event listeners
  searchButton.addEventListener("mouseenter", function () {
    searchButton.style.background = "#2084cf"; // Change background color on hover
    searchButton.style.color = "#ffffff"; // Change text color on hover
  });

  searchButton.addEventListener("mouseleave", function () {
    searchButton.style.background = "#ffffff"; // Reset background color
    searchButton.style.color = "#000000"; // Reset text color
  });

  // Create the close button ("x")
  var closeButton = document.createElement("button");
  closeButton.textContent = "x"; // Unicode "x" symbol
  Object.assign(closeButton.style, {
    position: "absolute", // Position the button absolutely within the header
    top: "5px", // Adjust the top margin as needed
    right: "5px", // Align to the top-right corner
    textAlign: "center",
    background: "transparent",
    border: "none",
    color: "#000000",
    fontSize: "20px",
    fontWeight: "bold",
    cursor: "pointer",
  });

  closeButton.addEventListener("click", function () {
    document.body.removeChild(container); // Removes the draggable container
  });

  // Add hover effect using JavaScript
  closeButton.addEventListener("mouseenter", function () {
    closeButton.style.color = "red"; // Change color to red on hover
  });

  closeButton.addEventListener("mouseleave", function () {
    closeButton.style.color = "#000000"; // Reset color back to black when hover ends
  });

  // Append the close button to the header
  header.appendChild(closeButton);

  container.appendChild(header);
  container.appendChild(searchInput);
  container.appendChild(searchButton);
  document.body.appendChild(container);

  makeDraggable(container);
  setupPopup(searchButton);
}

// makes container dragable container
function makeDraggable(element) {
  var offsetX,
    offsetY,
    isDragging = false;

  element.addEventListener("mousedown", function (e) {
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
  });

  document.addEventListener("mousemove", function (e) {
    if (isDragging) {
      element.style.left = e.clientX - offsetX + "px";
      element.style.top = e.clientY - offsetY + "px";
    }
  });

  document.addEventListener("mouseup", function () {
    isDragging = false;
  });
}

function setBaseUrl(pluginHelper) {
  baseUrl = "https://" + pluginHelper.tenant + "/api/1.0/workspace/";
  fetchWorkspace(pluginHelper);
}

// fetch workspace id
async function fetchWorkspace(pluginHelper) {
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const workspaces = await response.json();
    const packageIdName = pluginHelper.currentPackageId;
    const workspaceId = workspaces.find((workspace) => workspace.technicalName === packageIdName)?.id;
    if (workspaceId) {
      // Fetch artifacts using the workspaceId
      return await fetchArtifacts(workspaceId, pluginHelper);
    } else {
      console.log("Workspace not found");
      return null;
    }
  } catch (error) {
    console.error("Error fetching workspace:", error);
    return null;
  }
}

// fetch artifacts
async function fetchArtifacts(workspaceId, pluginHelper) {
  const artifactsUrl = `${baseUrl}${workspaceId}/artifacts/`;

  try {
    const response = await fetch(artifactsUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const artifacts = await response.json();

    // Static flowId for now
    const flowId = pluginHelper.currentIflowId;
    const artifact = artifacts.find((a) => a.tooltip === flowId);

    if (artifact) {
      const entityId = artifact.entityID;
      // Fetch the entity's script content
      return await fetchEntity(artifactsUrl, entityId, pluginHelper);
    } else {
      console.log("Artifact not found for flow ID:", flowId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching artifacts:", error);
    return null;
  }
}

// fetch entities
async function fetchEntity(artifactsUrl, entityId, pluginHelper) {
  const flowName = pluginHelper.currentArtifactId;
  iFlowUrl = `${artifactsUrl}${entityId}/entities/${entityId}/iflows/${flowName}`;
}

pluginList.push(plugin);
