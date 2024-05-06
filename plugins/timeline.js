var plugin = {
    metadataVersion: "1.0.0",
    id: "timeline",
    name: "Timeline",
    version: "1.0.1",
    author: "Gregor Schütz, AGILITA AG",
    website: "https://www.agilita.ch/",
    email: "gregor.schuetz@agilita.ch",
    description: "<br><b>(Trace not needed)</b></br> Displays the timeline of a message.",
    settings: {
        "icon": { "type": "icon", "src": "/images/plugin_logos/AGILITAAG_Logo.jpg" }
    },
    messageSidebarButton: {
        "icon": { "type": "icon", "text": "xe088" },
        "title": "display timeline",
        "onClick": async (pluginHelper, settings, runInfo, active) => {
            // Data Prep for table
            // Get correlationId of current message
            const urlForCorrelationId = `/${pluginHelper.urlExtension}odata/api/v1/MessageProcessingLogs?$format=json&$filter=MessageGuid eq '${runInfo.messageGuid}'`;
            var dataOfCurrentMessage = JSON.parse(await makeCallPromise("GET", urlForCorrelationId, false)).d.results;

            // Get data for table
            // Order by LogStart so we know in what order it started
            const urlForPathData = `/${pluginHelper.urlExtension}odata/api/v1/MessageProcessingLogs?$format=json&$filter=CorrelationId eq '${dataOfCurrentMessage[0].CorrelationId}'&$orderby=LogStart`;
            var dataForTable = JSON.parse(await makeCallPromise("GET", urlForPathData, false)).d.results;

            // Popup
            var popupContent = document.createElement("div");

            // Place the table inside of the div
            popupContent.innerHTML = createContent(dataForTable, pluginHelper);

            // Add content inside of a popup
            pluginHelper.functions.popup(popupContent, "Timeline");

            // Add table sorting
            $('table').tablesort();
        }
    }
}

// Returns formatted date & time
function formatTimestamp(timestamp) {
    // Extract the timestamp number using a regular expression
    const matches = timestamp.match(/\/Date\((\d+)\)\//);

    // Parse the timestamp to a date object
    const date = new Date(parseInt(matches[1], 10));

    // Format the date parts
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    return `{"date":"${year}-${month}-${day}","time":"${hours}:${minutes}:${seconds}.${milliseconds}"}`;
}

function createContent(data, pluginHelper) {
    // Table columns
    var popupContentPrefix = `
    <table class="ui sortable celled center aligned table" id='timelinetable'>
        <thead>
            <tr class="black">
                <th class="ui center aligned">Nr.</th>
                <th>Integration Flow Name</th>
                <th>Integration Package</th>
                <th>Status</th>
                <th class="sorted ascending">Start</th>
                <th>End</th>
            </tr>
        </thead>
        </tbody>`;

    // Creating a table entry for every connected artifact
    data.forEach(function (artifact, index) {
        // Status coloring for status field
        var statusColor = artifact.Status;
        if (statusColor == "PROCESSING") {
            statusColor = "yellow";
        }
        else if (statusColor == "FAILED") {
            statusColor = "red";
        }
        else if (statusColor == "COMPLETED") {
            statusColor = "green";
        }
        else if (statusColor.match(/^(ESCALATED|RETRY)$/)) {
            statusColor = "orange";
        }
        else if (statusColor.match(/^(CANCELLED)$/)) {
            statusColor = "grey";
        }
        else {
            statusColor = "blue";
        }

        var start = JSON.parse(formatTimestamp(artifact.LogStart));
        var end = JSON.parse(formatTimestamp(artifact.LogEnd));
        var packageLink = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}?section=ARTIFACTS`;
        // Displaying the currently viewed artifact differently than the connected artifacts
        // No link for currently viewed artifact (because we are already viewing it)
        // Has different background coloring and indicating text
        var link = `https://${pluginHelper.tenant}/${pluginHelper.urlExtension}shell/design/contentpackage/${artifact.IntegrationArtifact.PackageId}/integrationflows/${artifact.IntegrationArtifact.Id}`;
        popupContentPrefix += `
            <tr class="${statusColor}">
                <td data-label="Nr." class="ui center aligned">${index + 1}.</td>
                <td data-label="Integration Flow Name" ${artifact.IntegrationArtifact.Id != pluginHelper.integrationFlowId
                ? `class="selectable"><a href="${link}" target="_blank">${artifact.IntegrationArtifact.Name}</a>`
                : `class="yellow">${artifact.IntegrationArtifact.Name} (currently viewing)`}
                </td>
                <td data-label="Integration Package" class="selectable"><a href="${packageLink}" target="_blank">${artifact.IntegrationArtifact.PackageName}</a></td>
                <td data-label="Status">${artifact.Status}</td>
                <td data-label="Start">${start.date} ${start.time}</td>
                <td data-label="End">${end.date} ${end.time}</td>
            </tr>`;
    });

    return popupContentPrefix + `</tbody></table>`;
}

pluginList.push(plugin);

/*
	A simple, lightweight jQuery plugin for creating sortable tables.
	https://github.com/kylefox/jquery-tablesort
	Version 0.0.11
*/

(function($) {
	$.tablesort = function ($table, settings) {
		var self = this;
		this.$table = $table;
		this.$thead = this.$table.find('thead');
		this.settings = $.extend({}, $.tablesort.defaults, settings);
		this.$sortCells = this.$thead.length > 0 ? this.$thead.find('th:not(.no-sort)') : this.$table.find('th:not(.no-sort)');
		this.$sortCells.on('click.tablesort', function() {
			self.sort($(this));
		});
		this.index = null;
		this.$th = null;
		this.direction = null;
	};

	$.tablesort.prototype = {

		sort: function(th, direction) {
			var start = new Date(),
				self = this,
				table = this.$table,
				rowsContainer = table.find('tbody').length > 0 ? table.find('tbody') : table,
				rows = rowsContainer.find('tr').has('td, th'),
				cells = rows.find(':nth-child(' + (th.index() + 1) + ')').filter('td, th'),
				sortBy = th.data().sortBy,
				sortedMap = [];

			var unsortedValues = cells.map(function(idx, cell) {
				if (sortBy)
					return (typeof sortBy === 'function') ? sortBy($(th), $(cell), self) : sortBy;
				return ($(this).data().sortValue != null ? $(this).data().sortValue : $(this).text());
			});
			if (unsortedValues.length === 0) return;

			//click on a different column
			if (this.index !== th.index()) {
				this.direction = 'asc';
				this.index = th.index();
			}
			else if (direction !== 'asc' && direction !== 'desc')
				this.direction = this.direction === 'asc' ? 'desc' : 'asc';
			else
				this.direction = direction;

			direction = this.direction == 'asc' ? 1 : -1;

			self.$table.trigger('tablesort:start', [self]);
			self.log("Sorting by " + this.index + ' ' + this.direction);

			// Try to force a browser redraw
			self.$table.css("display");
			// Run sorting asynchronously on a timeout to force browser redraw after
			// `tablesort:start` callback. Also avoids locking up the browser too much.
			setTimeout(function() {
				self.$sortCells.removeClass(self.settings.asc + ' ' + self.settings.desc);
				for (var i = 0, length = unsortedValues.length; i < length; i++)
				{
					sortedMap.push({
						index: i,
						cell: cells[i],
						row: rows[i],
						value: unsortedValues[i]
					});
				}

				sortedMap.sort(function(a, b) {
					return self.settings.compare(a.value, b.value) * direction;
				});

				$.each(sortedMap, function(i, entry) {
					rowsContainer.append(entry.row);
				});

				th.addClass(self.settings[self.direction]);

				self.log('Sort finished in ' + ((new Date()).getTime() - start.getTime()) + 'ms');
				self.$table.trigger('tablesort:complete', [self]);
				//Try to force a browser redraw
				self.$table.css("display");
			}, unsortedValues.length > 2000 ? 200 : 10);
		},

		log: function(msg) {
			if(($.tablesort.DEBUG || this.settings.debug) && console && console.log) {
				console.log('[tablesort] ' + msg);
			}
		},

		destroy: function() {
			this.$sortCells.off('click.tablesort');
			this.$table.data('tablesort', null);
			return null;
		}

	};

	$.tablesort.DEBUG = false;

	$.tablesort.defaults = {
		debug: $.tablesort.DEBUG,
		asc: 'sorted ascending',
		desc: 'sorted descending',
		compare: function(a, b) {
			if (a > b) {
				return 1;
			} else if (a < b) {
				return -1;
			} else {
				return 0;
			}
		}
	};

	$.fn.tablesort = function(settings) {
		var table, sortable, previous;
		return this.each(function() {
			table = $(this);
			previous = table.data('tablesort');
			if(previous) {
				previous.destroy();
			}
			table.data('tablesort', new $.tablesort(table, settings));
		});
	};

})(window.Zepto || window.jQuery);