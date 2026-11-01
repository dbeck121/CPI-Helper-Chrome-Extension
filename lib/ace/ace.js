class EditorManager {
  // target: element id or element
  constructor(target, type = "text", theme = "textmate", tabSize = 2, readOnly = true, fontSize = 14, foldStyle = "markbegin", wrap = true) {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (!element) {
      throw new Error(`No element found with ID: ${target}`);
    }

    this.tabSize = tabSize;
    this.theme = theme;
    this.readOnly = readOnly;
    this.fontSize = fontSize;
    this.foldStyle = foldStyle;
    this.wrap = wrap;
    this.mode = `ace/mode/${type}`;

    this.editor = ace.edit(element, {
      theme: `ace/theme/${this.theme}`,
      readOnly: this.readOnly,
      fontSize: this.fontSize,
      enableMultiselect: true,
      mode: this.mode,
      // web workers are blocked by the content security policy of the CPI page
      useWorker: false,
      foldStyle: this.foldStyle,
      tabSize: this.tabSize,
      cursorStyle: "slim",
      highlightActiveLine: true,
      wrap: this.wrap,
      showLineNumbers: true,
      showGutter: true,
      showPrintMargin: false,
      highlightSelectedWord: true,
      showFoldWidgets: true,
      animatedScroll: false,
    });
    this.editor.resize();
  }

  // Setters
  setReadOnly(boolValue) {
    this.editor.setReadOnly(boolValue);
    this.readOnly = boolValue;
  }

  // starts at the top instead of selecting the whole text like editor.setValue does
  setContent(content) {
    this.editor.session.setValue(content);
    this.editor.moveCursorTo(0, 0);
    this.editor.renderer.scrollToRow(0);
  }

  setMode(type) {
    this.mode = `ace/mode/${type}`;
    this.editor.session.setMode(this.mode);
  }

  setTheme(theme) {
    this.theme = theme;
    this.editor.setTheme(`ace/theme/${theme}`);
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
    return this.editor.getOption("tabSize");
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
    this.setTheme(themes[nextIndex]);
    return this.getTheme() === "ace/theme/textmate" ? true : false;
  }
  toggleWrap() {
    this.setWrap(!this.getWrap());
    return this.getWrap();
  }

  foldAll() {
    this.editor.session.foldAll();
  }

  unfoldAll() {
    this.editor.session.unfold();
  }

  openSearch() {
    this.editor.execCommand("find");
  }

  resize() {
    this.editor.resize();
  }

  destroy() {
    this.editor.destroy();
  }
}
