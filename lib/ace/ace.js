class EditorManager {
    constructor(id, type = 'text', theme = "textmate", tabSize = 2, readOnly = true) {
        this.tabSize = tabSize;
        this.theme = theme;
        this.readOnly = readOnly;
        this.mode = `ace/mode/${type}`;

        this.editor = ace.edit(id, {
            theme: `ace/theme/${this.theme}`,
            readOnly: this.readOnly,
            fontSize: "1.2rem",
            enableMultiselect: true,
            mode: this.mode,
            foldStyle: "markbegin",
            tabSize: this.tabSize,
            cursorStyle: "slim",
            highlightActiveLine: true,
            wrap: true,
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
    }

    setContent(content) {
        this.editor.setValue(content);
    }

    // Getters
    getContent() {
        return this.editor.getValue();
    }

    getTheme() {
        return this.theme;
    }

    // Toggles
    toggleReadOnly() {
        this.setReadOnly(!this.editor.getReadOnly());
        return this.editor.getReadOnly()
    }

    toggleTheme() {
        this.theme = (this.theme === "textmate") ? "github_dark" : "textmate";
        this.editor.setTheme(`ace/theme/${this.theme}`);
    }
}