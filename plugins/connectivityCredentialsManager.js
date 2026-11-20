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
            text: "Adds a Connectivity profiles button to the CPI Helper toolbar on the Connectivity Test page (Monitoring → Test Connectivity)",
            type: "label"
        }
    },

    // panel in the floating toolbar, also on the global toolbar of the Monitoring pages, only on Test Connectivity
    messageSidebarContent: {
        globalToolbar: true,
        static: false,
        title: "Connectivity profiles",
        icon: { type: "icon", text: "xe20b" }, // SAP-icons "connected"
        condition: () => isConnectivityPage(),
        onRender: () => renderProfilesPanel()
    }
};

// Helper functions
// CPI Helper's own UI (floating toolbar with this plugin's panel, modals, toasts) is on the same page as the
// form: its inputs must never be saved into a profile or filled
function isCpiHelperElement(element) {
    return !!element.closest('#cpiHelper_floatingToolbar, #cpihelperglobal, .cpiHelper, .cpiHelper_toast_container');
}

function isConnectivityPage() {
    return window.location.href.includes('/shell/monitoring/Connectivity');
}

// The page has more tab lists (e.g. a carousel with an empty selected tab): only look inside the
// Connectivity page and take the first selected tab that has a label
function getCurrentTabType() {
    const page = document.querySelector('[id$="Connectivity--PageConnectivity"]') || document;
    const activeTab = [...page.querySelectorAll('[role="tab"][aria-selected="true"]')].find((tab) => tab.textContent.trim());
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
            if (isCpiHelperElement(input)) return;
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
            if (isCpiHelperElement(input)) return;
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
        if (isCpiHelperElement(el)) return false;
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

// Page world bridge (connectivityCredentialsManager-inject.js): sets a sap.m.Select through the UI5 API
let connectivityBridgeReady = null;

function ensureConnectivityBridge() {
    if (!connectivityBridgeReady) {
        connectivityBridgeReady = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('plugins/connectivityCredentialsManager-inject.js');
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            (document.head || document.documentElement).appendChild(script);
        });
    }
    return connectivityBridgeReady;
}

// Sends one request to the bridge, resolves with its reply or null (no bridge, timeout)
async function callConnectivityBridge(type, payload, timeout = 1500) {
    if (!(await ensureConnectivityBridge())) return null;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
        const onMessage = (event) => {
            if (event.source !== window || event.data?.source !== 'cpih-conn-reply' || event.data.requestId !== requestId) return;
            window.removeEventListener('message', onMessage);
            clearTimeout(timer);
            resolve(event.data);
        };
        const timer = setTimeout(() => {
            window.removeEventListener('message', onMessage);
            resolve(null);
        }, timeout);
        window.addEventListener('message', onMessage);
        window.postMessage({ source: 'cpih-conn', type, requestId, ...payload }, window.location.origin);
    });
}

async function setSelectKeyViaUi5(controlId, key) {
    const reply = await callConnectivityBridge('setSelectKey', { id: controlId, key });
    return reply?.ok === true && reply.key === key;
}

// The hidden input of a sap.m.Select can lag behind a selection made by keyboard: save the key the control
// itself reports. Falls back to what extractFormData read when the bridge does not answer.
async function readSelectKeysViaUi5(formData) {
    for (const field of Object.values(formData.fields)) {
        if (!field.id?.endsWith('-hiddenInput')) continue;
        const reply = await callConnectivityBridge('getSelectKey', { id: field.id.slice(0, -'-hiddenInput'.length) });
        if (reply?.ok && reply.key) field.value = reply.key;
    }
    return formData;
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

    // The saved value is the item key (hidden input). Through the UI5 API this works for every select; the
    // key press approach below only knows Proxy Type and stays as fallback when the bridge does not answer
    if (await setSelectKeyViaUi5(selectWrapper.id, fieldData.value)) {
        await wait(150);
        return true;
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

// Fills the form top to bottom. Dependent fields (Location ID after Proxy Type, Folder after "Check Mailbox
// Content", ...) only appear once the field they depend on is set, and other fields can disappear at the same
// time, so fields are tracked by id and the form is scanned again until a pass finds nothing new.
// onProgress(processed, total) is called before each field.
async function fillProfileFields(profileData, onProgress = null) {
    if (!profileData || !profileData.fields) {
        return 0;
    }

    const totalFields = Object.keys(profileData.fields).length;
    const handled = new Set();
    let filledCount = 0;
    let processed = 0;

    for (let pass = 0; pass < 5; pass++) {
        let progressed = false;
        const queue = sortByPosition(getAllVisibleFormElements());

        for (let i = 0; i < queue.length; i++) {
            const element = queue[i];
            if (handled.has(element.id)) continue;
            const fieldData = findFieldDataForElement(element, profileData);
            if (!fieldData) continue;

            handled.add(element.id);
            progressed = true;
            processed++;
            onProgress?.(processed, totalFields);

            if (await fillSingleField(element, fieldData)) {
                filledCount++;
            }

            // let the page show the fields that depend on this one, they are filled in this pass when they come
            // below the current field, otherwise in the next one
            await wait(150);
            for (const candidate of getAllVisibleFormElements()) {
                if (!queue.includes(candidate)) queue.push(candidate);
            }
            const rest = sortByPosition(queue.slice(i + 1));
            queue.splice(i + 1, rest.length, ...rest);
        }

        if (!progressed) break;
        await wait(300);
    }

    return filledCount;
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
    
    return writeStoredProfiles(profiles);
}

function writeStoredProfiles(profiles) {
    return new Promise(resolve => {
        chrome.storage.local.set({ 'connectivityCredentialsManager---profiles': profiles }, () => {
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
    const profiles = await getStoredProfiles();
    return writeStoredProfiles(profiles.filter(p => p.name !== profileName));
}

// ---------------------------------------------------------------- export / import
// File: { format: 'cpih-connectivity-profiles', version: 1, exported, profiles: [...] } with the stored profiles as they are,
// minus password fields: the file is meant to be passed around. A bare array of profiles is accepted on import too.
const CPIH_CONN_EXPORT_FORMAT = 'cpih-connectivity-profiles';

function isPasswordField(fieldName, fieldData) {
    return fieldData?.type === 'password' || /password|secret/i.test(fieldDisplayName(fieldName, fieldData || {}));
}

function withoutPasswords(profile) {
    const fields = Object.fromEntries(Object.entries(profile.data?.fields || {}).filter(([name, data]) => !isPasswordField(name, data)));
    return { ...profile, data: { ...profile.data, fields } };
}

async function exportProfiles() {
    const profiles = await getStoredProfiles();
    const exported = profiles.map(withoutPasswords);
    const removed = profiles.reduce((sum, p, i) => sum + profileFieldCount(p) - profileFieldCount(exported[i]), 0);
    const file = { format: CPIH_CONN_EXPORT_FORMAT, version: 1, exported: new Date().toISOString(), profiles: exported };

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    link.download = `connectivity-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    showNotification('Profiles exported', `${pluralize(exported.length, 'profile')} exported` +
        (removed ? `, ${pluralize(removed, 'password field')} left out` : ''), 'success');
}

function isValidProfile(profile) {
    return typeof profile?.name === 'string' && profile.name.trim() !== '' &&
        typeof profile.type === 'string' &&
        profile.data && typeof profile.data.fields === 'object' && !Array.isArray(profile.data.fields);
}

function pickJsonFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => resolve(input.files[0] || null));
        input.click();
    });
}

// Profiles with the name of an existing one replace it, after a confirmation. Returns true when something was imported.
async function importProfiles() {
    const file = await pickJsonFile();
    if (!file) return false;

    let incoming;
    try {
        const parsed = JSON.parse(await file.text());
        incoming = Array.isArray(parsed) ? parsed : parsed?.format === CPIH_CONN_EXPORT_FORMAT ? parsed.profiles : null;
    } catch (error) {
        incoming = null;
    }
    if (!Array.isArray(incoming)) {
        showNotification('Import failed', `${file.name} is not a connectivity profiles export`, 'error');
        return false;
    }
    const valid = incoming.filter(isValidProfile);
    if (valid.length === 0) {
        showNotification('Nothing imported', `${file.name} contains no valid profile`, 'warning');
        return false;
    }

    const profiles = await getStoredProfiles();
    const replaced = valid.filter((p) => profiles.some((existing) => existing.name === p.name));
    if (replaced.length) {
        const confirmed = await cpihConfirm({
            title: 'Replace existing profiles?',
            content: `<p>${escapeHtml(pluralize(replaced.length, 'profile'))} of the file already exist here and will be replaced:</p>
                <p>${replaced.map((p) => `"${escapeHtml(p.name)}"`).join(', ')}</p>
                <p>Passwords saved here are kept.</p>`,
            approveText: 'Import and replace',
            denyText: 'Cancel'
        });
        if (!confirmed) return false;
    }

    const now = new Date().toISOString();
    for (const p of valid) {
        const index = profiles.findIndex((existing) => existing.name === p.name);
        // exports carry no passwords: a replaced profile keeps the ones it has here
        const keptPasswords = index >= 0 ? Object.fromEntries(Object.entries(profiles[index].data?.fields || {})
            .filter(([name, data]) => isPasswordField(name, data) && !(name in p.data.fields))) : {};
        const data = { ...p.data, fields: { ...keptPasswords, ...p.data.fields } };
        const profile = { name: p.name, type: p.type, data, created: p.created || now, updated: p.updated || now };
        if (index >= 0) profiles[index] = profile;
        else profiles.push(profile);
    }
    if (!(await writeStoredProfiles(profiles))) {
        showNotification('Import failed', 'Could not save the profiles', 'error');
        return false;
    }
    const skipped = incoming.length - valid.length;
    showNotification('Profiles imported', `${pluralize(valid.length, 'profile')} imported` +
        (skipped ? `, ${skipped} invalid ${skipped === 1 ? 'entry' : 'entries'} skipped` : ''), 'success');
    return true;
}

// ============================================================================
// UI - lives in the CPI Helper floating toolbar: on the Connectivity Test page the toolbar gets a
// "Connectivity profiles" button (messageSidebarContent.globalToolbar + condition), its panel lists the
// profiles of the open tab and saves the form. Details, Manage and Help open as CPI Helper modals.
// Look: Recent panel of the toolbar and the UI kit (ui.css), plugin specifics in css/plugin.css (.cpihConn).
// ============================================================================

const CPIH_CONN_MODAL = '#cpiHelper_semanticui_modal';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatProfileDate(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return '';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function profileFieldCount(profile) {
    return Object.keys(profile?.data?.fields || {}).length;
}

function pluralize(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function showNotification(title, message, type = 'info') {
    if (typeof showToast === 'function') {
        // CPI Helper signature is showToast(message, title, type). The toast renders HTML, profile names are text
        showToast(escapeHtml(message), escapeHtml(title), type);
    } else {
        console.log(`[Connectivity Manager] ${title}: ${message}`);
    }
}

function closeToolbarPanel() {
    if (typeof getFloatingToolbar === 'function' && typeof closeFloatingToolbarMenu === 'function') {
        const toolbar = getFloatingToolbar();
        if (toolbar) closeFloatingToolbarMenu(toolbar);
    }
}

// Busy indicator while a profile is filled in (the fill is sequential and can take a few seconds)
function showBusyIndicator(profileName) {
    hideBusyIndicator();

    const overlay = document.createElement('div');
    overlay.id = 'cpiConnectivityBusyOverlay';
    overlay.className = 'cpihConn-busy';
    overlay.innerHTML = `
        <div class="cpihConn-busy-card" role="status" aria-live="polite">
            <div class="cpihConn-busy-header">Loading profile</div>
            <div class="cpihConn-busy-body">
                <div class="cpihConn-busy-name">${escapeHtml(profileName)}</div>
                <div class="cpihConn-progress"><div id="cpiConnectivityProgress" class="cpihConn-progress-bar"></div></div>
                <div id="cpiConnectivityStatus" class="cpihConn-busy-status">Initializing...</div>
            </div>
        </div>
    `;
    // inside #cpihelperglobal so the CPI Helper theme class (ch_light / ch_dark) applies
    (typeof cpihRoot === 'function' ? cpihRoot() : document.body).appendChild(overlay);
}

function updateBusyIndicator(status, progress) {
    const statusEl = document.getElementById('cpiConnectivityStatus');
    const progressEl = document.getElementById('cpiConnectivityProgress');
    if (statusEl) statusEl.textContent = status;
    if (progressEl && progress !== undefined) progressEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function hideBusyIndicator() {
    document.getElementById('cpiConnectivityBusyOverlay')?.remove();
}

async function loadProfileIntoForm(profile) {
    closeToolbarPanel();
    cpihModal.hide(CPIH_CONN_MODAL);
    showBusyIndicator(profile.name);
    let filledCount = 0;
    try {
        filledCount = await fillProfileFields(profile.data, (current, total) => {
            updateBusyIndicator(`Processing field ${current}/${total}`, Math.round((current / total) * 100));
        });
    } finally {
        hideBusyIndicator();
    }
    if (filledCount > 0) {
        showNotification('Profile loaded', `${pluralize(filledCount, 'field')} filled from "${profile.name}"`, 'success');
    } else {
        showNotification('Nothing filled', 'No field of the form matched the profile', 'warning');
    }
}

// ---------------------------------------------------------------- toolbar panel

// messageSidebarContent.onRender: the panel content, rendered again on every open
async function renderProfilesPanel() {
    if (!isConnectivityPage()) return null;
    const container = document.createElement('div');
    container.className = 'cpihConn-panel';
    await fillProfilesPanel(container);
    return container;
}

async function fillProfilesPanel(container) {
    const profiles = await getStoredProfiles();
    const currentTab = getCurrentTabType();
    const matching = profiles.filter((p) => p.type === currentTab).sort((a, b) => a.name.localeCompare(b.name));
    const otherCount = profiles.length - matching.length;

    const rows = matching.map((p) => `
        <li>
            <div class="cpiHelper_recent_item cpihConn-panelRow" role="button" tabindex="0" data-profile-name="${escapeHtml(p.name)}" title="Fill the form with this profile">
                <span class="cpihConn-panelText">
                    <span class="cpiHelper_recent_name">${escapeHtml(p.name)}</span>
                    <span class="cpiHelper_recent_type">${pluralize(profileFieldCount(p), 'field')} · ${escapeHtml(formatProfileDate(p.updated))}</span>
                </span>
                <span class="cpihConn-panelView" role="button" tabindex="0" title="Show values" aria-label="Show values of ${escapeHtml(p.name)}"><i class="eye icon"></i></span>
            </div>
        </li>
    `).join('');

    container.innerHTML = `
        <div class="cpiHelper_recent_heading">${escapeHtml(currentTab)} tab</div>
        ${matching.length
            ? `<ul class="cpiHelper_recent_list">${rows}</ul>`
            : `<p class="cpihConn-panelEmpty">No profile for ${escapeHtml(currentTab)} yet. Fill in the form and save it below.</p>`}
        ${otherCount ? `<p class="cpihConn-panelOther">${pluralize(otherCount, 'profile')} for other connection types, open their tab to load them.</p>` : ''}
        <div class="cpiHelper_recent_heading">Save the form</div>
        <form class="ui form cpihConn-panelSave">
            <input type="text" name="profileName" placeholder="Profile name, e.g. S/4 QA SFTP" autocomplete="off" maxlength="80" aria-label="Profile name">
            <button type="submit" class="ui primary button">Save</button>
        </form>
        <div class="cpihConn-hint" hidden>Exists already, Save overwrites it.</div>
        <div class="cpihConn-panelLinks">
            <a href="#" data-action="manage">Manage profiles</a>
            <a href="#" data-action="help">Help</a>
        </div>
    `;

    const byName = (name) => profiles.find((p) => p.name === name);
    container.querySelectorAll('.cpihConn-panelRow').forEach((row) => {
        const load = () => {
            const profile = byName(row.dataset.profileName);
            if (profile) loadProfileIntoForm(profile);
        };
        row.addEventListener('click', load);
        row.addEventListener('keydown', (event) => {
            if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                load();
            }
        });
    });
    container.querySelectorAll('.cpihConn-panelView').forEach((view) => {
        const open = (event) => {
            event.stopPropagation();
            event.preventDefault();
            const profile = byName(view.closest('.cpihConn-panelRow').dataset.profileName);
            if (profile) showProfileDetails(profile);
        };
        view.addEventListener('click', open);
        view.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') open(event);
        });
    });

    const form = container.querySelector('.cpihConn-panelSave');
    const input = form.elements.profileName;
    const hint = container.querySelector('.cpihConn-hint');
    input.addEventListener('input', () => {
        hint.hidden = !profiles.some((p) => p.name === input.value.trim());
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const profileName = input.value.trim();
        if (!profileName) {
            input.focus();
            showNotification('Name missing', 'Enter a name for the profile', 'error');
            return;
        }
        const formData = await readSelectKeysViaUi5(extractFormData());
        const fieldCount = Object.keys(formData.fields).length;
        if (fieldCount === 0) {
            showNotification('Nothing to save', 'Fill in some fields of the form first', 'warning');
            return;
        }
        if (await saveProfileToStorage(profileName, formData)) {
            showNotification('Profile saved', `"${profileName}" saved with ${pluralize(fieldCount, 'field')}`, 'success');
            fillProfilesPanel(container);
        } else {
            showNotification('Save failed', 'Could not save the profile', 'error');
        }
    });

    container.querySelectorAll('.cpihConn-panelLinks a').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            closeToolbarPanel();
            if (link.dataset.action === 'manage') showManageDialog();
            else showHelpDialog();
        });
    });
}

// ---------------------------------------------------------------- modals

// Opens the shared CPI Helper modal with our own footer.
// buttons: [{ text, icon?, primary?, onClick(modal) }] - a button without onClick just closes.
async function openConnectivityDialog({ title, body, buttons = [], size = 'small' }) {
    const node = createElementFromHTML(`<div class="cpihConn">${body}</div>`);
    await showBigPopup(node, title, { fullscreen: false, closeText: 'Close' });

    const modal = document.querySelector(CPIH_CONN_MODAL);
    if (!modal) return null;
    modal.classList.add(size);
    modal.querySelector('#cpiHelper_bigPopup_content_semanticui')?.style.removeProperty('min-height');

    const actions = modal.querySelector('.actions');
    if (actions && buttons.length) {
        actions.replaceChildren(...buttons.map((spec) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `ui button${spec.primary ? ' primary' : ''}`;
            button.innerHTML = `${spec.icon ? `<i class="${spec.icon} icon"></i>` : ''}${escapeHtml(spec.text)}`;
            button.addEventListener('click', () => (spec.onClick ? spec.onClick(modal) : cpihModal.hide(modal)));
            return button;
        }));
    }
    return modal;
}

function showHelpDialog() {
    const body = `
        <p class="cpihConn-lead">
            Save the settings of a connectivity test once and fill them in again with one click,
            for example to test the same SFTP server from several tenants.
        </p>
        <div class="ui relaxed list">
            <div class="item">
                <i class="save outline icon"></i>
                <div class="content">
                    <div class="header">Save</div>
                    <div class="description">Fill in the form on a tab (TLS, SSH, FTP, ...), open Connectivity profiles in the CPI Helper toolbar, type a name and click Save.</div>
                </div>
            </div>
            <div class="item">
                <i class="folder open outline icon"></i>
                <div class="content">
                    <div class="header">Load</div>
                    <div class="description">The panel lists the profiles of the open tab. Click one to fill the form, the eye shows its values.</div>
                </div>
            </div>
            <div class="item">
                <i class="settings icon"></i>
                <div class="content">
                    <div class="header">Manage</div>
                    <div class="description">All profiles of all tabs, with their values, and delete. Export saves them to a JSON file (without passwords) to share or keep as a backup, Import reads such a file.</div>
                </div>
            </div>
            <div class="item">
                <i class="shield alternate icon"></i>
                <div class="content">
                    <div class="header">Where profiles are kept</div>
                    <div class="description">Only in this browser's extension storage. Nothing is sent anywhere. Passwords are stored as entered, so do not save production secrets on a shared machine.</div>
                </div>
            </div>
        </div>
        <div class="ui info message">
            <i class="lightbulb outline icon"></i>
            Name profiles after system and environment, like "S/4 QA SFTP", so they are easy to tell apart.
        </div>
    `;
    openConnectivityDialog({ title: 'Connectivity profiles', body, size: 'tiny', buttons: [{ text: 'Got it', primary: true }] });
}

function profileRowHTML(profile, actions) {
    const meta = [
        `<span class="ui label">${escapeHtml(profile.type)}</span>`,
        pluralize(profileFieldCount(profile), 'field'),
        escapeHtml(formatProfileDate(profile.updated))
    ].join('<span class="cpihConn-dot">·</span>');

    return `
        <div class="cpihConn-row" data-profile-name="${escapeHtml(profile.name)}">
            <i class="file outline icon"></i>
            <div class="cpihConn-row-main">
                <div class="cpihConn-row-name">${escapeHtml(profile.name)}</div>
                <div class="cpihConn-row-meta">${meta}</div>
            </div>
            <div class="cpihConn-row-actions">${actions}</div>
        </div>
    `;
}

function fieldDisplayName(fieldName, fieldData) {
    if (!fieldData.id) return fieldName;
    return fieldData.id
        .replace(/^__component[\d-]+---/, '')
        .replace(/^.*--/, '')
        .replace(/-CB$/, '')
        .replace(/-RB$/, '')
        .replace(/-inner$/, '')
        .replace(/-hiddenInput$/, '')
        .replace(/^(inp|chb|rb|cmb|txt|sel)(?=[A-Z])/, '')
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .trim() || fieldName;
}

function fieldDisplayValue(displayName, fieldData) {
    if (fieldData.type === 'checkbox') return fieldData.value === 'on' ? 'Yes' : 'No';
    if (fieldData.type === 'password' || /password|secret/i.test(displayName)) return '••••••••';
    if (fieldData.value === '' || fieldData.value == null) return null;
    const value = String(fieldData.value);
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

// back: dialog to return to, e.g. Manage. Without it only Close.
function showProfileDetails(profile, back = null) {
    const fields = Object.entries(profile.data?.fields || {})
        .map(([name, data]) => ({ name: fieldDisplayName(name, data), data }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const rows = fields.map(({ name, data }) => {
        const value = fieldDisplayValue(name, data);
        return `
            <tr>
                <td>${escapeHtml(name)}</td>
                <td class="cpihConn-value">${value === null ? '<span class="cpihConn-muted">empty</span>' : escapeHtml(value)}</td>
                <td class="cpihConn-muted">${escapeHtml(data.type || '')}</td>
            </tr>
        `;
    }).join('');

    const body = `
        <div class="cpihConn-facts">
            <div><span>Type</span><strong>${escapeHtml(profile.type)}</strong></div>
            <div><span>Fields</span><strong>${fields.length}</strong></div>
            <div><span>Created</span><strong>${escapeHtml(formatProfileDate(profile.created))}</strong></div>
            <div><span>Updated</span><strong>${escapeHtml(formatProfileDate(profile.updated))}</strong></div>
        </div>
        <table class="ui very basic compact table cpihConn-table">
            <thead><tr><th>Field</th><th>Value</th><th>Type</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    const buttons = [];
    if (back) buttons.push({ text: 'Back', icon: 'arrow left', onClick: () => back() });
    if (profile.type === getCurrentTabType()) buttons.push({ text: 'Load into form', onClick: () => loadProfileIntoForm(profile) });
    buttons.push({ text: 'Close', primary: true });

    openConnectivityDialog({ title: profile.name, body, size: 'small', buttons });
}

async function showManageDialog() {
    const profiles = await getStoredProfiles();
    const sorted = [...profiles].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const actions = (p) => `
        <button type="button" class="ui tertiary button cpihConn-view" data-profile-name="${escapeHtml(p.name)}"><i class="eye icon"></i>View</button>
        <button type="button" class="ui tertiary button cpihConn-delete" data-profile-name="${escapeHtml(p.name)}"><i class="trash icon"></i>Delete</button>
    `;
    const body = profiles.length ? `
        <div class="cpihConn-section-title">${pluralize(profiles.length, 'saved profile')}</div>
        <div class="cpihConn-list">${sorted.map((p) => profileRowHTML(p, actions(p))).join('')}</div>
    ` : `<p class="cpihConn-muted">No saved profiles yet. Save one from the Connectivity profiles panel or import an export file.</p>`;

    const buttons = [{ text: 'Import', icon: 'folder open', onClick: async () => { if (await importProfiles()) showManageDialog(); } }];
    if (profiles.length) buttons.push({ text: 'Export', icon: 'download', onClick: () => exportProfiles() });
    buttons.push({ text: 'Close', primary: true });

    const modal = await openConnectivityDialog({ title: 'Manage connectivity profiles', body, size: 'small', buttons });
    if (!modal) return;

    const byName = (name) => profiles.find((p) => p.name === name);
    modal.querySelectorAll('.cpihConn-view').forEach((button) => {
        button.addEventListener('click', () => {
            const profile = byName(button.dataset.profileName);
            if (profile) showProfileDetails(profile, showManageDialog);
        });
    });
    modal.querySelectorAll('.cpihConn-delete').forEach((button) => {
        button.addEventListener('click', async () => {
            const profileName = button.dataset.profileName;
            const confirmed = await cpihConfirm({
                title: 'Delete profile?',
                content: `<p>"${escapeHtml(profileName)}" will be removed from this browser. This cannot be undone.</p>`,
                approveText: 'Delete',
                denyText: 'Cancel'
            });
            if (!confirmed) return;
            if (await deleteProfileFromStorage(profileName)) {
                showNotification('Profile deleted', `"${profileName}" deleted`, 'success');
                showManageDialog();
            } else {
                showNotification('Delete failed', 'Could not delete the profile', 'error');
            }
        });
    });
}

// Register with CPI Helper
pluginList.push(plugin);