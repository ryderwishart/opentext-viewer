const checkboxState = {
    tagName: {},
    className: {},
    label: {},
};


// Load all XML files from the xml/ subdirectory at build time
async function loadXMLFiles() {
    const response = await fetch("/generated_xml_manifest.json");
    const xmlFiles = await response.json();
    console.log('loadXMLFiles', { xmlFiles });
    return xmlFiles;
}

window.onload = async function () {
    // Create file selector
    const fileSelector = document.getElementById("file-selector");
    const select = document.createElement("select");
    select.addEventListener("change", async () => {
        // Clear current XML content and stylesheet
        document.getElementById("xml-display").innerHTML = "";
        document.getElementById("checkbox-container").innerHTML = "";
        const oldStylesheet = document.querySelector("link[rel=stylesheet]");
        if (oldStylesheet) {
            oldStylesheet.remove();
        }

        // Fetch and parse selected file
        const selectedFile = select.value;
        const { stylesheet, xmlDoc } = await parseXMLFile(selectedFile); // Destructure xmlDoc from the result

        loadStylesheet(stylesheet);

        // Repopulate XML content and stylesheet
        const { uniqueTags, uniqueLabels } = populateXMLDisplay(xmlDoc);
        addDynamicStyles(uniqueTags, uniqueLabels);
        populateCheckboxes(xmlDoc);
    });



    fileSelector.appendChild(select);

    // Load all XML files and populate file selector
    const xmlFiles = await loadXMLFiles();
    xmlFiles.forEach((file) => {
        const option = document.createElement("option");
        option.value = file;
        option.text = file;
        select.appendChild(option);
    });

    // Select the first file by default
    select.value = xmlFiles[0];
    select.dispatchEvent(new Event("change"));
};





// Parse the selected XML file and extract the necessary information
async function parseXMLFile(file) {
    try {
        const response = await fetch(file);
        const fileData = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileData, "text/xml");

        let stylesheet;
        for (let i = 0; i < xmlDoc.childNodes.length; i++) {
            const node = xmlDoc.childNodes[i];
            if (node.nodeType === 7 && node.target === 'xml-stylesheet') { // nodeType 7 is for processing instructions
                const match = node.data.match(/href="([^"]*)"/);
                stylesheet = match ? match[1] : undefined;
                break;
            }
        }

        console.log('parseXMLFile', { stylesheet, xmlDoc });
        return { stylesheet, xmlDoc };
    } catch (error) {
        console.error(`Error parsing file ${file}:`, error);
    }
}




function loadStylesheet(stylesheet) {
    const linkElement = document.createElement("link");
    linkElement.rel = "stylesheet";
    linkElement.href = stylesheet;
    document.head.appendChild(linkElement);

    console.log('loadStylesheet', { stylesheet });
}


// Generate checkboxes based on the content of the selected XML file
function populateCheckboxes(xmlDoc) {
    const checkboxesContainer = document.getElementById("checkbox-container");
    const xmlNodes = Array.from(xmlDoc.querySelectorAll("*")); // Get all elements in the XML except header

    const uniqueTagNames = new Set();
    const uniqueClassNames = new Set();
    const uniqueLabels = new Set();

    xmlNodes.forEach((node) => {
        // Ignore the <header> node and all descendants of <header>
        if (node.closest("header")) return;
        uniqueTagNames.add(node.tagName);
        node.className && uniqueClassNames.add(node.className);
        node.getAttribute("label") && uniqueLabels.add(node.getAttribute("label"));
    });

    // Initialize checkboxState properties
    checkboxState.tagName = {};
    checkboxState.className = {};
    checkboxState.label = {};

    // Function to create a checkbox for a given value and type
    const createCheckbox = (value, type) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.addEventListener("change", () => {
            checkboxState[type][value] = checkbox.checked;
            updateDisplay();
        });

        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.dataset[type] = value;
        checkbox.addEventListener("change", () => {
            checkboxState[type][value] = checkbox.checked;
            updateDisplay();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${type}: ${value}`));
        checkboxesContainer.appendChild(label);
    };

    // Add a heading and checkboxes for each type
    ["Tag Names", "Class Names", "Labels"].forEach((heading, i) => {
        const uniqueSet = [uniqueTagNames, uniqueClassNames, uniqueLabels][i];
        const type = ["tagName", "className", "label"][i];

        // Only create heading and checkboxes if there are unique values
        if (uniqueSet.size > 0) {
            const h3 = document.createElement("h3");
            h3.textContent = heading;
            checkboxesContainer.appendChild(h3);
            uniqueSet.forEach(value => createCheckbox(value, type));
        }
    });

    console.log('populateCheckboxes', { xmlNodes });
}

function toggleDisplay(type, value) {
    const nodes = Array.from(document.querySelectorAll(`#xml-display .${type}-${value}`));
    nodes.forEach((node) => {
        const hideClass = type === 'tagName' ? 'hideTag' : 'hideLabel';
        if (node.classList.contains(hideClass)) {
            node.classList.remove(hideClass);
        } else {
            node.classList.add(hideClass);
        }
    });
}

function updateDisplay() {
    const nodes = Array.from(document.querySelectorAll("#xml-display *"));
    nodes.forEach((node) => {
        const types = ["tagName", "label"];
        node.classList.remove("hideTag");
        node.classList.remove("hideLabel");
        for (const type of types) {
            const value = type === 'tagName' ? node[type] : node.getAttribute(type) || "no-label";
            const hideClass = type === 'tagName' ? 'hideTag' : 'hideLabel';
            if (checkboxState[type][value] === false) {
                node.classList.add(hideClass);
            }
        }
    });
}

// Populate tooltips or status bar for functions/values on hovering an element
function populateTooltips(node) {
    node.addEventListener("mouseover", () => {
        // Implementation goes here
    });
    node.addEventListener("mouseout", () => {
        // Implementation goes here
    });
}

function populateXMLDisplay(xmlDoc) {
    console.log({ xmlDoc })
    const xmlDisplayContainer = document.getElementById("xml-display");
    const uniqueNodes = new Set();
    const uniqueTags = new Set();
    const uniqueLabels = new Set();

    // Clone the entire XML document into the "xml-display" container
    const clonedNode = xmlDoc.documentElement.cloneNode(true);
    xmlDisplayContainer.appendChild(clonedNode);

    // Scan for unique nodes
    const xmlNodes = Array.from(xmlDisplayContainer.querySelectorAll("*")); // Get all elements in the XML
    xmlNodes.forEach((node) => {
        const labelAttr = node.getAttribute("label") || "no-label";
        const identifier = `${node.tagName}.${node.className}.${labelAttr}`; // unique identifier based on tag name, class name and label

        if (!uniqueNodes.has(identifier)) { // only process unique nodes
            uniqueNodes.add(identifier);
            node.classList.add(`tagName-${node.tagName}`);
            node.classList.add(`label-${labelAttr}`);
            uniqueTags.add(node.tagName);
            uniqueLabels.add(labelAttr);
        }
    });

    console.log('populateXMLDisplay', { xmlNodes });
    return { uniqueTags, uniqueLabels };
}

function addDynamicStyles(uniqueTags, uniqueLabels) {
    const styleElement = document.createElement('style');
    let styles = '';

    // Add styles for unique tags
    uniqueTags.forEach((tag, i) => {
        const color = randomColor();
        styles += `.tag-${tag} { border: 2px solid ${color}; border-radius: 5px; padding: 5px; }\n`;
    });

    // Add styles for unique labels
    uniqueLabels.forEach((label, i) => {
        const color = randomColor();
        styles += `.label-${label} { outline: 2px solid ${color}; }\n`;
    });

    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}


// Function to generate random colors
function randomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}



// Main function to initialize the application
async function main() {
    const xmlFiles = await loadXMLFiles();
    console.log('main', { xmlFiles });
    const selectedFile = xmlFiles[0]; // Select the first file by default
    const parsedFile = await parseXMLFile(selectedFile);
    const stylesheet = parsedFile.stylesheet;
    loadStylesheet(stylesheet);
    const xmlDoc = parsedFile.xmlDoc;
    const { uniqueTags, uniqueLabels } = populateXMLDisplay(xmlDoc); // Pass xmlDoc instead of xmlNodes
    addDynamicStyles(uniqueTags, uniqueLabels);
    populateCheckboxes(xmlDoc); // Pass xmlDoc instead of xmlNodes
}




// Run the main function when the page loads
window.onload = main;
