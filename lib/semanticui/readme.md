# Disclaimer for `semantic.dark.css` Modifications

**Important Notice:** The `semantic.dark.css` file is vital for our extension's dark mode functionality. Any changes made to `semantic.dark.css` must be approached with caution:

- **Custom File**: `semantic.dark.css` is not part of the official Fomantic UI library. It has been customized to fit our specific needs.
- **Hex Values Overwrite**: When making changes, please use hex codes (e.g., `#ffffff33`) instead of rgba, hsl, etc. This ensures consistency and ease of maintenance.
- **Core File**: `semantic.min.css` is the core file of the Fomantic UI library. Any modifications should be carefully considered to avoid disrupting the library's functionality.

**Precautionary Measures:** Before altering the `semanticui` folder:

- **Version Awareness**: We are currently using version **2.9.3**. Upgrading to a new version will require manual adjustments to ensure compatibility.
- **General Tags**: Remove modifications to general tags like `html`, `body`, `a`, etc., to avoid broad impacts on the entire application.
- **Dark Mode Updates**: Any updates to the dark mode file (`semantic.dark.css`) must be manually customized to fit the new upgrades.

Please ensure adherence to these guidelines to maintain the integrity and performance of our extension.

Thank you for your attention to this matter.
