const checkboxState = {
    tagName: {},
    className: {},
    subclassName: {},
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

    checkboxState.tagName = {};
    checkboxState.className = {};
    checkboxState.subclassName = {};

    const createCheckbox = (value, type, container) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.dataset[type] = value;
        if (type === "tagName") {
            container.dataset.tagName = value; // Add data attribute for tag name section
        }
        // FIXME: colorize labels for checkboxes based on CSS invoked by checkbox state (add class attribute to checkbox label, or maybe an example element before or after the checkbox)
        checkbox.addEventListener("change", () => {
            checkboxState[type][value] = checkbox.checked;

            if (type === "tagName") {
                // If it's a tagName checkbox, add hide class to tagName instances
                container.querySelectorAll('input').forEach(classCheckbox => {
                    classCheckbox.checked = checkbox.checked;
                    checkboxState.className[classCheckbox.dataset.className] = checkbox.checked;
                });
                const elements = document.querySelectorAll(`#xml-display ${value.replace(/([^\w\s])/g, '\\$1')}`);
                elements.forEach((element) => {
                    element.setAttribute('data-hide-tag', (!checkbox.checked).toString());
                });
            } else if (type === "className") {
                // If it's a className checkbox, update the specific class
                const elements = document.querySelectorAll(`#xml-display .${value}`);
                elements.forEach((element) => {
                    element.setAttribute('data-hide-class', (!checkbox.checked).toString());
                });
            } else if (type === "subclassName") {
                // If it's a subclass checkbox, update the specific subclass
                const elements = document.querySelectorAll(`#xml-display [subclass="${value}"]`);
                elements.forEach((element) => {
                    element.setAttribute('data-hide-subclass', (!checkbox.checked).toString());
                });
            }

            updateDisplay(); // Call updateDisplay here to reflect the changes
        });

        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.dataset[type] = value;
        label.appendChild(checkbox);
        const labelText = type === "tagName" ? "[toggle all]" : value;
        label.appendChild(document.createTextNode(labelText));
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
            || tagName.toLowerCase() === 'function'
            || tagName.toLowerCase() === 'english') continue;

        const tagSection = document.createElement("div");
        checkboxesContainer.appendChild(tagSection);

        const h3 = document.createElement("h3");
        // capitalize tag name and add an 's' to the end
        h3.textContent = tagName[0].toUpperCase() + tagName.slice(1) + 's';
        // Append a horizontal rule before the h3
        const hr = document.createElement('hr');
        tagSection.appendChild(hr);
        tagSection.appendChild(h3);

        createCheckbox(tagName, "tagName", tagSection);

        // Add sections for both classname children and subclass children
        const tagElements = document.querySelectorAll(`#xml-display ${tagName}`);
        console.log('tagElements', { tagElements });
        const classList = new Set();
        const subclassList = new Set();

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

        console.log('tagNameClassList', classList);
        if (classList.size > 1) {
            const classnameSection = document.createElement("div");
            const classnameSectionTitle = document.createElement('h4');
            classnameSectionTitle.textContent = 'Classes'
            classnameSection.appendChild(classnameSectionTitle)
            tagSection.appendChild(classnameSection);
            // addToggleAllCheckbox(classList, "className", checkboxState, updateDisplay);
            Array.from(classList).sort().forEach((name) => {
                createCheckbox(name, "className", classnameSection);
            });
        }

        console.log('tagNameSubclassList', subclassList);
        if (subclassList.size > 1) {
            const subclassNameSection = document.createElement("div");
            const subclassNameSectionTitle = document.createElement('h4');
            subclassNameSectionTitle.textContent = 'Sub-classes'
            subclassNameSection.appendChild(subclassNameSectionTitle)
            tagSection.appendChild(subclassNameSection);
            // addToggleAllCheckbox(subclassList, "subclassName", checkboxState, updateDisplay);  
            Array.from(subclassList).sort().forEach((name) => {
                createCheckbox(name, "subclassName", subclassNameSection);
            });
        }


    }

}

function updateDisplay() {
    for (const tagName in checkboxState.tagName) {
        const hideTag = checkboxState.tagName[tagName] === false;
        const elements = document.querySelectorAll(`#xml-display ${tagName.replace(/([^\w\s])/g, '\\$1')}`);
        elements.forEach((element) => {
            element.setAttribute('data-hide-tag', hideTag.toString());
        });

        // If the relevant tagName is unchecked but some child classes are still checked, handle those cases
        if (hideTag) {
            const tagContainer = document.querySelector(`#checkbox-container div[data-tag-name="${tagName}"] div`);
            tagContainer.querySelectorAll('input').forEach(checkboxInTagNameSubList => {
                const className = checkboxInTagNameSubList.dataset.className;
                if (checkboxInTagNameSubList.checked) {
                    const classElements = document.querySelectorAll(`#xml-display ${tagName.replace(/([^\w\s])/g, '\\$1')}.${className}`);
                    classElements.forEach((element) => {
                        element.removeAttribute('data-hide-tag');
                    });
                }
            });
        }
    }

    // Loop through className state to update all classes
    for (const className in checkboxState.className) {
        const hide = checkboxState.className[className] === false;
        const classElements = document.querySelectorAll(`#xml-display [class="${className}"]`);
        classElements.forEach((element) => {
            element.setAttribute('data-hide-class', hide.toString());
        });
    }

    // Loop through subclasses state to update all subclasses
    for (const subclassName in checkboxState.subclassName) {
        const hide = checkboxState.subclassName[subclassName] === false;
        const subclassElements = document.querySelectorAll(`#xml-display [subclass="${subclassName}"]`);
        subclassElements.forEach((element) => {
            element.setAttribute('data-hide-subclass', hide.toString());
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
