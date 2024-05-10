var plugin = {
    metadataVersion: "1.0.0",
    id: "credentialHelper",
    name: "Credential Helper",
    version: "1.0.0",
    author: "Gregor Schütz, AGILITA AG",
    website: "https://www.agilita.ch/",
    email: "gregor.schuetz@agilita.ch",
    description: "Provides a search help for existing credential names and key aliases <br><br><b>Supported Adapters are:</b></br> AMQP, Ariba, AS2, AS4, Elster, Facebook, FTP, OData, HTTP, IDOC, JDBC, Kafka, LDAP, Mail, MDI, ODC, SFTP, SOAP, SuccessFactors, Twitter, XI</br>",
    settings: {
        "icon": { "type": "icon", "src": "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": (pluginHelper) => {
            //prepare array to be filled
            var securityMaterialList;

            //the ids of the input fields vary from adapter to adapter
            //if the ids are changed or new adapters were added we need to adjust/expand this array with the new or changed ids
            //these ids were checked for both Neo and CF environments for the following adapters... (7. May 2024)
            //AMQP, Ariba, AS2, AS4, Elster, Facebook, FTP, OData, HTTP, IDOC, JDBC, Kafka, LDAP, Mail, MDI, ODC, SFTP, SOAP, SuccessFactors, Twitter, XI
            const patterns = [
                'credentialName',
                'ldapCredentialName',
                'alias',
                'user',
                'samlAlias',
                'authPrivateKeyAlias',
                'credential_name',
                'encryptionKeyExpression',
                'signatureKeyExpression',
                'oAuthAppId',
                'oAuthAppSecret',
                'oAuthAccessToken',
                'tokenCredential',
                'consumerKey',
                'consumerSecret',
                'accessToken',
                'accessTokenSecret',
                'BasicAuthCredentialName',
                'ClientCertificateAlias',
                'odataCertAuthPrivateKeyAlias',
                'mdiCredentialName',
                'privateKeyAlias'
            ];
            
            //function to handle input typing and show matching suggestions as divs
            function handleTyping(event) {
                //find matching security materials and certificates based on user input
                var matchingAliases = securityMaterialList.filter(sm =>
                    sm.toLowerCase().includes(event.target.value.toLowerCase())
                );

                //indicate that there is no matching alias
                var hasMatches = true;
                if(matchingAliases.length == 0 && event.target.value != ""){
                    matchingAliases.push("No matching alias found");
                    hasMatches = false;
                }else if(matchingAliases.length == 0){
                    matchingAliases = securityMaterialList;
                }
        
                //remove any existing dropdown to avoid duplicates
                let existingDropdown = document.querySelector('.credentialHelperDropdown');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
        
                //create a new dropdown container
                const dropdown = document.createElement('div');
                dropdown.classList.add('credentialHelperDropdown');
        
                //style the dropdown
                dropdown.style.position = 'absolute';
                dropdown.style.backgroundColor = '#f9f9f9';
                dropdown.style.border = '1px solid #ccc';
                dropdown.style.boxShadow = '0px 8px 16px 0px rgba(0,0,0,0.2)';
                dropdown.style.zIndex = '1000';
                dropdown.style.width = event.target.parentElement.parentElement.parentElement.offsetWidth + 'px';
                dropdown.style.maxHeight = '200px';
                dropdown.style.overflowY = 'auto';
                dropdown.style.display = 'flex';
                dropdown.style.flexDirection = 'column-reverse'; // Reverses the order of items

                //get the input field's position relative to the viewport
                const inputRect = event.target.parentElement.parentElement.parentElement.getBoundingClientRect();
                const spaceBelow = window.innerHeight - inputRect.bottom;
                const dropdownMaxHeight = parseInt(dropdown.style.maxHeight.replace('px', ''), 10);
                const dropdownHeight = Math.min(dropdownMaxHeight, matchingAliases.length * 40); // Estimate each item height

                //determine if the dropdown should be placed above or below
                if (spaceBelow < dropdownHeight && inputRect.top > dropdownHeight) {
                    //place dropdown above the input field
                    dropdown.style.top = inputRect.top + window.scrollY - dropdownHeight + 'px';
                } else {
                    //place dropdown below the input field
                    dropdown.style.top = inputRect.bottom + window.scrollY + 'px';
                }
                dropdown.style.left = inputRect.left + window.scrollX + 'px';
        
                //populate the dropdown with matching items as selectable divs
                matchingAliases.forEach(option => {
                    const item = document.createElement('div');
                    item.textContent = option;
                    item.style.padding = '8px 12px';
                    item.style.borderBottom = '1px solid #eee';
                    item.dataset.originInput = event.target.id;
                    
                    if(hasMatches == true){
                        item.style.cursor = 'pointer';
                        item.classList.add('credentialHelperDropdown-item');

                        //set the input field value to the selected option on click
                        item.addEventListener('click', () => {
                            //we need to reselect the input field because SAP changes the id or recreates the input field for some reason
                            const matchedPattern = patterns.find(pattern => item.dataset.originInput.includes(pattern));
                            const selector = patterns.map(pattern => `input[id*="__input_"][id*="${matchedPattern}"]`).join(', ');
                            var inputField = document.querySelector(selector);
                            inputField.value = option;
                            dropdown.remove();
                            inputField.focus(); 
                        });
                    }
                    
                    dropdown.appendChild(item);
                });
        
                //append the dropdown to the body to ensure it is absolutely positioned
                document.body.appendChild(dropdown);
                dropdown.style.display = 'block';

                //add a scroll event listener to close the dropdown if scrolling is happening except for the dropdown
                function closeOnExternalScroll(event) {
                    if (!dropdown.contains(event.target)) {
                        dropdown.remove();
                        document.removeEventListener('scroll', closeOnExternalScroll, true);
                    }
                }

                //capture scroll events on any scrollable element
                document.addEventListener('scroll', closeOnExternalScroll, true);
            }
            
            document.addEventListener('click', async function (event) {
                //check if a credential name or private key alias input was clicked and is not in readonly mode
                if (event.target?.attributes?.readonly?.textContent != 'readonly' && event.target.tagName === 'INPUT' && event.target.id.includes('__input_') && patterns.some(pattern => event.target.id.includes(pattern))) {
                    //get Security Material and Key Store entries
                    //$format is ignored in both requests, so we need to set accept in order to get a json response
                    var urlForKeyStoreEntries = `/${pluginHelper.urlExtension}odata/api/v1/KeystoreEntries`;
                    var keyStoreEntries = JSON.parse(await makeCallPromise("GET", urlForKeyStoreEntries, false, "application/json")).d.results.map(ks => ks.Alias);
                    var urlForSecurityMaterialList = `/${pluginHelper.urlExtension}Operations/com.sap.it.km.api.commands.SecurityMaterialsListCommand`;
                    securityMaterialList = JSON.parse(await makeCallPromise("GET", urlForSecurityMaterialList, false, "application/json")).artifactInformations.map(sm => sm.name);

                    //add key store entries to the security material list
                    for (let i = 0; i < keyStoreEntries.length; i++) {
                        securityMaterialList.push(keyStoreEntries[i]);
                    }

                    //add an event listener to the credential name input field for typing
                    event.target.addEventListener('input', handleTyping);

                    //display on click
                    handleTyping(event);
                }
            });

            document.addEventListener('click', function(event) {
                //if the click is not on the dropdown or input field, remove the dropdown
                const isDropdownItem = event.target.classList.contains('credentialHelperDropdown-item');
                const isInputField = event.target.tagName === 'INPUT' && event.target.id.includes('input') && event.target.id.includes('credentialName');
        
                if (!isDropdownItem && !isInputField) {
                    const existingDropdowns = document.querySelectorAll('.credentialHelperDropdown');
                    existingDropdowns.forEach(dropdown => dropdown.remove());
                }
            });
        }
    }
};

pluginList.push(plugin);