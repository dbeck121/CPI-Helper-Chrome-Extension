/**
 * SAP CPI Helper Plugin - Message Processing Logs Table Sorter
 * Adds easy, flexible column sorting directly to the SAP CPI Messages monitoring table.
 * Features an authentic SAPUI5 Multi-Select Value Help dialog with priority numbering.
 */
// Wrapped in an IIFE: content scripts share one global scope, so helper names must not leak.
(() => {
// ============================================================================
// 1. PLUGIN REGISTRATION & CONFIGURATION
// ============================================================================
var plugin = {
  metadataVersion: "1.0.0",
  id: "mplTableSorter",
  name: "MPL Table Sorter",
  version: "1.0.0",
  author: "Prem Sai Daggolu",
  website: "https://www.linkedin.com/in/premsaidaggolu/",
  email: "premsai.daggolu@gmail.com",
  description: "This plugin enables easy column sorting on the SAP CPI Monitor Message Processing (MPL) table.",
  settings: {},
  /**
   * Periodic lifecycle hook called by CPI Helper's content script loop.
   * Handles initialization, table discovery, and cleanups during page navigation.
   */
  heartbeat: async (pluginHelper, settings) => {
    const existingToolbar = document.getElementById("cpi-sort-toolbar-container");
    // The MPL table only exists below /monitoring/ (see contentScript.js, shell/monitoring/Messages).
    // Everywhere else we leave before scanning the DOM, because the heartbeat runs every 3 seconds.
    if (!document.location.pathname.includes('/monitoring/')) {
      forgetMessagesTable();
      if (existingToolbar) existingToolbar.remove();
      return;
    }
    // Inject self-contained styles into document.head
    injectPluginStyles();
    // Check if the SAP CPI Messages table is present on the active screen
    const table = findMessagesTable();
    if (table && !existingToolbar) {
      // First time on the Messages monitoring table -> initialize sorter toolbar
      initializeSorter();
    } else if (table && existingToolbar) {
      // Table already has toolbar -> keep fields synchronized with visible columns
      syncDropdownFields();
    } else if (!table && existingToolbar) {
      // User navigated away from the monitoring table -> cleanly remove toolbar
      existingToolbar.remove();
    }
  }
};
// Register this plugin in CPI Helper's global plugin list
pluginList.push(plugin);
// ============================================================================
// 2. SELF-CONTAINED STYLES (MATCHING SAPUI5 VALUE HELP & SCREENSHOTS)
// ============================================================================
function injectPluginStyles() {
  if (document.getElementById("cpi-mpl-sorter-styles")) return;
  const style = document.createElement("style");
  style.id = "cpi-mpl-sorter-styles";
  style.textContent = `
    /* Transparent toolbar container embedded next to Settings gear */
    #cpi-sort-toolbar-container {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-left: 10px;
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
      font-family: "72", "72full", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      vertical-align: middle;
      z-index: 10;
    }
    /* Individual sort rule group */
    .cpi-sort-rule-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      padding: 0;
      border: none;
    }
    /* Label text matching CPI Helper header link color */
    .cpi-sort-toolbar-label {
      font-weight: 600;
      color: #0070f2;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      font-size: 13px;
    }
    /* SAPUI5 Value Help Trigger Input (Screenshot 2) */
    .cpi-value-help-input {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      min-width: 140px;
      max-width: 190px;
      height: 26px;
      padding: 0 6px 0 8px;
      background-color: #ffffff;
      border: 1px solid #b0b5b9;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }
    .cpi-value-help-input:hover {
      border-color: #0070f2;
    }
    .cpi-value-help-input:focus {
      outline: none;
      border-color: #0070f2;
      box-shadow: 0 0 0 1px #0070f2;
    }
    .cpi-value-help-text {
      font-size: 12px;
      color: #32363a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: inherit;
    }
    .cpi-value-help-text.placeholder {
      font-style: italic;
      color: #74777a;
    }
    .cpi-value-help-icon {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      color: #555b63;
      flex-shrink: 0;
    }
    /* Direction Toggle Button */
    .cpi-sort-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      height: 26px;
      font-size: 12px;
      font-weight: 600;
      color: #0070f2;
      background: transparent;
      border: 1px solid #0070f2;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      box-sizing: border-box;
      transition: all 0.15s ease;
    }
    .cpi-sort-btn:hover {
      background-color: rgba(0, 112, 242, 0.08);
      color: #0854a0;
      border-color: #0854a0;
    }
    .cpi-sort-btn.cpi-btn-active {
      background-color: #0070f2;
      border-color: #0070f2;
      color: #ffffff;
    }
    /* Delete level button (✕) */
    .cpi-sort-del-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      background: transparent;
      color: #89919a;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      border-radius: 50%;
      margin-left: 2px;
      transition: all 0.15s ease;
    }
    .cpi-sort-del-btn:hover {
      color: #b00;
      background-color: rgba(187, 0, 0, 0.1);
    }
    /* "+ Then by..." link-style button */
    .cpi-sort-add-btn {
      display: inline-flex;
      align-items: center;
      padding: 2px 4px;
      font-size: 13px;
      font-weight: 600;
      color: #0070f2;
      background: transparent;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .cpi-sort-add-btn:hover {
      text-decoration: underline;
      color: #0854a0;
    }
    /* "Reset" link-style button */
    .cpi-sort-reset-btn {
      display: inline-flex;
      align-items: center;
      padding: 2px 4px;
      font-size: 13px;
      font-weight: 600;
      color: #6a6d70;
      background: transparent;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .cpi-sort-reset-btn:hover {
      color: #b00;
      text-decoration: underline;
    }
    /* =====================================================================
       SAPUI5 VALUE HELP DIALOG (Screenshot 1)
       ===================================================================== */
    .cpi-dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.35);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: cpiFadeIn 0.15s ease;
    }
    @keyframes cpiFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .cpi-dialog-box {
      width: 360px;
      max-width: 90vw;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
      border: 1px solid #d9d9d9;
      font-family: "72", "72full", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: cpiSlideUp 0.15s ease;
    }
    @keyframes cpiSlideUp {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .cpi-dialog-header {
      padding: 16px 18px 12px 18px;
      border-bottom: 1px solid #f0f0f0;
    }
    .cpi-dialog-title {
      font-size: 15px;
      font-weight: 700;
      color: #1d2d3e;
      margin: 0 0 12px 0;
    }
    .cpi-dialog-search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .cpi-dialog-search-input {
      width: 100%;
      height: 30px;
      padding: 0 28px 0 8px;
      font-size: 12.5px;
      font-family: inherit;
      font-style: italic;
      color: #32363a;
      border: 1px solid #b0b5b9;
      border-radius: 4px;
      box-sizing: border-box;
      outline: none;
    }
    .cpi-dialog-search-input:focus {
      border-color: #0070f2;
      box-shadow: 0 0 0 1px #0070f2;
      font-style: normal;
    }
    .cpi-dialog-search-icon {
      position: absolute;
      right: 8px;
      color: #74777a;
      pointer-events: none;
    }
    .cpi-dialog-list {
      max-height: 280px;
      overflow-y: auto;
      padding: 4px 0;
      margin: 0;
      list-style: none;
    }
    .cpi-dialog-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 18px;
      font-size: 13px;
      color: #32363a;
      cursor: pointer;
      user-select: none;
      border-left: 3px solid transparent;
      transition: background-color 0.1s ease;
    }
    .cpi-dialog-item:hover {
      background-color: #f2f4f7;
    }
    .cpi-dialog-item.selected {
      background-color: #f0f7ff;
      border-left-color: #0070f2;
      color: #0070f2;
      font-weight: 600;
    }
    /* Checkbox showing priority number (1, 2, 3...) when selected */
    .cpi-dialog-checkbox {
      width: 18px;
      height: 18px;
      border: 1px solid #89919a;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      color: transparent;
      transition: all 0.15s ease;
    }
    .cpi-dialog-item.selected .cpi-dialog-checkbox {
      border-color: #0070f2;
      background-color: #0070f2;
      color: #ffffff;
    }
    .cpi-dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      border-top: 1px solid #e5e5e5;
      background-color: #fafbfc;
    }
    .cpi-dialog-btn-clear {
      background: transparent;
      color: #6a6d70;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 6px;
    }
    .cpi-dialog-btn-clear:hover {
      color: #b00;
      text-decoration: underline;
    }
    .cpi-dialog-footer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cpi-dialog-btn-select {
      background-color: #0070f2;
      color: #ffffff;
      border: 1px solid #0070f2;
      border-radius: 6px;
      padding: 6px 18px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cpi-dialog-btn-select:hover {
      background-color: #0854a0;
      border-color: #0854a0;
    }
    .cpi-dialog-btn-cancel {
      background: transparent;
      color: #0070f2;
      border: none;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
    }
    .cpi-dialog-btn-cancel:hover {
      text-decoration: underline;
    }
    /* Toast popup for feedback */
    .cpi-sort-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 8px 16px;
      background-color: #32363a;
      color: #ffffff;
      font-family: "72", "72full", sans-serif;
      font-size: 13px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
    }
    .cpi-sort-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);
}
// ============================================================================
// 3. CORE LOGIC & PARSING
// ============================================================================
const TABLE_IDENTIFIER_KEYWORDS = ['artifact', 'status', 'updated', 'type', 'time', 'sender', 'receiver', 'message'];
let sortRules = [{ field: '', direction: 'asc' }];
function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
const HEADER_NOISE_SELECTOR = '.cpi-sort-icon, .sapUiPseudoInvisibleText, .sapUiInvisibleText, [aria-hidden="true"]';
function getHeaderText(th) {
  if (!th) return '';
  // Deep-cloning every header cell on every heartbeat is wasteful, and most cells carry no noise.
  if (!th.querySelector(HEADER_NOISE_SELECTOR)) {
    return (th.textContent || '').replace(/\s+/g, ' ').trim();
  }
  const clone = th.cloneNode(true);
  const elementsToRemove = clone.querySelectorAll(HEADER_NOISE_SELECTOR);
  elementsToRemove.forEach((el) => el.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}
function getElementTitleOrAria(el) {
  return el ? (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim() : '';
}
function isElementVisible(el) {
  if (!el || el.hidden) return false;
  if (el.classList.contains('sapMTableColHidden')) return false;
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  } catch (e) {
    if (el.style && el.style.display === 'none') return false;
  }
  return true;
}
function parseDurationMs(str) {
  if (!str) return -1;
  const s = str.toLowerCase().trim();
  if (!s || s === '-' || s === 'n/a' || s === 'null') return -1;
  let totalMs = 0;
  let matched = false;
  const hr = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h)\b/);
  if (hr) { totalMs += parseFloat(hr[1]) * 3600000; matched = true; }
  const min = s.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes|m)\b/);
  if (min) { totalMs += parseFloat(min[1]) * 60000; matched = true; }
  const sec = s.match(/(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds|s)(?!\s*ms)\b/);
  if (sec) { totalMs += parseFloat(sec[1]) * 1000; matched = true; }
  const ms = s.match(/(\d+(?:\.\d+)?)\s*(?:ms|millisecond|milliseconds)\b/);
  if (ms) { totalMs += parseFloat(ms[1]); matched = true; }
  if (matched) return totalMs;
  const numOnly = parseFloat(s.replace(/,/g, ''));
  return isNaN(numOnly) ? -1 : numOnly;
}
function parseDateTimeMs(str) {
  if (!str) return -1;
  const s = str.trim();
  if (!s || s === '-' || s === 'n/a' || s === 'null') return -1;
  const nativeParse = Date.parse(s);
  if (!isNaN(nativeParse) && nativeParse > 0) return nativeParse;
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const m = s.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})/i);
  if (m) {
    const mon = months[m[1].toLowerCase()];
    if (mon !== undefined) {
      return new Date(parseInt(m[3], 10), mon, parseInt(m[2], 10), parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
    }
  }
  const dmy = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (dmy) {
    return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), parseInt(dmy[4], 10), parseInt(dmy[5], 10), parseInt(dmy[6], 10)).getTime();
  }
  return -1;
}
let cachedMessagesTable = null;
function forgetMessagesTable() {
  cachedMessagesTable = null;
}
function findMessagesTable() {
  // The scan below is the expensive part of the heartbeat, so reuse the last hit
  // until SAP replaces the table.
  if (cachedMessagesTable && cachedMessagesTable.isConnected) return cachedMessagesTable;
  cachedMessagesTable = null;
  const tables = document.querySelectorAll('table');
  for (const table of tables) {
    const headers = table.querySelectorAll('th');
    if (headers.length === 0) continue;
    let matchCount = 0;
    for (const th of headers) {
      const text = normalizeText(getHeaderText(th));
      if (!text) continue;
      for (const kw of TABLE_IDENTIFIER_KEYWORDS) {
        if (text.includes(kw)) {
          matchCount++;
          break;
        }
      }
    }
    if (matchCount >= 3) {
      cachedMessagesTable = table;
      return table;
    }
  }
  return null;
}
const EXCLUDED_HEADER_NAMES = ['row actions', 'row action', 'actions', 'action', 'select all', 'select', 'selection', '>', '»', '→'];
function isExcludedHeader(fieldName) {
  if (!fieldName) return true;
  return EXCLUDED_HEADER_NAMES.includes(fieldName.toLowerCase().trim());
}
const STANDARD_CPI_FIELDS = [
  'Artifact Name', 'Status', 'Last Updated At', 'Artifact Type',
  'Processing Time', 'Log Level', 'Sender', 'Receiver', 'Custom Status'
];
function getColumnIndexMap(table) {
  const map = new Map();
  if (!table) return map;
  const headers = table.querySelectorAll('th');
  headers.forEach((th, idx) => {
    const text = getHeaderText(th);
    if (!text || isExcludedHeader(text)) return;
    map.set(text, { index: idx, thElement: th });
  });
  return map;
}
function getVisibleTargetFields(table) {
  if (!table) return [];
  const colMap = getColumnIndexMap(table);
  const visible = [];
  colMap.forEach((info, fieldName) => {
    if (!isExcludedHeader(fieldName) && isElementVisible(info.thElement)) {
      visible.push(fieldName);
    }
  });
  return visible;
}
function getRowGroups(tbody) {
  const trElements = Array.from(tbody.querySelectorAll('tr'));
  const groups = [];
  let currentGroup = null;
  trElements.forEach((tr) => {
    const isSubRow =
      tr.classList.contains('sapMListTblSubRow') ||
      tr.classList.contains('sapMListTblPopin') ||
      tr.getAttribute('data-sap-ui-popin') !== null ||
      (tr.cells.length === 1 && tr.cells[0].colSpan > 1) ||
      (tr.textContent.includes('Correlation ID:') && tr.textContent.includes('Message ID:'));
    if (isSubRow && currentGroup) {
      currentGroup.subRows.push(tr);
    } else {
      let origIdx = tr.dataset.cpiOriginalIndex;
      if (origIdx === undefined || origIdx === null || origIdx === '') {
        origIdx = groups.length;
        tr.dataset.cpiOriginalIndex = String(origIdx);
      } else {
        origIdx = parseInt(origIdx, 10);
      }
      currentGroup = { mainRow: tr, subRows: [], originalIndex: origIdx };
      groups.push(currentGroup);
    }
  });
  return groups;
}
function findCellForHeader(row, thElement, fieldName, table) {
  if (!row || !row.cells || row.cells.length === 0) return null;
  if (thElement) {
    const rawId = thElement.id || thElement.getAttribute('data-sap-ui') || '';
    const baseId = rawId.replace(/-(?:inner|text|title|label|header|col)$/i, '');
    const candidates = [rawId, baseId].filter(Boolean);
    if (candidates.length > 0) {
      for (let i = 0; i < row.cells.length; i++) {
        const td = row.cells[i];
        const headersAttr = td.getAttribute('headers') || '';
        const headersList = headersAttr.split(/\s+/).filter(Boolean);
        const colAttr = td.getAttribute('data-sap-ui-column') || '';
        const ariaList = (td.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        for (const cid of candidates) {
          if (headersList.includes(cid) || colAttr === cid || ariaList.includes(cid)) {
            return td;
          }
        }
      }
    }
  }
  if (table && thElement) {
    const allThs = Array.from(table.querySelectorAll('th'));
    const visibleThs = allThs.filter((th) => isElementVisible(th));
    const targetVisibleIdx = visibleThs.indexOf(thElement);
    if (targetVisibleIdx !== -1) {
      const visibleTds = Array.from(row.cells).filter((td) => isElementVisible(td));
      if (targetVisibleIdx < visibleTds.length) return visibleTds[targetVisibleIdx];
      if (targetVisibleIdx < row.cells.length) return row.cells[targetVisibleIdx];
    }
  }
  if (fieldName) {
    const normField = normalizeText(fieldName);
    for (let i = 0; i < row.cells.length; i++) {
      const td = row.cells[i];
      const dataTitle = td.getAttribute('data-title') || td.getAttribute('data-column-header') || '';
      if (normalizeText(dataTitle) === normField) return td;
    }
  }
  if (thElement && typeof thElement.cellIndex === 'number') {
    const cIdx = thElement.cellIndex;
    if (cIdx >= 0 && cIdx < row.cells.length) return row.cells[cIdx];
  }
  return null;
}
function extractCellValue(row, thElement, fieldName, table, subRows = []) {
  if (!row) return '';
  const cell = findCellForHeader(row, thElement, fieldName, table);
  if (!cell) return '';
  const elWithTitle = cell.querySelector('[title], [aria-label]') || (cell.hasAttribute('title') || cell.hasAttribute('aria-label') ? cell : null);
  const tooltipText = getElementTitleOrAria(elWithTitle);
  let rawText = (cell.textContent || '').replace(/\s+/g, ' ').trim();
  const isIconOnly = /^[\uE000-\uF8FF\s]*$/.test(rawText);
  let val = '';
  if (isIconOnly && tooltipText) {
    val = tooltipText;
  } else if (rawText) {
    val = rawText.replace(/^[\uE000-\uF8FF\s]+/, '').trim() || rawText;
  } else if (tooltipText) {
    val = tooltipText;
  }
  if (!val) {
    const statusEl = cell.querySelector('.sapMObjStatus, .sapUiIcon') || cell;
    const classList = statusEl.className || '';
    if (/Success|positive/i.test(classList)) val = 'Completed';
    else if (/Error|negative/i.test(classList)) val = 'Failed';
    else if (/Warning|critical/i.test(classList)) val = 'Escalated';
    else if (/Information|neutral/i.test(classList)) val = 'Processing';
  }
  if (!val && subRows && subRows.length > 0 && fieldName) {
    const normField = normalizeText(fieldName);
    for (const subRow of subRows) {
      const text = normalizeText(subRow.textContent);
      if (text.includes(normField)) {
        const popinVal = subRow.querySelector('.sapMListTblPopinVal, .sapMListTblSubRowVal');
        if (popinVal) {
          val = (popinVal.textContent || '').trim();
          break;
        }
        const m = subRow.textContent.match(new RegExp(fieldName + '[:\\s]+([^\\n\\r,;]+)', 'i'));
        if (m && m[1]) {
          val = m[1].trim();
          break;
        }
        val = subRow.textContent.replace(new RegExp(fieldName + '[:\\s]*', 'i'), '').trim();
        break;
      }
    }
  }
  return val.trim();
}
function compareGroupsMulti(groupA, groupB, rulesWithInfo, table) {
  for (const rule of rulesWithInfo) {
    const { field, direction, thElement } = rule;
    const valA = extractCellValue(groupA.mainRow, thElement, field, table, groupA.subRows);
    const valB = extractCellValue(groupB.mainRow, thElement, field, table, groupB.subRows);
    const isEmptyA = !valA || valA === '-' || valA === 'n/a';
    const isEmptyB = !valB || valB === '-' || valB === 'n/a';
    if (isEmptyA && isEmptyB) continue;
    if (isEmptyA) return 1;
    if (isEmptyB) return -1;
    let result = 0;
    const fLower = (field || '').toLowerCase();
    if (fLower === 'processing time') {
      result = parseDurationMs(valA) - parseDurationMs(valB);
    } else if (fLower === 'last updated at' || fLower.includes('date') || fLower.includes('time') || fLower.includes('updated')) {
      result = parseDateTimeMs(valA) - parseDateTimeMs(valB);
    } else {
      result = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (direction === 'desc') result = -result;
    if (result !== 0) return result;
  }
  // Stable tie-breaker: flip order when descending
  const primaryDir = rulesWithInfo.length > 0 ? rulesWithInfo[0].direction : 'asc';
  return primaryDir === 'desc'
    ? groupB.originalIndex - groupA.originalIndex
    : groupA.originalIndex - groupB.originalIndex;
}
function applyMultiSortToTable(showNotification = true) {
  const table = findMessagesTable();
  if (!table) return;
  const tbody = table.querySelector('tbody') || table;
  const colMap = getColumnIndexMap(table);
  const validRules = [];
  for (const r of sortRules) {
    if (r.field && colMap.has(r.field)) {
      const info = colMap.get(r.field);
      validRules.push({ field: r.field, direction: r.direction, colIndex: info.index, thElement: info.thElement });
    }
  }
  let groups = getRowGroups(tbody);
  if (validRules.length === 0) {
    groups.sort((a, b) => a.originalIndex - b.originalIndex);
    if (showNotification) showSortToast('Sort reset to original order');
  } else {
    groups.sort((a, b) => compareGroupsMulti(a, b, validRules, table));
    if (showNotification) {
      const summary = validRules.map((r, i) => `${i + 1}. ${r.field} (${r.direction.toUpperCase()})`).join(' ➔ ');
      showSortToast(`Sorted: ${summary}`);
    }
  }
  const fragment = document.createDocumentFragment();
  groups.forEach((group) => {
    fragment.appendChild(group.mainRow);
    group.subRows.forEach((subRow) => fragment.appendChild(subRow));
  });
  tbody.appendChild(fragment);
}
function showSortToast(message) {
  let toast = document.querySelector('.cpi-sort-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'cpi-sort-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}
// ============================================================================
// 4. SAP VALUE HELP DIALOG (MULTI-SELECT WITH PRIORITY NUMBERING)
// ============================================================================
/**
 * Opens an SAP-styled Value Help Dialog (Screenshot 1) supporting multi-selection
 * with automatic priority numbering (1st selected = primary sort).
 */
function openValueHelpDialog(onSelectCallback) {
  // Remove existing dialog if any
  const existingBackdrop = document.querySelector('.cpi-dialog-backdrop');
  if (existingBackdrop) existingBackdrop.remove();
  const table = findMessagesTable();
  let fields = getVisibleTargetFields(table);
  if (fields.length === 0) fields = STANDARD_CPI_FIELDS.slice();
  // Load currently active fields in selection order
  let tempSelected = sortRules.map((r) => r.field).filter(Boolean);
  // Create Modal Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'cpi-dialog-backdrop';
  // Create Dialog Box
  const dialogBox = document.createElement('div');
  dialogBox.className = 'cpi-dialog-box';
  // Dialog Header
  const header = document.createElement('div');
  header.className = 'cpi-dialog-header';
  const title = document.createElement('h3');
  title.className = 'cpi-dialog-title';
  title.textContent = 'Select Field';
  header.appendChild(title);
  // Search Input with Magnifying Glass Icon (Screenshot 1)
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'cpi-dialog-search-wrapper';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'cpi-dialog-search-input';
  searchInput.placeholder = 'Search Fields';
  const searchIcon = document.createElement('span');
  searchIcon.className = 'cpi-dialog-search-icon';
  searchIcon.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `;
  searchWrapper.appendChild(searchInput);
  searchWrapper.appendChild(searchIcon);
  header.appendChild(searchWrapper);
  dialogBox.appendChild(header);
  // List of Fields
  const list = document.createElement('ul');
  list.className = 'cpi-dialog-list';
  function renderListItems(filteredFields) {
    list.innerHTML = '';
    filteredFields.forEach((field) => {
      // Find priority index (0-indexed)
      const orderIndex = tempSelected.indexOf(field);
      const isSelected = orderIndex !== -1;
      const item = document.createElement('li');
      item.className = 'cpi-dialog-item' + (isSelected ? ' selected' : '');
      // Checkbox element displaying the priority number (1, 2, 3...) when selected
      const checkbox = document.createElement('span');
      checkbox.className = 'cpi-dialog-checkbox';
      if (isSelected) {
        checkbox.textContent = String(orderIndex + 1);
      }
      const label = document.createElement('span');
      label.textContent = field;
      item.appendChild(checkbox);
      item.appendChild(label);
      // Clicking toggles selection and appends/removes from priority list
      item.addEventListener('click', () => {
        const idx = tempSelected.indexOf(field);
        if (idx !== -1) {
          // Uncheck: remove and re-number remaining
          tempSelected.splice(idx, 1);
        } else {
          // Check: append to priority list
          tempSelected.push(field);
        }
        renderListItems(filteredFields);
        updateSelectBtnText();
      });
      list.appendChild(item);
    });
  }
  renderListItems(fields);
  dialogBox.appendChild(list);
  // Real-time search filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = fields.filter((f) => f.toLowerCase().includes(query));
    renderListItems(filtered);
  });
  // Dialog Footer
  const footer = document.createElement('div');
  footer.className = 'cpi-dialog-footer';
  // "Clear all" link button
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'cpi-dialog-btn-clear';
  clearBtn.textContent = 'Clear all';
  clearBtn.addEventListener('click', () => {
    tempSelected = [];
    renderListItems(fields);
    updateSelectBtnText();
  });
  footer.appendChild(clearBtn);
  const actionsWrapper = document.createElement('div');
  actionsWrapper.className = 'cpi-dialog-footer-actions';
  const selectBtn = document.createElement('button');
  selectBtn.type = 'button';
  selectBtn.className = 'cpi-dialog-btn-select';
  selectBtn.textContent = 'Select';
  function updateSelectBtnText() {
    selectBtn.textContent = tempSelected.length > 1 ? `Select (${tempSelected.length})` : 'Select';
  }
  updateSelectBtnText();
  function confirmSelection() {
    backdrop.remove();
    document.removeEventListener('keydown', handleKeyDown);
    onSelectCallback(tempSelected);
  }
  selectBtn.addEventListener('click', confirmSelection);
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cpi-dialog-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  function cancelDialog() {
    backdrop.remove();
    document.removeEventListener('keydown', handleKeyDown);
  }
  cancelBtn.addEventListener('click', cancelDialog);
  actionsWrapper.appendChild(selectBtn);
  actionsWrapper.appendChild(cancelBtn);
  footer.appendChild(actionsWrapper);
  dialogBox.appendChild(footer);
  backdrop.appendChild(dialogBox);
  document.body.appendChild(backdrop);
  // Close when clicking outside dialog box
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) cancelDialog();
  });
  // Handle Enter and Escape keys
  function handleKeyDown(e) {
    if (e.key === 'Escape') cancelDialog();
    if (e.key === 'Enter') confirmSelection();
  }
  document.addEventListener('keydown', handleKeyDown);
  // Auto-focus search input
  setTimeout(() => searchInput.focus(), 50);
}
// ============================================================================
// 5. TOOLBAR RENDERING (MULTI-LEVEL CHAINING)
// ============================================================================
function syncDropdownFields() {
  const table = findMessagesTable();
  if (!table) return;
  const inputs = document.querySelectorAll('.cpi-value-help-input');
  inputs.forEach((input, idx) => {
    const rule = sortRules[idx];
    if (!rule) return;
    const textSpan = input.querySelector('.cpi-value-help-text');
    if (!textSpan) return;
    if (rule.field) {
      textSpan.textContent = rule.field;
      textSpan.classList.remove('placeholder');
    } else {
      textSpan.textContent = 'All';
      textSpan.classList.add('placeholder');
    }
  });
  updateActionButtonsVisibility();
}
function renderToolbarContent() {
  const toolbar = document.getElementById('cpi-sort-toolbar-container');
  if (!toolbar) return;
  toolbar.innerHTML = '';
  sortRules.forEach((rule, index) => {
    const group = document.createElement('div');
    group.className = 'cpi-sort-rule-group' + (rule.field ? ' active' : '');
    // Pure text label
    const label = document.createElement('span');
    label.className = 'cpi-sort-toolbar-label';
    label.innerHTML = index === 0 ? '<span>Sort by:</span>' : '<span>Then by:</span>';
    group.appendChild(label);
    // SAPUI5 Value Help Input (Screenshot 2)
    const valHelpInput = document.createElement('div');
    valHelpInput.className = 'cpi-value-help-input';
    valHelpInput.tabIndex = 0;
    valHelpInput.title = 'Click to choose sort fields';
    const textSpan = document.createElement('span');
    textSpan.className = 'cpi-value-help-text' + (!rule.field ? ' placeholder' : '');
    textSpan.textContent = rule.field || 'All';
    valHelpInput.appendChild(textSpan);
    // Overlapping squares icon (Value Help Icon)
    const iconSpan = document.createElement('span');
    iconSpan.className = 'cpi-value-help-icon';
    iconSpan.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="13" height="13" rx="2"></rect>
        <path d="M8 8h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8z"></path>
      </svg>
    `;
    valHelpInput.appendChild(iconSpan);
    // Open multi-select Value Help Dialog on click
    function triggerValueHelp() {
      openValueHelpDialog((selectedFieldList) => {
        if (selectedFieldList.length === 0) {
          // Reset to empty single rule
          sortRules = [{ field: '', direction: 'asc' }];
        } else {
          // Map selected fields in chosen order; 1st selected = primary sort
          const updatedRules = [];
          selectedFieldList.forEach((field) => {
            const existing = sortRules.find((r) => r.field === field);
            updatedRules.push({
              field: field,
              direction: existing ? existing.direction : 'asc'
            });
          });
          sortRules = updatedRules;
        }
        renderToolbarContent();
        applyMultiSortToTable(true);
      });
    }
    valHelpInput.addEventListener('click', triggerValueHelp);
    valHelpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerValueHelp();
      }
    });
    group.appendChild(valHelpInput);
    // Direction Toggle Button (Asc / Desc)
    const dirBtn = document.createElement('button');
    dirBtn.className = 'cpi-sort-btn' + (rule.field ? ' cpi-btn-active' : '');
    dirBtn.type = 'button';
    dirBtn.textContent = rule.direction === 'desc' ? 'Desc' : 'Asc';
    dirBtn.title = 'Toggle Ascending / Descending';
    dirBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rule.direction = rule.direction === 'asc' ? 'desc' : 'asc';
      dirBtn.textContent = rule.direction === 'desc' ? 'Desc' : 'Asc';
      if (rule.field) applyMultiSortToTable(true);
    });
    group.appendChild(dirBtn);
    // Remove Level Button (✕) for secondary levels
    if (index > 0) {
      const delBtn = document.createElement('button');
      delBtn.className = 'cpi-sort-del-btn';
      delBtn.type = 'button';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove this sort level';
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sortRules.splice(index, 1);
        renderToolbarContent();
        applyMultiSortToTable(true);
      });
      group.appendChild(delBtn);
    }
    toolbar.appendChild(group);
  });
  createToolbarActions(toolbar);
}
function createToolbarActions(toolbar) {
  // "+ Then by..." link
  const addBtn = document.createElement('button');
  addBtn.id = 'cpi-sort-add-btn';
  addBtn.className = 'cpi-sort-add-btn';
  addBtn.type = 'button';
  addBtn.innerHTML = '+ Then by...';
  addBtn.title = 'Add secondary sort level';
  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sortRules.push({ field: '', direction: 'asc' });
    renderToolbarContent();
  });
  toolbar.appendChild(addBtn);
  // "Reset" link
  const resetBtn = document.createElement('button');
  resetBtn.id = 'cpi-sort-reset-btn';
  resetBtn.className = 'cpi-sort-reset-btn';
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';
  resetBtn.title = 'Reset all sort levels and restore original order';
  resetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sortRules = [{ field: '', direction: 'asc' }];
    renderToolbarContent();
    applyMultiSortToTable(true);
  });
  toolbar.appendChild(resetBtn);
  updateActionButtonsVisibility();
}
function updateActionButtonsVisibility() {
  const addBtn = document.getElementById('cpi-sort-add-btn');
  if (addBtn) {
    const table = findMessagesTable();
    const visibleFields = getVisibleTargetFields(table);
    const maxCount = visibleFields.length > 0 ? visibleFields.length : 20;
    addBtn.style.display = sortRules.length < maxCount && sortRules[0].field ? 'inline-flex' : 'none';
  }
  const resetBtn = document.getElementById('cpi-sort-reset-btn');
  if (resetBtn) {
    const hasActiveSort = sortRules.some((r) => r.field !== '') || sortRules.length > 1;
    resetBtn.style.display = hasActiveSort ? 'inline-flex' : 'none';
  }
}
function injectToolbar(table) {
  if (document.getElementById('cpi-sort-toolbar-container')) return;
  let anchorContainer = null, anchorElement = null, refreshBtn = null;
  const buttons = document.querySelectorAll('button, .sapMBtn');
  for (const btn of buttons) {
    const title = getElementTitleOrAria(btn).toLowerCase();
    if (title.includes('setting') || title.includes('personaliz') || title.includes('column')) {
      anchorElement = btn.closest('.sapMBtn') || btn;
      anchorContainer = anchorElement.parentElement;
      break;
    }
    if (!refreshBtn && title.includes('refresh')) {
      refreshBtn = btn.closest('.sapMBtn') || btn;
    }
  }
  if (!anchorElement && refreshBtn) {
    anchorElement = refreshBtn;
    anchorContainer = anchorElement.parentElement;
  }
  if (!anchorContainer) {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .sapMTitle, .sapMTB');
    for (const el of headings) {
      if (el.textContent && el.textContent.includes('Messages (')) {
        anchorContainer = el;
        break;
      }
    }
  }
  if (!anchorContainer) anchorContainer = table.parentElement;
  const toolbar = document.createElement('div');
  toolbar.id = 'cpi-sort-toolbar-container';
  if (anchorElement && anchorElement.parentElement) {
    anchorElement.insertAdjacentElement('afterend', toolbar);
  } else if (anchorContainer.classList.contains('sapMTB') || anchorContainer.classList.contains('sapMIBar')) {
    anchorContainer.appendChild(toolbar);
  } else {
    anchorContainer.insertAdjacentElement('afterend', toolbar);
  }
  renderToolbarContent();
}
function initializeSorter() {
  const table = findMessagesTable();
  if (!table) return;
  const tbody = table.querySelector('tbody') || table;
  getRowGroups(tbody);
  injectToolbar(table);
  syncDropdownFields();
}
})();
