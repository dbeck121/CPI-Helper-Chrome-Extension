var plugin = {
    metadataVersion: "1.0.0",
    id: "connectivityCredentialsManager", 
    name: "Connectivity Profile Manager",
    version: "1.0.0",
    author: "Vladimir Balko / CLAIMATE Tech team",
    email: "info@claimate.tech",
    website: "https://claimate.tech",
    description: "Profile manager for SAP CPI connectivity tests - save, load, and manage connection configurations",

    settings: {
        info: { 
            text: "This plugin automatically activates on the Connectivity Test page (Monitoring → Connectivity Test)", 
            type: "label" 
        }
    }
};

// Global state for the plugin
var connectivityCredentialsState = {
    initialized: false,
    observer: null
};

// Helper functions
function isConnectivityPage() {
    return window.location.href.includes('/shell/monitoring/Connectivity');
}

function getCurrentTabType() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    return activeTab ? activeTab.textContent.trim() : 'UNKNOWN';
}

function extractFormData() {
    const tabType = getCurrentTabType();
    const formData = { 
        type: tabType, 
        fields: {},
        timestamp: new Date().toISOString()
    };
    
    // First try to get inputs from active tab panel
    let activePanel = document.querySelector('[role="tabpanel"][aria-hidden="false"]');
    
    // Fallback: look for the visible content area based on the active tab
    if (!activePanel) {
        // Get all inputs that are currently visible on the page
        // Include hidden inputs that are part of SAP selects (they have -hiddenInput suffix)
        const allInputs = document.querySelectorAll('input:not([type="hidden"]), input[id$="-hiddenInput"], select, textarea');
        
        allInputs.forEach(input => {
            // Skip if not visible or (empty and not a checkbox)
            // Exception: allow hidden inputs that are part of SAP selects
            if (!input.offsetParent && !input.id?.endsWith('-hiddenInput')) return;
            if (!input.value && input.type !== 'checkbox') return;
            
            // Skip inputs that are likely not part of the connectivity form
            if (input.id && (input.id.includes('search') || input.id.includes('filter'))) return;
            
            // Create meaningful field identifier
            let fieldName = '';
            
            // Try to find associated label
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) {
                fieldName = label.textContent.trim();
            } else if (input.placeholder) {
                fieldName = input.placeholder;
            } else {
                // Extract from ID or name - keep full ID for checkboxes
                if (input.type === 'checkbox') {
                    // For checkboxes, use the full ID without modifications
                    fieldName = input.id || input.name || '';
                } else {
                    // For other inputs, clean up the ID
                    fieldName = (input.id || input.name || '').replace(/-inner$/, '').replace(/^__/, '');
                }
            }
            
            if (fieldName) {
                // Store value based on element type
                let value = input.value;
                let elementType = input.type || input.tagName.toLowerCase();
                
                if (input.type === 'checkbox') {
                    // For SAP UI5 checkboxes, check the wrapper's aria-checked
                    const sapWrapper = input.closest('.sapMCb');
                    if (sapWrapper) {
                        value = sapWrapper.getAttribute('aria-checked') === 'true' ? 'on' : 'off';
                    } else {
                        value = input.checked ? 'on' : 'off';
                    }
                } else if (input.type === 'radio') {
                    // For radio buttons, only store if checked
                    const sapWrapper = input.closest('.sapMRb');
                    if (sapWrapper) {
                        // Only save radio button if it's selected
                        if (sapWrapper.getAttribute('aria-checked') !== 'true') return;
                    } else {
                        if (!input.checked) return;
                    }
                } else if (input.getAttribute('role') === 'combobox' || input.id?.includes('hiddenInput')) {
                    // This is likely a SAP UI5 select dropdown
                    elementType = 'select';
                    // For hidden inputs, try to get the displayed text value
                    if (input.id?.includes('hiddenInput')) {
                        const baseId = input.id.replace('-hiddenInput', '');
                        const displayInput = document.getElementById(baseId + '-inner');
                        if (displayInput && displayInput.value) {
                            value = displayInput.value;
                        }
                    }
                }
                
                formData.fields[fieldName] = {
                    id: input.id,
                    name: input.name,
                    type: elementType,
                    value: value,
                    selector: `#${input.id}`
                };
            }
        });
    } else {
        // Original logic for when panel is found
        // Include hidden inputs that are part of SAP selects (they have -hiddenInput suffix)
        const inputs = activePanel.querySelectorAll('input:not([type="hidden"]), input[id$="-hiddenInput"], select, textarea');
        
        inputs.forEach(input => {
            // Skip if not visible or (empty and not a checkbox)
            // Exception: allow hidden inputs that are part of SAP selects
            if (!input.offsetParent && !input.id?.endsWith('-hiddenInput')) return;
            if (!input.value && input.type !== 'checkbox') return;
            
            // Create meaningful field identifier
            let fieldName = '';
            
            // Try to find associated label
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) {
                fieldName = label.textContent.trim();
            } else if (input.placeholder) {
                fieldName = input.placeholder;
            } else {
                // Extract from ID or name - keep full ID for checkboxes
                if (input.type === 'checkbox') {
                    // For checkboxes, use the full ID without modifications
                    fieldName = input.id || input.name || '';
                } else {
                    // For other inputs, clean up the ID
                    fieldName = (input.id || input.name || '').replace(/-inner$/, '').replace(/^__/, '');
                }
            }
            
            if (fieldName) {
                // Store value based on element type
                let value = input.value;
                let elementType = input.type || input.tagName.toLowerCase();
                
                if (input.type === 'checkbox') {
                    // For SAP UI5 checkboxes, check the wrapper's aria-checked
                    const sapWrapper = input.closest('.sapMCb');
                    if (sapWrapper) {
                        value = sapWrapper.getAttribute('aria-checked') === 'true' ? 'on' : 'off';
                    } else {
                        value = input.checked ? 'on' : 'off';
                    }
                } else if (input.type === 'radio') {
                    // For radio buttons, only store if checked
                    const sapWrapper = input.closest('.sapMRb');
                    if (sapWrapper) {
                        // Only save radio button if it's selected
                        if (sapWrapper.getAttribute('aria-checked') !== 'true') return;
                    } else {
                        if (!input.checked) return;
                    }
                } else if (input.getAttribute('role') === 'combobox' || input.id?.includes('hiddenInput')) {
                    // This is likely a SAP UI5 select dropdown
                    elementType = 'select';
                    // For hidden inputs, try to get the displayed text value
                    if (input.id?.includes('hiddenInput')) {
                        const baseId = input.id.replace('-hiddenInput', '');
                        const displayInput = document.getElementById(baseId + '-inner');
                        if (displayInput && displayInput.value) {
                            value = displayInput.value;
                        }
                    }
                }
                
                formData.fields[fieldName] = {
                    id: input.id,
                    name: input.name,
                    type: elementType,
                    value: value,
                    selector: `#${input.id}`
                };
            }
        });
    }
    
    return formData;
}

// Redirect old multi-phase approach to sequential for backward compatibility
window.fillFormFieldsMultiPhase = window.fillFormFieldsSequential;

// ============================================================================
// NEW SEQUENTIAL APPROACH - Fills fields one by one from top to bottom
// ============================================================================

// Helper function: wait for specified milliseconds
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function: Get all visible form elements
function getAllVisibleFormElements() {
    // Get all inputs, but exclude search fields and hidden
    const selectors = [
        'input[type="text"]:not([id*="search"]):not([type="hidden"])',
        'input[type="number"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'input[role="combobox"]',
        'select',
        'textarea',
        // Add SAP Select hidden inputs (for dropdowns like Proxy Type)
        'input[id$="-hiddenInput"]'
    ];
    
    const elements = document.querySelectorAll(selectors.join(','));
    return Array.from(elements).filter(el => {
        // Visible element (but allow hidden inputs for SAP selects)
        if (!el.offsetParent && !el.id.endsWith('-hiddenInput')) return false;
        
        // Exclude help search
        if (el.id && el.id.includes('h4-carousel')) return false;
        
        // Exclude elements outside the main form area
        const rect = el.getBoundingClientRect();
        if (rect.top < 200 || rect.top > 900) return false;
        
        return true;
    });
}

// Helper function: Sort elements by position (top to bottom, left to right)
function sortByPosition(elements) {
    return elements.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        
        // If they're on the same row (±5px), sort by left position
        if (Math.abs(rectA.top - rectB.top) < 5) {
            return rectA.left - rectB.left;
        }
        return rectA.top - rectB.top;
    });
}

// Helper function: Detect element type based on wrapper and ID patterns
function detectElementType(element, wrapper) {
    // SAP UI5 components by wrapper
    if (wrapper) {
        if (wrapper.classList.contains('sapMCb')) return 'sap-checkbox';
        if (wrapper.classList.contains('sapMRb')) return 'sap-radio';
        if (wrapper.classList.contains('sapMSlt')) return 'sap-select';
        if (wrapper.classList.contains('sapMComboBox')) return 'sap-combobox';
    }
    
    // By ID patterns
    if (element.id) {
        if (element.id.endsWith('-CB')) return 'sap-checkbox';
        if (element.id.endsWith('-RB')) return 'sap-radio';
        if (element.id.includes('-hiddenInput')) return 'sap-select';
        if (element.getAttribute('role') === 'combobox') return 'sap-combobox';
    }
    
    // Default HTML types
    return element.type || element.tagName.toLowerCase();
}

// Helper function: Find matching field data for an element
function findFieldDataForElement(element, profileData) {
    const fields = profileData.fields;
    
    // 1. Exact ID match
    for (const fieldName in fields) {
        const field = fields[fieldName];
        if (field.id === element.id) return field;
    }
    
    // 2. ID without prefixes/suffixes
    const cleanId = element.id
        .replace(/^__/, '')
        .replace(/-inner$/, '')
        .replace(/-CB$/, '')
        .replace(/-RB$/, '')
        .replace(/-hiddenInput$/, '');
        
    for (const fieldName in fields) {
        const field = fields[fieldName];
        const cleanFieldId = (field.id || '')
            .replace(/^__/, '')
            .replace(/-inner$/, '')
            .replace(/-CB$/, '')
            .replace(/-RB$/, '')
            .replace(/-hiddenInput$/, '');
            
        if (cleanFieldId === cleanId) return field;
    }
    
    // 3. Match by name attribute (for radio buttons)
    if (element.name && element.type === 'radio') {
        for (const fieldName in fields) {
            const field = fields[fieldName];
            if (field.name === element.name && field.type === 'radio') {
                // For radio, check if it should be selected
                if (field.value === 'on' || field.checked) {
                    // Make sure it's the right radio button by checking ID similarity
                    if (field.id && element.id && field.id.includes(element.id.split('--').pop())) {
                        return field;
                    }
                }
            }
        }
    }
    
    // 4. Match by fieldName being the element ID
    if (fields[element.id]) {
        return fields[element.id];
    }
    
    return null;
}

// Fill SAP UI5 checkbox
async function fillSapCheckbox(element, fieldData) {
    const shouldBeChecked = fieldData.value === 'on' || fieldData.value === true || fieldData.value === 'true';
    const wrapper = element.closest('.sapMCb');
    const isChecked = wrapper?.getAttribute('aria-checked') === 'true';
    
    if (shouldBeChecked !== isChecked) {
        element.focus();
        element.dispatchEvent(new KeyboardEvent('keydown', {
            key: ' ', 
            code: 'Space', 
            keyCode: 32, 
            which: 32,
            bubbles: true
        }));
        element.dispatchEvent(new KeyboardEvent('keyup', {
            key: ' ', 
            code: 'Space', 
            keyCode: 32, 
            which: 32,
            bubbles: true
        }));
        await wait(50);
        return true;
    }
    return false;
}

// Fill SAP UI5 radio button
async function fillSapRadio(element, fieldData) {
    const wrapper = element.closest('.sapMRb');
    const isChecked = wrapper?.getAttribute('aria-checked') === 'true';
    
    if (!isChecked && (fieldData.value === 'on' || fieldData.checked)) {
        element.focus();
        element.dispatchEvent(new KeyboardEvent('keydown', {
            key: ' ', 
            code: 'Space', 
            keyCode: 32, 
            which: 32,
            bubbles: true
        }));
        element.dispatchEvent(new KeyboardEvent('keyup', {
            key: ' ', 
            code: 'Space', 
            keyCode: 32, 
            which: 32,
            bubbles: true
        }));
        await wait(50);
        return true;
    }
    return false;
}

// Fill SAP UI5 select dropdown
async function fillSapSelect(element, fieldData) {
    
    // Find the select wrapper div
    let selectWrapper = null;
    if (element.id.includes('-hiddenInput')) {
        // Get the parent select div
        const baseId = element.id.replace('-hiddenInput', '');
        selectWrapper = document.getElementById(baseId);
    } else {
        selectWrapper = element.closest('.sapMSlt');
    }
    
    if (!selectWrapper) {
        return false;
    }
    
    // Method 1: Simple keyboard approach (like we did for checkboxes)
    // Find the interactive element (the hidden select with role="combobox")
    const hiddenSelect = selectWrapper.querySelector('[role="combobox"]');
    if (hiddenSelect) {
        
        // Focus the element
        hiddenSelect.focus();
        await wait(100);
        
        // Try opening with Space (like checkboxes)
        const spaceEvent = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            which: 32,
            bubbles: true
        });
        hiddenSelect.dispatchEvent(spaceEvent);
        await wait(200);
        
        // Also try keyup
        const spaceUpEvent = new KeyboardEvent('keyup', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            which: 32,
            bubbles: true
        });
        hiddenSelect.dispatchEvent(spaceUpEvent);
        await wait(200);
        
        // Check if dropdown is open, if not try Enter
        if (hiddenSelect.getAttribute('aria-expanded') !== 'true') {
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            });
            hiddenSelect.dispatchEvent(enterEvent);
            await wait(200);
        }
        
        // If still not open, try Alt+Down (common dropdown pattern)
        if (hiddenSelect.getAttribute('aria-expanded') !== 'true') {
            const altDownEvent = new KeyboardEvent('keydown', {
                key: 'ArrowDown',
                code: 'ArrowDown',
                keyCode: 40,
                which: 40,
                altKey: true,
                bubbles: true
            });
            hiddenSelect.dispatchEvent(altDownEvent);
            await wait(200);
        }
        
        // Now try to select the right option
        const targetValue = fieldData.value === 'ON-PREMISE' ? 'On-Premise' : 
                          fieldData.value === 'NONE' ? 'Internet' : 
                          fieldData.value;
        
        // Get current selection
        const currentText = selectWrapper.querySelector('.sapMSelectListItemText')?.textContent?.trim();
        
        // If we need to change selection
        if (currentText !== targetValue) {
            // Try arrow down to move to next option
            if (targetValue === 'On-Premise' && currentText === 'Internet') {
                const arrowDownEvent = new KeyboardEvent('keydown', {
                    key: 'ArrowDown',
                    code: 'ArrowDown',
                    keyCode: 40,
                    which: 40,
                    bubbles: true
                });
                hiddenSelect.dispatchEvent(arrowDownEvent);
                await wait(100);
            } else if (targetValue === 'Internet' && currentText === 'On-Premise') {
                const arrowUpEvent = new KeyboardEvent('keydown', {
                    key: 'ArrowUp',
                    code: 'ArrowUp',
                    keyCode: 38,
                    which: 38,
                    bubbles: true
                });
                hiddenSelect.dispatchEvent(arrowUpEvent);
                await wait(100);
            }
            
            // Confirm selection with Enter
            const confirmEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            });
            hiddenSelect.dispatchEvent(confirmEvent);
            await wait(100);
            
            // Verify the change
            const newText = selectWrapper.querySelector('.sapMSelectListItemText')?.textContent?.trim();
            
            if (newText === targetValue) {
                return true;
            }
        } else {
            return true;
        }
    }
    
    // Try SAP UI5 API first (if available in the page context)
    if (typeof sap !== 'undefined' && sap.ui?.getCore) {
        try {
            const controlId = selectWrapper.id;
            const control = sap.ui.getCore().byId(controlId);
            if (control?.setSelectedKey) {
                const items = control.getItems();
                const match = items.find(item => {
                    const text = item.getText();
                    const key = item.getKey();
                    return text === fieldData.value || 
                           key === fieldData.value ||
                           text.toLowerCase().replace(/[-\s]/g, '') === fieldData.value.toLowerCase().replace(/[-\s]/g, '');
                });
                if (match) {
                    control.setSelectedKey(match.getKey());
                    return true;
                }
            }
        } catch(e) {
        }
    }
    
    // Method 3: Click on the list items directly if they're visible
    const listItems = selectWrapper.querySelectorAll('li[role="option"]');
    if (listItems.length > 0) {
        
        // First click on the select to make it active
        selectWrapper.click();
        await wait(100);
        
        for (const item of listItems) {
            const text = item.textContent?.trim();
            if (text === fieldData.value || 
                text === 'On-Premise' && fieldData.value === 'ON-PREMISE' ||
                text === 'Internet' && fieldData.value === 'NONE') {
                
                
                // Simulate mouse events for proper SAP UI5 interaction
                const mousedownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                item.dispatchEvent(mousedownEvent);
                
                await wait(50);
                
                const mouseupEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                item.dispatchEvent(mouseupEvent);
                
                await wait(50);
                
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                item.dispatchEvent(clickEvent);
                
                await wait(100);
                return true;
            }
        }
    }
    
    // Method 4: Try clicking the arrow and then the item
    const arrow = selectWrapper.querySelector('.sapMSltArrow');
    if (arrow) {
        arrow.click();
        await wait(300);
        
        // Look for dropdown items
        const dropdownItems = document.querySelectorAll('.sapMSelectListItem, li[role="option"]');
        for (const item of dropdownItems) {
            const text = item.textContent?.trim();
            if (text === fieldData.value || 
                text === 'On-Premise' && fieldData.value === 'ON-PREMISE' ||
                text === 'Internet' && fieldData.value === 'NONE') {
                item.click();
                await wait(100);
                return true;
            }
        }
        
        // Close dropdown if nothing matched
        arrow.click();
    }
    
    return false;
}

// Fill SAP UI5 combobox
async function fillSapCombobox(element, fieldData) {
    
    // Combobox is like a text input with selection options
    element.value = fieldData.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // If there are options, try to select
    const wrapper = element.closest('.sapMComboBox');
    if (wrapper) {
        element.focus();
        await wait(100);
        
        // Check if options appeared
        const items = document.querySelectorAll('.sapMComboBoxBaseItem');
        for (const item of items) {
            if (item.textContent?.trim() === fieldData.value) {
                item.click();
                await wait(50);
                return true;
            }
        }
    }
    
    return true;
}

// Fill regular text/number input
async function fillTextInput(element, fieldData) {
    element.value = fieldData.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
}

// Fill a single field based on its type
async function fillSingleField(element, fieldData) {
    try {
        const wrapper = element.closest('.sapMCb, .sapMRb, .sapMSlt, .sapMInput, .sapMComboBox');
        const elementType = detectElementType(element, wrapper);
        
        
        switch(elementType) {
            case 'sap-checkbox':
                return await fillSapCheckbox(element, fieldData);
                
            case 'sap-radio':
                return await fillSapRadio(element, fieldData);
                
            case 'sap-select':
                return await fillSapSelect(element, fieldData);
                
            case 'sap-combobox':
                return await fillSapCombobox(element, fieldData);
                
            case 'text':
            case 'number':
                return await fillTextInput(element, fieldData);
                
            default:
                return false;
        }
    } catch (error) {
        console.error(`[ConnectivityPlugin-Seq] Error filling field ${element.id}:`, error);
        return false;
    }
}

// MAIN SEQUENTIAL FILL FUNCTION
window.fillFormFieldsSequential = async function(profileData) {
    if (!profileData || !profileData.fields) {
        return 0;
    }
    
    let filledCount = 0;
    
    // 1. Get all visible form elements
    const elements = getAllVisibleFormElements();
    
    // 2. Sort by position (top to bottom, left to right)
    const sortedElements = sortByPosition(elements);
    
    // 3. Fill each element sequentially
    for (const element of sortedElements) {
        const fieldData = findFieldDataForElement(element, profileData);
        if (fieldData) {
            const success = await fillSingleField(element, fieldData);
            if (success) {
                filledCount++;
                
                // Wait between fields to allow dynamic fields to appear
                await wait(150);
                
                // Check if new elements appeared after filling this field
                const newElements = getAllVisibleFormElements();
                if (newElements.length > elements.length) {
                    // Add new elements to the list
                    for (const newEl of newElements) {
                        if (!sortedElements.find(el => el.id === newEl.id)) {
                            sortedElements.push(newEl);
                        }
                    }
                    // Re-sort to maintain order
                    sortByPosition(sortedElements);
                }
            }
        }
    }
    
    return filledCount;
};

// Keep backward compatibility - redirect to sequential method
window.fillFormFields = window.fillFormFieldsSequential;

// Enhanced version with progress indicator
window.fillFormFieldsWithProgress = async function(profileData) {
    if (!profileData || !profileData.fields) {
        return 0;
    }
    
    const totalFields = Object.keys(profileData.fields).length;
    let currentField = 0;
    
    let filledCount = 0;
    
    // Get all visible form elements
    const elements = getAllVisibleFormElements();
    
    // Sort by position (top to bottom, left to right)
    const sortedElements = sortByPosition(elements);
    
    // Fill each element sequentially with progress updates
    for (const element of sortedElements) {
        const fieldData = findFieldDataForElement(element, profileData);
        if (fieldData) {
            currentField++;
            
            // Update progress indicator
            updateBusyIndicator(`Processing field ${currentField}/${totalFields}`, 
                              Math.round((currentField / totalFields) * 100));
            
            const success = await fillSingleField(element, fieldData);
            if (success) {
                filledCount++;
                
                // Wait between fields to allow dynamic fields to appear
                await wait(150);
                
                // Check if new elements appeared after filling this field
                const newElements = getAllVisibleFormElements();
                if (newElements.length > elements.length) {
                    // Add new elements to the list
                    for (const newEl of newElements) {
                        if (!sortedElements.find(el => el.id === newEl.id)) {
                            sortedElements.push(newEl);
                        }
                    }
                    // Re-sort to maintain order
                    sortByPosition(sortedElements);
                }
            }
        }
    }
    
    return filledCount;
};

// Storage functions
async function getStoredProfiles() {
    const storageKey = 'connectivityCredentialsManager---profiles';
    
    return new Promise(resolve => {
        chrome.storage.local.get([storageKey], result => {
            if (chrome.runtime.lastError) {
                console.error('Storage error:', chrome.runtime.lastError);
                resolve([]);
            } else {
                resolve(result[storageKey] || []);
            }
        });
    });
}

async function saveProfileToStorage(profileName, data) {
    const storageKey = 'connectivityCredentialsManager---profiles';
    const profiles = await getStoredProfiles();
    
    const existingIndex = profiles.findIndex(p => p.name === profileName);
    
    const profile = {
        name: profileName,
        type: data.type,
        data: data,
        created: existingIndex >= 0 ? profiles[existingIndex].created : new Date().toISOString(),
        updated: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
    } else {
        profiles.push(profile);
    }
    
    return new Promise(resolve => {
        chrome.storage.local.set({ [storageKey]: profiles }, () => {
            if (chrome.runtime.lastError) {
                console.error('Save error:', chrome.runtime.lastError);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

async function deleteProfileFromStorage(profileName) {
    const storageKey = 'connectivityCredentialsManager---profiles';
    const profiles = await getStoredProfiles();
    const filtered = profiles.filter(p => p.name !== profileName);
    
    return new Promise(resolve => {
        chrome.storage.local.set({ [storageKey]: filtered }, () => {
            resolve(!chrome.runtime.lastError);
        });
    });
}

// Busy Indicator Functions
function showBusyIndicator(profileName, profileData) {
    // Remove any existing indicator
    hideBusyIndicator();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'cpiConnectivityBusyOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    // Create indicator container
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 30px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        text-align: center;
        min-width: 300px;
        max-width: 400px;
    `;
    
    // Add content
    indicator.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">⚙️</div>
            <h3 style="margin: 0 0 10px 0; color: #333;">Loading Profile</h3>
            <p style="margin: 0 0 20px 0; color: #666; font-weight: bold;">${profileName}</p>
        </div>
        <div style="position: relative; height: 30px; background: #f0f0f0; border-radius: 15px; overflow: hidden;">
            <div id="cpiConnectivityProgress" style="
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                border-radius: 15px;
                width: 0%;
                transition: width 0.3s ease;
            "></div>
        </div>
        <div id="cpiConnectivityStatus" style="margin-top: 15px; color: #666; font-size: 14px;">
            Initializing...
        </div>
        <div style="margin-top: 20px;">
            <div class="spinner" style="
                border: 3px solid #f3f3f3;
                border-top: 3px solid #4CAF50;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            "></div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    overlay.appendChild(indicator);
    document.body.appendChild(overlay);
}

function updateBusyIndicator(status, progress) {
    const statusEl = document.getElementById('cpiConnectivityStatus');
    const progressEl = document.getElementById('cpiConnectivityProgress');
    
    if (statusEl) {
        statusEl.textContent = status;
    }
    
    if (progressEl && progress !== undefined) {
        progressEl.style.width = `${progress}%`;
    }
}

function hideBusyIndicator() {
    const overlay = document.getElementById('cpiConnectivityBusyOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// UI Creation functions
function createButton(text, title, onClick) {
    const button = document.createElement('button');
    button.className = 'sapMBtn sapMBtnBase';
    button.textContent = text;
    button.title = title;
    
    // Style to match SAP Fiori theme
    button.style.cssText = `
        height: 2rem;
        line-height: 2rem;
        padding: 0 0.875rem;
        margin: 0 0.125rem;
        border: none;
        border-radius: 0.25rem;
        background-color: transparent;
        color: #0070b1;
        font-size: 0.875rem;
        font-family: "72", "72full", Arial, Helvetica, sans-serif;
        font-weight: normal;
        cursor: pointer;
        transition: background-color 0.1s;
        white-space: nowrap;
    `;
    
    // Add hover effect
    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 112, 177, 0.1)';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'transparent';
    });
    
    // Add active/pressed effect
    button.addEventListener('mousedown', () => {
        button.style.backgroundColor = 'rgba(0, 112, 177, 0.2)';
    });
    
    button.addEventListener('mouseup', () => {
        button.style.backgroundColor = 'rgba(0, 112, 177, 0.1)';
    });
    
    // Add focus outline
    button.addEventListener('focus', () => {
        button.style.outline = '1px dotted #0070b1';
        button.style.outlineOffset = '2px';
    });
    
    button.addEventListener('blur', () => {
        button.style.outline = 'none';
    });
    
    button.addEventListener('click', onClick);
    return button;
}

function showNotification(title, message, type = 'info') {
    // Use CPI Helper's toast if available
    if (typeof showToast === 'function') {
        showToast(title, message, type);
    } else {
        // Fallback to console
        console.log(`[Connectivity Manager] ${title}: ${message}`);
    }
}

function createUI() {
    // Don't create if already exists
    if (document.querySelector('#cpiConnectivityControls')) return;
    
    // Find the header bar
    const header = document.querySelector('#PageConnectivity > header.sapMPageHeader');
    if (!header) {
        console.log('[Connectivity Manager] Header not found, retrying...');
        return;
    }

    // Find or create right area in header bar
    let rightArea = header.querySelector('.sapMBarRight');
    if (!rightArea) {
        const barMiddle = header.querySelector('.sapMBarMiddle');
        if (barMiddle && barMiddle.parentNode) {
            rightArea = document.createElement('div');
            rightArea.className = 'sapMBarRight sapMBarContainer';
            barMiddle.parentNode.appendChild(rightArea);
        }
    }

    if (!rightArea) {
        console.log('[Connectivity Manager] Could not create right area');
        return;
    }

    // Create container for our controls
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'cpiConnectivityControls';
    controlsContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-right: 0.5rem;
        padding-left: 0.5rem;
        border-left: 1px solid rgba(0, 0, 0, 0.1);
        height: 2.5rem;
    `;
    
    // Save button
    const saveBtn = createButton('Save', 'Save current form data as a reusable profile', showSaveDialog);
    
    // Load button
    const loadBtn = createButton('Load', 'Load a saved profile to fill the form', showLoadDialog);
    
    // Manage button
    const manageBtn = createButton('Manage', 'View, edit, or delete saved profiles', showManageDialog);
    
    // Help button
    const helpBtn = createButton('?', 'Help - How to use profiles', showHelpDialog);
    helpBtn.style.minWidth = '1.5rem';
    helpBtn.style.padding = '0 0.5rem';
    helpBtn.style.marginLeft = '0.5rem';
    helpBtn.style.borderLeft = '1px solid rgba(0, 0, 0, 0.1)';
    helpBtn.style.paddingLeft = '0.75rem';
    
    controlsContainer.appendChild(saveBtn);
    controlsContainer.appendChild(loadBtn);
    controlsContainer.appendChild(manageBtn);
    controlsContainer.appendChild(helpBtn);
    
    rightArea.appendChild(controlsContainer);
    
    console.log('[Connectivity Manager] UI created successfully');
}

// Create consistent dialog HTML
function createDialogHTML(title, iconClass, content) {
    return `
        <div class="ui form" style="font-size: 14px;">
            <h3 class="ui header" style="font-size: 1.28rem; margin-bottom: 1.5rem;">
                <i class="${iconClass} icon" style="font-size: 1.2em;"></i>
                <div class="content" style="padding-left: 0.5rem;">
                    ${title}
                </div>
            </h3>
            ${content}
        </div>
    `;
}

// Dialog functions
function showHelpDialog() {
    if (typeof showBigPopup === 'function' && typeof createElementFromHTML === 'function') {
        const content = `
            <div class="ui segments">
                <div class="ui segment">
                    <h4 class="ui header" style="font-size: 1rem;">
                        <i class="info circle icon"></i>
                        About Profile Manager
                    </h4>
                    <p style="font-size: 0.92rem; line-height: 1.5;">
                        The Profile Manager helps you save and reuse connectivity test configurations. 
                        This saves time when testing multiple environments or switching between different connection settings.
                    </p>
                </div>
                
                <div class="ui segment">
                    <h4 class="ui header" style="font-size: 1rem;">
                        <i class="list icon"></i>
                        How to Use
                    </h4>
                    <div class="ui relaxed list" style="font-size: 0.92rem;">
                        <div class="item">
                            <i class="save outline icon"></i>
                            <div class="content">
                                <div class="header" style="font-size: 0.92rem;">Save Profile</div>
                                <div class="description">Fill out the form with your connection details, then click Save to store them as a named profile.</div>
                            </div>
                        </div>
                        <div class="item">
                            <i class="folder open outline icon"></i>
                            <div class="content">
                                <div class="header" style="font-size: 0.92rem;">Load Profile</div>
                                <div class="description">Click Load to see your saved profiles. Click on any profile to instantly fill the form with those values.</div>
                            </div>
                        </div>
                        <div class="item">
                            <i class="settings icon"></i>
                            <div class="content">
                                <div class="header" style="font-size: 0.92rem;">Manage Profiles</div>
                                <div class="description">View all your profiles, see their details, or delete ones you no longer need.</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="ui segment">
                    <h4 class="ui header" style="font-size: 1rem;">
                        <i class="shield alternate icon"></i>
                        Data Storage
                    </h4>
                    <p style="font-size: 0.92rem; line-height: 1.5;">
                        All profiles are stored locally in your browser's Chrome storage. 
                        No data is sent to external servers. Profiles are specific to each connection type (TLS, SSH, FTP, etc.).
                    </p>
                </div>
                
                <div class="ui info message" style="font-size: 0.9rem;">
                    <i class="lightbulb outline icon"></i>
                    <strong>Tip:</strong> Use descriptive names for your profiles like "Production SFTP" or "Test Environment SSH" to easily identify them later.
                </div>
            </div>
        `;
        
        const html = createDialogHTML('Profile Manager Help', 'question circle', content);
        showBigPopup(createElementFromHTML(html), 'Help');
        
        // Add close button to modal footer
        setTimeout(() => {
            const modalFooter = document.querySelector('#cpiHelper_semanticui_modal .actions');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button class="ui primary button" id="helpCloseBtn">
                        Got it!
                    </button>
                `;
                
                document.getElementById('helpCloseBtn')?.addEventListener('click', () => {
                    $('#cpiHelper_semanticui_modal').modal('hide');
                });
            }
        }, 100);
    }
}

function showSaveDialog() {
    const formData = extractFormData();
    const fieldCount = Object.keys(formData.fields).length;
    
    if (fieldCount === 0) {
        showNotification('No data to save', 'Please fill out some fields first', 'warning');
        return;
    }
    
    // Check if CPI Helper functions are available
    if (typeof showBigPopup === 'function' && typeof createElementFromHTML === 'function') {
        const content = `
            <div class="ui info message" style="font-size: 0.92rem;">
                <div class="header" style="font-size: 1rem; margin-bottom: 0.5rem;">Profile Details</div>
                <p style="margin: 0.25rem 0;"><strong>Connection Type:</strong> ${formData.type}</p>
                <p style="margin: 0.25rem 0;"><strong>Fields to save:</strong> ${fieldCount} fields</p>
            </div>
            <div class="field">
                <label style="font-size: 0.92rem; font-weight: 600; margin-bottom: 0.5rem;">Profile Name</label>
                <input type="text" id="profileNameInput" placeholder="e.g., Production SFTP Server" 
                       style="font-size: 0.92rem; padding: 0.5rem;">
            </div>
        `;
        
        const html = createDialogHTML('Save Connectivity Profile', 'save', content);
        
        showBigPopup(createElementFromHTML(html), 'Save Profile');
        
        setTimeout(() => {
            const input = document.getElementById('profileNameInput');
            if (input) input.focus();
            
            // Add custom save button to modal footer
            const modalFooter = document.querySelector('#cpiHelper_semanticui_modal .actions');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button class="ui button" id="saveCancelBtn">Cancel</button>
                    <button class="ui primary button" id="saveProfileBtn">
                        <i class="save icon"></i> Save Profile
                    </button>
                `;
                
                document.getElementById('saveCancelBtn')?.addEventListener('click', () => {
                    $('#cpiHelper_semanticui_modal').modal('hide');
                });
                
                document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
                    const profileName = document.getElementById('profileNameInput').value.trim();
                    
                    if (!profileName) {
                        showNotification('Invalid name', 'Please enter a profile name', 'error');
                        return;
                    }
                    
                    const saved = await saveProfileToStorage(profileName, formData);
                    
                    if (saved) {
                        showNotification('Profile saved', `"${profileName}" saved successfully`, 'success');
                        $('#cpiHelper_semanticui_modal').modal('hide');
                    } else {
                        showNotification('Save failed', 'Could not save profile', 'error');
                    }
                });
            }
        }, 100);
    } else {
        // Fallback to browser prompt
        const profileName = prompt(`Save profile for ${formData.type} connection\n${fieldCount} fields will be saved.\n\nEnter profile name:`);
        if (profileName) {
            saveProfileToStorage(profileName.trim(), formData).then(saved => {
                if (saved) {
                    showNotification('Profile saved', `"${profileName}" saved successfully`, 'success');
                } else {
                    showNotification('Save failed', 'Could not save profile', 'error');
                }
            });
        }
    }
}

async function showLoadDialog() {
    const profiles = await getStoredProfiles();
    const currentTab = getCurrentTabType();
    
    if (profiles.length === 0) {
        showNotification('No profiles', 'No saved profiles found', 'info');
        return;
    }
    
    const matchingProfiles = profiles.filter(p => p.type === currentTab);
    const otherProfiles = profiles.filter(p => p.type !== currentTab);
    
    if (typeof showBigPopup === 'function' && typeof createElementFromHTML === 'function') {
        let content = `
            <div class="ui info message" style="font-size: 0.92rem;">
                <i class="info circle icon"></i>
                Current tab: <strong>${currentTab}</strong>
            </div>
        `;
        
        if (matchingProfiles.length > 0) {
            content += `
                <h4 class="ui header" style="font-size: 1rem; margin-top: 1rem;">
                    <i class="check circle icon" style="color: #21ba45;"></i>
                    Matching Profiles
                </h4>
                <div class="ui relaxed divided list" style="font-size: 0.92rem;">`;
            matchingProfiles.forEach(profile => {
                const date = new Date(profile.updated);
                const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                content += `
                    <div class="item" style="padding: 0.75rem; background: #f0f9ff; border-radius: 0.25rem; margin: 0.5rem 0;">
                        <div class="right floated content">
                            <button class="ui tiny icon button view-quick-btn" data-profile-name="${profile.name}" 
                                    title="View details" style="font-size: 0.85rem;">
                                <i class="eye icon"></i>
                            </button>
                        </div>
                        <div class="profile-item" style="cursor: pointer;" data-profile-name="${profile.name}">
                            <i class="file icon" style="font-size: 1.2rem;"></i>
                            <div class="content">
                                <div class="header" style="font-size: 0.95rem; font-weight: 600;">${profile.name}</div>
                                <div class="description" style="font-size: 0.85rem; color: #666;">
                                    ${Object.keys(profile.data.fields).length} fields • ${dateStr}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            content += `</div>`;
        }
        
        if (otherProfiles.length > 0) {
            content += `
                <h4 class="ui header" style="font-size: 1rem; margin-top: 1rem;">
                    <i class="folder outline icon"></i>
                    Other Profiles (Different Tab)
                </h4>
                <div class="ui warning message" style="font-size: 0.85rem; margin: 0.5rem 0;">
                    <i class="warning icon"></i>
                    These profiles are for different connection types and cannot be loaded on the current tab.
                </div>
                <div class="ui relaxed divided list" style="font-size: 0.92rem;">`;
            otherProfiles.forEach(profile => {
                const date = new Date(profile.updated);
                const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                content += `
                    <div class="item other-profile-item" style="padding: 0.75rem; opacity: 0.5; cursor: not-allowed;">
                        <div class="right floated content">
                            <button class="ui tiny icon button view-quick-btn" data-profile-name="${profile.name}" 
                                    title="View details" style="font-size: 0.85rem;">
                                <i class="eye icon"></i>
                            </button>
                        </div>
                        <div style="pointer-events: none;">
                            <i class="file outline icon" style="font-size: 1.2rem;"></i>
                            <div class="content">
                                <div class="header" style="font-size: 0.95rem; font-weight: 600;">${profile.name}</div>
                                <div class="description" style="font-size: 0.85rem; color: #999;">
                                    <strong>${profile.type}</strong> • ${Object.keys(profile.data.fields).length} fields • ${dateStr}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            content += `</div>`;
        }
        
        const html = createDialogHTML('Load Profile', 'folder open', content);
        
        showBigPopup(createElementFromHTML(html), 'Load Profile');
        
        // Add event listeners after dialog is shown
        setTimeout(() => {
            // Load profile on click (only for matching profiles)
            document.querySelectorAll('.profile-item').forEach(item => {
                item.addEventListener('click', async function() {
                    const profileName = this.getAttribute('data-profile-name');
                    const profile = profiles.find(p => p.name === profileName);
                    
                    if (profile && profile.type === currentTab) {
                        // Hide the modal immediately
                        $('#cpiHelper_semanticui_modal').modal('hide');
                        
                        // Show busy indicator
                        showBusyIndicator(profileName, profile.data);
                        
                        // Fill the form with progress updates
                        const filledCount = await window.fillFormFieldsWithProgress(profile.data);
                        
                        // Hide busy indicator
                        hideBusyIndicator();
                        
                        if (filledCount > 0) {
                            showNotification('Profile loaded', `Successfully loaded ${filledCount} fields from "${profileName}"`, 'success');
                        } else {
                            showNotification('Load failed', 'Could not fill any fields', 'warning');
                        }
                    }
                });
            });
            
            // Add click handler for other profile items to show warning
            document.querySelectorAll('.other-profile-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showNotification('Wrong tab', 'This profile is for a different connection type', 'warning');
                });
            });
            
            // View profile details on eye button click
            document.querySelectorAll('.view-quick-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent triggering the load
                    const profileName = this.getAttribute('data-profile-name');
                    const profile = profiles.find(p => p.name === profileName);
                    if (profile) {
                        showProfileDetails(profile);
                    }
                });
            });
        }, 100);
    } else {
        // Fallback to simple selection
        let message = `Select profile to load:\n\nMatching (${currentTab}):\n`;
        matchingProfiles.forEach((p, i) => {
            message += `${i + 1}. ${p.name}\n`;
        });
        if (otherProfiles.length > 0) {
            message += `\nOther profiles:\n`;
            otherProfiles.forEach((p, i) => {
                message += `${matchingProfiles.length + i + 1}. ${p.name} (${p.type})\n`;
            });
        }
        
        const selection = prompt(message + '\nEnter number:');
        if (selection) {
            const index = parseInt(selection) - 1;
            const allProfiles = [...matchingProfiles, ...otherProfiles];
            if (index >= 0 && index < allProfiles.length) {
                const profile = allProfiles[index];
                // Use window.fillFormFields and handle as Promise
                window.fillFormFields(profile.data).then(filledCount => {
                    if (filledCount > 0) {
                        showNotification('Profile loaded', `Loaded ${filledCount} fields from "${profile.name}"`, 'success');
                    } else {
                        showNotification('Load failed', 'Could not fill any fields', 'warning');
                    }
                });
            }
        }
    }
}

function showProfileDetails(profile) {
    if (typeof showBigPopup === 'function' && typeof createElementFromHTML === 'function') {
        // Prepare field values for display
        const fields = profile.data.fields;
        let fieldRows = '';
        
        // Sort fields by their IDs for consistent display
        const sortedFields = Object.entries(fields).sort((a, b) => {
            const idA = a[1].id || a[0];
            const idB = b[1].id || b[0];
            return idA.localeCompare(idB);
        });
        
        sortedFields.forEach(([fieldName, fieldData]) => {
            // Clean up field name for display
            let displayName = fieldName;
            if (fieldData.id) {
                // Extract meaningful name from ID
                displayName = fieldData.id
                    .replace(/^__component[\d-]+---/, '')
                    .replace(/--/, ' ')
                    .replace(/-CB$/, ' (Checkbox)')
                    .replace(/-RB$/, ' (Radio)')
                    .replace(/-inner$/, '')
                    .replace(/-hiddenInput$/, '')
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/^inp|^chb|^rb|^cmb|^txt/, '')
                    .trim();
            }
            
            // Format value for display
            let displayValue = fieldData.value;
            if (fieldData.type === 'checkbox') {
                displayValue = fieldData.value === 'on' ? '☑ Checked' : '☐ Unchecked';
            } else if (fieldData.type === 'radio') {
                displayValue = '◉ ' + displayValue;
            } else if (fieldData.type === 'password' || displayName.toLowerCase().includes('password')) {
                displayValue = '••••••••';
            } else if (!displayValue) {
                displayValue = '<em>empty</em>';
            } else if (displayValue.length > 50) {
                displayValue = displayValue.substring(0, 50) + '...';
            }
            
            // Escape HTML
            displayValue = String(displayValue).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            fieldRows += `
                <tr>
                    <td style="font-weight: 600; padding: 0.5rem 0.75rem; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem;">
                        ${displayName}
                    </td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #f0f0f0; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #333;">
                        ${displayValue}
                    </td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 0.8rem;">
                        ${fieldData.type}
                    </td>
                </tr>
            `;
        });
        
        const content = `
            <div style="max-height: 600px; overflow-y: auto;">
                <div class="ui segment" style="padding: 1rem;">
                    <div style="display: flex; justify-content: space-around; text-align: center;">
                        <div>
                            <strong style="color: #666; font-size: 0.75rem; text-transform: uppercase;">Type</strong><br>
                            <span style="font-size: 0.95rem; font-weight: 600;">${profile.type}</span>
                        </div>
                        <div>
                            <strong style="color: #666; font-size: 0.75rem; text-transform: uppercase;">Fields</strong><br>
                            <span style="font-size: 0.95rem; font-weight: 600;">${Object.keys(fields).length}</span>
                        </div>
                        <div>
                            <strong style="color: #666; font-size: 0.75rem; text-transform: uppercase;">Updated</strong><br>
                            <span style="font-size: 0.95rem; font-weight: 600;">${new Date(profile.updated).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                
                <h4 class="ui header" style="font-size: 1rem; margin-top: 1rem;">
                    <i class="list icon"></i>
                    Field Values
                </h4>
                <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 0.25rem;">
                    <table class="ui very basic table" style="width: 100%; margin: 0; font-size: 0.9rem;">
                        <thead style="background: #f5f5f5;">
                            <tr>
                                <th style="width: 35%; padding: 0.75rem; font-size: 0.85rem;">Field Name</th>
                                <th style="width: 45%; padding: 0.75rem; font-size: 0.85rem;">Value</th>
                                <th style="width: 20%; padding: 0.75rem; font-size: 0.85rem;">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fieldRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        const html = createDialogHTML(`Profile: ${profile.name}`, 'eye', content);
        
        // Create wrapper with button handlers
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        
        // Show dialog first
        showBigPopup(wrapper, 'Profile Details');
        
        // Add custom buttons to the modal footer
        setTimeout(() => {
            // Find the modal footer
            const modalFooter = document.querySelector('#cpiHelper_semanticui_modal .actions');
            if (modalFooter) {
                // Clear existing buttons and add our own
                modalFooter.innerHTML = `
                    <button class="ui button" id="profileDetailsBackBtn">
                        <i class="arrow left icon"></i> Back to Manage
                    </button>
                    <button class="ui primary button" id="profileDetailsCloseBtn">
                        Close
                    </button>
                `;
                
                // Add event listeners
                document.getElementById('profileDetailsBackBtn')?.addEventListener('click', () => {
                    $('#cpiHelper_semanticui_modal').modal('hide');
                    setTimeout(showManageDialog, 300);
                });
                
                document.getElementById('profileDetailsCloseBtn')?.addEventListener('click', () => {
                    $('#cpiHelper_semanticui_modal').modal('hide');
                });
            }
        }, 100);
    } else {
        // Fallback to alert
        let message = `Profile: ${profile.name}\n`;
        message += `Type: ${profile.type}\n`;
        message += `Fields: ${Object.keys(profile.data.fields).length}\n`;
        message += `Updated: ${new Date(profile.updated).toLocaleString()}\n\n`;
        message += 'Field Values:\n';
        
        Object.entries(profile.data.fields).forEach(([name, field]) => {
            let value = field.value;
            if (field.type === 'password' || name.toLowerCase().includes('password')) {
                value = '••••••••';
            } else if (value.length > 30) {
                value = value.substring(0, 30) + '...';
            }
            message += `  ${name}: ${value}\n`;
        });
        
        alert(message);
    }
}

async function showManageDialog() {
    const profiles = await getStoredProfiles();
    
    if (profiles.length === 0) {
        showNotification('No profiles', 'No saved profiles to manage', 'info');
        return;
    }
    
    if (typeof showBigPopup === 'function' && typeof createElementFromHTML === 'function') {
        let html = `
            <div class="ui form">
                <h3 class="ui header">
                    <i class="settings icon"></i>
                    Manage Profiles
                </h3>
                <p>${profiles.length} saved profile${profiles.length !== 1 ? 's' : ''}</p>
                <div class="ui relaxed divided list">
        `;
        
        profiles.forEach(profile => {
            html += `
                <div class="item">
                    <div class="right floated content">
                        <button class="ui small button view-profile-btn" data-profile-name="${profile.name}">
                            <i class="eye icon"></i> View
                        </button>
                        <button class="ui small red button delete-profile-btn" data-profile-name="${profile.name}">
                            <i class="trash icon"></i> Delete
                        </button>
                    </div>
                    <i class="file icon"></i>
                    <div class="content">
                        <div class="header">${profile.name}</div>
                        <div class="description">
                            Type: ${profile.type} • 
                            Fields: ${Object.keys(profile.data.fields).length} • 
                            Updated: ${new Date(profile.updated).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        showBigPopup(createElementFromHTML(html), 'Manage Profiles');
        
        // Add event listeners after dialog is shown
        setTimeout(() => {
            // View button handlers
            document.querySelectorAll('.view-profile-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const profileName = this.getAttribute('data-profile-name');
                    const profile = profiles.find(p => p.name === profileName);
                    if (profile) {
                        showProfileDetails(profile);
                    }
                });
            });
            
            // Delete button handlers
            document.querySelectorAll('.delete-profile-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const profileName = this.getAttribute('data-profile-name');
                    if (confirm(`Delete profile "${profileName}"?`)) {
                        const deleted = await deleteProfileFromStorage(profileName);
                        if (deleted) {
                            showNotification('Profile deleted', `"${profileName}" deleted`, 'success');
                            $('#cpiHelper_semanticui_modal').modal('hide');
                            // Refresh the dialog
                            setTimeout(showManageDialog, 500);
                        }
                    }
                });
            });
        }, 100);
    } else {
        // Fallback to simple list
        let message = 'Saved profiles:\n\n';
        profiles.forEach((p, i) => {
            message += `${i + 1}. ${p.name} (${p.type})\n`;
        });
        message += '\nEnter number to delete (or cancel):';
        
        const selection = prompt(message);
        if (selection) {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < profiles.length) {
                const profile = profiles[index];
                if (confirm(`Delete profile "${profile.name}"?`)) {
                    deleteProfileFromStorage(profile.name).then(deleted => {
                        if (deleted) {
                            showNotification('Profile deleted', `"${profile.name}" deleted`, 'success');
                        }
                    });
                }
            }
        }
    }
}

// Initialize function
function initializePlugin() {
    if (!isConnectivityPage()) return;
    
    if (connectivityCredentialsState.initialized) return;
    
    console.log('[Connectivity Manager] Initializing on connectivity page...');
    
    // Try to create UI
    createUI();
    
    // If UI wasn't created, set up observer to wait for page load
    if (!document.querySelector('#cpiConnectivityControls')) {
        if (connectivityCredentialsState.observer) {
            connectivityCredentialsState.observer.disconnect();
        }
        
        connectivityCredentialsState.observer = new MutationObserver((mutations, observer) => {
            if (document.querySelector('#PageConnectivity > header.sapMPageHeader')) {
                createUI();
                if (document.querySelector('#cpiConnectivityControls')) {
                    observer.disconnect();
                    connectivityCredentialsState.initialized = true;
                }
            }
        });
        
        connectivityCredentialsState.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also try periodically for 10 seconds
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            createUI();
            if (document.querySelector('#cpiConnectivityControls') || attempts > 20) {
                clearInterval(interval);
                if (connectivityCredentialsState.observer) {
                    connectivityCredentialsState.observer.disconnect();
                }
                connectivityCredentialsState.initialized = true;
            }
        }, 500);
    } else {
        connectivityCredentialsState.initialized = true;
    }
}

// Check for page changes (SPA navigation)
function checkForPageChange() {
    const wasInitialized = connectivityCredentialsState.initialized;
    const isNowConnectivityPage = isConnectivityPage();
    
    if (!wasInitialized && isNowConnectivityPage) {
        // Navigated to connectivity page
        initializePlugin();
    } else if (wasInitialized && !isNowConnectivityPage) {
        // Navigated away from connectivity page
        connectivityCredentialsState.initialized = false;
        if (connectivityCredentialsState.observer) {
            connectivityCredentialsState.observer.disconnect();
            connectivityCredentialsState.observer = null;
        }
    } else if (isNowConnectivityPage && !document.querySelector('#cpiConnectivityControls')) {
        // Still on connectivity page but UI is missing
        connectivityCredentialsState.initialized = false;
        initializePlugin();
    }
}

// Start monitoring
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializePlugin();
        // Check for page changes every 2 seconds
        setInterval(checkForPageChange, 2000);
    });
} else {
    initializePlugin();
    // Check for page changes every 2 seconds
    setInterval(checkForPageChange, 2000);
}

// Register with CPI Helper
pluginList.push(plugin);