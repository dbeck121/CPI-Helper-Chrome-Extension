var plugin = {
    metadataVersion: "1.0.0",
    id: "cpiExplorer",
    name: "CPI Explorer",
    version: "3.1.0",
    author: "Lokesh Bhukya",

    description:
        "Search CPI tenant iFlow configuration and externalized parameters.",

    settings: {},

    toolbarButton: {
        title: "CPI Explorer",

        onClick: function (pluginHelper) {
            CPI_EXPLORER.open(pluginHelper);
        },
    },
};


var CPI_EXPLORER = (function () {

    var helper = null;

    var tenant = "";
    var baseUrl = "";

    /*
     * Local tenant index.
     *
     * Built once per tenant.
     */
    var index = [];

    var indexPromise = null;
    var indexedTenant = "";

    var searchId = 0;

    var packageCount = 0;
    var flowCount = 0;


    /*
     * ------------------------------------------------------------
     * API
     * ------------------------------------------------------------
     */

    async function get(url) {

        var response = await fetch(url, {
            method: "GET",

            credentials: "include",

            headers: {
                Accept: "application/json",
            },
        });


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status +
                " - " +
                response.statusText
            );
        }


        return response.json();
    }


    /*
     * ------------------------------------------------------------
     * GET PACKAGES
     * ------------------------------------------------------------
     */

    async function getPackages() {

        var data =
            await get(
                baseUrl +
                "workspace/"
            );


        if (Array.isArray(data)) {
            return data;
        }


        if (
            data &&
            Array.isArray(data.results)
        ) {
            return data.results;
        }


        if (
            data &&
            data.d &&
            Array.isArray(data.d.results)
        ) {
            return data.d.results;
        }


        return [];
    }


    /*
     * ------------------------------------------------------------
     * GET IFLOWS / ARTIFACTS
     * ------------------------------------------------------------
     */

    async function getArtifacts(
        packageId
    ) {

        var url =
            baseUrl +
            "workspace/" +
            encodeURIComponent(packageId) +
            "/artifacts/";


        var data =
            await get(url);


        if (Array.isArray(data)) {
            return data;
        }


        if (
            data &&
            Array.isArray(data.results)
        ) {
            return data.results;
        }


        if (
            data &&
            data.d &&
            Array.isArray(data.d.results)
        ) {
            return data.d.results;
        }


        return [];
    }


    /*
     * ------------------------------------------------------------
     * GET IFLOW CONTENT
     *
     * IMPORTANT:
     *
     * CPI Configure screen uses:
     *
     * ?action=iPkgConfigure
     * &isConfigureRead=true
     * &type=Flow
     *
     * This response contains configured externalized
     * parameter values.
     * ------------------------------------------------------------
     */

    async function getIFlow(
        packageId,
        artifact
    ) {

        var entityId =
            artifact.entityID ||
            artifact.entityId ||
            artifact.id;


        if (!entityId) {
            return null;
        }


        /*
         * CPI Helper can expose different names
         * depending on the artifact.
         */
        var names = [];


        function addName(value) {

            if (!value) {
                return;
            }


            value =
                String(value);


            if (
                names.indexOf(value) === -1
            ) {

                names.push(value);
            }
        }


        addName(artifact.tooltip);
        addName(artifact.name);
        addName(artifact.displayName);
        addName(artifact.technicalName);
        addName(artifact.id);
        addName(artifact.entityID);
        addName(artifact.entityId);


        /*
         * First try the Configure-read endpoint.
         */
        for (
            var i = 0;
            i < names.length;
            i++
        ) {

            var configureUrl =
                baseUrl +
                "workspace/" +
                encodeURIComponent(packageId) +
                "/artifacts/" +
                encodeURIComponent(entityId) +
                "/entities/" +
                encodeURIComponent(entityId) +
                "/iflows/" +
                encodeURIComponent(names[i]) +
                "?action=iPkgConfigure" +
                "&isConfigureRead=true" +
                "&type=Flow" +
                "&filterByRuntimeProfileType=";


            try {

                var configureData =
                    await get(
                        configureUrl
                    );


                if (configureData) {

                    return {
                        data: configureData,

                        name: names[i],

                        configure: true,
                    };
                }

            } catch (e) {

                console.warn(
                    "CPI Explorer: Configure request failed for " +
                    names[i],
                    e
                );
            }
        }


        /*
         * Fallback to normal iFlow endpoint.
         *
         * This keeps the plugin usable if Configure-read
         * is unavailable for a particular artifact.
         */
        for (
            var j = 0;
            j < names.length;
            j++
        ) {

            var normalUrl =
                baseUrl +
                "workspace/" +
                encodeURIComponent(packageId) +
                "/artifacts/" +
                encodeURIComponent(entityId) +
                "/entities/" +
                encodeURIComponent(entityId) +
                "/iflows/" +
                encodeURIComponent(names[j]);


            try {

                var normalData =
                    await get(
                        normalUrl
                    );


                if (normalData) {

                    return {
                        data: normalData,

                        name: names[j],

                        configure: false,
                    };
                }

            } catch (e2) {

                /*
                 * Try next name.
                 */
            }
        }


        return null;
    }


    /*
     * ------------------------------------------------------------
     * PACKAGE / IFLOW NAMES
     * ------------------------------------------------------------
     */

    function getPackageName(
        packageInfo
    ) {

        return (
            packageInfo.technicalName ||
            packageInfo.name ||
            packageInfo.displayName ||
            packageInfo.id ||
            "Unknown Package"
        );
    }


    function getFlowName(
        artifact,
        flow
    ) {

        return (
            flow.name ||
            artifact.name ||
            artifact.tooltip ||
            artifact.displayName ||
            artifact.technicalName ||
            "Unknown iFlow"
        );
    }


    /*
     * ------------------------------------------------------------
     * COLLECT VALUES
     * ------------------------------------------------------------
     *
     * This recursively collects normal iFlow values.
     *
     * It additionally detects Configure API objects such as:
     *
     * {
     *     "value": "s4dev.sap.china.livanova.com",
     *     "defaultValue": "ftp.livanova.com:22",
     *     "key": "source_address",
     *     "additionalMetadata": {
     *         "Configured": "true"
     *     }
     * }
     *
     * The configured value is indexed as:
     *
     * Externalized Parameter.source_address
     * ->
     * s4dev.sap.china.livanova.com
     * ------------------------------------------------------------
     */

    function collectValues(
        value,
        path,
        result,
        depth
    ) {

        if (
            value === null ||
            value === undefined
        ) {
            return;
        }


        /*
         * Prevent extremely deep structures.
         */
        if (depth > 15) {
            return;
        }


        /*
         * Ignore large UI-only fields.
         */
        if (
            path.endsWith(".svg") ||
            path.endsWith(".icon") ||
            path.endsWith(".style") ||
            path.endsWith(".bounds") ||
            path.endsWith(".position")
        ) {
            return;
        }


        /*
         * Primitive value.
         */
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {

            var text =
                String(value);


            if (text.length > 3000) {

                text =
                    text.substring(
                        0,
                        3000
                    );
            }


            result.push({

                path:
                    path ||
                    "value",

                value:
                    text,
            });


            return;
        }


        /*
         * --------------------------------------------------------
         * EXTERNALIZED PARAMETER
         * --------------------------------------------------------
         *
         * Detect configured parameter entries.
         */
        if (
            typeof value === "object" &&
            !Array.isArray(value) &&
            value.key &&
            value.additionalMetadata &&
            String(
                value.additionalMetadata.Configured
            ).toLowerCase() === "true"
        ) {

            /*
             * Configured value.
             */
            if (
                value.value !== null &&
                value.value !== undefined &&
                String(value.value) !== ""
            ) {

                result.push({

                    path:
                        "Externalized Parameter." +
                        String(value.key),

                    value:
                        String(value.value),
                });
            }


            /*
             * Also index the default value.
             *
             * This allows searches for both
             * configured and default values.
             */
            if (
                value.defaultValue !== null &&
                value.defaultValue !== undefined &&
                String(value.defaultValue) !== ""
            ) {

                result.push({

                    path:
                        "Externalized Parameter." +
                        String(value.key) +
                        ".Default",

                    value:
                        String(value.defaultValue),
                });
            }
        }


        /*
         * --------------------------------------------------------
         * ARRAY
         * --------------------------------------------------------
         */

        if (
            Array.isArray(value)
        ) {

            for (
                var i = 0;
                i < value.length;
                i++
            ) {

                collectValues(

                    value[i],

                    path +
                    "[" +
                    i +
                    "]",

                    result,

                    depth + 1
                );
            }


            return;
        }


        /*
         * --------------------------------------------------------
         * OBJECT
         * --------------------------------------------------------
         */

        if (
            typeof value === "object"
        ) {

            var keys =
                Object.keys(value);


            for (
                var j = 0;
                j < keys.length;
                j++
            ) {

                var key =
                    keys[j];


                /*
                 * Skip unnecessary UI data.
                 */
                if (
                    key === "svg" ||
                    key === "icon" ||
                    key === "style" ||
                    key === "bounds" ||
                    key === "position"
                ) {

                    continue;
                }


                var newPath =
                    path
                        ? path +
                            "." +
                            key
                        : key;


                collectValues(

                    value[key],

                    newPath,

                    result,

                    depth + 1
                );
            }
        }
    }


    /*
     * ------------------------------------------------------------
     * REMOVE DUPLICATES
     * ------------------------------------------------------------
     */

    function removeDuplicates(
        values
    ) {

        var seen = {};
        var result = [];


        for (
            var i = 0;
            i < values.length;
            i++
        ) {

            var key =
                values[i].path +
                "|" +
                values[i].value;


            if (
                seen[key]
            ) {

                continue;
            }


            seen[key] =
                true;


            result.push(
                values[i]
            );
        }


        return result;
    }


    /*
     * ------------------------------------------------------------
     * INDEX ONE IFLOW
     * ------------------------------------------------------------
     */

    async function indexIFlow(
        packageInfo,
        artifact
    ) {

        var flow =
            await getIFlow(
                packageInfo.id,
                artifact
            );


        if (!flow) {
            return;
        }


        var values = [];


        collectValues(
            flow.data,
            "",
            values,
            0
        );


        values =
            removeDuplicates(
                values
            );


        if (
            !values.length
        ) {

            return;
        }


        index.push({

            packageName:
                getPackageName(
                    packageInfo
                ),

            packageId:
                packageInfo.id,

            flowName:
                getFlowName(
                    artifact,
                    flow
                ),

            values:
                values,
        });


        flowCount++;
    }


    /*
     * ------------------------------------------------------------
     * INDEX ONE PACKAGE
     * ------------------------------------------------------------
     */

    async function indexPackage(
        packageInfo,
        packageNumber,
        totalPackages
    ) {

        var artifacts;


        try {

            artifacts =
                await getArtifacts(
                    packageInfo.id
                );

        } catch (e) {

            console.warn(
                "CPI Explorer: Could not load artifacts",
                packageInfo,
                e
            );

            return;
        }


        packageCount =
            packageNumber;


        updateStatus(

            "Package " +
            packageNumber +
            "/" +
            totalPackages +
            " — " +
            getPackageName(
                packageInfo
            )
        );


        /*
         * Only 2 iFlow requests at a time.
         *
         * This is intentionally kept low
         * to avoid excessive CPI API calls.
         */
        var next = 0;


        async function worker() {

            while (
                next <
                artifacts.length
            ) {

                var current =
                    next++;


                var artifact =
                    artifacts[current];


                updateStatus(

                    "Indexing " +
                    packageNumber +
                    "/" +
                    totalPackages +
                    " — iFlow " +
                    (current + 1) +
                    "/" +
                    artifacts.length
                );


                try {

                    await indexIFlow(
                        packageInfo,
                        artifact
                    );

                } catch (e) {

                    console.warn(
                        "CPI Explorer: Failed to index iFlow",
                        artifact,
                        e
                    );

                    /*
                     * Continue with next iFlow.
                     */
                }
            }
        }


        await Promise.all([

            worker(),

            worker(),

        ]);
    }


    /*
     * ------------------------------------------------------------
     * BUILD TENANT INDEX
     * ------------------------------------------------------------
     */

    async function buildIndex() {

        /*
         * Already indexed.
         */
        if (
            indexedTenant === tenant &&
            index.length > 0
        ) {

            return;
        }


        /*
         * If another search is already
         * building the index, wait for it.
         */
        if (indexPromise) {

            return indexPromise;
        }


        indexPromise =
            (async function () {

                index = [];

                packageCount = 0;

                flowCount = 0;


                updateStatus(
                    "Loading CPI packages..."
                );


                var packages =
                    await getPackages();


                updateStatus(

                    "Found " +
                    packages.length +
                    " packages. Building index..."
                );


                for (
                    var i = 0;
                    i < packages.length;
                    i++
                ) {

                    await indexPackage(

                        packages[i],

                        i + 1,

                        packages.length
                    );
                }


                indexedTenant =
                    tenant;


                updateStatus(

                    "Index ready — " +
                    flowCount +
                    " iFlows from " +
                    packages.length +
                    " packages."
                );

            })();


        try {

            await indexPromise;

        } finally {

            indexPromise =
                null;
        }
    }


    /*
     * ------------------------------------------------------------
     * LOCAL SEARCH
     * ------------------------------------------------------------
     */

    function searchIndex(
        searchText,
        currentSearch
    ) {

        var query =
            searchText
                .toLowerCase()
                .trim();


        var results =
            document.getElementById(
                "cpi-results"
            );


        if (!results) {
            return;
        }


        results.innerHTML =
            "";


        var count = 0;


        for (
            var i = 0;
            i < index.length;
            i++
        ) {

            if (
                currentSearch !==
                searchId
            ) {

                return;
            }


            var flow =
                index[i];


            var flowMatches =
                [];


            for (
                var j = 0;
                j < flow.values.length;
                j++
            ) {

                var item =
                    flow.values[j];


                var itemValue =
                    String(
                        item.value
                    )
                        .toLowerCase();


                var itemPath =
                    String(
                        item.path
                    )
                        .toLowerCase();


                if (
                    itemValue.includes(
                        query
                    ) ||
                    itemPath.includes(
                        query
                    )
                ) {

                    flowMatches.push(
                        item
                    );


                    if (
                        flowMatches.length >=
                        20
                    ) {

                        break;
                    }
                }
            }


            if (
                flowMatches.length
            ) {

                for (
                    var k = 0;
                    k < flowMatches.length;
                    k++
                ) {

                    addResult(

                        flow.packageName,

                        flow.flowName,

                        flowMatches[k].path,

                        flowMatches[k].value
                    );


                    count++;
                }
            }
        }


        if (
            count === 0
        ) {

            updateStatus(
                "No matches found."
            );

        } else {

            updateStatus(

                count +
                " match(es) found — local search."
            );
        }
    }


    /*
     * ------------------------------------------------------------
     * MAIN SEARCH
     * ------------------------------------------------------------
     */

    async function search(
        searchText
    ) {

        var query =
            searchText.trim();


        if (!query) {

            updateStatus(
                "Enter something to search."
            );

            return;
        }


        searchId++;


        var currentSearch =
            searchId;


        /*
         * Get tenant from current CPI session.
         *
         * No username/password/credentials
         * are hardcoded.
         */
        tenant =
            String(

                helper.tenant ||

                window.location.host

            )
                .replace(
                    /^https?:\/\//i,
                    ""
                )
                .split(
                    "/"
                )[0];


        baseUrl =
            "https://" +
            tenant +
            "/api/1.0/";


        /*
         * Build index on first search.
         */
        if (
            indexedTenant !== tenant ||
            index.length === 0
        ) {

            updateStatus(
                "First search — building CPI index..."
            );


            try {

                await buildIndex();

            } catch (error) {

                console.error(
                    "CPI Explorer:",
                    error
                );


                updateStatus(

                    "Index failed: " +
                    error.message
                );


                return;
            }
        }


        if (
            currentSearch !==
            searchId
        ) {

            return;
        }


        /*
         * Search locally after index is built.
         */
        updateStatus(
            "Searching local index..."
        );


        searchIndex(
            query,
            currentSearch
        );
    }


    /*
     * ------------------------------------------------------------
     * OPEN UI
     * ------------------------------------------------------------
     */

    function open(
        pluginHelper
    ) {

        helper =
            pluginHelper || {};


        var existing =
            document.getElementById(
                "cpi-explorer"
            );


        if (existing) {

            existing.style.display =
                "block";


            var existingInput =
                document.getElementById(
                    "cpi-explorer-input"
                );


            if (existingInput) {

                existingInput.focus();
            }


            return;
        }


        var box =
            document.createElement(
                "div"
            );


        box.id =
            "cpi-explorer";


        box.innerHTML = `

            <div class="cpi-header">

                <b>CPI Explorer</b>

                <button id="cpi-close">
                    ×
                </button>

            </div>


            <div class="cpi-body">

                <div class="cpi-search">

                    <input
                        id="cpi-explorer-input"
                        type="text"
                        placeholder="Hostname, RFC, SFTP, IDoc, endpoint..."
                    />

                    <button id="cpi-search-button">
                        Search
                    </button>

                </div>


                <div id="cpi-status">
                    Ready — search the CPI tenant.
                </div>


                <div id="cpi-results"></div>

            </div>
        `;


        document.body.appendChild(
            box
        );


        addCSS();


        document
            .getElementById(
                "cpi-search-button"
            )
            .onclick =
            function () {

                search(

                    document
                        .getElementById(
                            "cpi-explorer-input"
                        )
                        .value
                );
            };


        document
            .getElementById(
                "cpi-explorer-input"
            )
            .addEventListener(

                "keydown",

                function (event) {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        document
                            .getElementById(
                                "cpi-search-button"
                            )
                            .click();
                    }
                }
            );


        document
            .getElementById(
                "cpi-close"
            )
            .onclick =
            function () {

                searchId++;


                box.style.display =
                    "none";
            };


        document
            .getElementById(
                "cpi-explorer-input"
            )
            .focus();
    }


    /*
     * ------------------------------------------------------------
     * RESULT
     * ------------------------------------------------------------
     */

    function addResult(
        packageName,
        flowName,
        path,
        value
    ) {

        var results =
            document.getElementById(
                "cpi-results"
            );


        if (!results) {
            return;
        }


        var item =
            document.createElement(
                "div"
            );


        item.className =
            "cpi-result";


        item.innerHTML = `

            <div class="cpi-flow">
                ${escapeHtml(flowName)}
            </div>

            <div class="cpi-package">
                Package:
                ${escapeHtml(packageName)}
            </div>

            <div class="cpi-path">
                ${escapeHtml(path)}
            </div>

            <div class="cpi-value">
                ${escapeHtml(value)}
            </div>
        `;


        results.appendChild(
            item
        );
    }


    /*
     * ------------------------------------------------------------
     * STATUS
     * ------------------------------------------------------------
     */

    function updateStatus(
        message
    ) {

        var status =
            document.getElementById(
                "cpi-status"
            );


        if (status) {

            status.textContent =
                message;
        }
    }


    /*
     * ------------------------------------------------------------
     * ESCAPE HTML
     * ------------------------------------------------------------
     */

    function escapeHtml(
        value
    ) {

        return String(value)

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );
    }


    /*
     * ------------------------------------------------------------
     * CSS
     * ------------------------------------------------------------
     */

    function addCSS() {

        if (
            document.getElementById(
                "cpi-explorer-css"
            )
        ) {

            return;
        }


        var style =
            document.createElement(
                "style"
            );


        style.id =
            "cpi-explorer-css";


        style.textContent = `

            #cpi-explorer {

                position: fixed;

                top: 70px;

                right: 30px;

                width: 650px;

                height: 700px;

                z-index: 999999;

                background: white;

                border: 1px solid #ccc;

                border-radius: 8px;

                box-shadow:
                    0 8px 30px
                    rgba(0,0,0,.25);

                font-family:
                    Arial,
                    sans-serif;
            }


            .cpi-header {

                height: 45px;

                background:
                    #354a5f;

                color: white;

                display: flex;

                align-items: center;

                justify-content:
                    space-between;

                padding:
                    0 12px;
            }


            #cpi-close {

                background: none;

                border: none;

                color: white;

                font-size: 24px;

                cursor: pointer;
            }


            .cpi-body {

                padding: 12px;

                height:
                    calc(100% - 45px);

                box-sizing:
                    border-box;

                display: flex;

                flex-direction:
                    column;
            }


            .cpi-search {

                display: flex;

                gap: 8px;
            }


            #cpi-explorer-input {

                flex: 1;

                height: 38px;

                padding:
                    0 10px;

                border:
                    1px solid #aaa;

                border-radius: 4px;
            }


            #cpi-search-button {

                width: 90px;

                background:
                    #0070f2;

                color: white;

                border: none;

                border-radius: 4px;

                cursor: pointer;

                font-weight: bold;
            }


            #cpi-status {

                margin-top: 10px;

                padding: 8px;

                background:
                    #f5f6f7;

                font-size: 12px;

                border-radius: 4px;
            }


            #cpi-results {

                margin-top: 10px;

                overflow-y: auto;

                flex: 1;
            }


            .cpi-result {

                border:
                    1px solid #ddd;

                border-radius: 5px;

                padding: 9px;

                margin-bottom: 8px;

                background:
                    #fafafa;
            }


            .cpi-flow {

                font-weight: bold;

                color:
                    #0070f2;

                font-size: 14px;
            }


            .cpi-package {

                color:
                    #666;

                font-size: 11px;

                margin-top: 3px;
            }


            .cpi-path {

                color:
                    #555;

                font-family:
                    Consolas,
                    monospace;

                font-size: 11px;

                margin-top: 5px;

                word-break:
                    break-all;
            }


            .cpi-value {

                margin-top: 5px;

                padding: 6px;

                background:
                    #eee;

                font-family:
                    Consolas,
                    monospace;

                font-size: 12px;

                word-break:
                    break-all;
            }
        `;


        document.head.appendChild(
            style
        );
    }


    /*
     * ------------------------------------------------------------
     * PUBLIC
     * ------------------------------------------------------------
     */

    return {

        open: open,

    };

})();


pluginList.push(
    plugin
);
