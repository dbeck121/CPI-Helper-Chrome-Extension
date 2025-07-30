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

    // Centralized error handler
    handleError: function(operation, error) {
        console.error(`[Connectivity Data Manager] Error in ${operation}:`, error);
        return false;
    },

    // Check if we're on the connectivity test page
    isConnectivityPage: function() {
        const url = window.location.href;
        
        // Match pattern: *.integrationsuite.cfapps.*.hana.ondemand.com/shell/monitoring/Connectivity
        const connectivityPathMatch = url.includes('/shell/monitoring/Connectivity');
        const integrationSuiteMatch = /https:\/\/[^.]+\.integrationsuite\.cfapps\.[^.]+\.hana\.ondemand\.com/.test(url);
        
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
            // Create global reference for dialog access
            window.connectivityDataManagerPlugin = this;
            
            this.initializeUI();
            this.setupPageChangeListener();
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
        // Remove any added UI elements, event listeners, etc.
        // This will be expanded in later phases
    },

    // Initialize UI components
    initializeUI: function() {
        // Ensure global references are always available
        window.connectivityDataManagerPlugin = this;
        
        
        // Add UI elements after page is fully loaded
        setTimeout(() => {
            this.addProfileManagementUI();
        }, 2000);
    },

    // Add profile management UI to the connectivity page
    addProfileManagementUI: function() {
        console.log('[Connectivity Data Manager] Checking page...', window.location.href);
        const isConnPage = this.isConnectivityPage();
        console.log('[Connectivity Data Manager] Is connectivity page:', isConnPage);
        
        if (!isConnPage) {
            console.log('[Connectivity Data Manager] Not on connectivity page, skipping button creation');
            return;
        }
        
        console.log('[Connectivity Data Manager] On connectivity page, adding buttons...');

        // Remove existing buttons first to prevent duplicates
        this.removeExistingButtons();

        // Single unified button placement
        setTimeout(() => {
            this.addAllButtons();
        }, 2000);

        // Set up periodic check to re-add buttons if they disappear
        this.setupButtonPersistence();
    },

    // Single centralized function to add all buttons
    addAllButtons: function() {
        console.log('[Connectivity Data Manager] Adding all buttons...');
        
        // Remove any existing buttons first
        this.removeExistingButtons();
        
        // Create button container
        const buttonContainer = this.createButtonContainer();
        console.log('[Connectivity Data Manager] Button container created:', buttonContainer);
        
        // Try placement strategies in order of preference
        console.log('[Connectivity Data Manager] Trying placement strategies...');
        
        // Primary method: Original toolbar approach (proven to work)
        if (this.addButtonsToToolbar()) {
            console.log('[Connectivity Data Manager] SUCCESS: Placed using original toolbar method');
            return;
        }
        
        // Fallback: Fixed positioning as last resort
        if (this.tryAnyContainerPlacement(buttonContainer)) {
            console.log('[Connectivity Data Manager] SUCCESS: Placed in any available container');
            return;
        }
        
        console.log('[Connectivity Data Manager] WARNING: No suitable placement found!');
    },

    // Set up periodic check to ensure buttons stay visible
    setupButtonPersistence: function() {
        console.log('[Connectivity Data Manager] Setting up button persistence...');
        
        // Check every 3 seconds if buttons are still visible
        this.buttonCheckInterval = setInterval(() => {
            if (!this.isConnectivityPage()) {
                // If not on connectivity page anymore, stop checking
                if (this.buttonCheckInterval) {
                    clearInterval(this.buttonCheckInterval);
                    this.buttonCheckInterval = null;
                }
                return;
            }
            
            // Check if our button container still exists and is visible
            const existingContainer = document.getElementById('cpiHelper_connectivity_buttonContainer');
            if (!existingContainer || !document.body.contains(existingContainer)) {
                console.log('[Connectivity Data Manager] Buttons disappeared, re-adding...');
                this.addAllButtons();
            }
        }, 3000);
    },


    // Try placing in any available container as absolute fallback
    tryAnyContainerPlacement: function(buttonContainer) {
        console.log('[Connectivity Data Manager] Trying any container placement (last resort)...');
        // Try very generic selectors, prioritizing stable areas
        const genericSelectors = [
            'body', // Most stable as final fallback
            'div[class*="Shell"]',
            'div[class*="Application"]',
            'div[class*="Header"]',
            'div[class*="Bar"]', 
            'div[class*="Toolbar"]',
            'header',
            'nav',
            '.ui-content',
            'main'
        ];
        
        for (const selector of genericSelectors) {
            const container = document.querySelector(selector);
            console.log(`[Connectivity Data Manager] Generic selector "${selector}" found:`, !!container);
            if (container) {
                this.addButtonsToContainer(buttonContainer, 'sap');
                
                // Create fixed positioning for maximum stability
                buttonContainer.style.position = 'fixed';
                buttonContainer.style.top = '20px';
                buttonContainer.style.right = '20px';
                buttonContainer.style.zIndex = '10000';
                buttonContainer.style.background = 'rgba(255, 255, 255, 0.95)';
                buttonContainer.style.padding = '8px';
                buttonContainer.style.borderRadius = '4px';
                buttonContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                
                container.appendChild(buttonContainer);
                return true;
            }
        }
        return false;
    },

    // Original toolbar method - more sophisticated approach
    addButtonsToToolbar: function() {
        console.log('[Connectivity Data Manager] Trying original toolbar approach...');
        
        // Remove existing buttons first
        this.removeExistingButtons();
        
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
                const analyzeBtn = this.createToolbarButton('Analyze', 'Analyze form fields for Phase 1/2 mapping', () => this.showAnalyzeFieldsDialog());

                buttonContainer.appendChild(loadBtn);
                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(manageBtn);
                buttonContainer.appendChild(analyzeBtn);

                rightArea.appendChild(buttonContainer);
                
                console.log('[Connectivity Data Manager] Buttons added to tab header right area');
                return true;
            }
        }
        
        console.log('[Connectivity Data Manager] No suitable tab header found');
        return false;
    },

    // Create right area helper
    createRightArea: function(parent) {
        const rightArea = document.createElement('div');
        rightArea.className = 'sapMBarEnd';
        rightArea.style.cssText = 'margin-left: auto; display: flex; align-items: center;';
        parent.appendChild(rightArea);
        return rightArea;
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
                const analyzeBtn = this.createHeaderButton('Analyze', 'Analyze form fields for Phase 1/2 mapping', () => this.showAnalyzeFieldsDialog());
                buttonContainer.appendChild(analyzeBtn);

                // Insert into header
                header.appendChild(buttonContainer);
                
                return true;
            }
        }
        
        return false;
    },

    // Special handling for title elements
    addButtonsNearTitle: function(titleElement) {
        
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
            
            return true;
        } else {
            
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
            
            return true;
        }
    },

    // Primary approach: Add buttons to toolbar right area
    addButtonsToToolbar: function() {
        
        // Specifically target the tab header area where the protocol tabs are
        const tabHeaderSelectors = [
            '.sapMIconTabHeader',
            '.sapMIconTabBar .sapMIconTabHeader',
            '[role="tablist"]',
            '.sapMSegmentedButton'
        ];
        

        for (const selector of tabHeaderSelectors) {
            const tabHeader = document.querySelector(selector);
            if (tabHeader) {
                
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
                }
                
                // Add buttons to the right area
                const buttonContainer = document.createElement('div');
                buttonContainer.id = 'cpiHelper_connectivity_buttonContainer';
                buttonContainer.style.cssText = `
                    display: inline-flex;
                    gap: 6px;
                    align-items: center;
                `;

                this.addButtonsToContainer(buttonContainer, 'toolbar');

                rightArea.appendChild(buttonContainer);
                
                return true;
            }
        }
        
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
        
    },

    // Fallback approach: Add buttons near the Send button
    addButtonsNearSendButton: function() {
        // Find the Send button specifically
        const sendButton = document.querySelector('button[type="submit"]') || 
                          Array.from(document.querySelectorAll('button')).find(btn => 
                              btn.textContent.trim().toLowerCase() === 'send'
                          );
        
        if (sendButton) {
            
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
            
            return true;
        } else {
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
        } else {
        }
    },

    // Remove existing plugin buttons to prevent duplicates
    removeExistingButtons: function() {
        const existingButtons = document.querySelectorAll('[id^="cpiHelper_connectivity_"]');
        existingButtons.forEach(button => button.remove());
    },

    // Unified button creation and container management
    createButtonContainer: function() {
        const container = document.createElement('div');
        container.id = 'cpiHelper_connectivity_buttonContainer';
        container.style.cssText = `
            display: inline-flex;
            gap: 4px;
            align-items: center;
            margin-left: 8px;
        `;
        return container;
    },

    addButtonsToContainer: function(container, buttonType = 'header') {
        const buttons = [
            { text: 'Load', title: 'Load saved connectivity profile', action: () => this.showLoadProfileDialog() },
            { text: 'Save', title: 'Save current connectivity data as profile', action: () => this.showSaveProfileDialog() },
            { text: 'Manage', title: 'Manage saved connectivity profiles', action: () => this.showManageProfilesDialog() },
            { text: 'Analyze', title: 'Analyze form fields for Phase 1/2 mapping', action: () => this.showAnalyzeFieldsDialog() }
        ];

        buttons.forEach(btn => {
            let button;
            switch(buttonType) {
                case 'toolbar':
                    button = this.createToolbarButton(btn.text, btn.title, btn.action);
                    break;
                case 'sap':
                    const icon = btn.text === 'Load' ? '📂' : btn.text === 'Save' ? '💾' : btn.text === 'Manage' ? '⚙️' : '🔍';
                    button = this.createSAPButton(`${icon} ${btn.text}`, btn.title, btn.action);
                    break;
                default: // header
                    button = this.createHeaderButton(btn.text, btn.title, btn.action);
            }
            container.appendChild(button);
        });
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
                                const success = await this.formHandler.populateForm(profile);
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
                                const success = await this.formHandler.populateForm(profile);
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

    // Field Analysis Dialog for Phase 1/2 mapping
    showAnalyzeFieldsDialog: async function() {
        const connectivityType = this.formHandler.detectConnectivityType();
        const elements = this.formHandler.findAllFormElements();
        
        const html = `
            <div style="padding: 20px; max-height: 70vh; overflow-y: auto;">
                <h3>🔍 Field Phase Analysis - ${connectivityType.toUpperCase()}</h3>
                <p style="margin: 15px 0; color: #666; font-size: 14px;">
                    <strong>Phase 1 fields</strong> are primary fields that trigger visibility of other fields.<br>
                    <strong>Phase 2 fields</strong> are conditional fields that appear after Phase 1 selections.<br>
                    <em>🔴 Red fields are currently hidden, 🟢 green fields are visible.</em>
                </p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div>
                        <h4 style="color: #28a745; margin: 10px 0;">✅ Phase 1 Fields (Primary)</h4>
                        <div id="phase1Fields" style="border: 2px solid #28a745; border-radius: 8px; padding: 15px; min-height: 200px; background: #f8fff8;">
                            <p style="color: #666; font-style: italic;">Drop fields here that control visibility of other fields</p>
                        </div>
                    </div>
                    <div>
                        <h4 style="color: #007bff; margin: 10px 0;">⚡ Phase 2 Fields (Conditional)</h4>
                        <div id="phase2Fields" style="border: 2px solid #007bff; border-radius: 8px; padding: 15px; min-height: 200px; background: #f8faff;">
                            <p style="color: #666; font-style: italic;">Drop fields here that appear conditionally</p>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h4 style="margin: 10px 0;">📦 Available Fields</h4>
                    <div id="availableFields" style="border: 2px dashed #ccc; border-radius: 8px; padding: 15px; background: #fafafa;">
                        ${Object.entries(elements).map(([fieldName, fieldData]) => {
                            const isVisible = fieldData.visible;
                            const element = fieldData.element;
                            const label = fieldData.label || fieldName;
                            const value = element ? (element.type === 'checkbox' ? element.checked : element.value || 'empty') : 'not found';
                            
                            return `
                                <div class="field-item" draggable="true" data-field="${fieldName}" 
                                     style="display: inline-block; margin: 5px; padding: 8px 12px; 
                                            background: ${isVisible ? '#e8f5e8' : '#ffe8e8'}; 
                                            border: 1px solid ${isVisible ? '#28a745' : '#dc3545'};
                                            border-radius: 4px; cursor: move; font-size: 13px;">
                                    <strong>${fieldName}</strong><br>
                                    <small>${isVisible ? '🟢' : '🔴'} ${label}</small><br>
                                    <small>Type: ${fieldData.type} | Value: ${String(value).substring(0, 15)}</small>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div style="margin: 20px 0; text-align: center;">
                    <button id="autoDetectBtn" style="padding: 10px 20px; margin: 5px; background: #ffc107; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        🤖 Auto-Detect Phases
                    </button>
                    <button id="testPhasesBtn" style="padding: 10px 20px; margin: 5px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        🧪 Test Phase Logic
                    </button>
                    <button id="saveConfigBtn" style="padding: 10px 20px; margin: 5px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        💾 Save Configuration
                    </button>
                </div>
                
                <div id="testResults" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; display: none;">
                    <h4>Test Results:</h4>
                    <pre id="testOutput" style="background: #fff; padding: 10px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow-y: auto;"></pre>
                </div>
            </div>
        `;
        
        await showBigPopup(html, 'Field Phase Analyzer');
        this.initFieldAnalyzer();
    },

    // Initialize drag & drop and analysis functionality
    initFieldAnalyzer: function() {
        const phase1Container = document.getElementById('phase1Fields');
        const phase2Container = document.getElementById('phase2Fields');
        const availableContainer = document.getElementById('availableFields');
        
        // Enable drag & drop
        [phase1Container, phase2Container, availableContainer].forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.style.backgroundColor = container.id === 'phase1Fields' ? '#e8f5e8' : 
                                                 container.id === 'phase2Fields' ? '#e8f4fd' : '#f0f0f0';
            });
            
            container.addEventListener('dragleave', () => {
                container.style.backgroundColor = container.id === 'phase1Fields' ? '#f8fff8' : 
                                                 container.id === 'phase2Fields' ? '#f8faff' : '#fafafa';
            });
            
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                const fieldName = e.dataTransfer.getData('text/plain');
                const fieldElement = document.querySelector(`[data-field="${fieldName}"]`);
                if (fieldElement) {
                    // Remove placeholder text
                    const placeholder = container.querySelector('p');
                    if (placeholder && placeholder.textContent.includes('Drop fields')) {
                        placeholder.remove();
                    }
                    container.appendChild(fieldElement);
                }
                container.style.backgroundColor = container.id === 'phase1Fields' ? '#f8fff8' : 
                                                 container.id === 'phase2Fields' ? '#f8faff' : '#fafafa';
            });
        });
        
        // Enable dragging of field items
        document.querySelectorAll('.field-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.field);
            });
        });
        
        // Auto-detect button
        document.getElementById('autoDetectBtn').addEventListener('click', () => {
            this.autoDetectPhases();
        });
        
        // Test phases button  
        document.getElementById('testPhasesBtn').addEventListener('click', () => {
            this.testPhaseLogic();
        });
        
        // Save config button
        document.getElementById('saveConfigBtn').addEventListener('click', () => {
            this.savePhaseConfiguration();
        });
    },

    // Auto-detect which fields should be in Phase 1 vs Phase 2
    autoDetectPhases: function() {
        console.log('Auto-detecting field phases...');
        
        const connectivityType = this.formHandler.detectConnectivityType();
        const elements = this.formHandler.findAllFormElements();
        
        // Phase 1: Fields that typically control visibility of others
        const phase1Patterns = [
            // Authentication-related controls
            /auth.*method/i,
            /authentication/i,
            /login.*type/i,
            /connection.*type/i,
            
            // Certificate and security controls
            /check.*cert/i,
            /checksrvcert/i,
            /verify.*cert/i,
            /use.*cert/i,
            /certificate.*check/i,
            /certificate.*auth/i,
            /tls.*enable/i,
            /ssl.*enable/i,
            /security.*mode/i,
            
            // Protocol controls
            /protocol/i,
            /mode/i,
            /type/i,
            
            // Radio buttons and checkboxes that control visibility
            /radio|checkbox/i
        ];
        
        // Phase 2: Fields that are typically conditional
        const phase2Patterns = [
            // Certificate details (usually appear after enabling cert check)
            /certificate.*path/i,
            /cert.*file/i,
            /keystore/i,
            /truststore/i,
            /private.*key/i,
            /public.*key/i,
            
            // Authentication details (appear after selecting auth method)
            /username/i,
            /password/i,
            /token/i,
            /secret/i,
            /credential/i,
            
            // Advanced/optional settings
            /timeout/i,
            /retry/i,
            /buffer/i,
            /encoding/i,
            /charset/i,
            
            // Proxy settings (usually optional)
            /proxy/i,
            
            // Port numbers (usually have defaults)
            /port/i
        ];
        
        const phase1Fields = [];
        const phase2Fields = [];
        const uncategorized = [];
        
        // Analyze each field
        Object.entries(elements).forEach(([fieldName, fieldData]) => {
            const element = fieldData.element;
            const label = fieldData.label.toLowerCase();
            const fieldNameLower = fieldName.toLowerCase();
            const combinedText = `${fieldNameLower} ${label}`;
            
            // Check for Phase 1 patterns
            const isPhase1 = phase1Patterns.some(pattern => 
                pattern.test(combinedText) || 
                pattern.test(element.type)
            );
            
            // Check for Phase 2 patterns
            const isPhase2 = phase2Patterns.some(pattern => 
                pattern.test(combinedText)
            );
            
            // Special logic for specific field types and TLS connectivity
            const isTLSControlField = connectivityType === 'tls' && (
                fieldNameLower.includes('checksrvcert') ||
                fieldNameLower.includes('certificateauth') ||
                combinedText.includes('check server cert')
            );
            
            if (isTLSControlField) {
                // TLS control fields that trigger visibility -> Phase 1
                phase1Fields.push(fieldName);
            } else if (element.type === 'checkbox' && !isPhase2) {
                // Most checkboxes control visibility -> Phase 1
                phase1Fields.push(fieldName);
            } else if (element.type === 'radio' && !isPhase2) {
                // Radio buttons usually control visibility -> Phase 1
                phase1Fields.push(fieldName);
            } else if (element.type === 'password') {
                // Passwords are usually conditional -> Phase 2
                phase2Fields.push(fieldName);
            } else if (isPhase1 && !isPhase2) {
                phase1Fields.push(fieldName);
            } else if (isPhase2 && !isPhase1) {
                phase2Fields.push(fieldName);
            } else if (!fieldData.visible) {
                // Hidden fields are likely Phase 2 (conditional)
                phase2Fields.push(fieldName);
            } else {
                // Common fields that don't clearly fit -> Phase 1 by default
                uncategorized.push(fieldName);
            }
        });
        
        // Move uncategorized fields to Phase 1 (conservative approach)
        phase1Fields.push(...uncategorized);
        
        // Apply the auto-detection results
        this.applyPhaseDetection(phase1Fields, phase2Fields);
        
        // Show results
        const testOutput = document.getElementById('testOutput');
        const results = `Auto-Detection Results for ${connectivityType.toUpperCase()}:

Phase 1 Fields (${phase1Fields.length}):
${phase1Fields.map(f => `• ${f} (${elements[f]?.label || 'no label'})`).join('\n')}

Phase 2 Fields (${phase2Fields.length}):
${phase2Fields.map(f => `• ${f} (${elements[f]?.label || 'no label'})`).join('\n')}

Logic Applied:
- Checkboxes/radios that control visibility → Phase 1
- Hidden fields → Phase 2 (conditional)
- Certificate/auth details → Phase 2
- Control fields (auth method, connection type) → Phase 1`;
        
        if (testOutput) {
            testOutput.textContent = results;
            document.getElementById('testResults').style.display = 'block';
        }
    },
    
    // Apply auto-detection results to the UI
    applyPhaseDetection: function(phase1Fields, phase2Fields) {
        // Move fields to their detected phases
        const phase1Container = document.getElementById('phase1Fields');
        const phase2Container = document.getElementById('phase2Fields');
        const availableContainer = document.getElementById('availableFields');
        
        // Clear existing phase containers
        phase1Container.innerHTML = '';
        phase2Container.innerHTML = '';
        
        // Move Phase 1 fields
        phase1Fields.forEach(fieldName => {
            const fieldElement = availableContainer.querySelector(`[data-field="${fieldName}"]`);
            if (fieldElement) {
                phase1Container.appendChild(fieldElement);
            }
        });
        
        // Move Phase 2 fields
        phase2Fields.forEach(fieldName => {
            const fieldElement = availableContainer.querySelector(`[data-field="${fieldName}"]`);
            if (fieldElement) {
                phase2Container.appendChild(fieldElement);
            }
        });
        
        console.log(`Auto-detection completed: ${phase1Fields.length} Phase 1, ${phase2Fields.length} Phase 2`);
    },

    // Test the current phase configuration
    testPhaseLogic: function() {
        console.log('Testing phase logic...');
        const phase1Fields = Array.from(document.querySelectorAll('#phase1Fields .field-item')).map(el => el.dataset.field);
        const phase2Fields = Array.from(document.querySelectorAll('#phase2Fields .field-item')).map(el => el.dataset.field);
        
        const testOutput = document.getElementById('testOutput');
        if (testOutput) {
            testOutput.textContent = `Phase 1 Fields: ${phase1Fields.join(', ')}\nPhase 2 Fields: ${phase2Fields.join(', ')}`;
            document.getElementById('testResults').style.display = 'block';
        }
    },

    // Save phase configuration
    savePhaseConfiguration: function() {
        const connectivityType = this.formHandler.detectConnectivityType();
        const phase1Fields = Array.from(document.querySelectorAll('#phase1Fields .field-item')).map(el => el.dataset.field);
        const phase2Fields = Array.from(document.querySelectorAll('#phase2Fields .field-item')).map(el => el.dataset.field);
        
        const config = {
            connectivityType: connectivityType,
            phase1Fields,
            phase2Fields,
            timestamp: new Date().toISOString()
        };
        
        console.log('Saving phase configuration:', config);
        
        // Store in localStorage for development use
        const storageKey = `cpi_phase_config_${connectivityType}`;
        localStorage.setItem(storageKey, JSON.stringify(config));
        
        // Generate code snippet for implementation
        const codeSnippet = this.generatePhaseConfigCode(connectivityType, phase1Fields, phase2Fields);
        
        const testOutput = document.getElementById('testOutput');
        if (testOutput) {
            testOutput.textContent = `✅ Configuration saved to localStorage: ${storageKey}

📝 Generated Code for Implementation:
${codeSnippet}

📋 Full Configuration Object:
${JSON.stringify(config, null, 2)}`;
            document.getElementById('testResults').style.display = 'block';
        }
        
        console.log(`✅ Phase configuration saved: ${storageKey}`);
    },
    
    // Generate code snippet for phase configuration
    generatePhaseConfigCode: function(connectivityType, phase1Fields, phase2Fields) {
        return `// ${connectivityType.toUpperCase()} Phase Configuration
${connectivityType}: {
    phase1: [
        ${phase1Fields.map(field => `'${field}'`).join(',\n        ')}
    ],
    phase2: [
        ${phase2Fields.map(field => `'${field}'`).join(',\n        ')}
    ]
},`;
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
                authenticationMethod: 'input[name="__group0"]', // Radio group for authentication method
                hostKeyValidation: 'input[name="__group1"]', // Radio group for host key validation
                checkDirectoryAccess: 'input[id*="CheckDirectoryAccess-CB"]',
                credentialName: 'input[id*="CredentialName-inner"]',
                directory: 'input[id*="Directory-inner"]'
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
                } else {
                }
            }
            
            // Find type-specific elements
            for (const [fieldName, selector] of Object.entries(typeMappings)) {
                const element = document.querySelector(selector);
                if (element) {
                    elements[fieldName] = element;
                } else {
                }
            }
            
            return elements;
        },

        // Enhanced field detection that finds both visible and hidden fields
        findAllFormElements: function() {
            const elements = {};
            
            // Generic selectors to find ALL form fields on the page
            const genericSelectors = [
                'input[type="text"]',
                'input[type="password"]', 
                'input[type="number"]',
                'input[type="checkbox"]',
                'input[type="radio"]',
                'select',
                'textarea',
                'input[id*="hiddenInput"]' // SAP ComboBox hidden inputs
            ];
            
            genericSelectors.forEach(selector => {
                const foundElements = document.querySelectorAll(selector);
                foundElements.forEach((element, index) => {
                    // Generate a field name from the element
                    let fieldName = this.generateFieldName(element, index);
                    if (fieldName && !elements[fieldName]) {
                        elements[fieldName] = {
                            element: element,
                            visible: this.isElementVisible(element),
                            type: element.type || element.tagName.toLowerCase(),
                            label: this.findFieldLabel(element)
                        };
                    }
                });
            });
            
            return elements;
        },

        // Generate a meaningful field name from element attributes
        generateFieldName: function(element, index) {
            // Try to get a meaningful name from various attributes
            if (element.id) {
                // Clean up SAP UI5 IDs
                let name = element.id
                    .replace(/-inner$/, '')
                    .replace(/-hiddenInput$/, '')
                    .replace(/^.*__(input|text|cb|rb|select)/, '')
                    .replace(/[_-]/g, ' ')
                    .toLowerCase()
                    .trim();
                if (name) return name;
            }
            if (element.name) return element.name;
            
            // Fallback to label-based name
            const label = this.findFieldLabel(element);
            if (label) {
                return label.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
            }
            
            // Final fallback
            return `field_${element.type}_${index}`;
        },

        // Check if element is currently visible
        isElementVisible: function(element) {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   rect.width > 0 && 
                   rect.height > 0;
        },

        // Find the label associated with a form field
        findFieldLabel: function(element) {
            // Try to find label by various methods
            const id = element.id;
            if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (label) return label.textContent.trim();
            }
            
            // Look for nearby text that might be a label
            const parent = element.closest('.sapMInputBase, .sapMCheckBox, .sapMRadioButton, .sapMComboBox, .sapMFormElement');
            if (parent) {
                const labelElement = parent.querySelector('.sapMLabel, .sapMText, .sapMFormElementLabel');
                if (labelElement) return labelElement.textContent.trim();
            }
            
            return element.placeholder || element.title || '';
        },

        // Simplified SAP UI5 ComboBox value setter (async version for Phase 1 compatibility)
        setSAPComboBoxValue: async function(hiddenInput, targetValue, fieldName) {
            try {
                const comboBoxId = hiddenInput.id.replace('-hiddenInput', '');
                
                // Find visible input and dropdown button using most common SAP UI5 patterns
                const visibleInput = document.querySelector(`#${comboBoxId}-inner`) || 
                                   document.querySelector(`#${comboBoxId}`);
                const dropdownArrow = document.querySelector(`#${comboBoxId}-arrow`) || 
                                    document.querySelector(`#${comboBoxId}-button`);
                
                if (visibleInput && dropdownArrow) {
                    // Click dropdown to open options
                    dropdownArrow.click();
                    
                    // Wait for dropdown to open and find matching option
                    setTimeout(() => {
                        const dropdownItems = document.querySelectorAll(`
                            li[role="option"],
                            .sapMSelectListItem,
                            .sapMComboBoxItem
                        `);
                        
                        // Find matching item
                        for (const item of dropdownItems) {
                            const itemText = item.textContent?.trim() || '';
                            const itemValue = item.getAttribute('data-value') || item.getAttribute('key') || itemText;
                            
                            // Check for exact match or case-insensitive match
                            if (itemValue === targetValue || 
                                itemText.toLowerCase() === targetValue.toLowerCase() ||
                                itemText.toLowerCase().includes(targetValue.toLowerCase())) {
                                
                                // Click the matching item
                                item.click();
                                
                                // Trigger change events
                                setTimeout(() => {
                                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    visibleInput.dispatchEvent(new Event('change', { bubbles: true }));
                                }, 50);
                                
                                return;
                            }
                        }
                        
                        // No match found, close dropdown
                        document.body.click();
                    }, 100);
                } else {
                    // Fallback: Set hidden input directly
                    hiddenInput.value = targetValue;
                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
            } catch (error) {
                this.handleError(`setting ComboBox ${fieldName}`, error);
            }
        },

        // Alias for backward compatibility
        setSAPComboBoxValueAsync: function(hiddenInput, targetValue, fieldName) {
            return this.setSAPComboBoxValue(hiddenInput, targetValue, fieldName);
        },

        // Extract data from connectivity form
        extractFormData: function() {
            
            const elements = this.findFormElements();
            const connectivityType = this.detectConnectivityType();
            const formData = {
                connectivityType: connectivityType,
                timestamp: new Date().toISOString(),
                fields: {}
            };
            
            // Track processed radio groups to avoid duplicates
            const processedRadioGroups = new Set();
            
            // Extract values from found elements
            for (const [fieldName, element] of Object.entries(elements)) {
                try {
                    let value = null;
                    
                    if (element.type === 'checkbox') {
                        value = element.checked;
                    } else if (element.type === 'radio') {
                        // For radio buttons, find the selected one in the group using UI5 API for reliability
                        const radioGroupContainer = element.closest('[role="radiogroup"]');
                        if (radioGroupContainer && !processedRadioGroups.has(radioGroupContainer.id)) {
                            let selectedRadioId = null;
                            try {
                                if (window.sap && window.sap.ui) {
                                    const ui5Control = window.sap.ui.getCore().byId(radioGroupContainer.id);
                                    if (ui5Control && typeof ui5Control.getSelectedButton === 'function') {
                                        const selectedButton = ui5Control.getSelectedButton();
                                        if (selectedButton) {
                                            selectedRadioId = selectedButton.getId();
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('[Connectivity Data Manager] Error using UI5 API to find selected radio, falling back to DOM.', e);
                            }

                            // Fallback to DOM query if UI5 API fails
                            if (!selectedRadioId) {
                                const checkedRadio = radioGroupContainer.querySelector('input[type="radio"]:checked');
                                if (checkedRadio) {
                                    selectedRadioId = checkedRadio.id;
                                }
                            }
                            
                            if (selectedRadioId) {
                                value = selectedRadioId;
                            } else {
                                value = null;
                            }
                            processedRadioGroups.add(radioGroupContainer.id);
                        } else {
                            // If the group was already processed or not found, skip.
                            continue;
                        }
                    } else if (element.tagName === 'SELECT') {
                        value = element.value;
                    } else {
                        value = element.value;
                    }
                    
                    if (value !== null) {
                        formData.fields[fieldName] = value;
                    }
                } catch (error) {
                    this.handleError(`extracting ${fieldName}`, error);
                }
            }
            
            // Extract any remaining radio button groups that weren't captured above
            const allRadioButtons = document.querySelectorAll('input[type="radio"]:checked');
            allRadioButtons.forEach(radio => {
                const groupName = radio.name;
                const value = radio.id; // Use ID consistently
                
                // Only add if we haven't already processed this group
                if (!processedRadioGroups.has(groupName)) {
                    // Try to map common radio group names to field names
                    let fieldName = null;
                    if (groupName === '__group0') {
                        fieldName = 'authenticationMethod';
                    } else if (groupName === '__group1') {
                        fieldName = 'hostKeyValidation';
                    } else if (groupName.includes('connection') || radio.id.includes('connection')) {
                        fieldName = 'connectionType';
                    } else {
                        // Use group name as field name
                        fieldName = groupName;
                    }
                    
                    if (fieldName && !formData.fields[fieldName]) {
                        formData.fields[fieldName] = value;
                    }
                }
            });
            
            return formData;
        },

        // Populate form with profile data
        populateForm: async function(profileData) {
            
            if (!profileData || !profileData.fields) {
                console.log('[Connectivity Data Manager] No profile data to populate');
                return false;
            }
            
            // Phase 1: Populate primary fields (that trigger conditional fields)
            await this.populateFormPhase1(profileData);
            
            // Phase 2: Wait and populate conditional fields  
            await this.populateFormPhase2(profileData);
            
            return true;
        },

        // Phase 1: Populate primary fields that might trigger conditional fields
        populateFormPhase1: async function(profileData) {
            const elements = this.findFormElements();
            const primaryFields = ['host', 'port', 'authenticationMethod', 'authenticationType', 'connectionType', 'proxyType'];
            let populatedCount = 0;
            
            console.log('[Connectivity Data Manager] Phase 1: Populating primary fields...');
            console.log('[Connectivity Data Manager] Profile data fields:', profileData.fields);
            console.log('[Connectivity Data Manager] Found form elements:', elements);
            
            for (const fieldName of primaryFields) {
                const value = profileData.fields[fieldName];
                const element = elements[fieldName];
                
                console.log(`[Connectivity Data Manager] Processing field: ${fieldName}, value:`, value, 'element:', element);
                
                if (element && value !== null && value !== undefined) {
                    try {
                        if (element.type === 'radio') {
                            console.log(`[Connectivity Data Manager] Processing radio field: ${fieldName} with value: ${value}`);
                            console.log(`[Connectivity Data Manager] Element name: ${element.name}`);
                            
                            // For radio buttons, find the correct option
                            const radioButtons = document.querySelectorAll(`input[name="${element.name}"]`);
                            console.log(`[Connectivity Data Manager] Found ${radioButtons.length} radio buttons for name: ${element.name}`);
                            
                            let foundMatch = false;
                            radioButtons.forEach((radio, index) => {
                                console.log(`[Connectivity Data Manager] Radio ${index}: id=${radio.id}, value="${radio.value}", data-value="${radio.getAttribute('data-value')}", checked=${radio.checked}`);
                                
                                // Check next sibling text content and labels
                                const nextSiblingText = radio.nextSibling?.textContent?.trim() || '';
                                const label = document.querySelector(`label[for="${radio.id}"]`);
                                const labelText = label?.textContent?.trim() || '';
                                console.log(`[Connectivity Data Manager] Radio ${index} next sibling text: "${nextSiblingText}"`);
                                console.log(`[Connectivity Data Manager] Radio ${index} label text: "${labelText}"`);
                                
                                // Since we store radio button IDs, prioritize exact ID matching
                                const exactIdMatch = radio.id === value;
                                const idIncludesMatch = value && radio.id && radio.id.includes(value);
                                const dataValueMatch = radio.getAttribute('data-value') === value;
                                const nextSiblingIncludesMatch = nextSiblingText && value && nextSiblingText.toLowerCase().includes(value.toLowerCase());
                                const labelIncludesMatch = labelText && value && labelText.toLowerCase().includes(value.toLowerCase());
                                
                                // Case-insensitive partial matches
                                const idIncludesCaseInsensitive = value && radio.id && radio.id.toLowerCase().includes(value.toLowerCase());
                                
                                console.log(`[Connectivity Data Manager] Radio ${index} trying to match "${value}" against:`);
                                console.log(`[Connectivity Data Manager]   - radio.id: "${radio.id}" -> exactId: ${exactIdMatch}`);
                                console.log(`[Connectivity Data Manager]   - radio.value: "${radio.value}" (ignored for ID-based matching)`);
                                console.log(`[Connectivity Data Manager]   - matches: exactId: ${exactIdMatch}, idIncludes: ${idIncludesMatch}, dataValue: ${dataValueMatch}, nextSibling: ${nextSiblingIncludesMatch}, label: ${labelIncludesMatch}, idIncludesCI: ${idIncludesCaseInsensitive}`);
                                
                                // Since we save IDs, exact ID match should be sufficient
                                const matches = exactIdMatch || idIncludesMatch || dataValueMatch || 
                                              nextSiblingIncludesMatch || labelIncludesMatch || idIncludesCaseInsensitive;
                                              
                                if (matches) {
                                    console.log(`[Connectivity Data Manager] MATCH FOUND! Setting radio ${index} (${radio.id}) to checked`);
                                    
                                    // For SAP UI5, we need to use multiple approaches
                                    foundMatch = true;
                                    
                                    // UI5-first approach: Try to use the official framework API before falling back to DOM manipulation.
                                    let ui5Success = false;
                                    const radioGroupContainer = radio.closest('[role="radiogroup"]');

                                    if (radioGroupContainer && window.sap && window.sap.ui) {
                                        try {
                                            const ui5Control = window.sap.ui.getCore().byId(radioGroupContainer.id);
                                            
                                            // Check if we have a RadioButtonGroup control
                                            if (ui5Control && typeof ui5Control.setSelectedIndex === 'function') {
                                                const allRadioInputs = Array.from(radioGroupContainer.querySelectorAll('input[type="radio"]'));
                                                const targetIndex = allRadioInputs.findIndex(r => r.id === radio.id);

                                                if (targetIndex !== -1) {
                                                    console.log(`[Connectivity Data Manager] Using UI5 API to set selected index to ${targetIndex} on control ${ui5Control.getId()}`);
                                                    ui5Control.setSelectedIndex(targetIndex);
                                                    // Manually fire the 'select' event which the application listens for to show/hide fields.
                                                    ui5Control.fireSelect({ selectedIndex: targetIndex });
                                                    ui5Success = true;
                                                }
                                            }
                                        } catch (e) {
                                            console.error('[Connectivity Data Manager] Error using UI5 API, will fallback to DOM events.', e);
                                        }
                                    }

                                    // Fallback to DOM events if UI5 API fails or is not available
                                    if (!ui5Success) {
                                        console.log('[Connectivity Data Manager] UI5 API failed or unavailable, falling back to enhanced DOM manipulation.');
                                        
                                        // Try multiple approaches to trigger SAP UI5 recognition
                                        
                                        // Method 1: Click the radio button
                                        radio.click();
                                        console.log(`[Connectivity Data Manager] After click: radio.checked = ${radio.checked}`);
                                        
                                        // Method 2: Try DOM-based approaches since window.sap is undefined
                                        setTimeout(() => {
                                            console.log(`[Connectivity Data Manager] window.sap is ${typeof window.sap}, trying DOM-based approaches...`);
                                            
                                            // Method 2a: Try to find and click the visual label/wrapper
                                            const label = document.querySelector(`label[for="${radio.id}"]`);
                                            if (label) {
                                                console.log(`[Connectivity Data Manager] Found label for radio, clicking it: ${label.textContent.trim()}`);
                                                label.click();
                                            }
                                            
                                            // Method 2b: Try to find the parent container and simulate user interaction
                                            const radioContainer = radio.closest('.sapMRb, .sapMRbBG, [role="radio"]');
                                            if (radioContainer) {
                                                console.log(`[Connectivity Data Manager] Found radio container, clicking it`);
                                                radioContainer.click();
                                            }
                                            
                                            // Method 2c: Trigger multiple DOM events to simulate user interaction
                                            console.log(`[Connectivity Data Manager] Triggering comprehensive DOM events...`);
                                            
                                            // Focus first
                                            radio.focus();
                                            
                                            // Trigger mouse events
                                            radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                            radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                            radio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                            
                                            // Trigger change and input events
                                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                                            radio.dispatchEvent(new Event('input', { bubbles: true }));
                                            
                                            // Try custom SAP events even without window.sap
                                            radio.dispatchEvent(new CustomEvent('sapselect', { bubbles: true, detail: { selected: true } }));
                                            radio.dispatchEvent(new CustomEvent('sapchange', { bubbles: true, detail: { checked: true } }));
                                            
                                            // Blur to complete the interaction
                                            radio.blur();
                                            
                                            console.log(`[Connectivity Data Manager] After comprehensive DOM events: radio.checked = ${radio.checked}`);
                                            
                                        }, 25);
                                    }

                                    // Add multiple checks to verify the radio button was actually set
                                    setTimeout(() => {
                                        console.log(`[Connectivity Data Manager] First check (50ms): radio ${radio.id} checked = ${radio.checked}`);
                                        const credentialField = document.querySelector('input[id*="CredentialName-inner"]');
                                        console.log(`[Connectivity Data Manager] Credential field is now ${credentialField ? 'VISIBLE' : 'NOT VISIBLE'}.`);
                                    }, 50);
                                    
                                    setTimeout(() => {
                                        console.log(`[Connectivity Data Manager] Second check (200ms): radio ${radio.id} checked = ${radio.checked}`);
                                        const credentialField = document.querySelector('input[id*="CredentialName-inner"]');
                                        console.log(`[Connectivity Data Manager] Credential field is now ${credentialField ? 'VISIBLE' : 'NOT VISIBLE'}.`);
                                        
                                        // If still not working, try one more time with direct UI5 manipulation
                                        if (!radio.checked && radioGroupContainer && window.sap && window.sap.ui) {
                                            console.log(`[Connectivity Data Manager] Radio still not checked, trying direct UI5 manipulation again...`);
                                            try {
                                                const ui5Control = window.sap.ui.getCore().byId(radioGroupContainer.id);
                                                if (ui5Control && typeof ui5Control.setSelectedIndex === 'function') {
                                                    const allRadioInputs = Array.from(radioGroupContainer.querySelectorAll('input[type="radio"]'));
                                                    const targetIndex = allRadioInputs.findIndex(r => r.id === radio.id);
                                                    if (targetIndex !== -1) {
                                                        ui5Control.setSelectedIndex(targetIndex);
                                                        ui5Control.fireSelect({ selectedIndex: targetIndex });
                                                        console.log(`[Connectivity Data Manager] Second attempt: set index ${targetIndex}`);
                                                    }
                                                }
                                            } catch (e) {
                                                console.error('[Connectivity Data Manager] Second UI5 attempt failed:', e);
                                            }
                                        }
                                    }, 200);
                                    
                                    setTimeout(() => {
                                        console.log(`[Connectivity Data Manager] Final check (500ms): radio ${radio.id} checked = ${radio.checked}`);
                                        const credentialField = document.querySelector('input[id*="CredentialName-inner"]');
                                        console.log(`[Connectivity Data Manager] Final: Credential field is ${credentialField ? 'VISIBLE' : 'NOT VISIBLE'}.`);
                                    }, 500);
                                }
                            });
                            
                            if (!foundMatch) {
                                console.log(`[Connectivity Data Manager] WARNING: No radio button match found for ${fieldName} with value: ${value}`);
                            }
                        } else if (element.type === 'checkbox') {
                            element.checked = value;
                        } else if (element.tagName === 'SELECT') {
                            element.value = value;
                        } else if (element.id && element.id.includes('hiddenInput')) {
                            // This is likely a SAP UI5 ComboBox/Select hidden input
                            console.log(`[Connectivity Data Manager] Phase 1: Detected SAP UI5 ComboBox hidden input for ${fieldName}: ${element.id}`);
                            // Set ComboBox value with await to ensure it completes before Phase 2
                            await this.setSAPComboBoxValueAsync(element, value, fieldName);
                        } else {
                            element.value = value;
                        }
                        
                        // Trigger change events to update UI and conditional fields
                        if (element.type !== 'radio' && !(element.id && element.id.includes('hiddenInput'))) {
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        
                        populatedCount++;
                        console.log(`[Connectivity Data Manager] Phase 1: Populated ${fieldName} with:`, value);
                    } catch (error) {
                        console.log(`[Connectivity Data Manager] Phase 1: Error populating ${fieldName}:`, error);
                    }
                } else if (value !== null && value !== undefined) {
                    console.log(`[Connectivity Data Manager] WARNING: No element found for field ${fieldName} with value:`, value);
                }
            }
            
            console.log(`[Connectivity Data Manager] Phase 1: Populated ${populatedCount} primary fields`);
            
            // Wait for conditional fields to appear (longer delay for ComboBox processing)
            await new Promise(resolve => setTimeout(resolve, 800));
        },

        // Phase 2: Populate conditional fields after DOM updates
        populateFormPhase2: async function(profileData) {
            const elements = this.findFormElements(); // Re-scan DOM for new conditional fields
            const primaryFields = ['host', 'port', 'authenticationMethod', 'authenticationType', 'connectionType'];
            let populatedCount = 0;
            
            console.log('[Connectivity Data Manager] Phase 2: Populating conditional fields...');
            
            // Populate all remaining fields (excluding primary fields already handled)
            for (const [fieldName, value] of Object.entries(profileData.fields)) {
                if (primaryFields.includes(fieldName)) {
                    continue; // Skip primary fields already handled in Phase 1
                }
                
                const element = elements[fieldName];
                if (element && value !== null && value !== undefined) {
                    try {
                        if (element.type === 'checkbox') {
                            element.checked = value;
                        } else if (element.tagName === 'SELECT') {
                            element.value = value;
                        } else if (element.id && element.id.includes('hiddenInput')) {
                            // This is likely a SAP UI5 ComboBox/Select hidden input
                            console.log(`[Connectivity Data Manager] Phase 2: Detected SAP UI5 ComboBox hidden input for ${fieldName}: ${element.id}`);
                            this.setSAPComboBoxValue(element, value, fieldName);
                            continue; // Skip manual event triggering for ComboBox
                        } else {
                            element.value = value;
                        }
                        
                        // Trigger change event to update UI (skip for ComboBox as it handles its own events)
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        populatedCount++;
                        console.log(`[Connectivity Data Manager] Phase 2: Populated ${fieldName} with:`, value);
                    } catch (error) {
                        console.log(`[Connectivity Data Manager] Phase 2: Error populating ${fieldName}:`, error);
                    }
                }
            }
            
            console.log(`[Connectivity Data Manager] Phase 2: Populated ${populatedCount} conditional fields`);
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