const markdownContent = `# General

## API Description

[Message API Documentation](https://help.sap.com/doc/a56f52e1a58e4e2bac7f7adbf45b2e26/Cloud/en-US/index.html)

[General Documentation](https://help.sap.com/doc/471310fc71c94c2d913884e2ff1b4039/Cloud/en-US/index.html)

## Groovy Scripts

### Get Body, Headers, and Properties
\`\`\`//groovy

// Always access the message body with a Reader (even in the case when you are not using XmlSlurper for further XML parsing).
def body = message.getBody(java.io.Reader)

// Access headers and properties
message.getProperties().get("property_name")
message.getHeaders().get("header_name")
\`\`\`

### Add Custom Header Properties
\`\`\`//groovy
import com.sap.gateway.ip.core.customdev.util.Message;

def Message processData(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message);
    messageLog.addCustomHeaderProperty("IDOCNUM", "123");
    return message;
}

// Nice and generic script to add all properties and headers that start with CH_ to Custom headers
import com.sap.gateway.ip.core.customdev.util.Message;
// by Dominic Beckbauer - Kangoolutions GmbH 2024

def Message processData(Message message) {
    def additionalTrackingObjects = ["traceid", "traceparent", "requestid"]
    def messageLog = messageLogFactory.getMessageLog(message);
    def iterationElementsLists = [message.getProperties(), message.getHeaders()]

    if (messageLog != null) {
        iterationElementsLists.each { elements ->
            elements.each { key, value ->
                if (key.toLowerCase().startsWith("ch_")) {
                    println("$key - $value")
                    messageLog.addCustomHeaderProperty(key.substring(3), value);
                }
                if (additionalTrackingObjects.contains(key.toLowerCase().replaceAll("_", "").replaceAll("-", ""))) {
                    println("$key - $value")
                    messageLog.addCustomHeaderProperty(key, value);
                }
            }
        }
    }
    return message;
}
\`\`\`

### Throw Error
\`\`\`//groovy
throw new Exception("message here")
\`\`\`

### Maps
\`\`\`//groovy
def people = [:] // Create an empty map
def root = new XmlSlurper().parseText(message.getBody(String)) // Parse the payload

// Now iterate over each <person> element
root.person.each { p ->
    people[p.id.text()] = [firstname: p.firstname.text(), lastname: p.lastname.text()]
}

all.Record.findAll { it.Username == deleteitem.Username && it.TerminationDate == deleteitem.TerminationDate }.replaceNode {}
\`\`\`

### Markup Builder
\`\`\`//groovy
import groovy.xml.MarkupBuilder;
import groovy.xml.XmlUtil

def body = new XmlSlurper().parse(message.getBody(java.io.Reader)).PerPerson.emailNav

def writer = new StringWriter()
def builder = new MarkupBuilder(writer)

// We store the data in the map first and then create XML later
def mymap = [:]

// Store incoming in map
for (email in body.PerEmail) {
    mymap[email.emailType.toString()] = [emailAddress: email.emailAddress,
                                         emailType: email.emailType,
                                         personIdExternal: email.personIdExternal,
                                         isPrimary: false]
}    

// Create XML
builder.PerEmail {
    for (key in mymap.keySet()) {
        "PerEmail" {
            "personIdExternal"(mymap[key].personIdExternal)
            "emailType"(mymap[key].emailType)
            "emailAddress"(mymap[key].emailAddress)
            "isPrimary"(mymap[key].isPrimary)
        }
    }
}

message.setBody(writer.toString())
\`\`\`

### MPL Attachments
\`\`\`//groovy
def Message processData(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message);
    def body = message.getBody(java.lang.String)
    messageLog.addAttachmentAsString("log", body, "text/plain");    
    return message;
}

// Set output name with property logname
import com.sap.gateway.ip.core.customdev.util.Message;
import java.util.HashMap;

def Message logging(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message);
    def logname = message.getProperties().get("logname")
    if (!logname) {
        logname = "log"
    }
    def body = message.getBody(java.lang.String)
    messageLog.addAttachmentAsString(logname, body, "text/plain");
    return message;
}

// Add attachment depending on log level
import com.sap.gateway.ip.core.customdev.util.Message

def Message processData(Message message) {
    String logLevel = message.getProperty('SAP_MessageProcessingLogConfiguration').logLevel.toString();
    if (logLevel in ['DEBUG', 'TRACE']) {
        messageLogFactory.getMessageLog(message)?.addAttachmentAsString('Payload', message.getBody(String), 'text/plain');
    }
    return message
}
\`\`\`

### Ranges
\`\`\`//groovy
import com.sap.it.api.ITApiFactory;
import com.sap.it.api.nrc.NumberRangeConfigurationService;
import com.sap.it.api.nrc.exception.NumberRangeConfigException;

// Access ranges
def service = ITApiFactory.getApi(NumberRangeConfigurationService.class, null);   

if (service != null) { 
    // Get next value from number range configured in web tooling.
    def nextValue = service.getNextValuefromNumberRange("new", null);
}
\`\`\`

### Secure Parameters Access
\`\`\`//groovy
def Message processData(Message message) {
    def apikey_alias = message.getProperty("ApiKeyAlias")
    def secureStorageService = ITApiFactory.getService(SecureStoreService.class, null)
    try {
        def secureParameter = secureStorageService.getUserCredential(apikey_alias)
        def apikey = secureParameter.getPassword().toString()
        message.setProperty("api-key", apikey)
    } catch(Exception e) {
        throw new SecureStoreException("Secure Parameter not available")
    }
    return message;
}

def Message processData(Message message) {
    def CredentialAlias = message.getProperty("CredentialAlias")
    def secureStorageService = ITApiFactory.getService(SecureStoreService.class, null)
    def credential = secureStorageService.getUserCredential(CredentialAlias)
    def credentialProperties = credential.getCredentialProperties()
    message.setProperty("credentialProperties", credentialProperties)
    return message;
}

def Message processData(Message message) {
    SecureStoreService secureStoreService = ITApiFactory.getService(SecureStoreService.class, null);
    AccessTokenAndUser accessTokenAndUser = secureStoreService.getAccesTokenForOauth2AuthorizationCodeCredential(credential_name);
    String token = accessTokenAndUser.getAccessToken();
    String user = accessTokenAndUser.getUser();   
    message.setHeader("Authorization", "Bearer " + token);
    return message;
}
\`\`\`

### Value Mappings in Groovy
\`\`\`//groovy
import com.sap.it.api.ITApiFactory
import com.sap.it.api.mapping.ValueMappingApi

def Message processData(Message message) {
    def valueMapApi = ITApiFactory.getApi(ValueMappingApi.class, null)
    def value = valueMapApi.getMappedValue('source-agency', 'source-identifier', 'source-value', 'target-agency', 'target-identifier')
    return message;
}
\`\`\`

### XML External Entity Prevention
\`\`\`//groovy
import com.sap.gateway.ip.core.customdev.util.Message; 
import javax.xml.parsers.DocumentBuilderFactory; 
import javax.xml.parsers.DocumentBuilder; 
import javax.xml.parsers.ParserConfigurationException; 
import org.xml.sax.InputSource; 
import java.io.StringReader; 

def Message processData(Message message) { 
    def dbf = DocumentBuilderFactory.newInstance(); 
    // Disallow the processing of doctype declarations 
    def FEATURE = "http://apache.org/xml/features/disallow-doctype-decl"; 
    dbf.setFeature(FEATURE, true); 
    def db = dbf.newDocumentBuilder(); 
    def is = new InputSource(message.getBody()); 
    def doc = db.parse(is); 
    message.setBody(doc); 
    return message; 
}
\`\`\`

### XML Slurper
\`\`\`//groovy
import groovy.util.XmlSlurper

def xml = new XmlSlurper().parse(message.getBody(java.io.Reader))
String result = XmlUtil.serialize(xml)
\`\`\`

### (Streaming) JSON Builder
\`\`\`//groovy
import groovy.json.JsonBuilder
import groovy.json.StreamingJsonBuilder
import groovy.json.JsonOutput

/* StreamingJsonBuilder supports the usual builder syntax made of nested method calls and closures, but also some specific aspects of JSON data structures, such as list of values, etc.
Unlike the JsonBuilder class which creates a data structure in memory, which is handy in those situations where you want to alter the structure programmatically before output, the StreamingJsonBuilder streams to a writer directly without any memory data structure.
So if you don't need to modify the structure, and want a more memory-efficient approach, please use the StreamingJsonBuilder. */

def contact = [
    [getFirstName: { 'A' }, getLastName: { 'B' }, getTitle: { 'C' }],
    [getFirstName: { 'D' }, getLastName: { 'E' }, getTitle: { 'F' }],
    [getFirstName: { 'G' }, getLastName: { 'H' }, getTitle: { 'I' }]
]
def rowKey = "4711"

def builder = new JsonBuilder()
def writer = new StringWriter()
def jsonBuilder = new StreamingJsonBuilder(writer)

jsonBuilder.contacts {
    contact.each { c ->
        contact {
            firstName c.getFirstName()
            lastName c.getLastName()
            title c.getTitle()
        }
    }
}
def json = writer.toString()
message.setBody(json)
\`\`\`

### Read URL GET Parameters
\`\`\`//groovy
import com.sap.gateway.ip.core.customdev.util.Message;
import java.util.HashMap;

def Message extractUrlGetParameters(Message message) {
	//get url
	def map = message.getHeaders();
	def queryString = map.get("CamelHttpQuery");

	//split url
	String[] vQuery;
	vQuery = queryString.split('&');

	//set properties
	for( String pair : vQuery ) {
		String[] vPairs = pair.split('=');
		message.setProperty(vPairs[0].replace("\$",""), vPairs[1]);
	}
	return message;
}
\`\`\`

### JSCH SFTP connections from Groovy
\`\`\`//groovy
import com.jcraft.jsch.Channel;
import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.SftpException;
import com.sap.it.api.securestore.SecureStoreService;
import com.sap.it.api.securestore.UserCredential;
import com.sap.it.api.ITApiFactory;
import java.util.Vector;

def Message setFTPrepo(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message);
    def map = message.getProperties();

    String userName = "";
    String password = "";
    String hostName = map.get("hostName")
    String sftpCredentials = map.get("sftpCredentials")

    def secureStorageService =  ITApiFactory.getApi(SecureStoreService.class, null);
    def cred = secureStorageService.getUserCredential(sftpCredentials);

    userName = cred.getUsername();
    password = cred.getPassword().toString();

    SFTPHelper sftp = new SFTPHelper(hostName,userName,password)
 
    def xmlTestSet = new XmlParser().parseText(map.get("xmlTestSet") as String)

    List<HashMap<String,String>> pathContent = []
    List<HashMap<String,String>> allContent = []
    
    def paths = xmlTestSet.'**'.path;
    paths.unique{ it.value() }
    
    paths.each{
         subContent = sftp.checkPath(it.value().text(), false);
         subContent.each{
             pathContent.add(it)
         }
    }
 
    pathContent.unique();
    message.setProperty("pathContent", pathContent)

    sftp.disconnect()

    if(messageLog != null) {
        messageLog.addAttachmentAsString("FTP File List", new JsonBuilder(pathContent).toPrettyString(), "text/plain");                
    }

    return message;
}

class SFTPHelper {
    def jsch
    def session
    Channel channel
    ChannelSftp sftpChannel

    SFTPHelper(String hostName, String userName, String password, int port = 22) {
        this.jsch = new JSch();
        this.session = jsch.getSession(userName, hostName, 22);
        this.session.setConfig("StrictHostKeyChecking", "no");
        this.session.setConfig("server_host_key", session.getConfig("server_host_key") + ",ssh-rsa");
        this.session.setPassword(password);
        this.session.connect();

        this.channel = session.openChannel("sftp");
        this.channel.connect();
        this.sftpChannel = (ChannelSftp) channel;
    }

    String copyFile(String source, String target) throws Exception {
        Session session = this.session;

        if (!session.isConnected()) {
            throw new Exception("Session is not connected...");
        }
        Channel upChannel = null;
        Channel downChannel = null;
        ChannelSftp uploadChannel = null;
        ChannelSftp downloadChannel = null;
        try {
            upChannel = session.openChannel("sftp");
            downChannel = session.openChannel("sftp");
            upChannel.connect();
            downChannel.connect();
            uploadChannel = (ChannelSftp) upChannel;
            downloadChannel = (ChannelSftp) downChannel;
            InputStream inputStream = uploadChannel.get(source);
            downloadChannel.put(inputStream, target);
        } catch (JSchException e) {
            throw new Exception(e);
        } finally {
            if (upChannel == null || downChannel == null) {
                println("Channel is null ...");
            } else if (uploadChannel != null && !uploadChannel.isClosed()) {
                uploadChannel.exit();
                downloadChannel.exit();
                uploadChannel.disconnect();
                downloadChannel.disconnect();
            } else if (!upChannel.isClosed()) {
                upChannel.disconnect();
                downChannel.disconnect();
            }
            session.disconnect();
        }
    }

    List<HashMap<String,String>> checkPath(String path, boolean subPath) {
        List<HashMap<String,String>> result = []
        try {
            Vector filelist = sftpChannel.ls(path);
            for (int i = 0; i < filelist.size(); i++) {
                if (filelist.get(i).getFilename() != '.' && filelist.get(i).getFilename() != '..' && filelist.get(i).getAttrs().isDir() == false) {
                    HashMap<String,String> item = [:]
                    item["path"] = path;
                    item["fileName"] = filelist.get(i).getFilename()
                    item["size"] = filelist.get(i).getAttrs().getSize()
                    item["lastmod"] = filelist.get(i).getAttrs().getMTime().toString()
                    item["isDir"] = filelist.get(i).getAttrs().isDir();

                    result << item
                    this.pwd()
                }

                // sub path
                if (subPath == true) {
                    if (filelist.get(i).getFilename() != '.' && filelist.get(i).getFilename() != '..' && filelist.get(i).getAttrs().isDir() == true) {
                        def subResult = this.checkPath(path + '/' + filelist.get(i).getFilename(), true);
                        subResult.each{
                            result.add(it)
                        }
                    }
                }
            }
        } catch(Exception e) {
            return result;
        }
        return result;
    }

    String pwd() {
        return this.sftpChannel.pwd()
    }

    void disconnect() {
        this.sftpChannel.exit();
        this.session.disconnect();
    }
}
\`\`\`

### HTTP Error Handling
\`\`\`//groovy
def Message errorHandling(Message message) {                
    // get a map of properties
    def map = message.getProperties();
            
    // get an exception java class instance
    def ex = map.get("CamelExceptionCaught");
    if (ex!=null) {
        // an http adapter throws an instance of org.apache.camel.component.ahc.AhcOperationFailedException
        if (ex.getClass().getCanonicalName().equals("org.apache.camel.component.ahc.AhcOperationFailedException")) {
            // save the http error response as a message attachment 
            def messageLog = messageLogFactory.getMessageLog(message);
            messageLog.addAttachmentAsString("http.ResponseBody", ex.getResponseBody(), "text/plain");

            // copy the http error response to an exchange property
            message.setProperty("http.ResponseBody",ex.getResponseBody());
            
            // copy the http error response to the message body
            message.setBody(ex.getResponseBody());

            // copy the value of http error code (i.e. 500) to a property
            message.setProperty("http.StatusCode",ex.getStatusCode());

            // copy the value of http error text (i.e. "Internal Server Error") to a property
            message.setProperty("http.StatusText",ex.getStatusText());
        }
    }
    return message;
}
\`\`\`

### Hashmaps
\`\`\`//groovy
def colors = [
    red: "#FF0000",
    green: "#00FF00",
    blue: "#0000FF"
]

println colors

// add new colors
println "add new color"
colors['yellow'] = "#FFFF00"

println colors

println colors['yellow']

// hashmap as value
def sales = [
    europe: [germany: 5, austria: 3, italy: 2],
    africa: [southafrica: 5, namibia: 3],
]

// get sales from namibia
sales["africa"]["namibia"]

// advantages hashmap
// + super fast to read for computer
// + can be easily put in property
\`\`\`
`;

function genratedata(markdownContent) {
  const md = window.markdownit();
  const sections = markdownContent.split(/(\n### .+)/).filter(Boolean); // Split into sections based on headers
  var segment = "";
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (section.startsWith("### ")) {
      const header = section;
      const codeBlock = sections[i + 1] ? sections[i + 1].trim().replace(/`{3}/g, "") : "";
      segment += `<div style="margin-block: 1rem;">
                <div class="ui segment">
                    <h2 class="ui dividing blue header">${header.replaceAll("#", "").trim()}</h2>
                    <button class="ui vertical animated button copy-button" style="float: right;">
                        <div class="hidden content">Copy</div>
                        <div class="visible content"><i class="copy icon"></i></div>
                    </button>
                    <pre><code style="text-wrap: pretty;">${codeBlock.replace("//groovy", "").trim()}</code></pre>
                </div></div>`;
    }
  }
  segment += `<div class="ui bottom left attached label">All the Content is developed and provided by kangoolutions.</div>`;
  return segment;
}

function copySectionUpdatye() {
  $(".copy-button").on("click", function () {
    const codeText = $(this).parent().find("code").text();
    navigator.clipboard.writeText(codeText).then(
      function () {
        showToast("Copied to clipboard!", "", "success");
      },
      function (err) {
        log.error("Could not copy text: ", err);
        showToast("Failed to copy!", "", "error");
      }
    );
  });
}

var plugin = {
  metadataVersion: "1.0.0",
  id: "Groovyreference",
  name: "Groovy Quick",
  version: "1.0.0",
  author: "Omkar",
  email: "omk14p@outlook.com",
  website: "https://incpi.github.io",
  description: "This plugin will help in quick look for groovy script patterns",
  settings: {},

  scriptCollectionButton: {
    icon: { text: "Groovy reference", type: "text", class: "ui mini blue tertiary" },
    title: "Grovvy reference",
    onClick: (pluginHelper, settings) => {
      pluginHelper.functions.popup(genratedata(markdownContent), "Reference", {
        fullscreen: true,
        callback: async () => {
          $(".tabular.menu .item").tab();
          copySectionUpdatye();
        },
      });
    },
    condition: (pluginHelper, settings) => {
      return true;
    },
  },
  scriptButton: {
    icon: { text: "Groovy reference", type: "text", class: "ui mini blue tertiary" },
    title: "Grovvy reference",
    onClick: (pluginHelper, settings) => {
      pluginHelper.functions.popup(genratedata(markdownContent), "Reference", {
        fullscreen: true,
        callback: async () => {
          $(".tabular.menu .item").tab();
          copySectionUpdatye();
        },
      });
    },
    condition: (pluginHelper, settings) => {
      return true;
    },
  },
};

pluginList.push(plugin);
