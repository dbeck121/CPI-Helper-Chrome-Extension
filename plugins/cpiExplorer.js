var plugin = {
    metadataVersion: "1.0.0",
    id: "cpiExplorer",
    name: "CPI Explorer",
    version: "3.0.0",
    author: "Lokesh Bhukya",

    description:
        "Search CPI tenant iFlow configuration.",

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
     * Built only once per tenant/page.
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
     * PACKAGES
     * ------------------------------------------------------------
     */

    async function getPackages() {

        var data =
            await get(
                baseUrl + "workspace/"
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
     * IFLOWS
     * ------------------------------------------------------------
     */

    async function getArtifacts(packageId) {

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
     * IFLOW ENTITY
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


        for (
            var i = 0;
            i < names.length;
            i++
        ) {

            var url =
                baseUrl +
                "workspace/" +
                encodeURIComponent(packageId) +
                "/artifacts/" +
                encodeURIComponent(entityId) +
                "/entities/" +
                encodeURIComponent(entityId) +
                "/iflows/" +
                encodeURIComponent(names[i]);


            try {

                var data =
                    await get(url);


                if (data) {

                    return {
                        data: data,

                        name: names[i],
                    };
                }

            } catch (e) {

                /*
                 * Try next identifier.
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

    function getPackageName(packageInfo) {

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
         * Prevent extremely deep/internal structures.
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
                    text.substring(0, 3000);
            }


            result.push({
                path: path || "value",
                value: text,
            });


            return;
        }


        /*
         * Array.
         */
        if (Array.isArray(value)) {

            for (
                var i = 0;
                i < value.length;
                i++
            ) {

                collectValues(
                    value[i],
                    path + "[" + i + "]",
                    result,
                    depth + 1
                );
            }


            return;
        }


        /*
         * Object.
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
                 * Skip large/unnecessary UI data.
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
                        ? path + "." + key
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
     * Remove duplicate path/value combinations.
     */
    function removeDuplicates(values) {

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


            if (seen[key]) {
                continue;
            }


            seen[key] = true;


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
            removeDuplicates(values);


        if (!values.length) {
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
         * Only 2 requests at a time.
         */
        var next = 0;


        async function worker() {

            while (
                next < artifacts.length
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

                    /*
                     * One failed iFlow should not
                     * stop the complete tenant index.
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

            indexPromise = null;
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


        results.innerHTML = "";


        var count = 0;


        for (
            var i = 0;
            i < index.length;
            i++
        ) {

            if (
                currentSearch !== searchId
            ) {
                return;
            }


            var flow =
                index[i];


            var flowMatches = [];


            for (
                var j = 0;
                j < flow.values.length;
                j++
            ) {

                var item =
                    flow.values[j];


                if (
                    item.value
                        .toLowerCase()
                        .includes(query) ||

                    item.path
                        .toLowerCase()
                        .includes(query)
                ) {

                    flowMatches.push(
                        item
                    );


                    if (
                        flowMatches.length >= 20
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


        if (count === 0) {

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
         * No current iFlow required.
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
                .split("/")[0];


        baseUrl =
            "https://" +
            tenant +
            "/api/1.0/";


        /*
         * FIRST SEARCH:
         * Build index once.
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
            currentSearch !== searchId
        ) {
            return;
        }


        /*
         * SECOND / THIRD / ANY LATER SEARCH:
         *
         * No CPI API call.
         *
         * Search local index.
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
     * UI
     * ------------------------------------------------------------
     */

    function open(pluginHelper) {

        helper =
            pluginHelper || {};


        var existing =
            document.getElementById(
                "cpi-explorer"
            );


        if (existing) {

            existing.style.display =
                "block";


            document
                .getElementById(
                    "cpi-explorer-input"
                )
                .focus();


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
                        event.key === "Enter"
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
     * HELPERS
     * ------------------------------------------------------------
     */

    function updateStatus(message) {

        var status =
            document.getElementById(
                "cpi-status"
            );


        if (status) {

            status.textContent =
                message;
        }
    }


    function escapeHtml(value) {

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
                font-family: Arial, sans-serif;
            }

            .cpi-header {
                height: 45px;
                background: #354a5f;
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 12px;
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
                height: calc(100% - 45px);
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
            }

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
            }

            #cpi-search-button {
                width: 90px;
                background: #0070f2;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }

            #cpi-status {
                margin-top: 10px;
                padding: 8px;
                background: #f5f6f7;
                font-size: 12px;
                border-radius: 4px;
            }

            #cpi-results {
                margin-top: 10px;
                overflow-y: auto;
                flex: 1;
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
            }

            .cpi-package {
                color: #666;
                font-size: 11px;
                margin-top: 3px;
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

pluginList.push(plugin);
