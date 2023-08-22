const checkboxState = {
    tagName: {},
    className: {},
};
const tagColors = {};

// Load all XML files from the xml/ subdirectory at build time
async function loadXMLFiles() {
    const response = await fetch("/generated_xml_manifest.json");
    const xmlFiles = await response.json();
    console.log('loadXMLFiles', { xmlFiles });
    return xmlFiles;
}

document.addEventListener("DOMContentLoaded", async function () {
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
        const { stylesheets, xmlDoc } = await parseXMLFile(selectedFile);

        for (const stylesheet of stylesheets) {
            await Promise.all(stylesheets.map(loadStylesheet));
        }

        // Repopulate XML content and stylesheet
        const { uniqueTags, uniqueClassNames } = populateXMLDisplay(xmlDoc);
        addDynamicStyles(uniqueTags, uniqueClassNames);
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

});

// Parse the selected XML file and extract the necessary information
async function parseXMLFile(file) {
    try {
        const response = await fetch(file);
        const fileData = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileData, "text/xml");

        let stylesheets = [];
        for (let i = 0; i < xmlDoc.childNodes.length; i++) {
            const node = xmlDoc.childNodes[i];
            if (node.nodeType === 7 && node.target === 'xml-stylesheet') { // nodeType 7 is for processing instructions
                const match = node.data.match(/href="([^"]*)"/);
                if (match) {
                    stylesheets.push(match[1]);
                }
            }
        }

        console.log('parseXMLFile', { stylesheets, xmlDoc });
        return { stylesheets, xmlDoc };
    } catch (error) {
        console.error(`Error parsing file ${file}:`, error);
    }
}


function loadStylesheet(stylesheet) {
    return new Promise((resolve) => {
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = stylesheet;
        linkElement.onload = () => {
            console.log('Stylesheet loaded', { stylesheet });
            resolve();
        };
        document.head.appendChild(linkElement);
    });
}


// Generate checkboxes based on the content of the selected XML file
function populateCheckboxes(xmlDoc) {
    const checkboxesContainer = document.getElementById("checkbox-container");
    const xmlNodes = Array.from(xmlDoc.querySelectorAll("*"));

    const tagClassMapping = {};

    xmlNodes.forEach((node) => {
        if (node.closest("header")) return;
        const tagName = node.tagName.toLowerCase();
        if (!tagClassMapping[tagName]) {
            tagClassMapping[tagName] = new Set();
        }
        if (node.className) {
            node.className.split(' ').forEach(className => tagClassMapping[tagName].add(className));
        }
    });

    checkboxState.tagName = {};
    checkboxState.className = {};

    const createCheckbox = (value, type, container) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.dataset[type] = value;
        if (type === "tagName") {
            container.dataset.tagname = value; // Add data attribute for tag name section
        }

        checkbox.addEventListener("change", () => {
            checkboxState[type][value] = checkbox.checked;
            updateDisplay();

            // If it's a tagName checkbox and it's unchecked, uncheck all nested className checkboxes
            // if (type === "tagName" && !checkbox.checked) {
            //     container.querySelectorAll('input').forEach(classCheckbox => {
            //         classCheckbox.checked = false;
            //         checkboxState.className[classCheckbox.dataset.value] = false;
            //         const elements = document.querySelectorAll(`#xml-display .${classCheckbox.dataset.value}`);
            //         elements.forEach((element) => {
            //             element.setAttribute('data-hide-class', true);
            //         });
            //     });
            // }
            // // If it's a tagName checkbox and it's checked, check all nested className checkboxes
            // else if (type === "tagName" && checkbox.checked) {
            //     container.querySelectorAll('input').forEach(classCheckbox => {
            //         classCheckbox.checked = true;
            //         checkboxState.className[classCheckbox.dataset.value] = true;
            //         const elements = document.querySelectorAll(`#xml-display .${classCheckbox.dataset.value}`);
            //         elements.forEach((element) => {
            //             element.removeAttribute('data-hide-class');
            //         });
            //     });
            // }
            // Handle tagName checkbox change
            if (type === "tagName") {
                container.querySelectorAll('input').forEach(classCheckbox => {
                    classCheckbox.checked = checkbox.checked;
                    checkboxState.className[classCheckbox.dataset.className] = checkbox.checked;
                });
            }

            updateDisplay();
        });

        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.dataset[type] = value;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${type}: ${value}`));
        container.appendChild(label);
    };

    for (const tagName in tagClassMapping) {
        // Skip creating checkboxes for OpenText and Text tagnames
        if (tagName.toLowerCase() === 'opentext' || tagName.toLowerCase() === 'text') continue;

        const tagSection = document.createElement("div");
        checkboxesContainer.appendChild(tagSection);

        const h3 = document.createElement("h3");
        h3.textContent = `Tag Name: ${tagName}`;
        tagSection.appendChild(h3);

        createCheckbox(tagName, "tagName", tagSection);

        const classSection = document.createElement("div");
        tagSection.appendChild(classSection);

        tagClassMapping[tagName].forEach(className => {
            createCheckbox(className, "className", classSection);
        });
    }
}

function updateDisplay() {

    for (const tagName in checkboxState.tagName) {
        const hide = checkboxState.tagName[tagName] === false;
        const elements = document.querySelectorAll(`#xml-display ${tagName}`);
        elements.forEach((element) => {
            element.setAttribute('data-hide-tag', hide.toString());
        });

        const classSection = document.querySelector(`#checkbox-container div[data-tagname="${tagName}"] div`);
        classSection.querySelectorAll('input').forEach(classCheckbox => {
            const className = classCheckbox.dataset.className;
            if (hide) {
                checkboxState.className[className] = false;
            } else {
                checkboxState.className[className] = classCheckbox.checked;
            }
            const classElements = document.querySelectorAll(`#xml-display .${className}`);
            classElements.forEach((element) => {
                element.setAttribute('data-hide-class', (!checkboxState.className[className]).toString());
            });
        });
    }
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
    const uniqueTags = new Set();
    const uniqueClassNames = new Set();

    // Clone the entire XML document into the "xml-display" container
    const clonedNode = xmlDoc.documentElement.cloneNode(true);
    xmlDisplayContainer.innerHTML = "";
    xmlDisplayContainer.appendChild(clonedNode);

    // Scan for unique nodes
    const xmlNodes = Array.from(xmlDisplayContainer.querySelectorAll("*")); // Get all elements in the XML

    xmlNodes.forEach((node) => {
        if (node.closest("header")) return; // Ignore the <header> node and all descendants of <header>

        // Add the tag name to the set of unique tags
        uniqueTags.add(node.tagName.toLowerCase());

        // Add the class names to the set of unique class names
        if (node.className) {
            node.className.split(' ').forEach(className => uniqueClassNames.add(className));
        }
    });

    return { uniqueTags, uniqueClassNames };
}

function addDynamicStyles(uniqueTags, uniqueClassNames) {
    const styleElement = document.createElement('style2');
    let styles = '';

    // Add styles for unique tags
    uniqueTags.forEach((tag) => {
        const color = randomColor();
        tagColors[tag] = color; // store the color for each tag
        styles += `${tag} { border: 2px solid ${color}; border-radius: 5px; padding: 5px; margin: 5px; }\n`;
    });


    // Add styles for unique class names
    uniqueClassNames.forEach((className) => {
        const color = randomColor();
        styles += `.${className} { outline: 2px solid ${color}; }\n`;
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
    const { stylesheets, xmlDoc } = await parseXMLFile(selectedFile);
    populateCheckboxes(xmlDoc);
    await Promise.all(stylesheets.map(loadStylesheet));
    addDynamicStyles(uniqueTags, uniqueClassNames);
    const { uniqueTags, uniqueClassNames } = populateXMLDisplay(xmlDoc);


}


// Run the main function when the page loads
window.onload = main;
