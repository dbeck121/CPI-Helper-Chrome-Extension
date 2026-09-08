/**
 * SAP CPI Helper Plugin - MPL Table Sorter
 * Adds easy, flexible column sorting directly to the SAP CPI Messages monitoring table.
 * Author: Prem Sai Daggolu
 * Repository: https://github.com/premsaidaggolu/cpi-mpl-sorter
 */

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
  description: "Adds easy column sorting directly to the SAP CPI Messages monitoring table.",

  // Configurable settings displayed in the CPI Helper popup menu
  settings: {
    enableMultiSort: {
      text: "Enable MPL Sorting on Messages Monitoring Table",
      type: "checkbox",
      scope: "browser",
      default: true
    }
  },

  /**
   * Periodic lifecycle hook called by CPI Helper's content script loop.
   * Handles initialization, settings toggles, and cleanups during page navigation.
   */
  heartbeat: async (pluginHelper, settings) => {
    // Read the toggle setting (with fallback support)
    let isEnabled = settings["mplTableSorter---enableMultiSort"];
    if (isEnabled === undefined) isEnabled = settings["enableMultiSort"];
    if (isEnabled === undefined) isEnabled = true;

    const existingToolbar = document.getElementById("cpi-sort-toolbar-container");

    // If user disabled the plugin in settings, remove the toolbar if present
    if (!isEnabled) {
      if (existingToolbar) existingToolbar.remove();
      return;
    }

    // Inject styles on demand
    injectPluginStyles();

    // Check if the SAP CPI Messages table is present on the current page
    const table = findMessagesTable();

    if (table && !existingToolbar) {
      // First time entering the Messages table -> initialize sorter toolbar
      initializeSorter();
    } else if (table && existingToolbar) {
      // Table already has toolbar -> ensure dropdown fields stay in sync with table columns
      syncDropdownFields();
    } else if (!table && existingToolbar) {
      // User navigated away from the monitoring table -> clean up toolbar
      existingToolbar.remove();
    }
  }
};

// Register this plugin in CPI Helper's global plugin list
pluginList.push(plugin);

// ============================================================================
// 2. SELF-CONTAINED STYLES INJECTION
// ============================================================================

/**
 * Injects CSS rules directly into document.head so the plugin is 100% self-contained
 * and does not require modifying any external CSS stylesheets.
 */
function injectPluginStyles() {
  if (document.getElementById("cpi-mpl-sorter-styles")) return;

  const style = document.createElement("style");
  style.id = "cpi-mpl-sorter-styles";
  style.textContent = `
    /* Sort toolbar container embedded next to Settings gear */
    #cpi-sort-toolbar-container {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-left: 8px;
      padding: 3px 10px;
      background-color: #f7f9fa;
      border: 1px solid #d9d9d9;
      border-radius: 6px;
      font-family: "72", "72full", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #32363a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      vertical-align: middle;
      z-index: 10;
    }

    /* Individual sort rule group (Sort by / Then by) */
    .cpi-sort-rule-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: #ffffff;
      padding: 2px 8px;
      border: 1px solid #c4cacf;
      border-radius: 4px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .cpi-sort-rule-group.active {
      border-color: #0070f2;
      background-color: #f5f9ff;
    }

    .cpi-sort-toolbar-label {
      font-weight: 600;
      color: #555b63;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    /* Field dropdown */
    .cpi-sort-select {
      padding: 3px 6px;
      font-size: 12px;
      color: #32363a;
      background-color: #ffffff;
      border: 1px solid #b3b9c0;
      border-radius: 4px;
      cursor: pointer;
      outline: none;
      max-width: 175px;
    }

    /* Standard button styling */
    .cpi-sort-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 3px 8px;
      font-size: 11.5px;
      font-weight: 500;
      color: #32363a;
      background-color: #ffffff;
      border: 1px solid #b3b9c0;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .cpi-sort-btn:hover {
      background-color: #ebf4fd;
      border-color: #0070f2;
      color: #0070f2;
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
    }
    .cpi-sort-del-btn:hover {
      color: #b00;
      background-color: #ffebeb;
    }

    /* Add sort level button (+ Then by...) */
    .cpi-sort-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      font-size: 11.5px;
      font-weight: 600;
      color: #0070f2;
      background-color: transparent;
      border: 1px dashed #0070f2;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }
    .cpi-sort-add-btn:hover {
      background-color: #ebf4fd;
      border-style: solid;
    }

    /* Reset button (↺ Reset) */
    .cpi-sort-reset-btn {
      color: #6a6d70;
      font-size: 11px;
    }
    .cpi-sort-reset-btn:hover {
      color: #b00;
      border-color: #b00;
      background-color: #fff0f0;
    }

    /* Toast popup for status messages */
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
// 3. CORE STATE & UTILITIES
// ============================================================================

// Keywords to accurately find the Messages table in the DOM
const TABLE_IDENTIFIER_KEYWORDS = ['artifact', 'status', 'updated', 'type', 'time', 'sender', 'receiver', 'message'];

// Active sort rules: each rule has a field name and direction ('asc' or 'desc')
let sortRules = [{ field: '', direction: 'asc' }];
let isSorting = false;

/**
 * Normalizes text to lowercase single-spaced string for reliable comparisons
 */
function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Safely extracts clean text from a table header (th), ignoring hidden helper text
 */
function getHeaderText(th) {
  if (!th) return '';
  const clone = th.cloneNode(true);
  const elementsToRemove = clone.querySelectorAll(
    '.cpi-sort-icon, .sapUiPseudoInvisibleText, .sapUiInvisibleText, [aria-hidden="true"]'
  );
  elementsToRemove.forEach((el) => el.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Retrieves the title or aria-label from an element (used for tooltips/status icons)
 */
function getElementTitleOrAria(el) {
  return el ? (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim() : '';
}

/**
 * Checks if a table column or cell is currently visible on screen
 */
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

// ============================================================================
// 4. SMART DATA PARSERS
// ============================================================================

/**
 * Converts duration strings (e.g. "1 sec 49 ms", "234 ms", "2 min 10 sec")
 * into total milliseconds for true numeric sorting.
 */
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

/**
 * Parses dates and timestamps across formats into epoch milliseconds for chronological sorting
 */
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

// ============================================================================
// 5. TABLE & COLUMN DETECTION
// ============================================================================

/**
 * Locates the SAP CPI Messages table in the DOM by inspecting column header text
 */
function findMessagesTable() {
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

    if (matchCount >= 3) return table;
  }
  return null;
}

// Non-data columns (arrows, selection boxes, row actions) to exclude from dropdown
const EXCLUDED_HEADER_NAMES = ['row actions', 'row action', 'actions', 'action', 'select all', 'select', 'selection', '>', '»', '→'];
function isExcludedHeader(fieldName) {
  if (!fieldName) return true;
  return EXCLUDED_HEADER_NAMES.includes(fieldName.toLowerCase().trim());
}

// Default CPI fields for instant initial dropdown load
const STANDARD_CPI_FIELDS = [
  'Artifact Name', 'Status', 'Last Updated At', 'Artifact Type',
  'Processing Time', 'Log Level', 'Sender', 'Receiver', 'Custom Status'
];

/**
 * Creates a map of visible column headers from <th> elements
 */
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

/**
 * Returns list of fields currently visible on screen in left-to-right order
 */
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

/**
 * Groups table rows together, keeping sub-rows (Correlation ID, Message ID, popins)
 * atomically attached to their parent row so details never detach.
 */
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

// ============================================================================
// 6. CELL RESOLUTION & VALUE EXTRACTION
// ============================================================================

/**
 * Locates the specific <td> cell that corresponds to a <th> header using multiple fallback strategies
 */
function findCellForHeader(row, thElement, fieldName, table) {
  if (!row || !row.cells || row.cells.length === 0) return null;

  // Strategy 1: Match by SAPUI5 column ID attribute
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

  // Strategy 2: Match by visible column index
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

  // Strategy 2.5: Match by cell data title attribute
  if (fieldName) {
    const normField = normalizeText(fieldName);
    for (let i = 0; i < row.cells.length; i++) {
      const td = row.cells[i];
      const dataTitle = td.getAttribute('data-title') || td.getAttribute('data-column-header') || '';
      if (normalizeText(dataTitle) === normField) return td;
    }
  }

  // Strategy 3: Native cellIndex fallback
  if (thElement && typeof thElement.cellIndex === 'number') {
    const cIdx = thElement.cellIndex;
    if (cIdx >= 0 && cIdx < row.cells.length) return row.cells[cIdx];
  }

  return null;
}

/**
 * Extracts clean cell values, handling icons, tooltips, and status classes
 */
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

  // Status CSS class fallback if text is empty
  if (!val) {
    const statusEl = cell.querySelector('.sapMObjStatus, .sapUiIcon') || cell;
    const classList = statusEl.className || '';
    if (/Success|positive/i.test(classList)) val = 'Completed';
    else if (/Error|negative/i.test(classList)) val = 'Failed';
    else if (/Warning|critical/i.test(classList)) val = 'Escalated';
    else if (/Information|neutral/i.test(classList)) val = 'Processing';
  }

  // Fallback to sub-rows (popins) if column is hidden in compact view
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

// ============================================================================
// 7. COMPARISON & TABLE SORTING
// ============================================================================

/**
 * Compares two row groups across all active sort rules
 */
function compareGroupsMulti(groupA, groupB, rulesWithInfo, table) {
  for (const rule of rulesWithInfo) {
    const { field,
