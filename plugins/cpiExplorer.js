var plugin = {
    metadataVersion: "1.0.0",
    id: "cpiExplorer",
    name: "CPI Explorer",
    version: "3.2.0",
    author: "Lokesh Bhukya",
    description: "Search CPI tenant iFlow configuration and externalized parameters.",
    settings: {},
    toolbarButton: {
        title: "CPI Explorer",
        onClick: function (pluginHelper) {
            CPI_EXPLORER.open(pluginHelper);
        },
    },
};

var CPI_EXPLORER = (() => {
    "use strict";

    /* ------------------------------------------------------------------
     * Constants
     * ------------------------------------------------------------------ */

    const MAX_DEPTH = 15;
    const MAX_VALUE_LENGTH = 3000;
    const MAX_MATCHES_PER_FLOW = 20;
    const CONCURRENT_REQUESTS = 2;

    /** Keys / path suffixes that only carry UI data and are never indexed. */
    const UI_ONLY_KEYS = ["svg", "icon", "style", "bounds", "position"];
    const UI_ONLY_SUFFIXES = UI_ONLY_KEYS.map((key) => "." + key);

    const IDS = {
        root: "cpi-explorer",
        css: "cpi-explorer-css",
        close: "cpi-close",
        packageFilter: "cpi-package-filter",
        flowFilter: "cpi-flow-filter",
        clearFilters: "cpi-clear-filters",
        input: "cpi-explorer-input",
        searchButton: "cpi-search-button",
        status: "cpi-status",
        refresh: "cpi-refresh-index",
        hint: "cpi-hint",
        results: "cpi-results",
    };

    /* ------------------------------------------------------------------
     * State
     * ------------------------------------------------------------------ */

    let helper = null;
    let tenant = "";
    let baseUrl = "";

    /**
     * Local tenant index.
     * @type {Array<{packageName: string, packageId: string, flowName: string,
     *                values: Array<{path: string, value: string}>}>}
     */
    let index = [];
    let indexPromise = null;
    let indexedTenant = "";
    let searchId = 0; // incremented to cancel stale searches
    let flowCount = 0;
    let knownPackages = []; // [{ id, name }] straight from the package list

    /* ------------------------------------------------------------------
     * Small utilities
     * ------------------------------------------------------------------ */

    const $ = (id) => document.getElementById(id);

    const isBlank = (value) => value === null || value === undefined || String(value) === "";

    const compareText = (a, b) => a.localeCompare(b);

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function updateStatus(message) {
        const status = $(IDS.status);
        if (status) status.textContent = message;
    }

    /* Friendly messages shown (and rotated) while the index is being built. */
    const WAIT_MESSAGES = [
        "☕ Grab a coffee — we're reading every iFlow in your tenant.",
        "🐢 Slow now, lightning fast later. Promise!",
        "📦 Unpacking packages one by one, no peeking at the gift wrap...",
        "🕵️ Hunting down every hidden hostname and endpoint...",
        "🧘 Good things come to those who wait for the index.",
        "🔍 Teaching the search box where you hid all your parameters...",
        "🚀 Still going! The iFlows are many, but we are mighty.",
        "🍿 Perfect time to stretch your legs. We'll shout when it's done.",
        "🧹 Tidying up thousands of values so your search is instant.",
    ];
    const HINT_INTERVAL_MS = 4000;
    let hintTimer = null;

    function setHint(text) {
        const hint = $(IDS.hint);
        if (hint) hint.textContent = text;
    }

    function startHints() {
        stopHints();
        let next = Math.floor(Math.random() * WAIT_MESSAGES.length);
        const show = () => {
            setHint(WAIT_MESSAGES[next]);
            next = (next + 1) % WAIT_MESSAGES.length;
        };
        show();
        hintTimer = setInterval(show, HINT_INTERVAL_MS);
    }

    function stopHints() {
        if (hintTimer) clearInterval(hintTimer);
        hintTimer = null;
        setHint("");
    }

    function createOption(value, label) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
    }

    /* ------------------------------------------------------------------
     * API
     * ------------------------------------------------------------------ */

    async function get(url) {
        const response = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        return response.json();
    }

    /** CPI answers with a bare array, `{ results }` or `{ d: { results } }`. */
    function unwrapResults(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.results)) return data.results;
        if (data && data.d && Array.isArray(data.d.results)) return data.d.results;
        return [];
    }

    async function getPackages() {
        return unwrapResults(await get(`${baseUrl}workspace/`));
    }

    async function getArtifacts(packageId) {
        const url = `${baseUrl}workspace/${encodeURIComponent(packageId)}/artifacts/`;
        return unwrapResults(await get(url));
    }

    const getPackageId = (pkg) =>
        pkg.id || pkg.entityID || pkg.entityId || pkg.packageId || pkg.technicalName;

    const getPackageName = (pkg) =>
        pkg.technicalName || pkg.name || pkg.displayName || pkg.id || "Unknown Package";

    const getFlowName = (artifact, flow) =>
        flow.name ||
        artifact.name ||
        artifact.tooltip ||
        artifact.displayName ||
        artifact.technicalName ||
        artifact.id ||
        "Unknown iFlow";

    /** Candidate names under which CPI may expose the iFlow. */
    function getArtifactNames(artifact) {
        const names = [];
        [
            artifact.tooltip,
            artifact.name,
            artifact.displayName,
            artifact.technicalName,
            artifact.id,
            artifact.entityID,
            artifact.entityId,
        ].forEach((candidate) => {
            if (!candidate) return;
            const name = String(candidate);
            if (!names.includes(name)) names.push(name);
        });
        return names;
    }

    /** Returns the first successful response for the given URLs, or null. */
    async function fetchFirst(urls, onError) {
        for (const { url, name } of urls) {
            try {
                const data = await get(url);
                if (data) return { data, name };
            } catch (error) {
                if (onError) onError(name, error);
            }
        }
        return null;
    }

    /**
     * Loads iFlow content.
     *
     * First tries the request used by the CPI "Configure" screen
     * (contains configured externalized parameter values), then falls
     * back to the plain iFlow request.
     */
    async function getIFlow(packageId, artifact) {
        const entityId = artifact.entityID || artifact.entityId || artifact.id;
        if (!entityId) return null;

        const names = getArtifactNames(artifact);
        const basePath =
            `${baseUrl}workspace/${encodeURIComponent(packageId)}` +
            `/artifacts/${encodeURIComponent(entityId)}` +
            `/entities/${encodeURIComponent(entityId)}/iflows/`;

        const configureQuery =
            "?action=iPkgConfigure&isConfigureRead=true&type=Flow&filterByRuntimeProfileType=";

        const configured = await fetchFirst(
            names.map((name) => ({ name, url: basePath + encodeURIComponent(name) + configureQuery })),
            (name, error) =>
                console.warn(`CPI Explorer: Configure request failed for ${name}`, error)
        );
        if (configured) return { ...configured, configure: true };

        const normal = await fetchFirst(
            names.map((name) => ({ name, url: basePath + encodeURIComponent(name) }))
        );
        return normal ? { ...normal, configure: false } : null;
    }

    /* ------------------------------------------------------------------
     * Value collection
     * ------------------------------------------------------------------ */

    const isConfiguredParameter = (value) =>
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.key &&
        value.additionalMetadata &&
        String(value.additionalMetadata.Configured).toLowerCase() === "true";

    /**
     * Recursively flattens a structure into `{ path, value }` pairs.
     * Includes normal values plus configured and default externalized
     * parameters.
     */
    function collectValues(value, path, result, depth) {
        if (value === null || value === undefined) return;
        if (depth > MAX_DEPTH) return;
        if (UI_ONLY_SUFFIXES.some((suffix) => path.endsWith(suffix))) return;

        // Primitive
        if (["string", "number", "boolean"].includes(typeof value)) {
            result.push({
                path: path || "value",
                value: String(value).substring(0, MAX_VALUE_LENGTH),
            });
            return;
        }

        // Externalized parameter: { key, value, defaultValue, additionalMetadata }
        if (isConfiguredParameter(value)) {
            const key = String(value.key);

            if (!isBlank(value.value)) {
                result.push({
                    path: `Externalized Parameter.${key}`,
                    value: String(value.value),
                });
            }
            if (!isBlank(value.defaultValue)) {
                result.push({
                    path: `Externalized Parameter.${key}.Default`,
                    value: String(value.defaultValue),
                });
            }
        }

        // Array
        if (Array.isArray(value)) {
            value.forEach((item, i) => collectValues(item, `${path}[${i}]`, result, depth + 1));
            return;
        }

        // Object
        if (typeof value === "object") {
            Object.keys(value).forEach((key) => {
                if (UI_ONLY_KEYS.includes(key)) return;
                const childPath = path ? `${path}.${key}` : key;
                collectValues(value[key], childPath, result, depth + 1);
            });
        }
    }

    function removeDuplicates(values) {
        const seen = new Set();
        return values.filter(({ path, value }) => {
            const key = `${path}|${value}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /* ------------------------------------------------------------------
     * Indexing
     * ------------------------------------------------------------------ */

    async function indexIFlow(packageInfo, artifact) {
        const packageId = getPackageId(packageInfo);
        if (!packageId) return;

        const flow = await getIFlow(packageId, artifact);
        if (!flow) return;

        const values = [];
        collectValues(flow.data, "", values, 0);
        const uniqueValues = removeDuplicates(values);
        if (!uniqueValues.length) return;

        index.push({
            packageName: getPackageName(packageInfo),
            packageId,
            flowName: getFlowName(artifact, flow),
            values: uniqueValues,
        });
        flowCount++;
    }

    async function indexPackage(packageInfo, packageNumber, totalPackages) {
        const packageId = getPackageId(packageInfo);
        if (!packageId) return;

        let artifacts;
        try {
            artifacts = await getArtifacts(packageId);
        } catch (error) {
            console.warn("CPI Explorer: Could not load artifacts", packageInfo, error);
            return;
        }

        const packageName = getPackageName(packageInfo);
        updateStatus(`Reading package ${packageNumber} of ${totalPackages}: ${packageName}`);

        // Simple worker pool: N workers pull from a shared cursor.
        let next = 0;

        const worker = async () => {
            while (next < artifacts.length) {
                const current = next++;
                updateStatus(
                    `Reading package ${packageNumber} of ${totalPackages}: ${packageName} ` +
                    `— iFlow ${current + 1} of ${artifacts.length}`
                );

                try {
                    await indexIFlow(packageInfo, artifacts[current]);
                } catch (error) {
                    console.warn("CPI Explorer: Failed to index iFlow", artifacts[current], error);
                }
            }
        };

        await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, worker));
    }

    async function buildIndex(forceRefresh) {
        if (!forceRefresh && indexedTenant === tenant && index.length > 0) return;
        if (indexPromise) return indexPromise;

        indexPromise = (async () => {
            index = [];
            flowCount = 0;

            startHints();
            updateStatus("Contacting CPI to get the list of packages...");
            const packages = await getPackages();

            const byId = {};
            packages.forEach((pkg) => {
                const id = getPackageId(pkg);
                if (id) byId[id] = getPackageName(pkg);
            });
            knownPackages = Object.keys(byId).map((id) => ({ id, name: byId[id] }));
            populatePackageFilter(); // names are selectable while indexing continues

            updateStatus(`Found ${packages.length} packages — now reading every iFlow inside them.`);

            for (let i = 0; i < packages.length; i++) {
                await indexPackage(packages[i], i + 1, packages.length);
            }

            indexedTenant = tenant;
            await saveCachedIndex();
            populatePackageFilter();
            stopHints();
            updateStatus(`Ready. ${flowCount} iFlows loaded. Go ahead and search.`);
        })();

        try {
            await indexPromise;
        } catch (error) {
            stopHints(); // on success the build already stopped them and set its own tip
            throw error;
        } finally {
            indexPromise = null;
        }
    }

    /* ------------------------------------------------------------------
     * Saved index (IndexedDB) – survives browser refresh
     * ------------------------------------------------------------------ */

    const DB_NAME = "cpiExplorer";
    const DB_STORE = "index";

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /** Runs one IndexedDB request on the store and resolves with its result. */
    async function dbRequest(mode, action) {
        const db = await openDb();
        try {
            return await new Promise((resolve, reject) => {
                const request = action(db.transaction(DB_STORE, mode).objectStore(DB_STORE));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } finally {
            db.close();
        }
    }

    async function loadCachedIndex() {
        try {
            const cached = await dbRequest("readonly", (store) => store.get(tenant));
            return cached && Array.isArray(cached.index) && cached.index.length ? cached : null;
        } catch (error) {
            console.warn("CPI Explorer: Could not read saved index", error);
            return null;
        }
    }

    async function saveCachedIndex() {
        try {
            await dbRequest("readwrite", (store) =>
                store.put({ savedAt: Date.now(), flowCount, index, packages: knownPackages }, tenant)
            );
        } catch (error) {
            console.warn("CPI Explorer: Could not save index", error);
        }
    }

    function applyCachedIndex(cached) {
        index = cached.index;
        knownPackages = cached.packages || [];
        flowCount = cached.flowCount || cached.index.length;
        indexedTenant = tenant;
        populatePackageFilter();
        updateStatus(`Ready. ${flowCount} iFlows loaded. Go ahead and search.`);
    }

    let ensurePromise = null;

    /**
     * Makes sure an index is available: memory first, then the saved copy,
     * and only then a fresh download from the tenant.
     */
    function ensureIndex() {
        if (indexedTenant === tenant && index.length > 0) return Promise.resolve();
        if (ensurePromise) return ensurePromise;

        ensurePromise = (async () => {
            const cached = await loadCachedIndex();
            if (cached) {
                applyCachedIndex(cached);
                return;
            }
            updateStatus("First time here — reading all iFlows from the tenant. This is a one-time wait.");
            await buildIndex(false);
        })();

        const clear = () => { ensurePromise = null; };
        ensurePromise.then(clear, clear);
        return ensurePromise;
    }

    /* ------------------------------------------------------------------
     * Filters
     * ------------------------------------------------------------------ */

    function getUniquePackages() {
        if (knownPackages.length) {
            return [...knownPackages].sort((a, b) => compareText(a.name, b.name));
        }

        const byId = {};
        index.forEach((item) => {
            if (item.packageId) byId[item.packageId] = item.packageName;
        });

        return Object.keys(byId)
            .map((id) => ({ id, name: byId[id] }))
            .sort((a, b) => compareText(a.name, b.name));
    }

    function getFlowsForPackage(packageId) {
        const names = new Set();
        index.forEach((item) => {
            if (!packageId || item.packageId === packageId) names.add(item.flowName);
        });
        return [...names].sort(compareText);
    }

    function populatePackageFilter() {
        const select = $(IDS.packageFilter);
        if (!select) return;

        const previous = select.value;
        const packages = getUniquePackages();

        select.innerHTML = "";
        select.appendChild(createOption("", "All Packages"));
        packages.forEach((pkg) => select.appendChild(createOption(pkg.id, pkg.name)));

        select.value = previous && packages.some((pkg) => pkg.id === previous) ? previous : "";

        populateFlowFilter();
    }

    function populateFlowFilter() {
        const packageSelect = $(IDS.packageFilter);
        const flowSelect = $(IDS.flowFilter);
        if (!packageSelect || !flowSelect) return;

        const previous = flowSelect.value;
        const flows = getFlowsForPackage(packageSelect.value);

        flowSelect.innerHTML = "";
        flowSelect.appendChild(createOption("", "All iFlows"));
        flows.forEach((flow) => flowSelect.appendChild(createOption(flow, flow)));

        // Keep the previous iFlow only if it still belongs to the selected package.
        flowSelect.value = previous && flows.includes(previous) ? previous : "";
    }

    function clearFilters() {
        const packageSelect = $(IDS.packageFilter);
        const flowSelect = $(IDS.flowFilter);

        if (packageSelect) packageSelect.value = "";
        if (flowSelect) {
            populateFlowFilter();   // rebuild the list for "All Packages"
            flowSelect.value = "";  // ...and reset the iFlow choice too
        }

        // Old results were for the old filters, so remove them.
        const results = $(IDS.results);
        if (results) results.innerHTML = "";

        updateStatus("Filters cleared. Searching all packages and all iFlows.");
    }

    /* ------------------------------------------------------------------
     * Search
     * ------------------------------------------------------------------ */

    /**
     * Builds a case-insensitive matcher from the search text.
     * `*` is a wildcard for any characters (like ABAP), e.g. "sftp*prod".
     * Without `*` it is a plain "contains" match. An empty query matches all.
     */
    function createMatcher(rawQuery) {
        const query = rawQuery.toLowerCase().trim();

        if (!query) return () => true;

        if (!query.includes("*")) {
            return (text) => String(text).toLowerCase().includes(query);
        }

        const pattern = query
            .split("*")
            .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*");
        const regex = new RegExp(pattern, "i");

        return (text) => regex.test(String(text));
    }

    const EXT_PREFIX = "Externalized Parameter.";
    const lookupCache = new WeakMap();

    /** path -> value map for one iFlow (built once, on first use). */
    function getLookup(flow) {
        let lookup = lookupCache.get(flow);
        if (!lookup) {
            lookup = new Map(flow.values.map((item) => [item.path, item.value]));
            lookupCache.set(flow, lookup);
        }
        return lookup;
    }

    /**
     * If `path` is one half of a configured/default pair, returns both
     * paths so they can be shown together as a single result.
     */
    function getValuePair(path, lookup) {
        if (path.endsWith(".defaultValue")) {
            const base = path.slice(0, -".defaultValue".length);
            if (lookup.has(base + ".value")) {
                return { key: base, displayPath: base, valuePath: base + ".value", defaultPath: path };
            }
        }
        if (path.endsWith(".value")) {
            const base = path.slice(0, -".value".length);
            if (lookup.has(base + ".defaultValue")) {
                return { key: base, displayPath: base, valuePath: path, defaultPath: base + ".defaultValue" };
            }
        }
        if (path.startsWith(EXT_PREFIX)) {
            const base = path.endsWith(".Default") ? path.slice(0, -".Default".length) : path;
            if (base.length > EXT_PREFIX.length && lookup.has(base) && lookup.has(base + ".Default")) {
                return { key: base, displayPath: base, valuePath: base, defaultPath: base + ".Default" };
            }
        }
        return null;
    }

    /**
     * Searches the local index, applying the package filter, the iFlow
     * filter and the search text. An empty query lists all values.
     * A configured value and its default are shown together in one result.
     */
    function searchIndex(searchText, currentSearch) {
        const matcher = createMatcher(searchText);

        const results = $(IDS.results);
        if (!results) return;
        results.innerHTML = "";

        const packageSelect = $(IDS.packageFilter);
        const flowSelect = $(IDS.flowFilter);
        const selectedPackage = packageSelect ? packageSelect.value : "";
        const selectedFlow = flowSelect ? flowSelect.value : "";

        const matchesQuery = (item) => matcher(item.value) || matcher(item.path);

        let count = 0;
        let flowsSearched = 0;
        let flowsWithMatches = 0;

        for (const flow of index) {
            if (currentSearch !== searchId) return; // superseded by a newer search

            if (selectedPackage && flow.packageId !== selectedPackage) continue;
            if (selectedFlow && flow.flowName !== selectedFlow) continue;

            flowsSearched++;

            const entries = [];
            const mergedPairs = new Set();

            for (const item of flow.values) {
                if (!matchesQuery(item)) continue;

                const pair = getValuePair(item.path, getLookup(flow));
                if (pair) {
                    if (mergedPairs.has(pair.key)) continue;
                    mergedPairs.add(pair.key);
                    const lookup = getLookup(flow);
                    entries.push({
                        path: pair.displayPath,
                        value: lookup.get(pair.valuePath),
                        defaultValue: lookup.get(pair.defaultPath),
                    });
                } else {
                    entries.push({ path: item.path, value: item.value });
                }

                if (entries.length >= MAX_MATCHES_PER_FLOW) break;
            }

            if (entries.length) flowsWithMatches++;
            entries.forEach((entry) => {
                addResult(flow.packageName, flow.flowName, entry);
                count++;
            });
        }

        if (count === 0) {
            updateStatus(
                `No matches found in ${flowsSearched} iFlows. ` +
                "Try a shorter word, or use * as a wildcard."
            );
            return;
        }

        const filters = [];
        if (selectedPackage) filters.push("package");
        if (selectedFlow) filters.push("iFlow");
        const filterText = filters.length ? ` Filtered by ${filters.join(" and ")}.` : "";

        updateStatus(
            `Found ${count} result(s) in ${flowsWithMatches} iFlow(s) — ` +
            `searched ${flowsSearched} iFlows.${filterText}`
        );
    }

    /** Resolves tenant host from the current CPI session (nothing hardcoded). */
    function resolveTenant() {
        tenant = String(helper.tenant || window.location.host)
            .replace(/^https?:\/\//i, "")
            .split("/")[0];
        baseUrl = `https://${tenant}/api/1.0/`;
    }

    async function search(searchText) {
        const query = searchText.trim();
        const currentSearch = ++searchId;
        if (!hintTimer) setHint(""); // clear the reload tip (but not the wait messages)

        resolveTenant();

        // Load the saved index, or build it if none exists yet.
        try {
            await ensureIndex();
        } catch (error) {
            console.error("CPI Explorer:", error);
            updateStatus(`Index failed: ${error.message}`);
            return;
        }

        if (currentSearch !== searchId) return;

        updateStatus("Searching local index...");
        searchIndex(query, currentSearch);
    }

    async function refreshIndex() {
        searchId++;
        resolveTenant(); // baseUrl is otherwise only set by search()
        index = [];
        indexedTenant = "";

        const results = $(IDS.results);
        if (results) results.innerHTML = "";

        updateStatus("Reloading everything from the tenant to get the latest data...");

        try {
            await buildIndex(true); // shows its own "All done" message
        } catch (error) {
            console.error("CPI Explorer refresh:", error);
            updateStatus(`Reload failed: ${error.message}`);
        }
    }

    /* ------------------------------------------------------------------
     * UI
     * ------------------------------------------------------------------ */

    function addResult(packageName, flowName, entry) {
        const results = $(IDS.results);
        if (!results) return;

        const valueBlock = (label, value) => `
            ${label ? `<div class="cpi-label">${label}</div>` : ""}
            <div class="cpi-value">${escapeHtml(value)}</div>`;

        const values = entry.defaultValue === undefined
            ? valueBlock("", entry.value)
            : valueBlock("Configured value", entry.value) + valueBlock("Default value", entry.defaultValue);

        const item = document.createElement("div");
        item.className = "cpi-result";
        item.innerHTML = `
            <div class="cpi-flow">${escapeHtml(flowName)}</div>
            <div class="cpi-package">Package: ${escapeHtml(packageName)}</div>
            <div class="cpi-path">${escapeHtml(entry.path)}</div>
            ${values}
        `;
        results.appendChild(item);
    }

    function buildMarkup() {
        return `
            <div class="cpi-header">
                <b>CPI Explorer</b>
                <button id="${IDS.close}" title="Close">×</button>
            </div>

            <div class="cpi-body">

                <div class="cpi-filter-row">
                    <div class="cpi-filter-group">
                        <label for="${IDS.packageFilter}">Package</label>
                        <select id="${IDS.packageFilter}">
                            <option value="">All Packages</option>
                        </select>
                    </div>

                    <div class="cpi-filter-group">
                        <label for="${IDS.flowFilter}">iFlow</label>
                        <select id="${IDS.flowFilter}">
                            <option value="">All iFlows</option>
                        </select>
                    </div>

                    <button
                        id="${IDS.clearFilters}"
                        class="cpi-secondary-button"
                        title="Clear Package and iFlow filters"
                    >Clear</button>
                </div>

                <div class="cpi-search">
                    <input
                        id="${IDS.input}"
                        type="text"
                        placeholder="Hostname, RFC, SFTP, IDoc, endpoint...  (* = wildcard)"
                    />
                    <button id="${IDS.searchButton}">Search</button>
                </div>

                <div class="cpi-controls">
                    <span id="${IDS.status}">Ready — search the CPI tenant.</span>
                    <button
                        id="${IDS.refresh}"
                        title="Download the latest packages and iFlows from the tenant again"
                    >Reload from Tenant</button>
                </div>

                <div id="${IDS.hint}"></div>

                <div id="${IDS.results}"></div>
            </div>
        `;
    }

    function bindEvents(box) {
        const input = $(IDS.input);
        const searchButton = $(IDS.searchButton);

        searchButton.onclick = () => search(input.value);

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") searchButton.click();
        });

        // Filters only narrow the next search; results appear on Search click.
        $(IDS.packageFilter).addEventListener("change", populateFlowFilter);

        $(IDS.clearFilters).onclick = clearFilters;
        $(IDS.refresh).onclick = refreshIndex;

        $(IDS.close).onclick = () => {
            searchId++;
            box.style.display = "none";
        };
    }

    function open(pluginHelper) {
        helper = pluginHelper || {};

        // Re-open the existing window instead of creating a second one.
        const existing = $(IDS.root);
        if (existing) {
            existing.style.display = "block";
            const existingInput = $(IDS.input);
            if (existingInput) existingInput.focus();
            autoLoadIndex();
            return;
        }

        const box = document.createElement("div");
        box.id = IDS.root;
        box.innerHTML = buildMarkup();
        document.body.appendChild(box);

        addCSS();
        bindEvents(box);
        $(IDS.input).focus();
        autoLoadIndex();
    }

    /** Loads the saved index (or builds one) when the window opens. */
    function autoLoadIndex() {
        resolveTenant();
        if (indexedTenant === tenant && index.length > 0) return; // reuse in-memory index
        if (indexPromise) return;                                // build already running

        ensureIndex().catch((error) => {
            console.error("CPI Explorer:", error);
            updateStatus(`Index failed: ${error.message}`);
        });
    }

    /* ------------------------------------------------------------------
     * Styles
     * ------------------------------------------------------------------ */

    function addCSS() {
        if ($(IDS.css)) return;

        const style = document.createElement("style");
        style.id = IDS.css;
        style.textContent = `
            #cpi-explorer {
                position: fixed;
                top: 70px;
                right: 30px;
                width: 760px;
                height: 720px;
                z-index: 999999;
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, .25);
                font-family: Arial, sans-serif;
                color: #222;
            }

            .cpi-header {
                height: 45px;
                background: #354a5f;
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 12px;
                box-sizing: border-box;
            }

            #cpi-close {
                background: transparent;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                line-height: 1;
            }

            .cpi-body {
                padding: 12px;
                height: calc(100% - 45px);
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }

            /* Filters */
            .cpi-filter-row {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                margin-bottom: 10px;
            }

            .cpi-filter-group {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .cpi-filter-group label {
                font-size: 11px;
                font-weight: bold;
                color: #555;
            }

            .cpi-filter-group select {
                width: 100%;
                height: 36px;
                padding: 0 8px;
                border: 1px solid #aaa;
                border-radius: 4px;
                background: white;
                box-sizing: border-box;
                text-overflow: ellipsis;
            }

            /* Search */
            .cpi-search {
                display: flex;
                gap: 8px;
            }

            #cpi-explorer-input {
                flex: 1;
                height: 38px;
                padding: 0 10px;
                border: 1px solid #aaa;
                border-radius: 4px;
                box-sizing: border-box;
                font-size: 13px;
            }

            #cpi-search-button {
                width: 90px;
                height: 38px;
                background: #0070f2;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }

            #cpi-search-button:hover {
                background: #005cb9;
            }

            /* Secondary buttons */
            .cpi-secondary-button {
                height: 36px;
                padding: 0 12px;
                background: white;
                color: #354a5f;
                border: 1px solid #aaa;
                border-radius: 4px;
                cursor: pointer;
                white-space: nowrap;
            }

            .cpi-secondary-button:hover {
                background: #f3f4f5;
            }

            /* Status / controls */
            .cpi-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-top: 8px;
                margin-bottom: 8px;
            }

            #cpi-status {
                padding: 8px;
                background: #f5f6f7;
                font-size: 12px;
                border-radius: 4px;
                flex: 1;
                min-width: 0;
                line-height: 1.4;
                word-break: break-word;
            }

            #cpi-refresh-index {
                height: 30px;
                padding: 0 10px;
                background: white;
                border: 1px solid #aaa;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                white-space: nowrap;
            }

            #cpi-refresh-index:hover {
                background: #f3f4f5;
            }

            #cpi-hint {
                font-size: 12px;
                font-style: italic;
                color: #666;
                margin-bottom: 8px;
            }

            #cpi-hint:empty {
                display: none;
            }

            .cpi-label {
                margin-top: 6px;
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
                color: #777;
            }

            .cpi-label + .cpi-value {
                margin-top: 2px;
            }

            /* Results */
            #cpi-results {
                margin-top: 2px;
                overflow-y: auto;
                flex: 1;
                min-height: 0;
                padding-right: 3px;
            }

            .cpi-result {
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 9px;
                margin-bottom: 8px;
                background: #fafafa;
            }

            .cpi-flow {
                font-weight: bold;
                color: #0070f2;
                font-size: 14px;
                word-break: break-word;
            }

            .cpi-package {
                color: #666;
                font-size: 11px;
                margin-top: 3px;
                word-break: break-word;
            }

            .cpi-path {
                color: #555;
                font-family: Consolas, monospace;
                font-size: 11px;
                margin-top: 5px;
                word-break: break-all;
            }

            .cpi-value {
                margin-top: 5px;
                padding: 6px;
                background: #eee;
                font-family: Consolas, monospace;
                font-size: 12px;
                word-break: break-all;
            }
        `;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------
     * Public API
     * ------------------------------------------------------------------ */

    return { open };
})();

pluginList.push(plugin);
