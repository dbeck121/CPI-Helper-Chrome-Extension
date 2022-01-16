class XmlToJson {

	constructor(xml) {
		if (xml) {
			return this.parse(xml);
		}
	}

	/**
     * Adds an object value to a parent object
     *
     * @method addToParent
     * @param {Object} parent
     * @param {String} nodeName
     * @param {Mixed} obj
     * @return none
     */
	addToParent(parent, nodeName, obj) {
		// If this is the first or only instance of the node name, assign it as
		// an object on the parent.
		if (!parent[nodeName]) {
			parent[nodeName] = obj;
		}
		// Else the parent knows about other nodes of the same name
		else {
			// If the parent has a property with the node name, but it is not an array,
			// store the contents of that property, convert the property to an array, and
			// assign what was formerly an object on the parent to the first member of the
			// array
			if (!Array.isArray(parent[nodeName])) {
				let tmp = parent[nodeName];
				parent[nodeName] = [];
				parent[nodeName].push(tmp);
			}

			// Push the current object to the collection
			parent[nodeName].push(obj);
		}
	}


	convertXMLStringToDoc(str) {
		let xmlDoc = null;

		if (str && typeof str === 'string') {
			// Create a DOMParser
			let parser = new DOMParser();

			// Use it to turn your xmlString into an XMLDocument
			xmlDoc = parser.parseFromString(str, 'application/xml');
		}

		return xmlDoc;
	}


	/**
	 * Validates if an data is an XMLDocument
	 *
	 * @method isXML
	 * @param {Mixed} data
	 * @return {Boolean}
	 */
	isXML(data) {
		let documentElement = (data ? data.ownerDocument || data : 0).documentElement;
		return documentElement ? documentElement.nodeName.toLowerCase() !== 'html' : false;
	}


	/**
	 * Sends a chunk of XML to be parsed
	 *
	 * @method parse
	 * @param {XMLXtring} xml
	 * @return {JSON | Null}
	 */
	parse(xml) {
		if (xml && typeof xml === 'string') {
			xml = this.convertXMLStringToDoc(xml);
		}

		return (xml && this.isXML(xml)) ? this.parseNode({}, xml.firstChild) : null;
	}


	/**
	 * Reads through a node's attributes and assigns the values to a new object
	 *
	 * @method parseAttributes
	 * @param {XMLNode} node
	 * @return {Object}
	 */
	parseAttributes(node) {
		let attributes = node.attributes,
			obj = {};

		// If the node has attributes, assign the new object properties
		// corresponding to each attribute
		if (node.hasAttributes()) {
			for (let i = 0; i < attributes.length; i++) {
				obj[attributes[i].name] = this.parseValue(attributes[i].value);
			}
		}

		// return the new object
		return obj;
	}


	/**
	 * Rips through child nodes and parses them
	 *
	 * @method parseChildren
	 * @param {Object} parent
	 * @param {XMLNodeMap} childNodes
	 * @return none
	 */
	parseChildren(parent, childNodes) {
		// If there are child nodes...
		if (childNodes.length > 0) {
			// Loop over all the child nodes
			for (let i = 0; i < childNodes.length; i++) {
				// If the child node is a XMLNode, parse the node
				if (childNodes[i].nodeType == 1) {
					this.parseNode(parent, childNodes[i]);
				}
			}
		}
	}


	/**
	 * Converts a node into an object with properties
	 *
	 * @method parseNode
	 * @param {Object} parent
	 * @param {XMLNode} node
	 * @return {Object}
	 */
	parseNode(parent, node) {
		let nodeName = node.nodeName,
			obj = Object.assign({}, this.parseAttributes(node)),
			tmp = null;

		// If there is only one text child node, there is no need to process the children
		if (node.childNodes.length == 1 && node.childNodes[0].nodeType == 3) {
			// If the node has attributes, then the object will already have properties.
			// Add a new property 'text' with the value of the text content
			if (node.hasAttributes()) {
				obj['text'] = this.parseValue(node.childNodes[0].nodeValue);
			}
			// If there are no attributes, then the parent[nodeName] property value is
			// simply the interpreted textual content
			else {
				obj = this.parseValue(node.childNodes[0].nodeValue);
			}
		}
		// Otherwise, there are child XMLNode elements, so process them
		else {
			this.parseChildren(obj, node.childNodes);
		}

		// Once the object has been processed, add it to the parent
		this.addToParent(parent, nodeName, obj)

		// Return the parent
		return parent;
	};


	/**
	 * Interprets a value and converts it to Boolean, Number or String based on content
	 *
	 * @method parseValue
	 * @param {Mixed} val
	 * @return {Mixed}
	 */
	parseValue(val) {
		// Create a numeric value from the passed parameter
		let num = Number(val);

		// If the value is 'true' or 'false', parse it as a Boolean and return it
		if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
			return val.toLowerCase() == 'true';
		}

		// If the num parsed to a Number, return the numeric value
		// Else if the valuse passed has no length (an attribute without value) return null,
		// Else return the param as is
		return (isNaN(num)) ? val : (val.length == 0) ? null : num;
	}
}
