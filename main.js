const checkboxState = {
    tagName: {},
    className: {},
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

    const tagClassMapping = {};
    const subclasses = [];

    xmlNodes.forEach((node) => {
        if (node.closest("header")) return;
        const tagName = node.tagName.toLowerCase();
        if (!tagClassMapping[tagName]) {
            tagClassMapping[tagName] = new Set();
        }
        if (node.className) {
            node.className.split(' ').forEach(className => tagClassMapping[tagName].add(className));
        }
        // If node has @subclass, then add that to the set of class names
        if (node.hasAttribute('subclass')) {
            const subclass = node.getAttribute('subclass');
            tagClassMapping[tagName].add(subclass);
            subclasses.push(subclass);
        }
    });

    checkboxState.tagName = {};
    checkboxState.className = {};
    checkboxState.subclass = {};

    const createCheckbox = (value, type, container) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.dataset[type] = value;
        if (type === "tagName") {
            container.dataset.tagname = value; // Add data attribute for tag name section
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
            } else if (type === "subclass") {
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
        // label.appendChild(document.createTextNode(`${type}: ${value}`));
        label.appendChild(document.createTextNode(value));
        // Add 'subclass' to text label if type is 'subclass'

        container.appendChild(label);
    };

    for (const tagName in tagClassMapping) {
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

        createCheckbox('[toggle all]', "tagName", tagSection);
        // Add sublist sections for both classname children and subclass children

        const classnameSublist = document.createElement("div");
        const classnameSublistTitle = document.createElement('h4');
        classnameSublistTitle.textContent = 'Classes'
        classnameSublist.appendChild(classnameSublistTitle)
        tagSection.appendChild(classnameSublist);

        const subclassSublist = document.createElement("div");
        const subclassSublistTitle = document.createElement('h4');
        subclassSublistTitle.textContent = 'Sub-classes'
        subclassSublist.appendChild(subclassSublistTitle)
        tagSection.appendChild(subclassSublist);

        tagClassMapping[tagName].forEach(name => {
            if (subclasses.includes(name)) {
                createCheckbox(name, "subclass", subclassSublist);
            } else
                createCheckbox(name, "className", classnameSublist);
        });

        // If a sublist (either className or subclass) is empty, hide the sublist
        // if (classnameSublist.childElementCount === 1 && subclassSublist.childElementCount === 1) {
        //     classnameSublist.style.display = 'none';
        //     subclassSublist.style.display = 'none';
        // }
        // If there are only classes, show the list of classes with no headings and no toggle-all checkbox
        // else if (classnameSublist.childElementCount > 1 && subclassSublist.childElementCount === 1) {
        //     subclassSublist.style.display = 'none';
        //     const sortedClassnameSublist = Array.from(classnameSublist.querySelectorAll('label')).sort((a, b) => {
        //         return a.textContent.localeCompare(b.textContent);
        //     });
        //     sortedClassnameSublist.forEach(label => classnameSublist.appendChild(label));
        // }
        // // If there are classes and subclasses, then use subheadings and toggle-all checkboxes for both sublists
        // else {
        //     const sortedClassnameSublist = Array.from(classnameSublist.querySelectorAll('label')).sort((a, b) => {
        //         return a.textContent.localeCompare(b.textContent);
        //     });
        //     sortedClassnameSublist.forEach(label => classnameSublist.appendChild(label));
        //     // Create a label
        //     const toggleAllLabel = document.createElement('label');
        //     toggleAllLabel.textContent = '[toggle all]';
        //     // Add a toggle all checkbox to the className sublist
        //     const toggleAllCheckbox = document.createElement('input');
        //     toggleAllCheckbox.type = 'checkbox';
        //     // checked by default
        //     toggleAllCheckbox.checked = true;
        //     toggleAllCheckbox.addEventListener('change', () => {
        //         const checked = toggleAllCheckbox.checked;
        //         classnameSublist.querySelectorAll('input').forEach(checkbox => {
        //             checkbox.checked = checked;
        //             checkboxState.className[checkbox.dataset.className] = checked;
        //         });
        //         updateDisplay();
        //     }
        //     );
        //     // Append the checkbox to the label
        //     toggleAllLabel.appendChild(toggleAllCheckbox);
        //     // Insert the label at the top of the sublist (after the h4)
        //     classnameSublist.insertBefore(toggleAllLabel, classnameSublist.firstChild.nextSibling);
        // }
        // // make chekcbox checked by default
        // // add tagname, classname, subclass to checkbox label (e.g., [toggle all tagname], [toggle all classname], [toggle all subclass]])

        // if (subclassSublist.childElementCount === 1) {
        //     subclassSublist.style.display = 'none';
        // } else {
        //     const sortedSubclassSublist = Array.from(subclassSublist.querySelectorAll('label')).sort((a, b) => {
        //         return a.textContent.localeCompare(b.textContent);
        //     });
        //     sortedSubclassSublist.forEach(label => subclassSublist.appendChild(label));
        //     // Add a label
        //     const toggleAllLabel = document.createElement('label');
        //     toggleAllLabel.textContent = '[toggle all]';
        //     // append to the top of the sublist
        //     const toggleAllCheckbox = document.createElement('input');
        //     subclassSublist.insertBefore(toggleAllCheckbox, subclassSublist.firstChild.nextSibling);
        //     // Add a toggle all checkbox to the subclass sublist
        //     toggleAllCheckbox.type = 'checkbox';
        //     // checked by default
        //     toggleAllCheckbox.checked = true;
        //     toggleAllCheckbox.addEventListener('change', () => {
        //         const checked = toggleAllCheckbox.checked;
        //         subclassSublist.querySelectorAll('input').forEach(checkbox => {
        //             checkbox.checked = checked;
        //             checkboxState.subclass[checkbox.dataset.subclass] = checked;
        //         });
        //         updateDisplay();
        //     }
        //     );
        // }
        function addToggleAllCheckbox(sublist, stateKey, stateObj, updateDisplayFunc) {
            if (sublist.childElementCount > 1) {
                const sortedSublist = Array.from(sublist.querySelectorAll('label'))
                    .sort((a, b) => a.textContent.localeCompare(b.textContent));

                sortedSublist.forEach(label => sublist.appendChild(label));

                const toggleAllLabel = document.createElement('label');
                toggleAllLabel.textContent = '[toggle all]';

                const toggleAllCheckbox = document.createElement('input');
                toggleAllCheckbox.type = 'checkbox';
                toggleAllCheckbox.checked = true;

                toggleAllCheckbox.addEventListener('change', () => {
                    const checked = toggleAllCheckbox.checked;
                    sublist.querySelectorAll('input').forEach(checkbox => {
                        checkbox.checked = checked;
                        stateObj[stateKey][checkbox.dataset[stateKey]] = checked;
                    });
                    updateDisplayFunc();
                });

                toggleAllLabel.appendChild(toggleAllCheckbox);
                sublist.insertBefore(toggleAllLabel, sublist.firstChild.nextSibling);
            }
        }
        // Use the helper function to refactor the repetitive code

        if (classnameSublist.childElementCount === 1) {
            classnameSublist.style.opacity = 0;
        } else {
            addToggleAllCheckbox(classnameSublist, "className", checkboxState, updateDisplay);
        }
        if (subclassSublist.childElementCount === 1) {
            subclassSublist.style.opacity = 0;
        } else {
            addToggleAllCheckbox(subclassSublist, "subclass", checkboxState, updateDisplay);
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

        // If the parent tag is hidden but some child classes are still shown, handle those cases
        if (hideTag) {
            const tagContainer = document.querySelector(`#checkbox-container div[data-tagname="${tagName}"] div`);
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
        const classElements = document.querySelectorAll(`#xml-display .${className}`);
        classElements.forEach((element) => {
            element.setAttribute('data-hide-class', hide.toString());
        });
    }

    // Loop through subclasses state to update all subclasses
    for (const subclass in checkboxState.subclass) {
        const hide = checkboxState.subclass[subclass] === false;
        const subclassElements = document.querySelectorAll(`#xml-display [subclass="${subclass}"]`);
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

// Main function to initialize the application
async function main() {
    const xmlFiles = await loadXMLFiles();
    console.log('main', { xmlFiles });
    const selectedFile = xmlFiles[0]; // Select the first file by default
    const { stylesheets, xmlDoc } = await parseXMLFile(selectedFile);
    // populateCheckboxes(xmlDoc);
    await Promise.all(stylesheets.map(loadStylesheet));
    addDynamicStyles(uniqueTags, uniqueClassNames);
    const { uniqueTags, uniqueClassNames } = populateXMLDisplay(xmlDoc);


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
        // addDynamicStyles(uniqueTags, uniqueClassNames);
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
