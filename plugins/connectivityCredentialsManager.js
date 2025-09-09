var plugin = {
    metadataVersion: "1.0.0",
    id: "connectivityCredentialsManager", 
    name: "Connectivity Credentials Manager",
    version: "1.0.0",
    author: "CLAIMATE Tech team",
    email: "info@claimate.tech",
    website: "https://github.com/claimate/CPI-Helper-Chrome-Extension",
    description: "Saves and manages credentials for SAP Cloud Integration connectivity tests. Auto-fills forms and eliminates repetitive data entry.",

    settings: {
        enableAutoSave: { text: "Auto-save on form fill", type: "checkbox", scope: "browser" },
        maxProfiles: { text: "Max stored profiles", type: "textinput", scope: "browser" },
        info: { text: "Securely stores connectivity test credentials locally in your browser", type: "label" }
    },

    // Check if we're on the connectivity test page
    isConnectivityPage: function() {
        return window.location.href.includes('/shell/monitoring/Connectivity');
    },

    // Get current active tab type (TLS, SSH, FTP, etc.)
    getCurrentTabType: function() {
        const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
        return activeTab ? activeTab.textContent.trim() : 'UNKNOWN';
    },

    // Extract all form data from current tab
    extractFormData: function() {
        const tabType = this.getCurrentTabType();
        const formData = { type: tabType, fields: {} };
        
        // Find all visible input fields in current tab
        const inputs = document.querySelectorAll('input:not([style*="display: none"]), select:not([style*="display: none"])');
        
        inputs.forEach(input => {
            if (input.offsetParent !== null && input.value) {
                // Create meaningful field name
                const fieldName = this.getFieldName(input);
                formData.fields[fieldName] = {
                    id: input.id,
                    type: input.type,
                    value: input.value
                };
            }
        });
        
        return formData;
    },

    // Generate readable field name from input element
    getFieldName: function(input) {
        // Try to find label
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label && label.textContent.trim()) {
            return label.textContent.trim();
        }
        
        // Fallback to placeholder or ID
        if (input.placeholder) return input.placeholder;
        if (input.id) return input.id.replace(/-inner$/, '').replace(/^inp/, '').replace(/([A-Z])/g, ' $1').trim();
        
        return `Field_${input.type}`;
    },

    // Fill form with saved data
    fillForm: function(profileData) {
        if (!profileData.fields) return false;
        
        let filled = 0;
        Object.keys(profileData.fields).forEach(fieldName => {
            const fieldData = profileData.fields[fieldName];
            const input = document.getElementById(fieldData.id);
            
            if (input && input.offsetParent !== null) {
                input.value = fieldData.value;
                // Trigger change event for SAP UI5 fields
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
            }
        });
        
        return filled > 0;
    },

    // Storage operations using Chrome storage API
    storage: {
        key: 'cpiConnectivityProfiles',
        
        async getAll() {
            return new Promise(resolve => {
                chrome.storage.local.get([this.key], result => {
                    resolve(result[this.key] || []);
                });
            });
        },
        
        async save(profileName, data) {
            const profiles = await this.getAll();
            const existingIndex = profiles.findIndex(p => p.name === profileName);
            
            const profile = {
                name: profileName,
                type: data.type,
                data: data,
                created: existingIndex === -1 ? new Date().toISOString() : profiles[existingIndex].created,
                updated: new Date().toISOString()
            };
            
            if (existingIndex !== -1) {
                profiles[existingIndex] = profile;
            } else {
                profiles.push(profile);
            }
            
            return new Promise(resolve => {
                chrome.storage.local.set({ [this.key]: profiles }, () => {
                    resolve(true);
                });
            });
        },
        
        async delete(profileName) {
            const profiles = await this.getAll();
            const filtered = profiles.filter(p => p.name !== profileName);
            
            return new Promise(resolve => {
                chrome.storage.local.set({ [this.key]: filtered }, () => {
                    resolve(true);
                });
            });
        }
    },

    // Create UI controls in page header
    createUI: function() {
        const header = document.querySelector('#PageConnectivity > header.sapMPageHeader');
        if (!header) return false;

        // Find or create right area in header bar
        let rightArea = header.querySelector('.sapMBarRight');
        if (!rightArea) {
            const barMiddle = header.querySelector('.sapMBarMiddle');
            if (barMiddle) {
                rightArea = document.createElement('div');
                rightArea.className = 'sapMBarRight sapMBarContainer';
                barMiddle.parentNode.appendChild(rightArea);
            }
        }

        if (!rightArea) return false;

        // Remove existing controls
        const existing = rightArea.querySelector('#cpiConnectivityControls');
        if (existing) existing.remove();

        // Create container for our controls
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'cpiConnectivityControls';
        controlsContainer.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-right: 10px;';
        
        // Save button
        const saveBtn = this.createButton('💾 Save', 'Save current form as profile', () => this.showSaveDialog());
        
        // Load dropdown
        const loadContainer = document.createElement('div');
        loadContainer.style.position = 'relative';
        
        const loadBtn = this.createButton('📂 Load', 'Load saved profile', () => this.showLoadDialog());
        loadContainer.appendChild(loadBtn);
        
        // Manage button  
        const manageBtn = this.createButton('⚙️ Manage', 'Manage saved profiles', () => this.showManageDialog());
        
        controlsContainer.appendChild(saveBtn);
        controlsContainer.appendChild(loadContainer);
        controlsContainer.appendChild(manageBtn);
        
        rightArea.appendChild(controlsContainer);
        return true;
    },

    // Create SAP-styled button
    createButton: function(text, title, onClick) {
        const button = document.createElement('button');
        button.className = 'sapMBtn sapMBtnDefault sapMBtnBase';
        button.innerHTML = `<span class="sapMBtnContent">${text}</span>`;
        button.title = title;
        button.style.cssText = 'height: 2rem; padding: 0 0.75rem; font-size: 0.75rem;';
        button.addEventListener('click', onClick);
        return button;
    },

    // Show save profile dialog
    showSaveDialog: function() {
        const formData = this.extractFormData();
        const fieldCount = Object.keys(formData.fields).length;
        
        if (fieldCount === 0) {
            this.showNotification('❌ No form data to save', 'Fill out some fields first.');
            return;
        }

        const html = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <h3>💾 Save Connectivity Profile</h3>
                <div style="background: #f3f3f3; padding: 15px; border-radius: 4px; margin: 15px 0;">
                    <strong>Connection Type:</strong> ${formData.type}<br>
                    <strong>Fields to save:</strong> ${fieldCount} fields
                </div>
                <div style="margin: 15px 0;">
                    <label for="profileName" style="display: block; margin-bottom: 5px; font-weight: bold;">Profile Name:</label>
                    <input type="text" id="profileName" placeholder="e.g., Production SFTP Server" 
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button id="cancelSave" style="padding: 8px 16px; margin-right: 10px; background: #f8f9fa; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="confirmSave" style="padding: 8px 16px; background: #0070d2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Save Profile
                    </button>
                </div>
            </div>
        `;
        
        cpiData.functions.popup(createElementFromHTML(html), 'Save Profile');
        
        // Add event listeners
        setTimeout(() => {
            document.getElementById('profileName').focus();
            
            document.getElementById('cancelSave').addEventListener('click', () => {
                $("#cpiHelper_semanticui_modal").modal("hide");
            });
            
            document.getElementById('confirmSave').addEventListener('click', async () => {
                const name = document.getElementById('profileName').value.trim();
                if (!name) {
                    alert('Please enter a profile name');
                    return;
                }
                
                await this.storage.save(name, formData);
                this.showNotification('✅ Profile saved', `"${name}" saved successfully`);
                $("#cpiHelper_semanticui_modal").modal("hide");
            });
        }, 100);
    },

    // Show load profiles dialog
    showLoadDialog: async function() {
        const profiles = await this.storage.getAll();
        const currentTabType = this.getCurrentTabType();
        
        if (profiles.length === 0) {
            this.showNotification('📂 No profiles found', 'Save a profile first to load it later.');
            return;
        }

        const matchingProfiles = profiles.filter(p => p.type === currentTabType);
        const otherProfiles = profiles.filter(p => p.type !== currentTabType);
        
        let html = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <h3>📂 Load Profile</h3>
                <p>Current tab: <strong>${currentTabType}</strong></p>
        `;
        
        if (matchingProfiles.length > 0) {
            html += `<h4 style="color: #0070d2; margin: 15px 0 10px 0;">Matching Profiles (${matchingProfiles.length})</h4>`;
            matchingProfiles.forEach(profile => {
                html += `
                    <div style="background: #e8f5e8; padding: 10px; margin: 5px 0; border-radius: 4px; cursor: pointer;" 
                         onclick="window.connectivityPlugin.loadProfile('${profile.name}')">
                        <strong>${profile.name}</strong> (${profile.type})
                        <div style="font-size: 0.8em; color: #666;">Updated: ${new Date(profile.updated).toLocaleDateString()}</div>
                    </div>
                `;
            });
        }
        
        if (otherProfiles.length > 0) {
            html += `<h4 style="color: #666; margin: 15px 0 10px 0;">Other Profiles (${otherProfiles.length})</h4>`;
            otherProfiles.forEach(profile => {
                html += `
                    <div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; cursor: pointer;" 
                         onclick="window.connectivityPlugin.loadProfile('${profile.name}')">
                        <strong>${profile.name}</strong> (${profile.type})
                        <div style="font-size: 0.8em; color: #666;">Updated: ${new Date(profile.updated).toLocaleDateString()}</div>
                    </div>
                `;
            });
        }
        
        html += `
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="$('#cpiHelper_semanticui_modal').modal('hide')" 
                            style="padding: 8px 16px; background: #f8f9fa; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        cpiData.functions.popup(createElementFromHTML(html), 'Load Profile');
        
        // Make plugin available globally for click handlers
        window.connectivityPlugin = this;
    },

    // Load specific profile
    loadProfile: async function(profileName) {
        const profiles = await this.storage.getAll();
        const profile = profiles.find(p => p.name === profileName);
        
        if (!profile) {
            this.showNotification('❌ Profile not found', `Profile "${profileName}" no longer exists.`);
            return;
        }
        
        const success = this.fillForm(profile.data);
        if (success) {
            this.showNotification('✅ Profile loaded', `"${profileName}" loaded successfully`);
        } else {
            this.showNotification('⚠️ Partial load', 'Some fields could not be filled');
        }
        
        $("#cpiHelper_semanticui_modal").modal("hide");
    },

    // Show manage profiles dialog
    showManageDialog: async function() {
        const profiles = await this.storage.getAll();
        
        if (profiles.length === 0) {
            this.showNotification('⚙️ No profiles to manage', 'Save some profiles first.');
            return;
        }

        let html = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <h3>⚙️ Manage Profiles</h3>
                <p>${profiles.length} saved profile${profiles.length !== 1 ? 's' : ''}</p>
        `;
        
        profiles.forEach(profile => {
            html += `
                <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 4px; border: 1px solid #e9ecef;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${profile.name}</strong> (${profile.type})
                            <div style="font-size: 0.8em; color: #666;">
                                Created: ${new Date(profile.created).toLocaleDateString()} | 
                                Updated: ${new Date(profile.updated).toLocaleDateString()}
                            </div>
                        </div>
                        <button onclick="window.connectivityPlugin.deleteProfile('${profile.name}')" 
                                style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="$('#cpiHelper_semanticui_modal').modal('hide')" 
                            style="padding: 8px 16px; background: #f8f9fa; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        cpiData.functions.popup(createElementFromHTML(html), 'Manage Profiles');
        window.connectivityPlugin = this;
    },

    // Delete profile
    deleteProfile: async function(profileName) {
        if (confirm(`Delete profile "${profileName}"?`)) {
            await this.storage.delete(profileName);
            this.showNotification('✅ Profile deleted', `"${profileName}" removed`);
            $("#cpiHelper_semanticui_modal").modal("hide");
        }
    },

    // Show notification
    showNotification: function(title, message) {
        // Simple notification using browser notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message, icon: '/images/v4/48.png' });
        } else {
            // Fallback to console
            console.log(`[Connectivity Manager] ${title}: ${message}`);
        }
    },

    // Initialize plugin on connectivity pages
    init: function() {
        if (this.isConnectivityPage()) {
            // Wait for page to be ready
            setTimeout(() => {
                this.createUI();
            }, 2000);
            
            // Re-add UI if page changes (SPA navigation)
            const checkAndReinit = () => {
                if (this.isConnectivityPage() && !document.querySelector('#cpiConnectivityControls')) {
                    this.createUI();
                }
            };
            
            setInterval(checkAndReinit, 3000);
        }
    },

    // Plugin hook methods for CPI Helper integration
    messageSidebarButton: {
        icon: { text: "🔗", type: "text" },
        title: "Connectivity Credentials Manager",
        onClick: (cpiData, settings, runInfo, active) => {
            const html = `
                <div style="padding: 20px;">
                    <h3>🔗 Connectivity Credentials Manager</h3>
                    <p><strong>Status:</strong> ${plugin.isConnectivityPage() ? '✅ Active on Connectivity page' : '❌ Navigate to Connectivity Test page'}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0;">
                        <h4>How to use:</h4>
                        <ol>
                            <li>Go to <strong>Monitoring → Connectivity Test</strong></li>
                            <li>Fill out connection parameters</li> 
                            <li>Click <strong>💾 Save</strong> to store the profile</li>
                            <li>Use <strong>📂 Load</strong> to reuse saved credentials</li>
                        </ol>
                    </div>
                </div>
            `;
            cpiData.functions.popup(createElementFromHTML(html), 'Connectivity Manager');
        },
        condition: (cpiData, settings, runInfo) => true
    }
};

// Auto-initialize plugin
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => plugin.init());
} else {
    plugin.init();
}

// Register with CPI Helper
pluginList.push(plugin);