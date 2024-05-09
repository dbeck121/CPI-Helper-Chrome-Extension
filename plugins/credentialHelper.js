var plugin = {
    metadataVersion: "1.0.0",
    id: "credentialHelper",
    name: "Credential Helper",
    version: "0.0.1",
    author: "Gregor Schütz, AGILITA AG",
    website: "https://www.agilita.ch/",
    email: "gregor.schuetz@agilita.ch",
    description: "<br><br><b>BETA</b></br>Provides a search help for existing credential names and key aliases <br><br><b>Supported Adapters are:</b></br> AMQP, Ariba, AS2, AS4, Elster, Facebook, FTP, OData, HTTP, IDOC, JDBC, Kafka, LDAP, Mail, MDI, ODC, SFTP, SOAP, SuccessFactors, Twitter, XI</br>",
    settings: {
        "icon": { "type": "icon", "src": "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarContent: {
        "static": true,
        "onRender": async (pluginHelper) => {
            //prepare array to be filled
            var securityMaterialList;

            //function to handle input typing and show matching suggestions as divs
            function handleTyping(event) {
                //find matching security materials and certificates based on user input
                var matchingAliases = securityMaterialList.filter(sm =>
                    sm.toLowerCase().includes(event.target.value.toLowerCase())
                );

                //indicate that there is no matching alias
                var hasMatches = true;
                if(matchingAliases.length == 0){
                    matchingAliases.push("No matching alias found");
                    hasMatches = false;
                }
        
                //remove any existing dropdown to avoid duplicates
                let existingDropdown = document.querySelector('.credentialHelperDropdown');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
        
                //create a new dropdown container
                const dropdown = document.createElement('div');
                dropdown.classList.add('credentialHelperDropdown');
        
                //style the dropdown appropriately
                dropdown.style.position = 'absolute';
                dropdown.style.backgroundColor = '#f9f9f9';
                dropdown.style.border = '1px solid #ccc';
                dropdown.style.boxShadow = '0px 8px 16px 0px rgba(0,0,0,0.2)';
                dropdown.style.zIndex = '1000'; //making sure it is not overlapped by other elements
                dropdown.style.width = event.target.offsetWidth + 'px';
                dropdown.style.maxHeight = '200px'; // Adjust this value according to your needs
                dropdown.style.overflowY = 'auto';
        
                //position the dropdown directly below the input field relative to the viewport
                const inputRect = event.target.getBoundingClientRect();
                dropdown.style.top = inputRect.bottom + window.scrollY + 'px';
                dropdown.style.left = inputRect.left + window.scrollX + 'px';
        
                //populate the dropdown with matching items as selectable divs
                matchingAliases.forEach(option => {
                    const item = document.createElement('div');
                    item.classList.add('credentialHelperDropdown-item');
                    item.textContent = option;
                    item.style.padding = '8px 12px';
                    item.style.borderBottom = '1px solid #eee';
                    
                    if(hasMatches == true){
                        //change cursor
                        item.style.cursor = 'pointer';

                        //highlight the item on hover
                        item.addEventListener('mouseover', () => {
                            item.style.backgroundColor = '#f1f1f1';
                        });
            
                        //remove the highlight when not hovered over
                        item.addEventListener('mouseout', () => {
                            item.style.backgroundColor = '';
                        });
            
                        //set the input field value to the selected option on click
                        item.addEventListener('click', () => {
                            event.target.value = option;
                            dropdown.remove(); //close the dropdown after selection
                        });
                    }
                    
                    dropdown.appendChild(item);
                });
        
                //append the dropdown to the body to ensure it is absolutely positioned
                document.body.appendChild(dropdown);
                dropdown.style.display = 'block';
            }
            
            document.addEventListener('click', async function (event) {
                //check if a credential name or private key alias input was clicked
                //the ids of the input fields vary from adapter to adapter
                //if the ids are changed or new adapters were added we need to adjust/expand this check with the new ids
                //these ids were checked for both Neo and CF environments for the following adapters... (07. May 2024)
                //AMQP, Ariba, AS2, AS4, Elster, Facebook, FTP, OData, HTTP, IDOC, JDBC, Kafka, LDAP, Mail, MDI, ODC, SFTP, SOAP, SuccessFactors, Twitter, XI
                if (event.target.tagName === 'INPUT' && event.target.id.includes('input') && 
                    (event.target.id.includes('credentialName') ||
                    event.target.id.includes('ldapCredentialName') ||
                    event.target.id.includes('alias') ||
                    event.target.id.includes('user') ||
                    event.target.id.includes('samlAlias') ||
                    event.target.id.includes('authPrivateKeyAlias') ||
                    event.target.id.includes('credential_name') ||
                    event.target.id.includes('encryptionKeyExpression') ||
                    event.target.id.includes('signatureKeyExpression') ||
                    event.target.id.includes('oAuthAppId') ||
                    event.target.id.includes('oAuthAppSecret') ||
                    event.target.id.includes('oAuthAccessToken') ||
                    event.target.id.includes('tokenCredential') ||
                    event.target.id.includes('consumerKey') ||
                    event.target.id.includes('consumerSecret') ||
                    event.target.id.includes('accessToken') ||
                    event.target.id.includes('accessTokenSecret') ||
                    event.target.id.includes('BasicAuthCredentialName') ||
                    event.target.id.includes('ClientCertificateAlias') ||
                    event.target.id.includes('odataCertAuthPrivateKeyAlias') ||
                    event.target.id.includes('mdiCredentialName') ||
                    event.target.id.includes('privateKeyAlias'))) {
                    
                    //get Security Material and Key Store entries
                    //$format is ignored in both requests, so we need to set accept in order to get a json response
                    var urlForKeyStoreEntries = `/${pluginHelper.urlExtension}odata/api/v1/KeystoreEntries`;
                    var keyStoreEntries = JSON.parse(await makeCallPromise("GET", urlForKeyStoreEntries, false, "application/json")).d.results.map(ks => ks.Alias);
                    var urlForSecurityMaterialList = `/${pluginHelper.urlExtension}odata/api/v1/UserCredentials`;
                    securityMaterialList = JSON.parse(await makeCallPromise("GET", urlForSecurityMaterialList, false, "application/json")).d.results.map(sm => sm.Name);

                    //add key store entries to the security material list
                    for (let i = 0; i < keyStoreEntries.length; i++) {
                        securityMaterialList.push(keyStoreEntries[i]);
                    }

                    //add an event listener to the credential name input field for typing
                    event.target.addEventListener('input', handleTyping);
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