class EditorManager {
    constructor(id, type = 'text', theme = 'textmate', tabSize = 2, readOnly = true, fontSize = "1.2rem", foldStyle = "markbegin", wrap = true) {
        if (!document.getElementById(id)) {
            throw new Error(`No element found with ID: ${id}`);
        }

        this.tabSize = tabSize;
        this.theme = theme;
        this.readOnly = readOnly;
        this.fontSize = fontSize;
        this.foldStyle = foldStyle;
        this.wrap = wrap;
        this.mode = `ace/mode/${type}`;

        this.editor = ace.edit(id, {
            theme: `ace/theme/${this.theme}`,
            readOnly: this.readOnly,
            fontSize: this.fontSize,
            enableMultiselect: true,
            mode: this.mode,
            foldStyle: this.foldStyle,
            tabSize: this.tabSize,
            cursorStyle: "slim",
            highlightActiveLine: true,
            wrap: this.wrap,
            showLineNumbers: true,
            showGutter: true,
            showPrintMargin: false,
            highlightSelectedWord: true
        });
        this.editor.resize();
    }

    // Setters
    setReadOnly(boolValue) {
        this.editor.setReadOnly(boolValue);
        this.readOnly = boolValue;
    }

    setContent(content) {
        this.editor.setValue(content);
    }

    setFontSize(fontSize) {
        this.editor.setOptions({ fontSize: fontSize });
        this.fontSize = fontSize;
    }

    setFoldStyle(foldStyle) {
        this.editor.setOptions({ foldStyle: foldStyle });
        this.foldStyle = foldStyle;
    }

    setTabSize(tabSize) {
        this.editor.setOptions({ tabSize: tabSize });
        this.tabSize = tabSize;
    }

    setWrap(wrap) {
        this.editor.setOptions({ wrap: wrap });
        this.wrap = wrap;
    }

    // Getters
    getContent() {
        return this.editor.getValue();
    }

    getTheme() {
        return this.editor.getOption("theme");
    }

    getFontSize() {
        return this.editor.getOption("fontSize");
    }

    getFoldStyle() {
        return this.editor.getOption("foldStyle");
    }

    getTabSize() {
        return this.editor.getOption("tabSize")
    }

    getWrap() {
        return this.editor.getOption("wrap");
    }

    // Toggles
    toggleReadOnly() {
        this.setReadOnly(!this.editor.getReadOnly());
        return this.editor.getReadOnly();
    }

    toggleTheme() {
        const themes = ["textmate", "github_dark"]; // Add more themes as needed
        const currentIndex = themes.indexOf(this.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.theme = themes[nextIndex];
        this.editor.setTheme(`ace/theme/${this.theme}`);
        return this.getTheme() === 'ace/theme/textmate' ? true : false
    }
    toggleWrap() {
        this.setWrap(!this.getWrap())
        return this.getWrap()
    }
    resize() {
        this.editor.resize();
    }
}
