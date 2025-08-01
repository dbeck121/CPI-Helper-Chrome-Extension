var plugin = {
  metadataVersion: "1.0.0",
  id: "iflowSearcher",
  name: "iFlow Searcher",
  version: "0.1.0",
  author: "Filip Krsmanovic",
  email: "f.krsmanovic@blackbelt-solutions.com",
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
        rectElement.style.fill = "#13af00"; // Apply fill to the rect
      }
    }
  });
}

// creates container for search bar
function createDraggableSearchContainer() {
  if (document.getElementById("draggable-container")) return;

  // Create base card container
  const container = document.createElement("div");
  container.id = "draggable-container";
  container.className = "ui card";
  Object.assign(container.style, {
    position: "fixed",
    top: "60px",
    left: "60px",
    width: "260px",
    zIndex: "1000",
    cursor: "move",
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    padding: "0",
  });

  // Header
  const header = document.createElement("div");
  header.className = "content";
  header.style.background = "#2185d0"; // Fomantic blue
  header.style.color = "black";
  header.style.fontWeight = "bold";
  header.style.padding = "10px";
  header.style.fontSize = "16px";
  header.textContent = "iFlow Searcher";

  // Close icon
  const closeIcon = document.createElement("i");
  closeIcon.className = "close icon";
  Object.assign(closeIcon.style, {
    float: "right",
    cursor: "pointer",
    color: "black",
  });

  closeIcon.addEventListener("click", () => {
    resetAllStyles();
    container.remove();
  });

  // Hover effect for close icon
  closeIcon.addEventListener("mouseenter", () => {
    closeIcon.style.color = "red";
  });

  closeIcon.addEventListener("mouseleave", () => {
    closeIcon.style.color = "black";
  });

  header.appendChild(closeIcon);

  // Body (search input)
  const content = document.createElement("div");
  content.className = "content";
  content.style.padding = "12px";

  const inputDiv = document.createElement("div");
  inputDiv.className = "ui small fluid input";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search term...";
  input.id = "search-input";

  // enable search by enter instead of button
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") button.click();
  });

  inputDiv.appendChild(input);
  content.appendChild(inputDiv);

  // Actions (button)
  const actions = document.createElement("div");
  actions.className = "extra content";
  actions.style.textAlign = "right";

  const button = document.createElement("button");
  button.className = "ui tiny blue button";
  button.textContent = "Search";

  button.addEventListener("click", () => {
    const searchTerm = input.value.trim();

    resetAllStyles();

    if (!searchTerm) return;

    fetch(iFlowUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const scriptElements = extractElementsByDisplayName(data, ["Groovy Script", "JavaScript"]);
        const contentModifierElements = extractElementsByDisplayName(data, ["Content Modifier"]);
        const tcmElements = searchContentModifierValues(contentModifierElements, searchTerm);

        return searchScripts(scriptElements, searchTerm).then((sElements) => {
          const combined = [...tcmElements, ...sElements];
          applyStylesToLiveDOM(combined);
        });
      })
      .catch((error) => console.error("Search failed:", error));
  });

  actions.appendChild(button);

  // Compose card
  container.appendChild(header);
  container.appendChild(content);
  container.appendChild(actions);
  document.body.appendChild(container);

  // Make it draggable via header
  makeDraggable(container, header);
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
