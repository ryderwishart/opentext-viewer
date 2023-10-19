const checkboxState = {
    tag: {},
    class: {},
    subclass: {},
};
const tagColors = {};

// Load all XML files from the xml/ subdirectory at build time
async function loadXMLFiles() {
    const response = await fetch("/generated_xml_manifest.json");
    const xmlFiles = await response.json();
    console.log('loadXMLFiles', { xmlFiles });
    return xmlFiles;
}

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
    const tagNames = new Set();
    const tagClassMapping = {};
    const tagSubclassMapping = {};

    xmlNodes.forEach((node) => {
        if (!node.closest("text")) return;
        const tagName = node.tagName.toLowerCase();
        // If tagNames does not yet contain this tagName as an item, add the string value of tagName to tagNames    
        if (!tagNames[tagName]) {
            tagNames.add(tagName);
        }
        // If tagName does not yet have a mapping of class names, then create a new set
        if (!tagClassMapping[tagName]) {
            tagClassMapping[tagName] = new Set();
        }
        // If node has @class, then add that to the set of class names
        if (node.hasAttribute('class')) {
            tagClassMapping[tagName].add(node.getAttribute('class'));
        }
        // If tagName does not yet have a mapping of subclass names, then create a new set
        if (!tagSubclassMapping[tagName]) {
            tagSubclassMapping[tagName] = new Set();
        }
        // If node has @class, then add that to the set of class names
        if (node.hasAttribute('subclass')) {
            tagSubclassMapping[tagName].add(node.getAttribute('subclass'));
        }
    });

    // FIXME: this now allows class names to be duplicates (e.g. same class or subclass name on different elements but with independent toggling), but it's a hack (it concatenates strings to produce unique values)
    checkboxState.tag = {};
    checkboxState.class = {};
    checkboxState.subclass = {};

    const createCheckbox = (tag, container, type, value, master) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        // FIXME: colorize labels for checkboxes based on CSS invoked by checkbox state (add class attribute to checkbox label, or maybe an example element before or after the checkbox)
        checkbox.addEventListener("change", () => {

            // If it's a tagName checkbox, hide all relevant tags                    
            if (type === "tag") {
                // Update the checkboxState to reflect the change
                checkboxState[type][tag + "_" + value] = checkbox.checked;
                const elements = document.querySelectorAll(`#xml-display ${value.replace(/([^\w\s])/g, '\\$1')}`);
                elements.forEach((element) => {
                    element.setAttribute('data-hide-tag', (!checkbox.checked).toString());
                });
            }
            // If it's a master checkbox (i.e. toggle all), adjust relevant elements AND toggle all checkboxes inside the container
            else if (master) {
                // Update the checkboxState to reflect the change
                checkboxState[type][tag + "_" + value] = checkbox.checked;
                if (type === "class") {
                    // If it's a className checkbox, hide all classes
                    const tagName = checkbox.closest("div[data-tag-name]").dataset.tagName
                    console.log('checkboxTagName', tagName);
                    const elements = document.querySelectorAll(`#xml-display ${tagName.replace(/([^\w\s])/g, '\\$1')}[class]`);
                    elements.forEach((element) => {
                        element.setAttribute('data-hide-class', (!checkbox.checked).toString());
                    });
                } else if (type === "subclass") {
                    // If it's a subclass checkbox, hide all subclasses
                    const tagName = checkbox.closest("div[data-tag-name]").dataset.tagName
                    console.log('checkboxTagName', tagName);
                    const elements = document.querySelectorAll(`#xml-display ${tagName.replace(/([^\w\s])/g, '\\$1')}[subclass]`);
                    elements.forEach((element) => {
                        element.setAttribute('data-hide-subclass', (!checkbox.checked).toString());
                    });
                }
                // Update subcheckboxes regardless of whether or not they occur within the same menu section
                container.querySelectorAll('input').forEach(subCheckbox => {
                    subCheckbox.checked = checkbox.checked;
                    // Update checkboxStates for the specific checkboxes
                    checkboxState[type][tag + "_" + subCheckbox.dataset.type] = checkbox.checked;
                });
            } else
                // Update the checkboxState to reflect the change
                checkboxState[type][tag + "_" + value] = checkbox.checked;
            if (type === "class") {
                // If it's a className checkbox, hide the specific class
                const elements = document.querySelectorAll(`#xml-display [class="${value}"]`);
                elements.forEach((element) => {
                    element.setAttribute('data-hide-class', (!checkbox.checked).toString());
                });
            } else if (type === "subclass") {
                // If it's a subclass checkbox, hide the specific subclass
                const elements = document.querySelectorAll(`#xml-display [subclass="${value}"]`);
                elements.forEach((element) => {
                    element.setAttribute('data-hide-subclass', (!checkbox.checked).toString());
                });
            }
        });

        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.dataset[type] = master ? "all" : value;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(master ? "[toggle all]" : value));
        container.appendChild(label);
    };

    // For each unique tagName create a section in the left menu
    console.log('tagNames', tagNames);
    for (const tagName of tagNames) {
        console.log('tagName', tagName);
        // Skip creating checkboxes for OpenText and Text tagnames
        if (tagName.toLowerCase() === 'opentext'
            || tagName.toLowerCase() === 'text'
            || tagName.toLowerCase() === 'path'
            || tagName.toLowerCase() === 'ellipsis'
            || tagName.toLowerCase() === 'token'
            || tagName.toLowerCase() === 'greek'
            || tagName.toLowerCase() === 'english') continue;

        // Create div for checkboxes related to the current tagName
        const tagNameSection = document.createElement("div");
        // Add data attribute identifying div as a tag name section (used for toggle all functionality)
        tagNameSection.dataset.tagName = tagName;

        checkboxesContainer.appendChild(tagNameSection);

        const h3 = document.createElement("h3");
        // capitalize tag name and add an 's' to the end
        h3.textContent = tagName[0].toUpperCase() + tagName.slice(1) + 's';
        // Append a horizontal rule before the h3
        const hr = document.createElement('hr');
        tagNameSection.appendChild(hr);
        tagNameSection.appendChild(h3);

        createCheckbox(tagName, tagNameSection, "tag", tagName, true);

        // Add sections as needed for classes and subclasses
        const tagElements = document.querySelectorAll(`#xml-display ${tagName}`);
        console.log('tagElements', { tagElements });
        const classList = new Set();
        const subclassList = new Set();

        // Populate lists of @classes and @subclasses for the current tagName
        tagElements.forEach((element) => {
            const classAttr = element.getAttribute('class');
            const subclassAttr = element.getAttribute('subclass');
            if (classAttr) {
                classList.add(classAttr);
            }
            if (subclassAttr) {
                subclassList.add(subclassAttr);
            }
        });

        // Create class checkboxes if more than one class occurs
        console.log('tagNameClassList', classList);
        if (classList.size > 1) {
            const classNameSection = document.createElement("div");
            // Add data attribute identifying div as a list of classes (used for toggle all functionality)
            classNameSection.dataset.attributeName = "class";
            const classNameSectionTitle = document.createElement('h4');
            classNameSectionTitle.textContent = 'Classes'
            classNameSection.appendChild(classNameSectionTitle)
            tagNameSection.appendChild(classNameSection);
            createCheckbox(tagName, classNameSection, "class", "class", true);
            Array.from(classList).sort().forEach((name) => {
                createCheckbox(tagName, classNameSection, "class", name, false);
            });
        }

        // Create subclass checkboxes if more than one subclass occurs
        console.log('tagNameSubclassList', subclassList);
        if (subclassList.size > 1) {
            const subclassNameSection = document.createElement("div");
            // Add data attribute identifying div as a list of subclasses (used for toggle all functionality)
            subclassNameSection.dataset.attributeName = "subclass";
            const subclassNameSectionTitle = document.createElement('h4');
            subclassNameSectionTitle.textContent = 'Sub-classes'
            subclassNameSection.appendChild(subclassNameSectionTitle)
            tagNameSection.appendChild(subclassNameSection);
            createCheckbox(tagName, subclassNameSection, "subclass", "subclass", true);
            Array.from(subclassList).sort().forEach((name) => {
                createCheckbox(tagName, subclassNameSection, "subclass", name, false);
            });
        }
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

    // Clone the entire XML document into the "xml-display" container
    const clonedNode = xmlDoc.documentElement.cloneNode(true);
    xmlDisplayContainer.innerHTML = "";
    xmlDisplayContainer.appendChild(clonedNode);
}

// Main function to initialize the application
async function main() {
    const xmlFiles = await loadXMLFiles();
    console.log('main', { xmlFiles });
    const selectedFile = xmlFiles[0]; // Select the first file by default
    const { stylesheets, xmlDoc } = await parseXMLFile(selectedFile);
    // populateCheckboxes(xmlDoc);
    await Promise.all(stylesheets.map(loadStylesheet));
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
        populateXMLDisplay(xmlDoc);
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


// Run the main function when the page loads
window.onload = main;
