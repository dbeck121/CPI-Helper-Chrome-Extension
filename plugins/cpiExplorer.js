var plugin = {
    metadataVersion: "1.0.0",
    id: "cpiExplorer",
    name: "CPI Explorer",
    version: "3.3.0",
    author: "Lokesh Bhukya",
    description: "Search CPI tenant iFlow configurations.",
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
    const MAX_VALUE_LENGTH = 500;        // keeps the index small
    const MAX_QUERY_LENGTH = 200;
    const MAX_MATCHES_PER_FLOW = 20;
    const MAX_TOTAL_RESULTS = 500;       // overall cap on rendered results
    const CONCURRENT_REQUESTS = 2;

    /** Saved-index policy: persistence is opt-in and always expires. */
    const SAVED_INDEX_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
    const SAVED_INDEX_SCHEMA = 2;
    const PERSIST_PREF_KEY = "cpiExplorer.persistIndex";

    /** Keys / path suffixes that only carry UI data and are never indexed. */
    const UI_ONLY_KEYS = ["svg", "icon", "style", "bounds", "position"];
    const UI_ONLY_SUFFIXES = UI_ONLY_KEYS.map((key) => "." + key);

    /**
     * Sensitive values are NOT indexed at all (never held in memory,
     * never saved). Matches parameter names, property names and path segments.
     */
    const SENSITIVE_RE = /password|passwd|pwd|passphrase|secret|token|key|credential|authorization/i;
    const NAME_FIELDS = ["key", "Key", "name", "Name"];
    const VALUE_FIELDS = ["value", "Value", "defaultValue", "DefaultValue"];

    /** "user:password@" inside URLs is masked in every indexed value. */
    const URL_CREDENTIALS_RE = /(\/\/)[^\/\s:@]+:[^\/\s@]+@/g;

    /** Artifact types that are integration flows (normalised: lowercase, no separators). */
    const IFLOW_TYPES = ["iflow", "integrationflow"];

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
        build: "cpi-build-index",
        persist: "cpi-persist",
        clearSaved: "cpi-clear-saved",
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
    let searchId = 0;            // incremented to cancel stale searches
    let cancelRequested = false; // set by the Stop button
    let flowCount = 0;
    let skippedArtifacts = 0;
    let typesSeen = new Set();   // raw artifact type values, for diagnostics
    let knownPackages = [];      // [{ id, name }] straight from the package list

    /* ------------------------------------------------------------------
     * Small utilities
     * ------------------------------------------------------------------ */

    const $ = (id) => document.getElementById(id);

    const isBlank = (value) => value === null || value === undefined || String(value) === "";

    const compareText = (a, b) => a.localeCompare(b);

    /** Logs through the extension's `log` object when present. */
    const logger = {
        write(...args) {
            if (typeof log !== "undefined" && log && typeof log.log === "function") {
                log.log(...args);
            } else {
                console.log(...args);
            }
        },
        warn(message, detail) {
            this.write(`CPI Explorer: ${message}`, detail === undefined ? "" : detail);
        },
        error(message, detail) {
            this.write(`CPI Explorer ERROR: ${message}`, detail === undefined ? "" : detail);
        },
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /** Masks credentials embedded in URLs, then shortens the value. */
    function sanitizeValue(value) {
        return String(value)
            .replace(URL_CREDENTIALS_RE, "$1***:***@")
            .substring(0, MAX_VALUE_LENGTH);
    }

    function updateStatus(message) {
        const status = $(IDS.status);
        if (status) status.textContent = message;
    }

    /** Appends under the extension's global element when available (plugin rule). */
    function appendToPage(element) {
        if (typeof body === "function") {
            try {
                const target = body();
                if (target && typeof target.append === "function") {
                    target.append(element);
                    return;
                }
            } catch (error) {
                logger.warn("body() not usable, falling back to document.body", error);
            }
        }
        document.body.appendChild(element);
    }

    /** Uses the extension's dialog when present, otherwise the browser's. */
    async function confirmAction(title, content) {
        if (typeof cpihConfirm === "function") {
            try {
                return !!(await cpihConfirm({
                    title,
                    content,
                    approveText: "Continue",
                    denyText: "Cancel",
                }));
            } catch (error) {
                logger.warn("cpihConfirm failed, using browser dialog", error);
            }
        }
        return window.confirm(`${title}\n\n${content}`);
    }

    const isDarkTheme = () => typeof cpihIsDark === "function" && !!cpihIsDark();

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

    function updateBuildButton() {
        const button = $(IDS.build);
        if (!button) return;
        button.disabled = false;
        if (indexPromise) {
            button.textContent = cancelRequested ? "Stopping..." : "Stop";
            button.disabled = cancelRequested;
        } else {
            button.textContent = index.length > 0 ? "Reload from Tenant" : "Build index";
        }
    }

    /* ------------------------------------------------------------------
     * API
     * ------------------------------------------------------------------ */

    /**
     * GET JSON through the extension's shared request helper so logging
     * and error handling match the rest of the extension.
     *
     * Assumed helper signature (verify against the extension source):
     *   makeCallPromise(method, url, includeXcsrf, accept, payload,
     *                   callback, contentType, showLogs)
     * resolving with the response text or an object. showLogs is off
     * because the iFlow lookup deliberately tries several URL variants.
     * This is the only function that calls it.
     */
    async function get(url) {
        if (typeof makeCallPromise !== "function") {
            throw new Error("makeCallPromise is not available in this extension version");
        }

        const response = await makeCallPromise(
            "GET", url, false, "application/json", "", "", "", false
        );

        if (response && typeof response === "object" && typeof response.responseText === "string") {
            return JSON.parse(response.responseText);
        }
        if (typeof response === "string") return response ? JSON.parse(response) : null;
        if (response && typeof response === "object") return response;

        // Unknown return shape: fail visibly instead of silently indexing nothing.
        throw new Error(`Unexpected makeCallPromise result (${typeof response}) for ${url}`);
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

    const getRawType = (artifact) => artifact.type || artifact.artifactType || "";

    /** True only for integration flows (not value mappings, scripts, message mappings...). */
    function isIFlow(artifact) {
        const type = String(getRawType(artifact)).toLowerCase().replace(/[\s_-]/g, "");
        return IFLOW_TYPES.includes(type);
    }

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
            (name, error) => logger.warn(`Configure request failed for ${name}`, error)
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

    /** True if the last path segment looks like a secret (name fields like `key` are exempt). */
    function isSensitivePath(path) {
        const segment = path.split(".").pop().replace(/\[\d+\]$/, "");
        if (!segment || NAME_FIELDS.includes(segment)) return false;
        return SENSITIVE_RE.test(segment);
    }

    /** True if this object is a name/value pair whose name looks like a secret. */
    function hasSensitiveName(object) {
        return NAME_FIELDS.some(
            (field) => typeof object[field] === "string" && SENSITIVE_RE.test(object[field])
        );
    }

    /**
     * Recursively flattens a structure into `{ path, value }` pairs.
     * Includes normal values plus configured and default externalized
     * parameters. Sensitive values are skipped entirely.
     */
    function collectValues(value, path, result, depth) {
        if (value === null || value === undefined) return;
        if (depth > MAX_DEPTH) return;
        if (UI_ONLY_SUFFIXES.some((suffix) => path.endsWith(suffix))) return;

        // Primitive
        if (["string", "number", "boolean"].includes(typeof value)) {
            if (isSensitivePath(path)) return;
            result.push({ path: path || "value", value: sanitizeValue(value) });
            return;
        }

        // Externalized parameter: { key, value, defaultValue, additionalMetadata }
        if (isConfiguredParameter(value)) {
            const key = String(value.key);
            if (SENSITIVE_RE.test(key)) return; // skip the whole parameter

            if (!isBlank(value.value)) {
                result.push({
                    path: `Externalized Parameter.${key}`,
                    value: sanitizeValue(value.value),
                });
            }
            if (!isBlank(value.defaultValue)) {
                result.push({
                    path: `Externalized Parameter.${key}.Default`,
                    value: sanitizeValue(value.defaultValue),
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
            // { name: "password", value: "..." } style property pairs
            const sensitivePair = hasSensitiveName(value);

            Object.keys(value).forEach((key) => {
                if (UI_ONLY_KEYS.includes(key)) return;
                if (sensitivePair && VALUE_FIELDS.includes(key)) return;
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

        let allArtifacts;
        try {
            allArtifacts = await getArtifacts(packageId);
        } catch (error) {
            logger.warn("Could not load artifacts", error);
            return;
        }

        allArtifacts.forEach((artifact) =>
            typesSeen.add(String(getRawType(artifact) || "(no type field)"))
        );

        // Only integration flows - avoids up to 14 failed requests per other artifact.
        const artifacts = allArtifacts.filter(isIFlow);
        skippedArtifacts += allArtifacts.length - artifacts.length;

        const packageName = getPackageName(packageInfo);
        updateStatus(`Reading package ${packageNumber} of ${totalPackages}: ${packageName}`);

        // Simple worker pool: N workers pull from a shared cursor.
        let next = 0;

        const worker = async () => {
            while (!cancelRequested && next < artifacts.length) {
                const current = next++;
                updateStatus(
                    `Reading package ${packageNumber} of ${totalPackages}: ${packageName} ` +
                    `— iFlow ${current + 1} of ${artifacts.length}`
                );

                try {
                    await indexIFlow(packageInfo, artifacts[current]);
                } catch (error) {
                    logger.warn("Failed to index iFlow", error);
                }
            }
        };

        await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, worker));
    }

    async function buildIndex() {
        if (indexPromise) return indexPromise;

        indexPromise = (async () => {
            index = [];
            flowCount = 0;
            skippedArtifacts = 0;
            typesSeen = new Set();
            cancelRequested = false;
            updateBuildButton();

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

            for (let i = 0; i < packages.length && !cancelRequested; i++) {
                await indexPackage(packages[i], i + 1, packages.length);
            }

            indexedTenant = tenant;
            populatePackageFilter();
            stopHints();

            if (cancelRequested) {
                // A partial index is searchable but never saved.
                updateStatus(
                    `Stopped. ${flowCount} iFlows loaded (partial, not saved). ` +
                    "Use Reload from Tenant to read everything."
                );
                return;
            }

            if (isPersistEnabled()) await saveCachedIndex();

            if (flowCount === 0 && typesSeen.size > 0) {
                const seen = [...typesSeen].join(", ");
                logger.warn(`No iFlows matched. Artifact types seen: ${seen}`);
                updateStatus(
                    `No iFlows matched the type filter (${skippedArtifacts} artifacts skipped). ` +
                    `Artifact types seen: ${seen}. Update IFLOW_TYPES if one of these is the iFlow type.`
                );
            } else {
                updateStatus(`Ready. ${flowCount} iFlows loaded. Go ahead and search.`);
            }
        })();

        try {
            await indexPromise;
        } catch (error) {
            stopHints();
            throw error;
        } finally {
            indexPromise = null;
            cancelRequested = false;
            updateBuildButton();
        }
    }

    /* ------------------------------------------------------------------
     * Saved index (IndexedDB) - OPT-IN, expires, can be cleared
     * ------------------------------------------------------------------ */

    const DB_NAME = "cpiExplorer";
    const DB_STORE = "index";

    function isPersistEnabled() {
        try {
            return localStorage.getItem(PERSIST_PREF_KEY) === "1";
        } catch (error) {
            return false;
        }
    }

    function setPersistEnabled(enabled) {
        try {
            if (enabled) localStorage.setItem(PERSIST_PREF_KEY, "1");
            else localStorage.removeItem(PERSIST_PREF_KEY);
        } catch (error) {
            logger.warn("Could not store preference", error);
        }
    }

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

    async function deleteSavedIndex() {
        try {
            await dbRequest("readwrite", (store) => store.delete(tenant));
        } catch (error) {
            logger.warn("Could not delete saved index", error);
        }
    }

    /**
     * Returns the saved index only if the user opted in, it is current
     * (schema 2, which never contains sensitive values) and not expired.
     * Anything else is deleted on the spot - this also purges copies
     * written by earlier versions of the plugin.
     */
    async function loadCachedIndex() {
        try {
            const cached = await dbRequest("readonly", (store) => store.get(tenant));
            if (!cached) return null;

            const valid =
                isPersistEnabled() &&
                cached.schema === SAVED_INDEX_SCHEMA &&
                typeof cached.expiresAt === "number" &&
                cached.expiresAt > Date.now() &&
                Array.isArray(cached.index) &&
                cached.index.length > 0;

            if (!valid) {
                await deleteSavedIndex();
                return null;
            }
            return cached;
        } catch (error) {
            logger.warn("Could not read saved index", error);
            return null;
        }
    }

    async function saveCachedIndex() {
        if (!isPersistEnabled()) return;
        try {
            const now = Date.now();
            await dbRequest("readwrite", (store) =>
                store.put(
                    {
                        schema: SAVED_INDEX_SCHEMA,
                        savedAt: now,
                        expiresAt: now + SAVED_INDEX_TTL_MS,
                        flowCount,
                        index,
                        packages: knownPackages,
                    },
                    tenant
                )
            );
        } catch (error) {
            logger.warn("Could not save index", error);
        }
    }

    function applyCachedIndex(cached) {
        index = cached.index;
        knownPackages = cached.packages || [];
        flowCount = cached.flowCount || cached.index.length;
        indexedTenant = tenant;
        populatePackageFilter();
        updateBuildButton();

        const minutes = Math.max(1, Math.round((Date.now() - cached.savedAt) / 60000));
        updateStatus(
            `Ready. ${flowCount} iFlows loaded from a copy saved ${minutes} min ago. ` +
            "Use Reload from Tenant for the latest data."
        );
    }

    /** Clears the saved copy and the in-memory index. */
    async function clearSavedIndex() {
        if (indexPromise) {
            updateStatus("The index is being built. Click Stop first, then clear it.");
            return;
        }

        searchId++;
        await deleteSavedIndex();
        index = [];
        indexedTenant = "";
        flowCount = 0;
        knownPackages = [];

        const results = $(IDS.results);
        if (results) results.innerHTML = "";
        populatePackageFilter();
        updateBuildButton();
        updateStatus("Saved index cleared. Click Build index to read the tenant again.");
    }

    /**
     * Makes the index available WITHOUT contacting the tenant: memory
     * first, then the saved copy (only if opted in). Returns true if ready.
     */
    async function loadIndexIfAvailable() {
        if (indexedTenant === tenant && index.length > 0) return true;

        const cached = await loadCachedIndex();
        if (cached) {
            applyCachedIndex(cached);
            return true;
        }
        return false;
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
     * filter and the search text. An empty query lists all values (up to
     * MAX_TOTAL_RESULTS). A configured value and its default are shown
     * together in one result.
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

        const fragment = document.createDocumentFragment();
        let count = 0;
        let flowsSearched = 0;
        let flowsWithMatches = 0;
        let capped = false;

        for (const flow of index) {
            if (currentSearch !== searchId) return; // superseded by a newer search
            if (count >= MAX_TOTAL_RESULTS) {
                capped = true;
                break;
            }

            if (selectedPackage && flow.packageId !== selectedPackage) continue;
            if (selectedFlow && flow.flowName !== selectedFlow) continue;

            flowsSearched++;

            const entries = [];
            const mergedPairs = new Set();
            const lookup = getLookup(flow);

            for (const item of flow.values) {
                if (!matchesQuery(item)) continue;

                const pair = getValuePair(item.path, lookup);
                if (pair) {
                    if (mergedPairs.has(pair.key)) continue;
                    mergedPairs.add(pair.key);
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
            for (const entry of entries) {
                if (count >= MAX_TOTAL_RESULTS) {
                    capped = true;
                    break;
                }
                fragment.appendChild(createResultElement(flow.packageName, flow.flowName, entry));
                count++;
            }
        }

        if (capped) {
            const notice = document.createElement("div");
            notice.className = "cpi-cap-notice";
            notice.textContent =
                `Showing the first ${MAX_TOTAL_RESULTS} results. ` +
                "Refine your search or use the Package / iFlow filters to see more.";
            fragment.appendChild(notice);
        }
        results.appendChild(fragment);

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
        const capText = capped ? ` Limited to ${MAX_TOTAL_RESULTS} — refine your search.` : "";

        updateStatus(
            `Found ${count}${capped ? "+" : ""} result(s) in ${flowsWithMatches} iFlow(s) — ` +
            `searched ${flowsSearched} iFlows.${filterText}${capText}`
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
        const query = searchText.trim().substring(0, MAX_QUERY_LENGTH);
        const currentSearch = ++searchId;
        if (!hintTimer) setHint("");

        resolveTenant();

        if (indexPromise) {
            updateStatus("The index is still being built — please wait until it is ready.");
            return;
        }

        // Use what we already have. Never start a tenant crawl from a search.
        const available = await loadIndexIfAvailable();
        if (currentSearch !== searchId) return;

        if (!available) {
            updateStatus('No index yet. Click "Build index" to read the tenant first.');
            return;
        }

        updateStatus("Searching local index...");
        searchIndex(query, currentSearch);
    }

    /** Stop while building; otherwise confirm, then crawl the tenant. */
    async function onBuildButton() {
        if (indexPromise) {
            cancelRequested = true;
            updateBuildButton();
            updateStatus("Stopping after the current requests finish...");
            return;
        }

        resolveTenant();

        const reload = index.length > 0;
        const title = reload ? "Reload the index from the tenant?" : "Build the index now?";
        const content =
            "CPI Explorer will read every integration flow in every package of this tenant. " +
            "This sends many requests and can take several minutes on large tenants. " +
            "You can stop it at any time. " +
            "Passwords, secrets, tokens and keys are not indexed. " +
            (isPersistEnabled()
                ? `The index will be saved in this browser for ${SAVED_INDEX_TTL_MS / 3600000} hours.`
                : "The index is kept in memory only and is lost when the page is closed or reloaded.");

        if (!(await confirmAction(title, content))) return;

        searchId++;
        index = [];
        indexedTenant = "";

        const results = $(IDS.results);
        if (results) results.innerHTML = "";

        try {
            await buildIndex();
        } catch (error) {
            logger.error("Index failed", error);
            updateStatus(`Index failed: ${error.message}`);
        }
    }

    async function onPersistChanged(enabled) {
        setPersistEnabled(enabled);
        resolveTenant();

        if (enabled) {
            if (index.length > 0 && !indexPromise) {
                await saveCachedIndex();
                updateStatus(
                    `Index will be kept in this browser for ${SAVED_INDEX_TTL_MS / 3600000} hours.`
                );
            } else {
                updateStatus(
                    `The index will be kept in this browser for ${SAVED_INDEX_TTL_MS / 3600000} hours once built.`
                );
            }
        } else {
            await deleteSavedIndex();
            updateStatus("Saving disabled. Any saved copy was deleted; the index stays in memory only.");
        }
    }

    /* ------------------------------------------------------------------
     * UI
     * ------------------------------------------------------------------ */

    function createResultElement(packageName, flowName, entry) {
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
        return item;
    }

    function buildMarkup() {
        return `
            <div class="cpi-header">
                <b>CPI Explorer</b>
                <button id="${IDS.close}" title="Close" aria-label="Close CPI Explorer">×</button>
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
                        maxlength="${MAX_QUERY_LENGTH}"
                        aria-label="Search text"
                        placeholder="Hostname, RFC, SFTP, IDoc, endpoint...  (* = wildcard)"
                    />
                    <button id="${IDS.searchButton}">Search</button>
                </div>

                <div class="cpi-controls">
                    <span id="${IDS.status}" role="status" aria-live="polite">No index yet — click "Build index" to read the tenant.</span>
                    <button
                        id="${IDS.build}"
                        class="cpi-small-button"
                        title="Read all iFlows from the tenant (asks for confirmation, can be stopped)"
                    >Build index</button>
                </div>

                <div class="cpi-storage-row">
                    <label title="Off by default. When on, the index is kept in this browser and expires automatically.">
                        <input type="checkbox" id="${IDS.persist}" />
                        Remember index in this browser (${SAVED_INDEX_TTL_MS / 3600000} h)
                    </label>
                    <button
                        id="${IDS.clearSaved}"
                        class="cpi-small-button"
                        title="Delete the saved index and the in-memory index"
                    >Clear saved index</button>
                </div>

                <div id="${IDS.hint}"></div>

                <div id="${IDS.results}"></div>
            </div>
        `;
    }

    function closeWindow(box) {
        searchId++;
        box.style.display = "none";
    }

    function bindEvents(box) {
        const input = $(IDS.input);
        const searchButton = $(IDS.searchButton);

        searchButton.onclick = () => search(input.value);

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") searchButton.click();
        });

        box.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeWindow(box);
        });

        // Filters only narrow the next search; results appear on Search click.
        $(IDS.packageFilter).addEventListener("change", populateFlowFilter);

        $(IDS.clearFilters).onclick = clearFilters;
        $(IDS.build).onclick = onBuildButton;
        $(IDS.clearSaved).onclick = async () => {
            resolveTenant();
            await clearSavedIndex();
        };

        const persist = $(IDS.persist);
        persist.checked = isPersistEnabled();
        persist.addEventListener("change", () => onPersistChanged(persist.checked));

        $(IDS.close).onclick = () => closeWindow(box);
    }

    function open(pluginHelper) {
        helper = pluginHelper || {};

        // Re-open the existing window instead of creating a second one.
        const existing = $(IDS.root);
        if (existing) {
            existing.classList.toggle("cpi-dark", isDarkTheme());
            existing.style.display = "block";
            const existingInput = $(IDS.input);
            if (existingInput) existingInput.focus();
            autoLoadIndex();
            return;
        }

        const box = document.createElement("div");
        box.id = IDS.root;
        box.classList.toggle("cpi-dark", isDarkTheme());
        box.innerHTML = buildMarkup();
        appendToPage(box);

        addCSS();
        bindEvents(box);
        $(IDS.input).focus();
        autoLoadIndex();
    }

    /**
     * On open: reuse the in-memory index or a valid saved copy (if the
     * user opted in). Also removes expired / legacy / non-opted-in saved
     * copies. Never contacts the tenant - building needs a button click.
     */
    async function autoLoadIndex() {
        resolveTenant();
        updateBuildButton();
        if (indexPromise) return; // a build is already running
        try {
            const available = await loadIndexIfAvailable();
            if (!available && !indexPromise) {
                updateStatus('No index yet — click "Build index" to read the tenant.');
            }
        } catch (error) {
            logger.error("Could not load index", error);
            updateStatus(`Could not load index: ${error.message}`);
        }
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
                max-width: calc(100vw - 60px);
                height: 720px;
                max-height: calc(100vh - 90px);
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
                color: #222;
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
                background: white;
                color: #222;
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

            .cpi-small-button {
                height: 30px;
                padding: 0 10px;
                background: white;
                color: #222;
                border: 1px solid #aaa;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                white-space: nowrap;
            }

            .cpi-small-button:hover:not(:disabled) {
                background: #f3f4f5;
            }

            .cpi-small-button:disabled {
                opacity: .5;
                cursor: default;
            }

            /* Status / controls */
            .cpi-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-top: 8px;
                margin-bottom: 6px;
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

            .cpi-storage-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 8px;
                font-size: 11px;
                color: #555;
            }

            .cpi-storage-row label {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
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

            .cpi-cap-notice {
                padding: 10px;
                margin-bottom: 8px;
                background: #fff4e5;
                color: #222;
                border: 1px solid #f0c36d;
                border-radius: 5px;
                font-size: 12px;
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

            /* Dark theme (follows the CPI Helper theme) */
            #cpi-explorer.cpi-dark {
                background: #1f2933;
                color: #e6e9ec;
                border-color: #3b4754;
            }
            #cpi-explorer.cpi-dark .cpi-filter-group label,
            #cpi-explorer.cpi-dark .cpi-storage-row,
            #cpi-explorer.cpi-dark .cpi-package,
            #cpi-explorer.cpi-dark .cpi-path,
            #cpi-explorer.cpi-dark .cpi-label,
            #cpi-explorer.cpi-dark #cpi-hint {
                color: #aab4be;
            }
            #cpi-explorer.cpi-dark select,
            #cpi-explorer.cpi-dark #cpi-explorer-input,
            #cpi-explorer.cpi-dark .cpi-small-button,
            #cpi-explorer.cpi-dark .cpi-secondary-button {
                background: #2b3744;
                color: #e6e9ec;
                border-color: #4a5866;
            }
            #cpi-explorer.cpi-dark #cpi-status {
                background: #2b3744;
            }
            #cpi-explorer.cpi-dark .cpi-result {
                background: #26313c;
                border-color: #3b4754;
            }
            #cpi-explorer.cpi-dark .cpi-value {
                background: #1a222b;
            }
            #cpi-explorer.cpi-dark .cpi-flow {
                color: #6cb2ff;
            }
            #cpi-explorer.cpi-dark .cpi-cap-notice {
                background: #4a3b1d;
                color: #f3e6c8;
                border-color: #8a6d2b;
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
