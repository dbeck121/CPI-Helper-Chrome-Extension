var plugin = {
    metadataVersion: "1.0.0",
    id: "connectivityCredentialsManager", 
    name: "Connectivity Credentials Manager",
    version: "3.0.0",
    author: "CLAIMATE Tech team",
    email: "info@claimate.tech",
    website: "https://github.com/claimate/CPI-Helper-Chrome-Extension",
    description: "Saves and manages credentials for SAP Cloud Integration connectivity tests. Automatically adds controls to the Connectivity Test page.",

    settings: {
        enableAutoSave: { 
            text: "Auto-save on form changes", 
            type: "checkbox", 
            scope: "browser" 
        },
        showNotifications: {
            text: "Show notifications",
            type: "checkbox", 
            scope: "browser"
        },
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
        const allInputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        
        allInputs.forEach(input => {
            // Skip if not visible or (empty and not a checkbox)
            if (!input.offsetParent) return;
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
                            console.log(`[ConnectivityPlugin] Extracted select value from display input: ${value}`);
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
        const inputs = activePanel.querySelectorAll('input:not([type="hidden"]), select, textarea');
        
        inputs.forEach(input => {
            // Skip if not visible or (empty and not a checkbox)
            if (!input.offsetParent) return;
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
                            console.log(`[ConnectivityPlugin] Extracted select value from display input: ${value}`);
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

// Make fillFormFields globally available for event handlers and return Promise
window.fillFormFields = function(profileData) {
    return new Promise((resolve) => {
        if (!profileData || !profileData.fields) {
            resolve(0);
            return;
        }
        
        let phase1Count = 0;
        
        console.log('[ConnectivityPlugin] Starting fillFormFields with:', profileData);
        
        // First pass: handle checkboxes and radio buttons to trigger dynamic fields
        Object.keys(profileData.fields).forEach(fieldName => {
            const field = profileData.fields[fieldName];
            if (field.type !== 'checkbox' && field.type !== 'radio') return;
            
            console.log(`[ConnectivityPlugin] Processing ${field.type} ${fieldName}:`, field);
            
            // Handle IDs with double underscores by trying both versions
            let element = document.getElementById(field.id);
            if (!element && field.id.startsWith('__')) {
                // Try without the double underscore prefix
                element = document.getElementById(field.id.substring(2));
            }
            if (!element && field.selector) {
                try {
                    element = document.querySelector(field.selector);
                } catch(e) {
                    console.log(`[ConnectivityPlugin] Error finding by selector:`, e);
                }
            }
            
            // Additional fallback: try to find by partial ID match for checkboxes
            if (!element && field.type === 'checkbox' && field.id) {
                // Try to find checkbox with a more flexible selector
                const idPart = field.id.split('--').pop(); // Get the last part after --
                element = document.querySelector(`input[id*="${idPart}"]`);
                if (element) {
                    console.log(`[ConnectivityPlugin] Found checkbox by partial ID match: ${idPart}`);
                } else {
                    // Try even more flexible matching
                    const keywords = field.id.match(/[A-Z][a-z]+|[a-z]+/g); // Extract words from camelCase
                    if (keywords && keywords.length > 0) {
                        // Try to find by keywords in the ID
                        for (let keyword of keywords) {
                            if (keyword.length > 3) { // Skip short words
                                element = document.querySelector(`input[type="checkbox"][id*="${keyword}"]`);
                                if (element) {
                                    console.log(`[ConnectivityPlugin] Found checkbox by keyword: ${keyword}`);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Last resort: log all available checkboxes
                    if (!element) {
                        const allCheckboxes = document.querySelectorAll('input[type="checkbox"]:not([type="hidden"])');
                        console.log(`[ConnectivityPlugin] Could not find checkbox ${field.id}. Available checkboxes:`, 
                            Array.from(allCheckboxes).map(cb => cb.id).filter(id => id));
                    }
                }
            }
            
            // Additional fallback for radio buttons
            if (!element && field.type === 'radio' && field.id) {
                // Try to find radio with a more flexible selector
                const idPart = field.id.split('--').pop(); // Get the last part after --
                element = document.querySelector(`input[id*="${idPart}"][type="radio"]`);
                if (element) {
                    console.log(`[ConnectivityPlugin] Found radio by partial ID match: ${idPart}`);
                } else {
                    // Try without the type restriction
                    element = document.querySelector(`input[id*="${idPart}"]`);
                    if (element) {
                        console.log(`[ConnectivityPlugin] Found radio by partial ID match without type: ${idPart}`);
                    } else {
                        // Try to extract meaningful parts from the ID
                        // Look for specific patterns like rbSSHHostKeyValidation
                        const keyPatterns = ['HostKey', 'KeyValidation', 'Validation', 'rbSSHHost'];
                        for (let pattern of keyPatterns) {
                            if (field.id.includes(pattern)) {
                                element = document.querySelector(`input[type="radio"][id*="${pattern}"]`);
                                if (element) {
                                    console.log(`[ConnectivityPlugin] Found radio by pattern: ${pattern}`);
                                    break;
                                }
                            }
                        }
                        
                        if (!element) {
                            const matches = field.id.match(/rb[A-Z][A-Za-z]+|[A-Z][a-z]+/g);
                            if (matches) {
                                // Skip generic terms and look for specific ones
                                const specificMatches = matches.filter(m => 
                                    !['Connectivity', 'com', 'sap', 'it', 'op', 'web', 'ui', 'pages'].includes(m)
                                );
                                for (let match of specificMatches) {
                                    element = document.querySelector(`input[type="radio"][id*="${match}"]`);
                                    if (element) {
                                        console.log(`[ConnectivityPlugin] Found radio by keyword: ${match}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Last resort: log all available radio buttons
                    if (!element) {
                        const allRadios = document.querySelectorAll('input[type="radio"]:not([type="hidden"])');
                        console.log(`[ConnectivityPlugin] Could not find radio ${field.id}. Available radios:`, 
                            Array.from(allRadios).map(r => r.id).filter(id => id));
                    }
                }
            }
            
            if (element) {
                if (field.type === 'radio') {
                    // Handle radio buttons
                    const sapWrapper = element.closest('.sapMRb');
                    if (sapWrapper) {
                        const isChecked = sapWrapper.getAttribute('aria-checked') === 'true';
                        if (!isChecked) {
                            console.log(`[ConnectivityPlugin] Clicking radio button ${fieldName}`);
                            // Use keyboard event for radio buttons too
                            element.focus();
                            const spaceEvent = new KeyboardEvent('keydown', {
                                key: ' ',
                                code: 'Space',
                                keyCode: 32,
                                which: 32,
                                bubbles: true
                            });
                            element.dispatchEvent(spaceEvent);
                            phase1Count++;
                        }
                    } else {
                        if (!element.checked) {
                            element.click();
                            phase1Count++;
                        }
                    }
                    return;
                }
                
                // Handle checkboxes
                const shouldBeChecked = field.value === 'on' || field.value === true || field.value === 'true';
                const sapWrapper = element.closest('.sapMCb');
                if (sapWrapper) {
                    const isChecked = sapWrapper.getAttribute('aria-checked') === 'true';
                    console.log(`[ConnectivityPlugin] SAP checkbox ${fieldName}: wrapper found, should be ${shouldBeChecked}, is ${isChecked}`);
                    if (shouldBeChecked !== isChecked) {
                        console.log(`[ConnectivityPlugin] Clicking SAP wrapper for ${fieldName}`);
                        
                        // Try different methods to toggle the checkbox
                        // Method 1: Focus and space key (most reliable for accessibility)
                        element.focus();
                        const spaceEvent = new KeyboardEvent('keydown', {
                            key: ' ',
                            code: 'Space',
                            keyCode: 32,
                            which: 32,
                            bubbles: true
                        });
                        element.dispatchEvent(spaceEvent);
                        element.dispatchEvent(new KeyboardEvent('keyup', {
                            key: ' ',
                            code: 'Space',
                            keyCode: 32,
                            which: 32,
                            bubbles: true
                        }));
                        
                        // Method 2: Try clicking the wrapper after a short delay
                        setTimeout(() => {
                            if (sapWrapper.getAttribute('aria-checked') !== (shouldBeChecked ? 'true' : 'false')) {
                                console.log(`[ConnectivityPlugin] Keyboard event didn't work, trying wrapper click`);
                                sapWrapper.click();
                                
                                // Method 3: Force the state change
                                setTimeout(() => {
                                    if (sapWrapper.getAttribute('aria-checked') !== (shouldBeChecked ? 'true' : 'false')) {
                                        console.log(`[ConnectivityPlugin] Wrapper click didn't work, forcing state change`);
                                        
                                        // Try to find and use SAP UI5 control directly
                                        if (typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
                                            try {
                                                const control = sap.ui.getCore().byId(sapWrapper.id);
                                                if (control && control.setSelected) {
                                                    control.setSelected(shouldBeChecked);
                                                    console.log(`[ConnectivityPlugin] Used SAP UI5 API to set checkbox`);
                                                }
                                            } catch(e) {
                                                console.log(`[ConnectivityPlugin] SAP UI5 API error:`, e);
                                            }
                                        }
                                        
                                        // Last resort: click the input directly
                                        element.click();
                                    }
                                }, 50);
                            }
                        }, 50);
                        
                        phase1Count++;
                    }
                } else {
                    // Fallback for regular checkboxes
                    const isChecked = element.checked;
                    console.log(`[ConnectivityPlugin] Regular checkbox ${fieldName}: should be ${shouldBeChecked}, is ${isChecked}`);
                    if (shouldBeChecked !== isChecked) {
                        element.click();
                        phase1Count++;
                    }
                }
            } else {
                console.log(`[ConnectivityPlugin] Checkbox element not found for ${fieldName}, field.id: ${field.id}`);
            }
        });
        
        // Wait for dynamic fields to appear
        setTimeout(() => {
            let phase2Count = 0;
            console.log('[ConnectivityPlugin] Phase 2: Filling dropdowns and dynamic checkboxes');
            
            // First, handle select dropdowns to trigger more dynamic fields
            Object.keys(profileData.fields).forEach(fieldName => {
                const field = profileData.fields[fieldName];
                if (field.type !== 'select' && !field.id?.includes('hiddenInput')) return;
                
                console.log(`[ConnectivityPlugin] Phase 2 - Processing dropdown ${fieldName}:`, field);
                
                let element = document.getElementById(field.id);
                if (!element && field.id.startsWith('__')) {
                    element = document.getElementById(field.id.substring(2));
                }
                
                if (element && element.offsetParent) {
                    // For hidden inputs, find the actual select element
                    let selectElement = element;
                    if (element.id.includes('hiddenInput')) {
                        const baseId = element.id.replace('-hiddenInput', '');
                        const possibleSelect = document.getElementById(baseId);
                        if (possibleSelect) {
                            selectElement = possibleSelect;
                        }
                    }
                    
                    // Try SAP UI5 API first
                    let success = false;
                    if (typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
                        try {
                            let controlId = selectElement.id.replace('-hiddenInput', '').replace('-inner', '');
                            console.log(`[ConnectivityPlugin] Looking for SAP UI5 control: ${controlId}`);
                            const control = sap.ui.getCore().byId(controlId);
                            if (control && control.setSelectedKey) {
                                const items = control.getItems();
                                console.log(`[ConnectivityPlugin] Found ${items.length} items in dropdown ${fieldName}`);
                                const matchingItem = items.find(item => {
                                    const itemText = item.getText();
                                    const itemKey = item.getKey();
                                    // More flexible matching
                                    return itemText === field.value || 
                                           itemKey === field.value ||
                                           itemText.toLowerCase().replace(/[-\s]/g, '') === field.value.toLowerCase().replace(/[-\s]/g, '');
                                });
                                if (matchingItem) {
                                    control.setSelectedKey(matchingItem.getKey());
                                    control.fireChange();
                                    console.log(`[ConnectivityPlugin] Phase 2 - Set dropdown ${fieldName} to ${matchingItem.getKey()} via SAP UI5`);
                                    phase2Count++;
                                    success = true;
                                } else {
                                    console.log(`[ConnectivityPlugin] No matching item found for ${field.value} in dropdown ${fieldName}`);
                                }
                            } else {
                                console.log(`[ConnectivityPlugin] Control not found or doesn't have setSelectedKey for ${controlId}`);
                            }
                        } catch(e) {
                            console.log(`[ConnectivityPlugin] SAP UI5 error in phase 2:`, e);
                        }
                    }
                    
                    // Fallback: try clicking the dropdown if SAP UI5 API didn't work
                    if (!success && element.offsetParent) {
                        console.log(`[ConnectivityPlugin] Phase 2 - Trying fallback click method for ${fieldName}`);
                        setTimeout(() => {
                            // Find and click the dropdown arrow
                            const wrapper = selectElement.closest('.sapMSlt, .sapMComboBox') || selectElement.parentElement;
                            const arrow = wrapper ? wrapper.querySelector('.sapMSltArrow, .sapMSltIcon, .sapMInputBaseIcon') : null;
                            if (arrow) {
                                arrow.click();
                                setTimeout(() => {
                                    const items = document.querySelectorAll('.sapMSelectListItem, .sapMSLI, .sapMComboBoxBaseItem');
                                    items.forEach(item => {
                                        const itemText = item.textContent?.trim();
                                        if (itemText && (itemText === field.value || 
                                            itemText.toLowerCase().replace(/[-\s]/g, '') === field.value.toLowerCase().replace(/[-\s]/g, ''))) {
                                            item.click();
                                            console.log(`[ConnectivityPlugin] Phase 2 - Clicked dropdown item ${itemText}`);
                                            phase2Count++;
                                        }
                                    });
                                }, 200);
                            }
                        }, 100);
                    }
                }
            });
            
            // Wait a bit for dropdowns to trigger dynamic fields
            setTimeout(() => {
                console.log('[ConnectivityPlugin] Phase 2.5: Checking for newly appeared checkboxes and radio buttons');
                
                // After dropdowns, try to fill any checkboxes that might have appeared dynamically
                Object.keys(profileData.fields).forEach(fieldName => {
                const field = profileData.fields[fieldName];
                
                // Handle dynamic checkboxes
                if (field.type === 'checkbox' && field.id !== 'chbSSHUseOutdatedProtocols-CB') {
                
                // Try to find the checkbox again (it might have appeared after phase 1)
                let element = document.getElementById(field.id);
                if (!element) {
                    // Try partial match
                    const idPart = field.id.split('-CB')[0];
                    element = document.querySelector(`input[id*="${idPart}"]`);
                }
                
                if (element) {
                    console.log(`[ConnectivityPlugin] Found dynamic checkbox ${fieldName} in phase 2`);
                    const shouldBeChecked = field.value === 'on' || field.value === true || field.value === 'true';
                    const sapWrapper = element.closest('.sapMCb');
                    if (sapWrapper) {
                        const isChecked = sapWrapper.getAttribute('aria-checked') === 'true';
                        if (shouldBeChecked !== isChecked) {
                            element.focus();
                            const spaceEvent = new KeyboardEvent('keydown', {
                                key: ' ',
                                code: 'Space',
                                keyCode: 32,
                                which: 32,
                                bubbles: true
                            });
                            element.dispatchEvent(spaceEvent);
                            phase2Count++;
                        }
                    }
                }
                
                // Handle dynamic radio buttons that might have appeared
                if (field.type === 'radio' && field.id.includes('HostKey')) {
                    // Try to find the radio button again
                    let element = document.getElementById(field.id);
                    if (!element && field.id.startsWith('__')) {
                        element = document.getElementById(field.id.substring(2));
                    }
                    if (!element) {
                        // Try partial match for Host Key radio buttons
                        const patterns = ['HostKey', 'KeyValidation', 'ValidationKH', 'ValidationFP'];
                        for (let pattern of patterns) {
                            element = document.querySelector(`input[type="radio"][id*="${pattern}"]`);
                            if (element) {
                                console.log(`[ConnectivityPlugin] Found dynamic radio by pattern in phase 2.5: ${pattern}`);
                                break;
                            }
                        }
                    }
                    
                    if (element) {
                        const sapWrapper = element.closest('.sapMRb');
                        if (sapWrapper) {
                            const isChecked = sapWrapper.getAttribute('aria-checked') === 'true';
                            if (!isChecked) {
                                console.log(`[ConnectivityPlugin] Clicking dynamic radio button ${fieldName} in phase 2.5`);
                                element.focus();
                                const spaceEvent = new KeyboardEvent('keydown', {
                                    key: ' ',
                                    code: 'Space',
                                    keyCode: 32,
                                    which: 32,
                                    bubbles: true
                                });
                                element.dispatchEvent(spaceEvent);
                                phase2Count++;
                            }
                        }
                    }
                }
                }  // Added missing closing brace for checkbox if statement
            });
            
            // Phase 3: Fill text fields and remaining elements
            setTimeout(() => {
                let phase3Count = 0;
                console.log('[ConnectivityPlugin] Phase 3: Filling text fields and remaining elements');
                
                // Fill all text fields and other remaining fields
                Object.keys(profileData.fields).forEach(fieldName => {
                    const field = profileData.fields[fieldName];
                    if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'select') return; // Already handled
                
                console.log(`[ConnectivityPlugin] Processing field ${fieldName}:`, field);
                
                let element = null;
                
                // Try multiple ways to find the element
                if (field.id) {
                    element = document.getElementById(field.id);
                }
                if (!element && field.selector) {
                    try {
                        element = document.querySelector(field.selector);
                    } catch(e) {}
                }
                if (!element && field.name) {
                    element = document.querySelector(`[name="${field.name}"]`);
                }
                
                // Also try to find by placeholder for dynamic fields
                if (!element && fieldName) {
                    element = document.querySelector(`input[placeholder*="${fieldName}"], input[id*="${fieldName}"]`);
                }
                
                if (element && element.offsetParent) {
                    // Check if this is a SAP UI5 select dropdown
                    const sapSelectWrapper = element.closest('.sapMSlt');
                    if (sapSelectWrapper || (element.hasAttribute('role') && element.getAttribute('role') === 'combobox') || element.id.includes('hiddenInput')) {
                        console.log(`[ConnectivityPlugin] Found select dropdown ${fieldName}, attempting to set value:`, field.value);
                        
                        // For hidden inputs, find the actual select element
                        let selectElement = element;
                        if (element.id.includes('hiddenInput')) {
                            // Try to find the associated select control
                            const baseId = element.id.replace('-hiddenInput', '');
                            const possibleSelect = document.getElementById(baseId);
                            if (possibleSelect) {
                                selectElement = possibleSelect;
                                console.log(`[ConnectivityPlugin] Found actual select element from hidden input`);
                            }
                        }
                        
                        // Method 1: Try using SAP UI5 control API first (most reliable)
                        let success = false;
                        if (typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
                            try {
                                // Try different ways to get the control ID
                                let controlId = null;
                                if (sapSelectWrapper) {
                                    controlId = sapSelectWrapper.id;
                                } else if (selectElement.id.includes('hiddenInput')) {
                                    controlId = selectElement.id.replace('-hiddenInput', '');
                                } else {
                                    controlId = selectElement.id;
                                }
                                
                                const control = sap.ui.getCore().byId(controlId);
                                if (control && control.setSelectedKey) {
                                    // Try to find the key that matches the text value
                                    const items = control.getItems();
                                    const matchingItem = items.find(item => 
                                        item.getText() === field.value || 
                                        item.getKey() === field.value
                                    );
                                    if (matchingItem) {
                                        control.setSelectedKey(matchingItem.getKey());
                                        control.fireChange();
                                        console.log(`[ConnectivityPlugin] Set select value via SAP UI5 API`);
                                        success = true;
                                    }
                                } else if (control && control.setValue) {
                                    control.setValue(field.value);
                                    control.fireChange();
                                    console.log(`[ConnectivityPlugin] Set select value via setValue`);
                                    success = true;
                                }
                            } catch(e) {
                                console.log(`[ConnectivityPlugin] SAP UI5 API error:`, e);
                            }
                        }
                        
                        // Method 2: Try to set the value directly
                        if (!success) {
                            selectElement.value = field.value;
                            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            // Also set the hidden input if present
                            if (element.id.includes('hiddenInput')) {
                                element.value = field.value;
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                        
                        // Method 3: Try to click and select from dropdown (fallback)
                        if (!success) {
                            setTimeout(() => {
                                console.log(`[ConnectivityPlugin] Trying dropdown click method`);
                                
                                // Find the select wrapper
                                const wrapper = selectElement.closest('.sapMSlt') || selectElement.parentElement;
                                
                                // Find and click the arrow to open dropdown
                                const arrow = wrapper ? wrapper.querySelector('.sapMSltArrow, .sapMSltIcon, .sapMInputBaseIcon') : null;
                                    
                                if (arrow) {
                                    arrow.click();
                                    
                                    // Wait for dropdown to open, then select item
                                    setTimeout(() => {
                                        // Look for dropdown items
                                        const items = document.querySelectorAll('.sapMSelectListItem, .sapMSLI, li[role="option"], .sapMComboBoxBaseItem');
                                        let found = false;
                                        console.log(`[ConnectivityPlugin] Found ${items.length} dropdown items, looking for:`, field.value);
                                        
                                        items.forEach(item => {
                                            const itemText = item.textContent ? item.textContent.trim() : '';
                                            // More flexible matching: case-insensitive and handle variations
                                            const fieldValueNorm = field.value.toLowerCase().replace(/[-_\s]/g, '');
                                            const itemTextNorm = itemText.toLowerCase().replace(/[-_\s]/g, '');
                                            
                                            if (itemText === field.value || 
                                                itemTextNorm === fieldValueNorm ||
                                                itemText.includes(field.value) ||
                                                field.value.includes(itemText)) {
                                                console.log(`[ConnectivityPlugin] Found matching item: "${itemText}" for value: "${field.value}"`);
                                                item.click();
                                                found = true;
                                                return; // Exit forEach
                                            }
                                        });
                                        
                                        if (!found) {
                                            console.log(`[ConnectivityPlugin] Could not find dropdown item for value: "${field.value}"`);
                                            // Log available items for debugging
                                            const availableItems = Array.from(items).map(item => item.textContent?.trim()).filter(Boolean);
                                            if (availableItems.length > 0) {
                                                console.log(`[ConnectivityPlugin] Available dropdown items:`, availableItems);
                                            }
                                        }
                                    }, 200);
                                }
                            }, 100);
                        }
                        
                        phase2Count++;
                    } else {
                        // Handle regular text inputs
                        element.value = field.value;
                        
                        // Trigger SAP UI5 events
                        ['input', 'change', 'blur'].forEach(eventType => {
                            element.dispatchEvent(new Event(eventType, { bubbles: true }));
                        });
                        
                        // For SAP UI5 inputs, also try to set the inner input
                        const innerInput = element.querySelector('input');
                        if (innerInput) {
                            innerInput.value = field.value;
                            innerInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        
                        console.log(`[ConnectivityPlugin] Filled text field ${fieldName} with value:`, field.value);
                        phase3Count++;  // Fixed: should be phase3Count not phase2Count
                    }
                } else {
                    console.log(`[ConnectivityPlugin] Field ${fieldName} not found or not visible`);
                }
            });
            
                    console.log(`[ConnectivityPlugin] Phase 3 complete. Filled ${phase3Count} fields`);
                    
                    // Resolve with total count from all phases
                    const totalCount = phase1Count + phase2Count + phase3Count;
                    console.log(`[ConnectivityPlugin] All phases complete. Total fields filled: ${totalCount}`);
                    resolve(totalCount);
                }, 800); // Increased wait for text fields after dropdowns
            }, 500); // Increased wait for checkboxes after dropdowns
        }, 700); // Increased wait for initial dynamic fields
    });
}

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

// UI Creation functions
function createButton(text, title, onClick) {
    const button = document.createElement('button');
    button.className = 'sapMBtn sapMBtnDefault sapMBtnBase';
    button.innerHTML = `<span class="sapMBtnContent">${text}</span>`;
    button.title = title;
    button.style.cssText = 'height: 2rem; padding: 0 0.75rem; font-size: 0.875rem; margin: 0 0.25rem;';
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
    controlsContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-right: 10px;';
    
    // Save button
    const saveBtn = createButton('💾 Save', 'Save current form as profile', showSaveDialog);
    
    // Load button
    const loadBtn = createButton('📂 Load', 'Load saved profile', showLoadDialog);
    
    // Manage button  
    const manageBtn = createButton('⚙️ Manage', 'Manage saved profiles', showManageDialog);
    
    controlsContainer.appendChild(saveBtn);
    controlsContainer.appendChild(loadBtn);
    controlsContainer.appendChild(manageBtn);
    
    rightArea.appendChild(controlsContainer);
    
    console.log('[Connectivity Manager] UI created successfully');
}

// Dialog functions
function showSaveDialog() {
    const formData = extractFormData();
    const fieldCount = Object.keys(formData.fields).length;
    
    if (fieldCount === 0) {
        showNotification('No data to save', 'Please fill out some fields first', 'warning');
        return;
    }
    
    // Check if CPI Helper functions are available
    if (typeof showBigPopup === 'function' && typeof createElementFromHTML === 'function') {
        const html = `
            <div class="ui form">
                <h3 class="ui header">
                    <i class="save icon"></i>
                    Save Connectivity Profile
                </h3>
                <div class="ui info message">
                    <div class="header">Profile Details</div>
                    <p><strong>Connection Type:</strong> ${formData.type}</p>
                    <p><strong>Fields to save:</strong> ${fieldCount} fields</p>
                </div>
                <div class="field">
                    <label>Profile Name</label>
                    <input type="text" id="profileNameInput" placeholder="e.g., Production SFTP Server">
                </div>
                <div class="ui divider"></div>
                <div class="actions">
                    <button class="ui button" onclick="$('#cpiHelper_semanticui_modal').modal('hide')">Cancel</button>
                    <button class="ui primary button" id="saveProfileBtn">Save Profile</button>
                </div>
            </div>
        `;
        
        showBigPopup(createElementFromHTML(html), 'Save Profile');
        
        setTimeout(() => {
            const input = document.getElementById('profileNameInput');
            if (input) input.focus();
            
            document.getElementById('saveProfileBtn').addEventListener('click', async () => {
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
        let html = `
            <div class="ui form">
                <h3 class="ui header">
                    <i class="folder open icon"></i>
                    Load Profile
                </h3>
                <div class="ui info message">
                    Current tab: <strong>${currentTab}</strong>
                </div>
        `;
        
        if (matchingProfiles.length > 0) {
            html += `<h4 class="ui header">Matching Profiles</h4><div class="ui relaxed divided list">`;
            matchingProfiles.forEach(profile => {
                html += `
                    <div class="item profile-item" style="cursor: pointer; padding: 10px; background: #f0f9ff;" 
                         data-profile-name="${profile.name}">
                        <i class="file icon"></i>
                        <div class="content">
                            <div class="header">${profile.name}</div>
                            <div class="description">Updated: ${new Date(profile.updated).toLocaleString()}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        if (otherProfiles.length > 0) {
            html += `<h4 class="ui header">Other Profiles</h4><div class="ui relaxed divided list">`;
            otherProfiles.forEach(profile => {
                html += `
                    <div class="item profile-item" style="cursor: pointer; padding: 10px;" 
                         data-profile-name="${profile.name}">
                        <i class="file outline icon"></i>
                        <div class="content">
                            <div class="header">${profile.name}</div>
                            <div class="description">${profile.type} • ${new Date(profile.updated).toLocaleString()}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `
                <div class="ui divider"></div>
                <div class="actions">
                    <button class="ui button" onclick="$('#cpiHelper_semanticui_modal').modal('hide')">Close</button>
                </div>
            </div>
        `;
        
        showBigPopup(createElementFromHTML(html), 'Load Profile');
        
        // Add event listeners after dialog is shown
        setTimeout(() => {
            document.querySelectorAll('.profile-item').forEach(item => {
                item.addEventListener('click', async function() {
                    const profileName = this.getAttribute('data-profile-name');
                    const profile = profiles.find(p => p.name === profileName);
                    
                    if (profile) {
                        // Use window.fillFormFields and await the Promise
                        const filledCount = await window.fillFormFields(profile.data);
                        if (filledCount > 0) {
                            showNotification('Profile loaded', `Loaded ${filledCount} fields from "${profileName}"`, 'success');
                        } else {
                            showNotification('Load failed', 'Could not fill any fields', 'warning');
                        }
                        $('#cpiHelper_semanticui_modal').modal('hide');
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
                        <button class="ui small red button delete-profile-btn" data-profile-name="${profile.name}">Delete</button>
                    </div>
                    <i class="file icon"></i>
                    <div class="content">
                        <div class="header">${profile.name}</div>
                        <div class="description">
                            Type: ${profile.type} • 
                            Created: ${new Date(profile.created).toLocaleDateString()} • 
                            Updated: ${new Date(profile.updated).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                <div class="ui divider"></div>
                <div class="actions">
                    <button class="ui button" onclick="$('#cpiHelper_semanticui_modal').modal('hide')">Close</button>
                </div>
            </div>
        `;
        
        showBigPopup(createElementFromHTML(html), 'Manage Profiles');
        
        // Add event listeners after dialog is shown
        setTimeout(() => {
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