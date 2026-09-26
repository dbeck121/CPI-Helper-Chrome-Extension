// template = - [header :your header as HTML] [description": "description goes here as HTML] ,... //multiple
const whats_new_log = `
- [Plugin] New Version History plugin: view the version history of an iFlow and revert to an earlier version directly in the editor. Special thanks to Gregor Schütz.
- [Plugin] New MPL Table Sorter plugin: sort the Monitor Message Processing table by one or more columns. Special thanks to Prem Sai Daggolu.
- [Plugin] New Create named Groovy script plugin: create a Groovy resource with a name of your choice in the current iFlow. Special thanks to Björn Konzmann.
- [Feature] New floating toolbar: Trace, Messages, Info, Runtime and More are now compact icons in a toolbar you can drag anywhere on the page. It remembers its position and no longer waits for the page header.
- [Feature] Rewritten browser action popup: faster, without jQuery and Semantic UI, and it can open the plugin settings of the current tab. Artifact names in the popup are now escaped. Special thanks to Alexander Aigner.
- [Feature] The browser tab title shows a readable name of the current app. Thanks to Alexander Aigner.
- [Feature] Plugins can use a select dropdown in their settings. Thanks to Alexander Aigner.
- [Feature] CPI Helper buttons on the new API and MCP Server artifact pages.
- [Improvement] Updated plugin metadata for Timeline, Unlock and Credential Helper. Thanks to Gregor Schütz.
- [Improvement] Version History highlights only the current version, Unlock refreshes the page after unlocking. Thanks to Gregor Schütz.
- [Fix] The runtime location menu can be clicked on pages outside the iFlow editor.
- [Fix] The CPI Helper button in the new shell header opens on the first click and no longer disappears. Thanks to Alexander Aigner.
- [Fix] The CPI Helper popup no longer opens empty the first time. Thanks to Alexander Aigner.
- [Fix] CPI Helper stops cleanly after the extension was reloaded or updated instead of flooding the console. Thanks to Alexander Aigner.
`;
