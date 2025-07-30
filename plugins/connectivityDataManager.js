console.log('[Connectivity Data Manager] 🔥 PLUGIN FILE IS LOADING 🔥');

var plugin = {
    metadataVersion: "1",
    id: "connectivity-data-manager",
    name: "Connectivity Data Manager",
    version: "1.0.0",
    author: "CLAIMATE Tech team",
    email: "info@claimate.tech",
    description: "Store and manage SSH/SFTP connectivity test data for SAP Integration Suite. Allows saving connection profiles and auto-populating connectivity test forms to eliminate repetitive manual data entry.",
    
    settings: {
        maxProfiles: 50,
        autoSaveEnabled: true,
        encryptionEnabled: false
    },

    // Check if we're on the connectivity test page
    isConnectivityPage: function() {
        const url = window.location.href;
        
        console.log('[Connectivity Data Manager] URL Detection Debug:');
        console.log('- Current URL:', url);
        
        // Match pattern: *.integrationsuite.cfapps.*.hana.ondemand.com/shell/monitoring/Connectivity
        const connectivityPathMatch = url.includes('/shell/monitoring/Connectivity');
        const integrationSuiteMatch = /https:\/\/[^.]+\.integrationsuite\.cfapps\.[^.]+\.hana\.ondemand\.com/.test(url);
        
        console.log('- Connectivity Path Match:', connectivityPathMatch);
        console.log('- Integration Suite Match:', integrationSuiteMatch);
        console.log('- Final Result:', connectivityPathMatch && integrationSuiteMatch);
        
        return connectivityPathMatch && integrationSuiteMatch;
    },

    // Enhanced page detection with detailed logging
    detectPageContext: function() {
        const url = window.location.href;
        const context = {
            isConnectivityPage: this.isConnectivityPage(),
            currentUrl: url,
            tenant: this.extractTenant(url),
            pageType: this.getPageType(url)
        };
        
        console.log('[Connectivity Data Manager] Page context:', context);
        return context;
    },

    // Extract tenant information from URL
    extractTenant: function(url) {
        const match = url.match(/https:\/\/([^.]+)\.integrationsuite\.cfapps\.([^.]+)\.hana\.ondemand\.com/);
        return match ? { name: match[1], region: match[2] } : null;
    },

    // Determine specific page type within connectivity section
    getPageType: function(url) {
        if (url.includes('/shell/monitoring/Connectivity')) {
            return 'connectivity-test';
        }
        return 'unknown';
    },

    // Initialize plugin when page loads
    init: function() {
        const context = this.detectPageContext();
        
        if (context.isConnectivityPage) {
            console.log('[Connectivity Data Manager] Plugin activated on connectivity page');
            console.log('[Connectivity Data Manager] Tenant:', context.tenant);
            
            // Create multiple global references for dialog buttons
            window.connectivityDataManagerPlugin = this;
            window.cpiConnectivityManager = this; // Additional reference
            
            // Create simple global functions for dialog buttons
            window.cpiDebugFormStructure = () => this.formHandler.debugFormStructure();
            window.cpiExtractFormData = () => this.formHandler.extractFormData();
            window.cpiDetectConnectivityType = () => this.formHandler.detectConnectivityType();
            
            this.initializeUI();
            this.setupPageChangeListener();
        } else {
            console.log('[Connectivity Data Manager] Plugin not activated - not on connectivity page');
        }
    },

    // Setup listener for page changes (SPA navigation)
    setupPageChangeListener: function() {
        // Listen for URL changes in single page applications
        let lastUrl = window.location.href;
        
        const checkUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                console.log('[Connectivity Data Manager] Page changed, re-checking context');
                
                // Re-initialize if we're still on connectivity page
                if (this.isConnectivityPage()) {
                    this.initializeUI();
                } else {
                    this.cleanup();
                }
            }
        };

        // Check for URL changes every 1 second
        setInterval(checkUrlChange, 1000);
        
        // Also listen for popstate events (back/forward navigation)
        window.addEventListener('popstate', checkUrlChange);
    },

    // Cleanup when leaving connectivity page
    cleanup: function() {
        console.log('[Connectivity Data Manager] Cleaning up plugin resources');
        // Remove any added UI elements, event listeners, etc.
        // This will be expanded in later phases
    },

    // Initialize UI components
    initializeUI: function() {
        // This will be implemented in the next phase
        console.log('[Connectivity Data Manager] Initializing UI components...');
        
        // Ensure global references are always available
        window.connectivityDataManagerPlugin = this;
        window.cpiConnectivityManager = this;
        
        // Create simple global functions for dialog buttons (ensure they're created here too)
        window.cpiDebugFormStructure = () => {
            console.log('[Connectivity Data Manager] Debug function called');
            return this.formHandler.debugFormStructure();
        };
        window.cpiExtractFormData = () => {
            console.log('[Connectivity Data Manager] Extract function called');
            return this.formHandler.extractFormData();
        };
        window.cpiDetectConnectivityType = () => {
            console.log('[Connectivity Data Manager] Detect type function called');
            return this.formHandler.detectConnectivityType();
        };
        
        // Verify functions are created
        console.log('[Connectivity Data Manager] Global functions created:', {
            cpiDebugFormStructure: typeof window.cpiDebugFormStructure,
            cpiExtractFormData: typeof window.cpiExtractFormData,
            cpiDetectConnectivityType: typeof window.cpiDetectConnectivityType
        });
        
        // Add UI elements after page is fully loaded
        setTimeout(() => {
            this.addProfileManagementUI();
        }, 2000);
    },

    // Add profile management UI to the connectivity page
    addProfileManagementUI: function() {
        console.log('[Connectivity Data Manager] Adding Profile Management UI to connectivity page...');
        
        const isConnectivityPage = this.isConnectivityPage();
        
        if (!isConnectivityPage) {
            console.log('[Connectivity Data Manager] Not on connectivity page, skipping UI injection');
            console.log('[Connectivity Data Manager] TEMPORARY: For testing, will try to add buttons anyway...');
            // Temporarily continue for debugging - remove this later
        }

        // Remove existing buttons first to prevent duplicates
        this.removeExistingButtons();

        // Try multiple approaches to find the best button placement - prioritize toolbar
        setTimeout(() => {
            console.log('[Connectivity Data Manager] Attempting to add buttons...');
            const result1 = this.addButtonsToToolbar();
            console.log('[Connectivity Data Manager] addButtonsToToolbar result:', result1);
            
            if (!result1) {
                const result2 = this.addButtonsToPageHeader();
                console.log('[Connectivity Data Manager] addButtonsToPageHeader result:', result2);
                
                if (!result2) {
                    const result3 = this.addButtonsNearSendButton();
                    console.log('[Connectivity Data Manager] addButtonsNearSendButton result:', result3);
                }
            }
        }, 2000);
    },

    // Primary approach: Add buttons to page header like iflow buttons (Logs, Trace, Messages)
    addButtonsToPageHeader: function() {
        // Look for SAP page header structures - expanded list for connectivity pages
        const headerSelectors = [
            '.sapMPage .sapMPageHeader',
            '.sapMObjectHeader',
            '.sapUiSizeCompact .sapMBar',
            '.sapMPage .sapMBar',
            '[role="banner"]',
            '.sapMShellContent .sapMBar',
            '.sapMPageHeader',
            '.sapMBar.sapMPageHeader',
            '.sapMTitle',
            '.sapMFlexBox .sapMBar',
            '.sapMHeaderContainer',
            '.sapMPage header',
            '[class*="PageHeader"]',
            '[class*="Header"] .sapMBar'
        ];

        for (const selector of headerSelectors) {
            const header = document.querySelector(selector);
            if (header) {
                console.log('[Connectivity Data Manager] Found page header:', selector);
                console.log('[Connectivity Data Manager] Header element:', header);
                console.log('[Connectivity Data Manager] Header parent:', header.parentElement);
                
                // Check if this is a title element that needs different handling
                if (selector === '.sapMTitle') {
                    return this.addButtonsNearTitle(header);
                }
                
                // Create button container with SAP header styling
                const buttonContainer = document.createElement('div');
                buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
                buttonContainer.className = 'sapMBarChild';
                buttonContainer.style.cssText = `
                    display: flex;
                    gap: 6px;
                    margin-left: auto;
                    align-items: center;
                    padding: 0 8px;
                `;

                // Create compact header-style buttons
                const loadBtn = this.createHeaderButton('Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
                const saveBtn = this.createHeaderButton('Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
                const manageBtn = this.createHeaderButton('Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

                buttonContainer.appendChild(loadBtn);
                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(manageBtn);

                // Insert into header
                header.appendChild(buttonContainer);
                
                console.log('[Connectivity Data Manager] Buttons added to page header successfully');
                return true;
            }
        }
        
        console.log('[Connectivity Data Manager] No suitable page header found');
        return false;
    },

    // Special handling for title elements
    addButtonsNearTitle: function(titleElement) {
        console.log('[Connectivity Data Manager] Handling title element specifically');
        
        // Find the parent container (likely a header bar or flex container)
        let container = titleElement.parentElement;
        while (container && !container.classList.contains('sapMBar') && 
               !container.classList.contains('sapMFlexBox') && 
               !container.classList.contains('sapMHeader') &&
               container.tagName !== 'HEADER') {
            container = container.parentElement;
            if (!container || container === document.body) break;
        }
        
        if (container) {
            console.log('[Connectivity Data Manager] Found title container:', container);
            
            // Create button container that will sit alongside the title
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
            buttonContainer.style.cssText = `
                display: inline-flex;
                gap: 6px;
                margin-left: auto;
                align-items: center;
                padding: 0 16px;
            `;

            // Create header-style buttons
            const loadBtn = this.createHeaderButton('Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
            const saveBtn = this.createHeaderButton('Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
            const manageBtn = this.createHeaderButton('Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

            buttonContainer.appendChild(loadBtn);
            buttonContainer.appendChild(saveBtn);
            buttonContainer.appendChild(manageBtn);

            // Insert into the same container as the title
            container.appendChild(buttonContainer);
            
            console.log('[Connectivity Data Manager] Buttons added near title successfully');
            return true;
        } else {
            console.log('[Connectivity Data Manager] Could not find suitable container for title');
            
            // Fallback: insert directly after the title element
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
            buttonContainer.style.cssText = `
                display: inline-flex;
                gap: 6px;
                margin-left: 16px;
                align-items: center;
            `;

            const loadBtn = this.createHeaderButton('Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
            const saveBtn = this.createHeaderButton('Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
            const manageBtn = this.createHeaderButton('Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

            buttonContainer.appendChild(loadBtn);
            buttonContainer.appendChild(saveBtn);
            buttonContainer.appendChild(manageBtn);

            titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
            
            console.log('[Connectivity Data Manager] Buttons added as fallback after title');
            return true;
        }
    },

    // Primary approach: Add buttons to toolbar right area
    addButtonsToToolbar: function() {
        console.log('[Connectivity Data Manager] Trying toolbar approach first...');
        
        // Specifically target the tab header area where the protocol tabs are
        const tabHeaderSelectors = [
            '.sapMIconTabHeader',
            '.sapMIconTabBar .sapMIconTabHeader',
            '[role="tablist"]',
            '.sapMSegmentedButton'
        ];
        
        console.log('[Connectivity Data Manager] Looking for tab headers with selectors:', tabHeaderSelectors);

        for (const selector of tabHeaderSelectors) {
            const tabHeader = document.querySelector(selector);
            if (tabHeader) {
                console.log('[Connectivity Data Manager] Found tab header:', selector);
                
                // Look for existing right area within this tab header
                let rightArea = tabHeader.querySelector('.sapMBarRight, .sapMBarEnd');
                
                if (!rightArea) {
                    // Create a right area positioned at the end of the tab header
                    rightArea = document.createElement('div');
                    rightArea.className = 'sapMBarRight sapMBarContainer';
                    rightArea.style.cssText = `
                        position: absolute;
                        right: 16px;
                        top: 50%;
                        transform: translateY(-50%);
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        z-index: 10;
                    `;
                    
                    // Ensure the tab header has relative positioning
                    if (getComputedStyle(tabHeader).position === 'static') {
                        tabHeader.style.position = 'relative';
                    }
                    
                    tabHeader.appendChild(rightArea);
                    console.log('[Connectivity Data Manager] Created right area in tab header');
                }
                
                // Add buttons to the right area
                const buttonContainer = document.createElement('div');
                buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
                buttonContainer.style.cssText = `
                    display: inline-flex;
                    gap: 6px;
                    align-items: center;
                `;

                const loadBtn = this.createToolbarButton('Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
                const saveBtn = this.createToolbarButton('Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
                const manageBtn = this.createToolbarButton('Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

                buttonContainer.appendChild(loadBtn);
                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(manageBtn);

                rightArea.appendChild(buttonContainer);
                
                console.log('[Connectivity Data Manager] Buttons added to tab header right area');
                return true;
            }
        }
        
        console.log('[Connectivity Data Manager] No suitable tab header found');
        return false;
    },

    // Add buttons to existing right area of toolbar
    addButtonsToRightArea: function(rightArea) {
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
        buttonContainer.style.cssText = `
            display: inline-flex;
            gap: 4px;
            align-items: center;
            margin-left: 8px;
        `;

        const loadBtn = this.createToolbarButton('Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
        const saveBtn = this.createToolbarButton('Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
        const manageBtn = this.createToolbarButton('Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

        buttonContainer.appendChild(loadBtn);
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(manageBtn);

        rightArea.appendChild(buttonContainer);
        console.log('[Connectivity Data Manager] Buttons added to existing right area');
    },

    // Create right area in toolbar if it doesn't exist
    createRightAreaInToolbar: function(toolbar) {
        // Create a proper SAP right area
        const rightArea = document.createElement('div');
        rightArea.className = 'sapMBarRight sapMBarContainer';
        rightArea.style.cssText = `
            display: flex;
            align-items: center;
            margin-left: auto;
            gap: 4px;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
        buttonContainer.style.cssText = `
            display: inline-flex;
            gap: 4px;
            align-items: center;
        `;

        const loadBtn = this.createToolbarButton('Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
        const saveBtn = this.createToolbarButton('Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
        const manageBtn = this.createToolbarButton('Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

        buttonContainer.appendChild(loadBtn);
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(manageBtn);

        rightArea.appendChild(buttonContainer);
        toolbar.appendChild(rightArea);
        
        console.log('[Connectivity Data Manager] Created new right area in toolbar');
    },

    // Fallback approach: Add buttons near the Send button
    addButtonsNearSendButton: function() {
        // Find the Send button specifically
        const sendButton = document.querySelector('button[type="submit"]') || 
                          Array.from(document.querySelectorAll('button')).find(btn => 
                              btn.textContent.trim().toLowerCase() === 'send'
                          );
        
        if (sendButton) {
            console.log('[Connectivity Data Manager] Found Send button, adding our buttons as fallback');
            
            // Create our button container
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
            buttonContainer.style.cssText = `
                display: inline-flex;
                gap: 8px;
                margin-left: 16px;
                align-items: center;
            `;

            // Create buttons with proper SAP styling to match Send button
            const loadBtn = this.createSAPButton('📂 Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
            const saveBtn = this.createSAPButton('💾 Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
            const manageBtn = this.createSAPButton('⚙️ Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

            buttonContainer.appendChild(loadBtn);
            buttonContainer.appendChild(saveBtn);
            buttonContainer.appendChild(manageBtn);

            // Insert right after the Send button
            sendButton.parentNode.insertBefore(buttonContainer, sendButton.nextSibling);
            
            console.log('[Connectivity Data Manager] Buttons added successfully near Send button');
            return true;
        } else {
            console.log('[Connectivity Data Manager] Send button not found, trying form container approach');
            this.addButtonsToFormContainer();
            return true;
        }
    },

    // Fallback: add to form container
    addButtonsToFormContainer: function() {
        const formContainer = document.querySelector('form') || 
                            document.querySelector('[role="form"]') ||
                            document.querySelector('.sapMPanel') ||
                            document.querySelector('.sapMPage');
        
        if (formContainer) {
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
            buttonContainer.style.cssText = `
                margin: 16px 0;
                padding: 12px;
                border: 1px solid #d9d9d9;
                border-radius: 6px;
                background: #f8f9fa;
                display: flex;
                gap: 8px;
                align-items: center;
            `;

            const title = document.createElement('span');
            title.textContent = 'Connectivity Profiles:';
            title.style.cssText = 'font-weight: 600; margin-right: 8px; color: #0854a0;';
            buttonContainer.appendChild(title);

            const loadBtn = this.createSAPButton('📂 Load', 'Load saved connectivity profile', () => this.showLoadProfileDialog());
            const saveBtn = this.createSAPButton('💾 Save', 'Save current connectivity data as profile', () => this.showSaveProfileDialog());
            const manageBtn = this.createSAPButton('⚙️ Manage', 'Manage saved connectivity profiles', () => this.showManageProfilesDialog());

            buttonContainer.appendChild(loadBtn);
            buttonContainer.appendChild(saveBtn);
            buttonContainer.appendChild(manageBtn);

            formContainer.appendChild(buttonContainer);
            console.log('[Connectivity Data Manager] Buttons added to form container');
        } else {
            console.log('[Connectivity Data Manager] No suitable container found for buttons');
        }
    },

    // Remove existing plugin buttons to prevent duplicates
    removeExistingButtons: function() {
        const existingButtons = document.querySelectorAll('[id^="cpiHelper_connectivity_"]');
        existingButtons.forEach(button => button.remove());
    },


    // Create SAP Fiori styled button to match Send button
    createSAPButton: function(text, title, onClick) {
        const button = document.createElement('button');
        button.className = 'sapMBtn sapMBtnDefault sapMBtnText cpiHelper_connectivity_button';
        button.style.cssText = `
            background: #fff;
            color: #0854a0;
            border: 1px solid #0854a0;
            padding: 0.5rem 1rem;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.875rem;
            font-family: '72', Arial, sans-serif;
            font-weight: 400;
            line-height: 1.125rem;
            min-height: 2.25rem;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            transition: all 0.1s ease-in-out;
            box-sizing: border-box;
            vertical-align: middle;
        `;
        
        button.textContent = text;
        button.title = title;
        button.onclick = onClick;
        
        // SAP Fiori hover effects to match native buttons
        button.onmouseover = () => {
            button.style.background = '#0854a0';
            button.style.color = '#fff';
        };
        button.onmouseout = () => {
            button.style.background = '#fff';
            button.style.color = '#0854a0';
        };
        button.onmousedown = () => {
            button.style.background = '#073d75';
        };
        button.onmouseup = () => {
            button.style.background = '#0854a0';
        };
        
        return button;
    },

    // Create header-style button like those on iflow pages (Edit, Configure, Deploy, Delete)
    createHeaderButton: function(text, title, onClick) {
        const button = document.createElement('button');
        button.className = 'sapMBtn sapMBtnTransparent sapMBtnText cpiHelper_connectivity_button';
        button.style.cssText = `
            background: transparent;
            color: #0854a0;
            border: 1px solid transparent;
            padding: 0.25rem 0.75rem;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.875rem;
            font-family: '72', Arial, sans-serif;
            font-weight: 400;
            line-height: 1rem;
            min-height: 2rem;
            display: inline-flex;
            align-items: center;
            transition: all 0.1s ease-in-out;
            box-sizing: border-box;
            vertical-align: middle;
        `;
        
        button.textContent = text;
        button.title = title;
        button.onclick = onClick;
        
        // Header button hover effects
        button.onmouseover = () => {
            button.style.background = 'rgba(8, 84, 160, 0.1)';
            button.style.borderColor = '#0854a0';
        };
        button.onmouseout = () => {
            button.style.background = 'transparent';
            button.style.borderColor = 'transparent';
        };
        button.onmousedown = () => {
            button.style.background = 'rgba(8, 84, 160, 0.2)';
        };
        button.onmouseup = () => {
            button.style.background = 'rgba(8, 84, 160, 0.1)';
        };
        
        return button;
    },

    // Create toolbar-style button like tab buttons (Logs, Trace, Messages, Info, Plugins)
    createToolbarButton: function(text, title, onClick) {
        const button = document.createElement('button');
        button.className = 'sapMBtn sapMBtnTransparent sapMBtnText cpiHelper_connectivity_button';
        button.style.cssText = `
            background: transparent;
            color: #354a5f;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0;
            cursor: pointer;
            font-size: 0.875rem;
            font-family: '72', Arial, sans-serif;
            font-weight: 400;
            line-height: 1rem;
            min-height: 2.5rem;
            display: inline-flex;
            align-items: center;
            transition: all 0.1s ease-in-out;
            box-sizing: border-box;
            vertical-align: middle;
            border-bottom: 2px solid transparent;
        `;
        
        button.textContent = text;
        button.title = title;
        button.onclick = onClick;
        
        // Toolbar button hover effects like tab buttons
        button.onmouseover = () => {
            button.style.background = 'rgba(8, 84, 160, 0.05)';
            button.style.borderBottomColor = '#0854a0';
            button.style.color = '#0854a0';
        };
        button.onmouseout = () => {
            button.style.background = 'transparent';
            button.style.borderBottomColor = 'transparent';
            button.style.color = '#354a5f';
        };
        button.onmousedown = () => {
            button.style.background = 'rgba(8, 84, 160, 0.1)';
        };
        button.onmouseup = () => {
            button.style.background = 'rgba(8, 84, 160, 0.05)';
        };
        
        return button;
    },

    // Legacy method for backward compatibility
    createConnectivityButton: function(text, title, onClick) {
        return this.createSAPButton(text, title, '🔗', onClick);
    },

    // Dialog functions - Phase 4 Implementation
    showLoadProfileDialog: async function() {
        try {
            const connectivityType = this.formHandler.detectConnectivityType();
            const allProfiles = await this.storage.getProfiles();
            const typeProfiles = allProfiles.filter(p => p.connectivityType === connectivityType);
            
            if (typeProfiles.length === 0) {
                const html = `
                    <div style="padding: 20px;">
                        <h3>📂 Load Connectivity Profile</h3>
                        <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #ffc107;">
                            <h4>No ${connectivityType.toUpperCase()} profiles found</h4>
                            <p>You haven't saved any ${connectivityType.toUpperCase()} connectivity profiles yet.</p>
                            <p>Fill out the form and click <strong>Save</strong> to create your first profile.</p>
                        </div>
                        <button id="closeBtn" class="ui button" style="padding: 8px 16px; margin: 5px;">
                            Close
                        </button>
                    </div>
                `;
                await showBigPopup(html, 'Load Profile');
                return;
            }

            let profileOptions = '';
            typeProfiles.forEach((profile, index) => {
                const savedDate = new Date(profile.savedAt).toLocaleDateString();
                const host = profile.fields.host || 'Unknown Host';
                profileOptions += `
                    <div data-profile-action="load" data-profile-id="${profile.id}" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin: 5px 0; cursor: pointer; background: #f9f9f9;" 
                         onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='#f9f9f9'">
                        <strong>${profile.name}</strong><br>
                        <small>Host: ${host} | Saved: ${savedDate}</small>
                    </div>
                `;
            });

            const html = `
                <div style="padding: 20px;">
                    <h3>📂 Load ${connectivityType.toUpperCase()} Profile</h3>
                    <p>Select a profile to load into the current form:</p>
                    <div style="max-height: 300px; overflow-y: auto; margin: 10px 0;">
                        ${profileOptions}
                    </div>
                    <hr style="margin: 15px 0;">
                    <button data-action="cancel-load" style="padding: 8px 16px; margin: 5px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            `;
            
            await showBigPopup(html, 'Load Profile');
            
            // Add event listeners after popup is created
            setTimeout(() => {
                // Handle profile item clicks
                document.querySelectorAll('[data-profile-action="load"]').forEach(element => {
                    element.addEventListener('click', async () => {
                        const profileId = element.getAttribute('data-profile-id');
                        try {
                            const profiles = await this.storage.getProfiles();
                            const profile = profiles.find(p => p.id === profileId);
                            
                            if (profile) {
                                const success = this.formHandler.populateForm(profile);
                                if (success) {
                                    showToast('Profile "' + profile.name + '" loaded successfully!');
                                    $("#cpiHelper_semanticui_modal").modal("hide");
                                } else {
                                    showToast('Failed to load profile. Please try again.', 'error');
                                }
                            }
                        } catch (error) {
                            console.error('Error loading profile:', error);
                            showToast('Error loading profile: ' + error.message, 'error');
                        }
                    });
                });
                
                // Handle cancel button
                document.querySelector('[data-action="cancel-load"]')?.addEventListener('click', () => {
                    $("#cpiHelper_semanticui_modal").modal("hide");
                });
            }, 100);
        } catch (error) {
            console.error('[Connectivity Data Manager] Error in showLoadProfileDialog:', error);
            await showBigPopup(`<div style="padding: 20px;"><h3>Error</h3><p>Failed to load profiles: ${error.message}</p></div>`, 'Error');
        }
    },

    showSaveProfileDialog: async function() {
        try {
            const formData = this.formHandler.extractFormData();
            const connectivityType = formData.connectivityType;
            const host = formData.fields.host || '';
            const suggestedName = host ? `${connectivityType.toUpperCase()} - ${host}` : `${connectivityType.toUpperCase()} Profile`;

            const html = `
                <div style="padding: 20px;">
                    <h3>💾 Save ${connectivityType.toUpperCase()} Profile</h3>
                    <div style="margin: 15px 0;">
                        <label for="profileName" style="display: block; margin-bottom: 5px; font-weight: bold;">Profile Name:</label>
                        <input type="text" id="profileName" value="${suggestedName}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" 
                               placeholder="Enter profile name">
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 12px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #28a745;">
                        <h4>📋 Profile Summary:</h4>
                        <p><strong>Type:</strong> ${connectivityType.toUpperCase()}</p>
                        <p><strong>Host:</strong> ${formData.fields.host || 'Not specified'}</p>
                        <p><strong>Port:</strong> ${formData.fields.port || 'Not specified'}</p>
                        <p><strong>Fields captured:</strong> ${Object.keys(formData.fields).length}</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; max-height: 200px; overflow-y: auto;">
                        <h5>📊 Form Data Preview:</h5>
                        <pre style="font-size: 11px; margin: 0;">${JSON.stringify(formData.fields, null, 2)}</pre>
                    </div>
                    
                    <hr style="margin: 15px 0;">
                    <button data-action="save-profile" style="padding: 10px 20px; margin: 5px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        💾 Save Profile
                    </button>
                    <button data-action="cancel-save" style="padding: 10px 20px; margin: 5px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            `;
            
            await showBigPopup(html, 'Save Profile');
            
            // Add event listeners after popup is created
            setTimeout(() => {
                // Handle save button
                document.querySelector('[data-action="save-profile"]')?.addEventListener('click', async () => {
                    const profileName = document.getElementById('profileName').value.trim();
                    if (!profileName) {
                        showToast('Please enter a profile name.', 'error');
                        return;
                    }
                    
                    try {
                        const formData = this.formHandler.extractFormData();
                        const savedProfile = await this.storage.saveProfile(formData, profileName);
                        
                        showToast('Profile "' + savedProfile.name + '" saved successfully!\\n\\nYou can now load it using the Load button.');
                        $("#cpiHelper_semanticui_modal").modal("hide");
                    } catch (error) {
                        console.error('Error saving profile:', error);
                        showToast('Error saving profile: ' + error.message, 'error');
                    }
                });
                
                // Handle cancel button
                document.querySelector('[data-action="cancel-save"]')?.addEventListener('click', () => {
                    $("#cpiHelper_semanticui_modal").modal("hide");
                });
            }, 100);
        } catch (error) {
            console.error('[Connectivity Data Manager] Error in showSaveProfileDialog:', error);
            await showBigPopup(`<div style="padding: 20px;"><h3>Error</h3><p>Failed to prepare save dialog: ${error.message}</p></div>`, 'Error');
        }
    },

    showManageProfilesDialog: async function() {
        try {
            const allProfiles = await this.storage.getProfiles();
            const storageStats = await this.storage.getStorageStats();
            
            if (allProfiles.length === 0) {
                const html = `
                    <div style="padding: 20px;">
                        <h3>⚙️ Manage Connectivity Profiles</h3>
                        <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #ffc107;">
                            <h4>No profiles found</h4>
                            <p>You haven't saved any connectivity profiles yet.</p>
                            <p>Fill out a form and click <strong>Save</strong> to create your first profile.</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0;">
                            <p><strong>Storage:</strong> ${storageStats.bytesUsedFormatted}</p>
                        </div>
                        <button data-action="close-empty" style="padding: 8px 16px; margin: 5px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Close
                        </button>
                    </div>
                `;
                await showBigPopup(html, 'Manage Profiles');
                
                // Add event listener for empty state close button
                setTimeout(() => {
                    document.querySelector('[data-action="close-empty"]')?.addEventListener('click', () => {
                        $("#cpiHelper_semanticui_modal").modal("hide");
                    });
                }, 100);
                
                return;
            }

            // Group profiles by connectivity type
            const profilesByType = {};
            allProfiles.forEach(profile => {
                const type = profile.connectivityType || 'unknown';
                if (!profilesByType[type]) profilesByType[type] = [];
                profilesByType[type].push(profile);
            });

            let profilesHtml = '';
            Object.keys(profilesByType).sort().forEach(type => {
                profilesHtml += `<h4 style="color: #0854a0; margin: 15px 0 10px 0;">${type.toUpperCase()} Profiles (${profilesByType[type].length})</h4>`;
                
                profilesByType[type].forEach(profile => {
                    const savedDate = new Date(profile.savedAt).toLocaleDateString();
                    const host = profile.fields.host || 'Unknown Host';
                    const fieldCount = Object.keys(profile.fields).length;
                    
                    profilesHtml += `
                        <div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin: 5px 0; background: #f9f9f9;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${profile.name}</strong><br>
                                    <small>Host: ${host} | Fields: ${fieldCount} | Saved: ${savedDate}</small>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button data-action="load-profile" data-profile-id="${profile.id}" 
                                            style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
                                        Load
                                    </button>
                                    <button data-action="delete-profile" data-profile-id="${profile.id}" data-profile-name="${profile.name}" 
                                            style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            });

            const html = `
                <div style="padding: 20px;">
                    <h3>⚙️ Manage Connectivity Profiles</h3>
                    <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; margin: 10px 0;">
                        <p><strong>Total Profiles:</strong> ${allProfiles.length} | <strong>Storage:</strong> ${storageStats.bytesUsedFormatted}</p>
                    </div>
                    
                    <div style="max-height: 400px; overflow-y: auto; margin: 10px 0;">
                        ${profilesHtml}
                    </div>
                    
                    <hr style="margin: 15px 0;">
                    <button data-action="clear-all" style="padding: 8px 16px; margin: 5px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🗑️ Clear All Profiles
                    </button>
                    <button data-action="close-manage" style="padding: 8px 16px; margin: 5px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            `;
            
            await showBigPopup(html, 'Manage Profiles');
            
            // Add event listeners after popup is created
            setTimeout(() => {
                // Handle load profile buttons
                document.querySelectorAll('[data-action="load-profile"]').forEach(button => {
                    button.addEventListener('click', async () => {
                        const profileId = button.getAttribute('data-profile-id');
                        try {
                            const profiles = await this.storage.getProfiles();
                            const profile = profiles.find(p => p.id === profileId);
                            if (profile) {
                                const success = this.formHandler.populateForm(profile);
                                if (success) {
                                    showToast('Profile "' + profile.name + '" loaded successfully!');
                                    $("#cpiHelper_semanticui_modal").modal("hide");
                                } else {
                                    showToast('Failed to load profile. Make sure you are on the correct connectivity tab (' + profile.connectivityType.toUpperCase() + ').', 'error');
                                }
                            }
                        } catch (error) {
                            console.error('Error loading profile:', error);
                            showToast('Error loading profile: ' + error.message, 'error');
                        }
                    });
                });
                
                // Handle delete profile buttons
                document.querySelectorAll('[data-action="delete-profile"]').forEach(button => {
                    button.addEventListener('click', async () => {
                        const profileId = button.getAttribute('data-profile-id');
                        const profileName = button.getAttribute('data-profile-name');
                        
                        if (confirm('Are you sure you want to delete profile "' + profileName + '"?\\n\\nThis action cannot be undone.')) {
                            try {
                                await this.storage.deleteProfile(profileId);
                                showToast('Profile "' + profileName + '" deleted successfully!');
                                $("#cpiHelper_semanticui_modal").modal("hide");
                                // Reopen the dialog to refresh the list
                                await this.showManageProfilesDialog();
                            } catch (error) {
                                console.error('Error deleting profile:', error);
                                showToast('Error deleting profile: ' + error.message, 'error');
                            }
                        }
                    });
                });
                
                // Handle clear all button
                document.querySelector('[data-action="clear-all"]')?.addEventListener('click', async () => {
                    if (confirm('Are you sure you want to delete ALL connectivity profiles?\\n\\nThis will permanently delete all saved profiles and cannot be undone.')) {
                        try {
                            const profiles = await this.storage.getProfiles();
                            for (const profile of profiles) {
                                await this.storage.deleteProfile(profile.id);
                            }
                            showToast('All profiles deleted successfully!');
                            $("#cpiHelper_semanticui_modal").modal("hide");
                        } catch (error) {
                            console.error('Error clearing profiles:', error);
                            showToast('Error clearing profiles: ' + error.message, 'error');
                        }
                    }
                });
                
                // Handle close button
                document.querySelector('[data-action="close-manage"]')?.addEventListener('click', () => {
                    $("#cpiHelper_semanticui_modal").modal("hide");
                });
            }, 100);
        } catch (error) {
            console.error('[Connectivity Data Manager] Error in showManageProfilesDialog:', error);
            await showBigPopup(`<div style="padding: 20px;"><h3>Error</h3><p>Failed to load profiles: ${error.message}</p></div>`, 'Error');
        }
    },

    // Storage functions - Phase 3 Implementation
    storage: {
        STORAGE_KEY: 'connectivityDataManager_profiles',

        // Get all saved profiles
        getProfiles: async function() {
            try {
                return new Promise((resolve) => {
                    chrome.storage.local.get([this.STORAGE_KEY], (result) => {
                        const profiles = result[this.STORAGE_KEY] || [];
                        console.log('[Connectivity Data Manager] Retrieved profiles:', profiles);
                        resolve(profiles);
                    });
                });
            } catch (error) {
                console.error('[Connectivity Data Manager] Error getting profiles:', error);
                return [];
            }
        },

        // Save a new profile
        saveProfile: async function(profileData, profileName) {
            try {
                const profiles = await this.getProfiles();
                
                const newProfile = {
                    id: Date.now().toString(),
                    name: profileName || `Profile ${profiles.length + 1}`,
                    ...profileData,
                    savedAt: new Date().toISOString()
                };

                // Check for duplicate names
                let finalName = newProfile.name;
                let counter = 1;
                while (profiles.some(p => p.name === finalName)) {
                    finalName = `${newProfile.name} (${counter})`;
                    counter++;
                }
                newProfile.name = finalName;

                profiles.push(newProfile);

                return new Promise((resolve, reject) => {
                    chrome.storage.local.set({[this.STORAGE_KEY]: profiles}, () => {
                        if (chrome.runtime.lastError) {
                            console.error('[Connectivity Data Manager] Error saving profile:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log('[Connectivity Data Manager] Profile saved successfully:', newProfile);
                            resolve(newProfile);
                        }
                    });
                });
            } catch (error) {
                console.error('[Connectivity Data Manager] Error saving profile:', error);
                throw error;
            }
        },

        // Update an existing profile
        updateProfile: async function(profileId, profileData) {
            try {
                const profiles = await this.getProfiles();
                const profileIndex = profiles.findIndex(p => p.id === profileId);
                
                if (profileIndex === -1) {
                    throw new Error('Profile not found');
                }

                profiles[profileIndex] = {
                    ...profiles[profileIndex],
                    ...profileData,
                    updatedAt: new Date().toISOString()
                };

                return new Promise((resolve, reject) => {
                    chrome.storage.local.set({[this.STORAGE_KEY]: profiles}, () => {
                        if (chrome.runtime.lastError) {
                            console.error('[Connectivity Data Manager] Error updating profile:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log('[Connectivity Data Manager] Profile updated successfully:', profiles[profileIndex]);
                            resolve(profiles[profileIndex]);
                        }
                    });
                });
            } catch (error) {
                console.error('[Connectivity Data Manager] Error updating profile:', error);
                throw error;
            }
        },

        // Delete a profile
        deleteProfile: async function(profileId) {
            try {
                const profiles = await this.getProfiles();
                const filteredProfiles = profiles.filter(p => p.id !== profileId);

                return new Promise((resolve, reject) => {
                    chrome.storage.local.set({[this.STORAGE_KEY]: filteredProfiles}, () => {
                        if (chrome.runtime.lastError) {
                            console.error('[Connectivity Data Manager] Error deleting profile:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log('[Connectivity Data Manager] Profile deleted successfully:', profileId);
                            resolve(true);
                        }
                    });
                });
            } catch (error) {
                console.error('[Connectivity Data Manager] Error deleting profile:', error);
                throw error;
            }
        },

        // Search profiles by connectivity type
        getProfilesByType: async function(connectivityType) {
            try {
                const profiles = await this.getProfiles();
                return profiles.filter(p => p.connectivityType === connectivityType);
            } catch (error) {
                console.error('[Connectivity Data Manager] Error filtering profiles by type:', error);
                return [];
            }
        },

        // Get storage usage stats
        getStorageStats: async function() {
            try {
                return new Promise((resolve) => {
                    chrome.storage.local.getBytesInUse(this.STORAGE_KEY, (bytesInUse) => {
                        const stats = {
                            bytesUsed: bytesInUse,
                            bytesUsedFormatted: (bytesInUse / 1024).toFixed(2) + ' KB'
                        };
                        console.log('[Connectivity Data Manager] Storage stats:', stats);
                        resolve(stats);
                    });
                });
            } catch (error) {
                console.error('[Connectivity Data Manager] Error getting storage stats:', error);
                return { bytesUsed: 0, bytesUsedFormatted: '0 KB' };
            }
        }
    },

    // Form interaction functions - Phase 2 Implementation
    formHandler: {
        // Map of form field selectors for different connectivity types - Updated based on actual form structure
        fieldMappings: {
            common: {
                host: 'input[id*="HostName-inner"], input[placeholder*="example.org"]',
                port: 'input[id*="Port-inner"], input[type="number"]',
                proxyType: 'input[id*="ProxyType-hiddenInput"]',
                locationId: 'input[id*="LocationId-inner"]',
                timeout: 'input[id*="Timeout-inner"]',
                credentialName: 'input[id*="CredentialName-inner"]',
                directory: 'input[id*="Directory-inner"]'
            },
            ssh: {
                useOutdatedProtocols: 'input[id*="UseOutdatedProtocols-CB"]',
                authMethodAnonymous: 'input[id*="AuthMethodAnonymous-RB"]',
                authMethodPublicKey: 'input[id*="AuthMethodPublicKey-RB"]', 
                authMethodUserCredentials: 'input[id*="AuthMethodUserCredentials-RB"]',
                authMethodDual: 'input[id*="AuthMethodDual-RB"]',
                hostKeyValidationKnownHosts: 'input[id*="HostKeyValidationKH-RB"]',
                hostKeyValidationPublicKeyData: 'input[id*="HostKeyValidationPD-RB"]',
                hostKeyValidationNone: 'input[id*="HostKeyValidationNO-RB"]',
                checkDirectoryAccess: 'input[id*="CheckDirectoryAccess-CB"]'
            },
            tls: {
                certificateAuth: 'input[id*="CertificateAuth-CB"]',
                checkServerCert: 'input[id*="CheckSrvCert-CB"]'
            },
            ftp: {
                port: 'input[id*="cmbFTPPort-inner"]',
                encryption: 'input[id*="cmbFTPEncryption-hiddenInput"]',
                authMethodNone: 'input[id*="rbFTPAuthMethodNone-RB"]',
                authMethodUserCredentials: 'input[id*="rbFTPAuthMethodUserCredentials-RB"]',
                checkServerCert: 'input[id*="chbFTPCheckSrvCert-CB"]'
            },
            smtp: {
                port: 'input[id*="cmbSMTPPort-inner"]',
                encryption: 'input[id*="selSMTPEncryption-hiddenInput"]',
                authMethodAnonymous: 'input[id*="rbSMTPAuthMethodAnonymous-RB"]',
                authMethodEncrypted: 'input[id*="rbSMTPAuthMethodEncrypted-RB"]',
                authMethodUserCredentials: 'input[id*="rbSMTPAuthMethodUserCredentials-RB"]',
                authMethodOAuth2: 'input[id*="rbSMTPAuthMethodOAuth2AuthorizationCode-RB"]',
                checkServerCert: 'input[id*="chbSMTPCheckSrvCert-CB"]',
                checkEmail: 'input[id*="chbSMTPCheckEmail-CB"]'
            },
            imap: {
                port: 'input[id*="cmbIMAPPort-inner"]',
                encryption: 'input[id*="selIMAPEncryption-hiddenInput"]',
                authMethodEncrypted: 'input[id*="rbIMAPAuthMethodEncrypted-RB"]',
                authMethodUserCredentials: 'input[id*="rbIMAPAuthMethodUserCredentials-RB"]',
                authMethodOAuth2: 'input[id*="rbIMAPAuthMethodOAuth2AuthorizationCode-RB"]',
                checkServerCert: 'input[id*="chbIMAPCheckSrvCert-CB"]',
                listFolders: 'input[id*="chbIMAPListFolders-CB"]',
                listMailboxContent: 'input[id*="chbIMAPListMailboxContent-CB"]'
            },
            pop3: {
                port: 'input[id*="cmbPOP3Port-inner"]',
                encryption: 'input[id*="selPOP3Encryption-hiddenInput"]',
                authMethodEncrypted: 'input[id*="rbPOP3AuthMethodEncrypted-RB"]',
                authMethodUserCredentials: 'input[id*="rbPOP3AuthMethodUserCredentials-RB"]',
                checkServerCert: 'input[id*="chbPOP3CheckSrvCert-CB"]',
                listMailboxContent: 'input[id*="chbPOP3ListMailboxContent-CB"]'
            },
            amqp: {
                transportProtocol: 'input[id*="selAMQPTransportProtocol-hiddenInput"]',
                connectWithTLS: 'input[id*="chbAMQPConnectWithTLS-CB"]',
                checkServerCert: 'input[id*="chbAMQPCheckSrvCert-CB"]'
            },
            kafka: {
                authMethodSASL: 'input[id*="rbKafkaAuthMethodSASL-RB"]',
                authMethodClientCertificate: 'input[id*="rbFTPAuthMethodClientCertificate-RB"]',
                connectWithTLS: 'input[id*="chbKafkaConnectWithTLS-CB"]',
                saslMechanismPlain: 'input[id*="rbKafkaSASLMechanismPlain-RB"]',
                saslMechanismScramSha256: 'input[id*="rbKafkaSASLMechanismScramSha256-RB"]',
                saslMechanismScramSha512: 'input[id*="rbKafkaSASLMechanismScramSha512-RB"]'
            },
            cloudconnector: {
                // Only has locationId from common fields
            }
        },

        // Detect current connectivity type from active tab
        detectConnectivityType: function() {
            // Check which tab is active
            const activeTab = document.querySelector('.sapMITBSelected .sapMITBText, .sapMSegmentedButtonItem--selected');
            if (activeTab) {
                const tabText = activeTab.textContent.trim().toLowerCase();
                console.log('[Connectivity Data Manager] Active tab detected:', tabText);
                
                // Map tab text to internal connectivity type names
                const typeMap = {
                    'tls': 'tls',
                    'ssh': 'ssh', 
                    'ftp': 'ftp',
                    'smtp': 'smtp',
                    'imap': 'imap',
                    'pop3': 'pop3',
                    'amqp': 'amqp',
                    'kafka': 'kafka',
                    'cloud connector': 'cloudconnector'
                };
                
                return typeMap[tabText] || tabText;
            }
            
            // Fallback: check URL or other indicators
            const url = window.location.href;
            if (url.includes('ssh')) return 'ssh';
            if (url.includes('tls')) return 'tls';
            if (url.includes('smtp')) return 'smtp';
            if (url.includes('ftp')) return 'ftp';
            if (url.includes('imap')) return 'imap';
            if (url.includes('pop3')) return 'pop3';
            if (url.includes('amqp')) return 'amqp';
            if (url.includes('kafka')) return 'kafka';
            
            console.log('[Connectivity Data Manager] Could not detect connectivity type, defaulting to ssh');
            return 'ssh';
        },

        // Find form elements based on current connectivity type
        findFormElements: function() {
            const connectivityType = this.detectConnectivityType();
            const commonMappings = this.fieldMappings.common;
            const typeMappings = this.fieldMappings[connectivityType] || {};
            
            const elements = {};
            
            // Find common elements
            for (const [fieldName, selector] of Object.entries(commonMappings)) {
                const element = document.querySelector(selector);
                if (element) {
                    elements[fieldName] = element;
                    console.log(`[Connectivity Data Manager] Found ${fieldName}:`, element);
                } else {
                    console.log(`[Connectivity Data Manager] Could not find ${fieldName} with selector: ${selector}`);
                }
            }
            
            // Find type-specific elements
            for (const [fieldName, selector] of Object.entries(typeMappings)) {
                const element = document.querySelector(selector);
                if (element) {
                    elements[fieldName] = element;
                    console.log(`[Connectivity Data Manager] Found ${connectivityType} ${fieldName}:`, element);
                }
            }
            
            return elements;
        },

        // Extract data from connectivity form
        extractFormData: function() {
            console.log('[Connectivity Data Manager] Extracting form data...');
            
            const elements = this.findFormElements();
            const connectivityType = this.detectConnectivityType();
            const formData = {
                connectivityType: connectivityType,
                timestamp: new Date().toISOString(),
                fields: {}
            };
            
            // Extract values from found elements
            for (const [fieldName, element] of Object.entries(elements)) {
                try {
                    let value = null;
                    
                    if (element.type === 'checkbox') {
                        value = element.checked;
                    } else if (element.type === 'radio') {
                        value = element.checked;
                    } else if (element.tagName === 'SELECT') {
                        value = element.value;
                    } else {
                        value = element.value;
                    }
                    
                    formData.fields[fieldName] = value;
                    console.log(`[Connectivity Data Manager] Extracted ${fieldName}:`, value);
                } catch (error) {
                    console.log(`[Connectivity Data Manager] Error extracting ${fieldName}:`, error);
                }
            }
            
            // Also extract radio button group values
            const radioGroups = ['__group0', '__group1']; // Authentication and Host Key Validation groups
            radioGroups.forEach(groupName => {
                const checkedRadio = document.querySelector(`input[name="${groupName}"]:checked`);
                if (checkedRadio) {
                    const groupType = groupName === '__group0' ? 'authenticationMethod' : 'hostKeyValidation';
                    formData.fields[groupType] = checkedRadio.id;
                    console.log(`[Connectivity Data Manager] Extracted ${groupType}:`, checkedRadio.id);
                }
            });
            
            console.log('[Connectivity Data Manager] Complete form data:', formData);
            return formData;
        },

        // Populate form with profile data
        populateForm: function(profileData) {
            console.log('[Connectivity Data Manager] Populating form with:', profileData);
            
            if (!profileData || !profileData.fields) {
                console.log('[Connectivity Data Manager] No profile data to populate');
                return false;
            }
            
            const elements = this.findFormElements();
            let populatedCount = 0;
            
            // Populate each field
            for (const [fieldName, value] of Object.entries(profileData.fields)) {
                const element = elements[fieldName];
                if (element && value !== null && value !== undefined) {
                    try {
                        if (element.type === 'checkbox') {
                            element.checked = value;
                        } else if (element.tagName === 'SELECT') {
                            element.value = value;
                        } else {
                            element.value = value;
                        }
                        
                        // Trigger change event to update UI
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        populatedCount++;
                        console.log(`[Connectivity Data Manager] Populated ${fieldName} with:`, value);
                    } catch (error) {
                        console.log(`[Connectivity Data Manager] Error populating ${fieldName}:`, error);
                    }
                }
            }
            
            console.log(`[Connectivity Data Manager] Successfully populated ${populatedCount} fields`);
            return populatedCount > 0;
        },

        // Debug function to analyze page structure
        debugFormStructure: function() {
            console.log('[Connectivity Data Manager] === FORM STRUCTURE DEBUG ===');
            
            // Find all form elements
            const inputs = document.querySelectorAll('input, select, textarea');
            console.log(`[Connectivity Data Manager] Found ${inputs.length} form elements:`);
            
            inputs.forEach((input, index) => {
                console.log(`[Connectivity Data Manager] ${index + 1}. ${input.tagName} - type: ${input.type} - name: ${input.name} - id: ${input.id} - placeholder: ${input.placeholder} - value: ${input.value}`);
            });
            
            // Find active tab
            const activeTab = document.querySelector('.sapMITBSelected, .sapMSegmentedButtonItem--selected');
            if (activeTab) {
                console.log('[Connectivity Data Manager] Active tab:', activeTab.textContent);
            }
            
            console.log('[Connectivity Data Manager] === END DEBUG ===');
        }
    },

    // Test button in message sidebar (for plugin activation testing only)
    messageSidebarButton: {
        icon: { text: "🔗", type: "text" },
        title: "Connectivity Data Manager - Plugin Test",
        onClick: async function(cpiData, settings, runInfo, active) {
            const context = plugin.detectPageContext();
            const html = `
                <div style="padding: 20px; font-family: Arial, sans-serif;">
                    <h3 style="color: #0070d2;">🔗 Connectivity Data Manager</h3>
                    <div style="background: #f3f3f3; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <h4>Plugin Status: ✅ Active</h4>
                        <p><strong>Author:</strong> ${plugin.author}</p>
                        <p><strong>Version:</strong> ${plugin.version}</p>
                        <p><strong>Is Connectivity Page:</strong> ${context.isConnectivityPage ? '✅ Yes' : '❌ No'}</p>
                    </div>
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <h4>✅ Plugin Working!</h4>
                        <p><strong>Main Features:</strong> Go to the SCI Connectivity Test page to see the actual functionality!</p>
                        <p><strong>Expected buttons on connectivity page:</strong></p>
                        <ul>
                            <li>📂 Load Profile</li>
                            <li>💾 Save Profile</li> 
                            <li>⚙️ Manage</li>
                        </ul>
                    </div>
                </div>
            `;
            showBigPopup(html, 'Plugin Test');
        },
        condition: function(cpiData, settings, runInfo) {
            return true; // Always show for testing
        }
    }
};

// Create global functions immediately at plugin load time
window.cpiDebugFormStructure = function() {
    console.log('[Connectivity Data Manager] Global debug function called');
    const pluginInstance = pluginList.find(p => p.id === 'connectivity-data-manager');
    if (pluginInstance && pluginInstance.formHandler) {
        return pluginInstance.formHandler.debugFormStructure();
    } else {
        console.error('[Connectivity Data Manager] Plugin instance not found');
    }
};

window.cpiExtractFormData = function() {
    console.log('[Connectivity Data Manager] Global extract function called');
    const pluginInstance = pluginList.find(p => p.id === 'connectivity-data-manager');
    if (pluginInstance && pluginInstance.formHandler) {
        return pluginInstance.formHandler.extractFormData();
    } else {
        console.error('[Connectivity Data Manager] Plugin instance not found');
    }
};

window.cpiDetectConnectivityType = function() {
    console.log('[Connectivity Data Manager] Global detect function called');
    const pluginInstance = pluginList.find(p => p.id === 'connectivity-data-manager');
    if (pluginInstance && pluginInstance.formHandler) {
        return pluginInstance.formHandler.detectConnectivityType();
    } else {
        console.error('[Connectivity Data Manager] Plugin instance not found');
    }
};

console.log('[Connectivity Data Manager] Global functions created at load time:', {
    cpiDebugFormStructure: typeof window.cpiDebugFormStructure,
    cpiExtractFormData: typeof window.cpiExtractFormData,
    cpiDetectConnectivityType: typeof window.cpiDetectConnectivityType
});

// Auto-initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        plugin.init();
    });
} else {
    plugin.init();
}

// Register plugin with CPI Helper
pluginList.push(plugin);

console.log('[Connectivity Data Manager] 🚀 PLUGIN REGISTERED SUCCESSFULLY 🚀');
console.log('[Connectivity Data Manager] Plugin ID:', plugin.id);
console.log('[Connectivity Data Manager] Current pluginList length:', pluginList.length);