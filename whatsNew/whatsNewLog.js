// template = - [header :your header as HTML] [description": "description goes here as HTML] ,... //multiple
const whats_new_log = `
- [Plugin] New Version History plugin: view the version history of an iFlow and revert to an earlier version directly in the editor. Special thanks to Gregor Schütz.
- [Plugin] New MPL Table Sorter plugin: sort the Monitor Message Processing table by one or more columns. Special thanks to Prem Sai Daggolu.
- [Plugin] New Create named Groovy script plugin: create a Groovy resource with a name of your choice in the current iFlow. Special thanks to Björn Konzmann.
- [Feature] New floating toolbar instead of the buttons in the page header: Trace, Messages, Info, Logs and Runtime in a toolbar you can drag anywhere. Wide with labels or compact with icons only, it remembers position and variant. In the compact variant hovering shows the name and the keyboard shortcut.
- [Feature] Everyone updating from version 3 gets a short welcome and a tour of the new toolbar, once. It can be replayed from What changed.
- [Feature] Plugins have their own section in the toolbar. Plugins with a single action run it directly, plugins with more content open it in a panel next to the toolbar. The plugin settings are under Manage plugins.
- [Feature] Message popup in the style of the new toolbar, slightly translucent. The header keeps the tenant color.
- [Feature] CPI Helper toolbar on the new API and MCP Server pages. They use the integration cell runtime by default.
- [Feature] Rewritten browser action popup: faster, without jQuery and Semantic UI, and it can open the plugin settings of the current tab. Artifact names in the popup are now escaped. Special thanks to Alexander Aigner.
- [Feature] The browser tab title shows a readable name of the current app. Thanks to Alexander Aigner.
- [Feature] For plugin developers: toolbarButton for direct toolbar actions, an optional icon for toolbar entries and a select dropdown for plugin settings. Thanks to Alexander Aigner.
- [Improvement] The setting "Plugin page as separate sidebar" is gone, plugins live in the toolbar now.
- [Improvement] Updated plugin metadata for Timeline, Unlock and Credential Helper. Thanks to Gregor Schütz.
- [Improvement] Version History highlights only the current version, Unlock refreshes the page after unlocking. Thanks to Gregor Schütz.
- [Fix] The CPI Helper button in the new shell header opens on the first click and no longer disappears. Thanks to Alexander Aigner.
- [Fix] The CPI Helper popup no longer opens empty the first time. Thanks to Alexander Aigner.
- [Fix] CPI Helper stops cleanly after the extension was reloaded or updated instead of flooding the console. Thanks to Alexander Aigner.
`;
