var plugin = {
    metadataVersion: "1.0.0",
    id: "simple_reference",
    name: "Simple Reference (Beta)",
    version: "0.1.0",
    author: "Kangoolutions",
    email: "cpihelper@kangoolutions.com",
    website: "https://kangoolutions.com",
    description: "Adds an button to the message sidebar to open a reference guide.",
    settings: {
        
    },

    messageSidebarContent: {
        "onRender": (pluginHelper, settings) => {
            var button = document.createElement("button");
            button.innerText = "Open Reference";
            button.addEventListener("click", async () => {
                console.log("helper plugin clicked");
                


  var textElement = `
  <div>
       
        <div class="ui segment">
            <div class="ui top attached tabular menu">
                <a class="item active" data-tab="one">Headers and Properties</a>
                <a class="item" data-tab="two">Camel's Simple Expressions</a>
                <a class="item" data-tab="three">Groovy</a>
                <a class="item" data-tab="four">Links</a>
            </div>
            <div class="ui bottom attached tab segment active" data-tab="one">
                        <table class="ui celled striped table">
                        <thead>
                        <tr><th colspan="3">
                            Headers
                        </th>
                        </tr></thead>
                        <tbody>
                        <tr>
                            <td class="collapsing">
                            SAP_ApplicationID
                            </td>
                            <td>A custom id that can be set in content modifier to find the IFlow in monitoring</td>
                           
                        </tr>
                        <tr>
                            <td>
                            SAP_MessageType
                            </td>
                            <td>A custom message type that you can set</td>
                            
                        </tr>
                        <tr>
                            <td>
                            SAP_Sender
                            </td>
                            <td>IFlow Sender if set. Can be overwritten but needs SAP_ReceiverOverwrite property to be "True"</td>
                           
                        </tr>
                        <tr>
                            <td>
                            SAP_Receiver
                            </td>
                            <td>IFlow Receiver if set. Can be overwritten but needs SAP_ReceiverOverwrite property to be "True"</td>
                            
                        </tr>
                        </tbody>
                    </table>
                    <table class="ui celled striped table">
                    <thead>
                    <tr><th colspan="3">
                        Properties
                    </th>
                    </tr></thead>
                    <tbody>
                    <tr>
                        <td class="collapsing">
                        SAP_MessageProcessingLogID
                        </td>
                        <td>(read only) The message id for this specific message</td>
                       
                    </tr>
                    <tr>
                        <td>
                        SAP_ReceiverOverwrite
                        </td>
                        <td>Set "True" if you want to write SAP_Sender or SAP_Receiver header</td>
                        
                    </tr>
               
                    </tbody>
                </table>
               
                </div>
                <div class="ui bottom attached tab segment" data-tab="two">
                <table class="ui celled striped table">
                <thead>
                <tr><th colspan="3">
                    Camel's Simple Expressions
                </th>
                </tr></thead>
                <tbody>
                <tr>
                    <td class="collapsing">
                    \${property.myproperty}
                    </td>
                    <td>Get property value</td>
                   
                </tr>
                <tr>
                    <td>
                    \${header.myproperty}
                    </td>
                    <td>Get header value</td>
                    
                </tr>
                <tr>
                    <td>
                    \${date:now:yyyy-MM-dd'T'HH:mm:ss}
                    </td>
                    <td>Get date. Check <a href="https://docs.oracle.com/javase/8/docs/api/java/text/SimpleDateFormat.html">Reference</a> for formatting.</td>
                   
                </tr>
                <tr>
                    <td>
                    \${date-with-timezone:now:Europe/Berlin:dd-MM-yyyy HH:mm}
                    </td>
                    <td>Check Timezones <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones">here</a> (TZ database name). You can also apply <a href="https://docs.oracle.com/javase/9/docs/api/java/time/ZoneId.html">zone ids</a></td>
        
                </tr>
               
                <td>
                \${property.MyStringProperty.substring(0,4)}
                </td>
                <td>You can apply some functions like substring(), toUpperCase() or toLowerCase()</td>
            
            </tr>
            </tr>
            <td>
            \${exception.message}
            </td>
            <td>Gets exception message as string</td>
        
        </tr>
                </tbody>
            </table>
                </div>
                    <div class="ui bottom attached tab segment" data-tab="three">
                    <div class="ui segment">
                    A comprehensive list of Groovy Scripts can be found on following Notion page.
                    <a href="https://kangoolutions.notion.site/Groovy-bf09f39f392c41dd8ae87350032fb60a" target="_blanc">Kangoolutions Groovy Script Collection</a>
                    </diV>
                </div>
                <div class="ui bottom attached tab segment" data-tab="four">
                <div class="ui segment">
                <h3 class="ui header">Official SAP Help Links</h3>
                
                    <p>Official SAP Help <a href="https://help.sap.com/docs/CLOUD_INTEGRATION" target="_blanc">Link</a></p>
                    <p>List of Framework Headers and Properties <a href="https://help.sap.com/docs/CLOUD_INTEGRATION/368c481cd6954bdfa5d0435479fd4eaf/d0fcb0988f034e889f611c6e36d43ad5.html?locale=en-US "target="_blanc">SAP Help</a></p>
                    <p>Link to Groovy API and more <a href="https://help.sap.com/docs/CLOUD_INTEGRATION/368c481cd6954bdfa5d0435479fd4eaf/c5c7933b77ba46dbaa9a2c1576dbb381.html?locale=en-US" target="_blanc">here</a></p>   
                    </div>
                </div>
          
        
        </div>
        </div>
    `;



        x = createElementFromHTML(textElement)
            pluginHelper.functions.popup(x, "Reference", { fullscreen: false, callback: async () => {
                $('.tabular.menu .item').tab();
               
                            }});

})
            
            return button;
        }
    }

}

pluginList.push(plugin);