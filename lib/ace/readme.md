# Disclaimer for `ace.js` Modifications

**Important Notice:** The `ace.js` file is vital for our extension's functionality. Any changes made to `ace.js` must be approached with caution:

- **ace.js** is not part of this library. instead it's wrapper class to utilize more easily.

- **ace.min.js** is Core of editor: ace-builds 1.44.0, `src-min-noconflict/ace.js` (BSD license, see LICENSE). The mode, theme and ext files come from the same build and must be updated together.
- **Precautionary Measures:** Before altering `ace folder`:
  - Web worker are disabled due to **Content Security Policy (CSP)**. Please don't try to include as it's violations the CSP.

Please ensure adherence to these guidelines to maintain the integrity and performance of our extension.

Thank you for your attention to this matter.
