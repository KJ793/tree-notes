// --------------------------------------------------------------------------
// DOM Element and Data Initialization
// --------------------------------------------------------------------------

// Map to store box elements, with their ID as keys and an object
// containing the box element and a Map of connected lines as values.
let boxes = new Map();

// Array, currently not used for any specific functionality.
let bin = [];

// Counter for the total number of boxes created. Used to assign unique IDs.
let totalBoxes = 1;

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------

/**
 * Wires up the prototype against the current DOM. Called by the React host
 * once the editor markup has mounted. Safe to call again after a remount,
 * since all state is rebuilt from scratch.
 */
function initPrototype() {
    // Reset state so a remount doesn't inherit stale box references.
    boxes = new Map();
    totalBoxes = 1;

    // Get the first DOM element with the class "box". This is the initial box.
    const seed = document.querySelectorAll(".box")[0];

    // Attach a listener to the seed box to handle pasting images directly into it.
    listenForImagePaste(seed);

    // Make the initial seed box draggable using the makeDraggable function.
    makeDraggable(seed);

    // Attach event listeners to the buttons within the box toolbar.
    boxToolbarListeners();

    // Add the seed box to the 'boxes' Map. The key is the box's ID, and the
    // value is an object containing the box element itself and an empty
    // array to store the IDs of the boxes this one is linked to.
    boxes.set(seed.id, {
        box: seed,
        lines: []
    });

    initTextContextMenu();
    initLinkDropdown();
    initCanvasPan();
}

// --------------------------------------------------------------------------
// Canvas Panning
// --------------------------------------------------------------------------

/**
 * Lets the user drag the empty canvas to pan around, the way a whiteboard
 * works. Implemented by moving the container's scroll position rather than
 * transforming its contents, so it composes with the existing zoom and leaves
 * every box's stored coordinates untouched.
 */
function initCanvasPan() {
    const container = document.querySelector("#tree .container");
    let panning = false;
    let startX, startY, startLeft, startTop;

    container.addEventListener("mousedown", (e) => {
        // Boxes have their own drag handler, and the toolbar needs its clicks.
        if (e.target.closest(".box") || e.target.closest(".canvas-tools")) return;

        panning = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = container.scrollLeft;
        startTop = container.scrollTop;
        container.style.cursor = "grabbing";

        // Stops the drag from turning into a text selection.
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (!panning) return;
        container.scrollLeft = startLeft - (e.clientX - startX);
        container.scrollTop = startTop - (e.clientY - startY);
    });

    window.addEventListener("mouseup", () => {
        if (!panning) return;
        panning = false;
        container.style.cursor = "";
    });
}

// --------------------------------------------------------------------------
// Zoom Functionality
// --------------------------------------------------------------------------

/**
 * Zooms the canvas in or out by multiplying the current scale.
 * @param {number} times - The factor by which to zoom (e.g., 2 for 2x zoom, 0.5 for 0.5x zoom).
 */
function zoom(times) {
    const canvas = document.getElementById("zoom");
    const container = document.querySelector("#tree .container");
    const scale = (new DOMMatrix(canvas.style.transform)).a || 1;
    const next = scale * times;

    // Whatever sits in the middle of the pane should stay there afterwards,
    // rather than the view sliding towards the canvas origin.
    const centreX = container.scrollLeft + container.clientWidth / 2;
    const centreY = container.scrollTop + container.clientHeight / 2;

    canvas.style.transform = `scale(${next})`;

    // transform-origin is the top-left corner, so painted positions scale
    // linearly and the old centre simply moves by the ratio of the two scales.
    const ratio = next / scale;
    container.scrollLeft = centreX * ratio - container.clientWidth / 2;
    container.scrollTop = centreY * ratio - container.clientHeight / 2;
}

// --------------------------------------------------------------------------
// Drag and Drop Functionality for Boxes
// --------------------------------------------------------------------------

/**
 * Makes a given HTML element draggable.
 * Uses closures to maintain event listener variables without global scope.
 * @param {HTMLElement} box - The HTML element to make draggable.
 */
function makeDraggable(box) {
    let isDragging = false;
    let offsetX, offsetY;

    // Event listener for when the box loses focus (blur event).
    // Updates connected lines, since the box height may have changed while
    // it was being edited.
    box.addEventListener("blur", () => {
        updateLinesPosition(box);
    });

    // Event listener for when the box is clicked.
    // Shows the toolbar associated with the clicked box.
    box.addEventListener("click", () => {
        const toolbar = document.getElementById('toolbar');
        const rect = box.getBoundingClientRect();
        toolbar.style.left = rect.right + 'px';
        toolbar.style.top = rect.top + 'px';
        const colorPicker = document.getElementById("boxColor");
        colorPicker.value = colorToHex(box.style.backgroundColor);
        toolbar.style.display = 'block';
        document.getElementById("toolbar").dataset.boxId = box.id;

        // Lets the React graph panel react to the selection without this script
        // needing to know anything about it.
        window.dispatchEvent(new CustomEvent("box-selected", {
            detail: { id: box.id }
        }));
    });

    // Event listener for when the mouse button is pressed down on the box.
    // Initiates the dragging process.
    box.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - box.offsetLeft;
        offsetY = e.clientY - box.offsetTop;
        box.style.cursor = "grabbing";
    });

    // Event listener for mouse movement across the window.
    // Handles the actual dragging of the box and updates line positions.
    window.addEventListener("mousemove", (e) => {
        const container = document.getElementById("tree");
        const limitReached = container.offsetLeft > e.clientX || container.offsetTop > e.clientY;
        if (!isDragging || limitReached) return;
        box.style.left = e.clientX - offsetX + "px";
        box.style.top = e.clientY - offsetY + "px";
        updateLinesPosition(box);
    });

    // Event listener for when the mouse button is released over the window.
    // Ends the dragging process.
    window.addEventListener("mouseup", () => {
        isDragging = false;
        box.style.cursor = "grab";
    });
}

// --------------------------------------------------------------------------
// Box Creation and Management
// --------------------------------------------------------------------------

/**
 * Adds a new block adjacent to the currently selected box and connects them with a line.
 * @param {HTMLElement} box - The reference box to which the new block will be connected.
 */
function addBlock(box) {
    // Place the new box clear of the parent's right edge. getBoxCoords() gives
    // the parent's centre, which is what lines need but would drop the new box
    // on top of the parent and hide its text.
    const gap = 40;
    const x = box.offsetLeft + box.offsetWidth + gap;

    // Stagger downwards so several children of the same parent don't stack.
    const existingChildren = boxes.get(box.id).lines.length;
    const y = box.offsetTop + existingChildren * (box.offsetHeight + 20);

    const newBox = createNewBlock(x, y);
    newLine(box, newBox);
}

/**
 * Creates a new draggable block (div element) and appends it to the "boxes" container.
 * @param {number} [x=0] - The initial x-coordinate (left position) of the new box.
 * @param {number} [y=20] - The initial y-coordinate (top position) of the new box.
 * @param {string} [content="New Box"] - The initial text content of the new box.
 * @returns {HTMLElement} The newly created box element.
 */
function createNewBlock(x = 0, y = 20, content = "New Box") {
    let newBox = document.createElement('div');
    totalBoxes += 1;
    newBox.id = totalBoxes;
    newBox.className = "box";
    newBox.style.position = "absolute";
    newBox.style.left = `${x}px`;
    newBox.style.top = `${y}px`;
    newBox.textContent = content;
    newBox.contentEditable = true;
    newBox.style.backgroundColor = "#f1f1f1";
    const footer = document.createElement("h6");
    footer.innerHTML = `#${totalBoxes}`;
    footer.className = "boxFooter";
    newBox.appendChild(footer);
    document.getElementById("boxes").appendChild(newBox);
    makeDraggable(newBox);
    listenForImagePaste(newBox);
    boxes.set(newBox.id, {
        box: newBox,
        lines: []
    });
    return newBox;
}

/**
 * Creates a box in the middle of whatever part of the canvas is on screen.
 * createNewBlock() alone always spawns at (0, 20), which is both hidden behind
 * the toolbar overlaying that corner and, once zoomed out, a long way from
 * wherever the user is actually looking.
 * @returns {HTMLElement} The newly created box.
 */
function createBlockInView() {
    const container = document.querySelector("#tree .container");
    const canvas = document.getElementById("zoom");
    const scale = (new DOMMatrix(canvas.style.transform)).a || 1;

    // transform-origin is the top-left corner, so a canvas coordinate paints at
    // coordinate x scale. Dividing inverts that to find the coordinate sitting
    // at the centre of the visible area.
    const centreX = (container.scrollLeft + container.clientWidth / 2) / scale;
    const centreY = (container.scrollTop + container.clientHeight / 2) / scale;

    // Offset by roughly half a box so it straddles the centre, and keep it
    // clear of the toolbar. The floors are divided by scale too, so they mean
    // the same number of on-screen pixels at every zoom level.
    const x = Math.max(centreX - 75, 20 / scale);
    const y = Math.max(centreY - 20, 60 / scale);

    return createNewBlock(x, y);
}

/**
 * Deletes a specified box and all the lines connected to it.
 * @param {HTMLElement} box - The box element to be deleted.
 */
function deleteBox(box) {
    const lines = getLinesAttached(box);
    lines.forEach(line => {
        deleteLine(line);
    });
    box.remove();
    boxes.delete(box.id);
}

// --------------------------------------------------------------------------
// Line Creation and Management
// --------------------------------------------------------------------------

/**
 * Creates a new SVG line element connecting two specified boxes.
 * @param {HTMLElement|string} box1 - The first box element or its ID.
 * @param {HTMLElement|string} box2 - The second box element or its ID.
 */
function newLine(box1, box2) {
    //console.log(box1);
    if (!box1?.id) box1 = document.getElementById(box1);
    if (!box2?.id) box2 = document.getElementById(box2);
    const newLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    let id = "";
    if (+box1.id < +box2.id) {
        id = box1.id + "_" + box2.id;
    } else {
        id = box2.id + "_" + box1.id;
    }
    newLine.setAttribute('id', id);

    // Add box ids to line lists
    
    const box1Lines = boxes.get(box1.id).lines;
    if (!box1Lines.includes(box2.id)) box1Lines.push(box2.id);

    const box2Lines = boxes.get(box2.id).lines;
    if (!box2Lines.includes(box1.id)) box2Lines.push(box1.id);


    newLine.setAttribute('class', 'line');
    [x1, y1] = getBoxCoords(box1);
    [x2, y2] = getBoxCoords(box2);
    updateLinePosition(newLine, x1, y1, x2, y2);
    document.getElementById("lines").appendChild(newLine);
}

/**
 * Updates the position of all lines connected to a given box.
 * @param {HTMLElement} box - The box whose connected lines need to be updated.
 */
function updateLinesPosition(box) {
    const lines = document.querySelectorAll(".line");
    lines.forEach((line) => {
        let boxes = (line.id).split('_');
        if (box.id == boxes[0]) {
            [x1, y1] = getBoxCoords(box);
            updateLinePosition(line, x1, y1, false, false);
        } else if (box.id == boxes[1]) {
            [x2, y2] = getBoxCoords(box);
            updateLinePosition(line, false, false, x2, y2);
        }
    });
}

/**
 * Deletes a specified SVG line element and updates the 'boxes' Map accordingly.
 * @param {SVGLineElement} line - The SVG line element to be deleted.
 */
function deleteLine(line) {
    const [a, b] = line.id.split("_");
    [...boxes.values()].forEach(item => {
        item.lines = item.lines.filter(id => id!==a && id!==b)
    });
    line.remove();
}

/**
 * Retrieves all SVG line elements that are connected to a given box.
 * @param {HTMLElement} box - The box element to find connected lines for.
 * @returns {SVGLineElement[]} An array of SVG line elements connected to the box.
 */
function getLinesAttached(box) {
    let lines = document.querySelectorAll(".line");
    lines = Array(...lines).filter(line => {
        const [a, b] = line.id.split("_");
        if (a == box.id) {
            return true;
        } else if (b == box.id) {
            return true;
        }
        return false;
    });
    return lines;
}

/**
 * Gets the center coordinates (x, y) of a given HTML element.
 * @param {HTMLElement} box - The HTML element.
 * @returns {number[]} An array containing the x and y coordinates of the center of the box.
 */
function getBoxCoords(box) {
    const x = box.offsetLeft + box.offsetWidth / 2;
    const y = box.offsetTop + box.offsetHeight / 2;
    return [x, y];
}

/**
 * Updates the coordinates of an SVG line element.
 * @param {SVGLineElement} line - The SVG line element to update.
 * @param {number|boolean} [x1=false] - The new x1 coordinate, or false to not update.
 * @param {number|boolean} [y1=false] - The new y1 coordinate, or false to not update.
 * @param {number|boolean} [x2=false] - The new x2 coordinate, or false to not update.
 * @param {number|boolean} [y2=false] - The new y2 coordinate, or false to not update.
 */
function updateLinePosition(line, x1 = false, y1 = false, x2 = false, y2 = false) {
    if (x1) line.setAttribute("x1", x1);
    if (y1) line.setAttribute("y1", y1);
    if (x2) line.setAttribute("x2", x2);
    if (y2) line.setAttribute("y2", y2);
}

// --------------------------------------------------------------------------
// Image Pasting Functionality
// --------------------------------------------------------------------------

/**
 * Attaches an event listener to a given HTML element to handle image pasting.
 * When an image is pasted, it creates an <img> tag and appends it to the element.
 * @param {HTMLElement} box - The HTML element to which the paste listener will be attached.
 */
function listenForImagePaste(box) {
    box.addEventListener('paste', function (event) {
        let items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf("image") === 0) {
                event.preventDefault();
                let blob = item.getAsFile();
                let reader = new FileReader();
                reader.onload = function (event) {
                    let img = document.createElement("img");
                    img.src = event.target.result;
                    img.style.maxWidth = "100%";
                    box.appendChild(img);
                };
                reader.readAsDataURL(blob);
            }
        }
    });
}

// --------------------------------------------------------------------------
// Custom Text Context Menu and Highlighting
// --------------------------------------------------------------------------

/**
 * Checks if the current text selection is within a <span> element inside the "#text" container.
 * @param {Selection} selection - The current window text selection.
 * @returns {HTMLElement|boolean} The <span> element if selected text is within one, otherwise false.
 */
function isSpan(selection) {
    const range = selection.getRangeAt(0);
    let commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType === Node.TEXT_NODE) {
        commonAncestor = commonAncestor.parentElement;
    }
    if (!commonAncestor.closest('#text')) return false;
    if (commonAncestor.tagName === "SPAN") {
        return commonAncestor;
    }
    return false;
}

/**
 * Highlights the selected text by wrapping it in a span with the given background color.
 * If the selected text is already within a span, it updates the background color.
 * @param {string} color - The background color to apply to the highlighted text.
 * @param {HTMLElement|boolean} isSpan - The existing span element if the text is already highlighted, or false otherwise.
 * @returns {HTMLElement|boolean} The created or updated span element, or false if an error occurred.
 */
function highlightText(color, isSpan) {
    if (isSpan) {
        isSpan.style.backgroundColor = color;
        addGlow(isSpan, color);
    } else {
        const span = document.createElement("span");
        span.className = "highlight";
        span.style.backgroundColor = color;
        try {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            range.surroundContents(span);
            addGlow(span, color);
            return span;
        } catch (error) {
            console.warn("Erros Highlighting", error);
            return false;
        }
    }
}

/**
 * Removes a span element, effectively removing the highlight or link.
 * @param {HTMLElement} span - The span element to remove.
 */
function removeSpan(span) {
    const content = span.textContent;
    const textNode = document.createTextNode(content);
    span.replaceWith(textNode);
}

/**
 * Builds a readable label for a box from the text the user typed into it.
 * @param {HTMLElement} box - The box element to label.
 * @returns {string} The box's own text, or "Box# <id>" if it is empty.
 */
function boxLabel(box) {
    // Clone so the hidden "#2" footer can be dropped without touching the real
    // box. A textContent string replace would also strip a legitimate "#2" the
    // user had typed themselves.
    const clone = box.cloneNode(true);
    clone.querySelectorAll(".boxFooter").forEach(el => el.remove());

    const text = clone.textContent.trim().replace(/\s+/g, " ");
    if (!text) return "Box# " + box.id;
    return text.length > 30 ? text.slice(0, 30) + "..." : text;
}

/**
 * Updates the options in the link dropdown within the text toolbar.
 * @param {string} link - The ID of the box that should be marked as selected, if any.
 */
function updateBoxList(link) {
    const dropdown = document.getElementById("t_dropdown");
    const boxes = document.getElementById("boxes").children;
    dropdown.innerHTML = `<option value='none' ${link ? "" : "selected"}>--None--</option>`;
    Array(...boxes).forEach(box => {
        const option = document.createElement("option");
        option.value = box.id;
        option.selected = link == box.id ? "selected" : "";
        option.textContent = boxLabel(box);
        // Keeps the id reachable on hover, since two boxes can share a label.
        option.title = "Box# " + box.id;
        dropdown.appendChild(option);

        // Add glow effect on mouseenter/mouseleave for dropdown options
        option.addEventListener("mouseenter", e => glowBox(e));
        option.addEventListener("mouseleave", e => noGlowBox(e));

        function glowBox(e) {
            const id = e.target.value;
            document.documentElement.style.setProperty("--glow-color", "black");
            document.getElementById(id)?.classList.add("glow");
        }

        function noGlowBox(e) {
            const id = e.target.value;
            document.getElementById(id)?.classList.remove("glow");
        }
    });
}

/**
 * Extracts the box ID from a string that represents setting the window location hash.
 * @param {string} e - The string containing the window.location.href assignment.
 * @returns {string|boolean} The extracted box ID, or false if no ID is found.
 */
function getLink(e) {
    let match = e.match(/window\.location\.href\s*=\s*['"]#(.*?)['"]/);
    if (match) {
        match = match[1];
        console.log("ID:", match);
        return match;
    }
    return false;
}

/**
 * Event listener for the "text" element's context menu (right-click).
 * Prevents the default context menu and displays a custom text toolbar.
 */
function initTextContextMenu() {
document.getElementById("text").addEventListener("contextmenu", (e) => {
    e.preventDefault();

    // To remove all event listeners on the toolbar (for updating them)
    const loadToolbar = document.getElementById("textToolbar");
    loadToolbar.parentNode.replaceChild(loadToolbar.cloneNode(true), loadToolbar);

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let span = isSpan(selection);

    // Event listener for the text highlight color picker
    document.getElementById("t_boxColor").addEventListener("change", e => {
        const color = colorToHex(e.target.value);
        highlightText(color, span);
    });

    // Event listener for the link dropdown
    document.getElementById("t_dropdown").addEventListener("change", e => {
        if (!span) {
            span = highlightText("#FFFF00", false);
            document.getElementById("t_boxColor").value = "#FFFF00";
        }
        span.dataset.boxId = e.target.value;
        span.setAttribute("onclick", `window.location.href='#${e.target.value}'`);
    });

    // Event listener for removing the text highlight/link
    document.getElementById("t_remove").addEventListener("click", e => {
        if (span) {
            removeSpan(span);
            removetoolbar();
        }
    });

    // Update the color picker value and visibility of the remove button
    document.getElementById("t_boxColor").value = span ? colorToHex(span.style.backgroundColor) : "#ffffff";
    document.getElementById("t_remove").style.display = span ? "inline" : "none";
    updateBoxList(span.dataset?.boxId);

    const toolbar = document.getElementById("textToolbar");
    toolbar.style.left = e.clientX + 'px';
    toolbar.style.top = e.clientY + 'px';

    toolbar.style.display = 'block'; // Show the toolbar

    // Function to hide the text toolbar and clear selection
    function removetoolbar() {
        selection?.removeAllRanges();
        toolbar.style.display = 'none';
    }
});
}

// --------------------------------------------------------------------------
// Toolbar Visibility Management (General)
// --------------------------------------------------------------------------

/**
 * Event listener for clicks anywhere on the document to hide the toolbars.
 */
document.addEventListener('click', function (event) {
    const toolbar = document.getElementById('toolbar');
    const textToolbar = document.getElementById("textToolbar");

    // Hide the box toolbar if the click is outside the "boxes" container
    if (!event.target.closest('#boxes')) {
        toolbar.style.display = 'none';
    }

    // Hide the text toolbar if the click is outside the "textToolbar"
    if (!event.target.closest("#textToolbar")) {
        textToolbar.style.display = 'none';
    }
});

// --------------------------------------------------------------------------
// Box Toolbar Event Listeners
// --------------------------------------------------------------------------

/**
 * Attaches event listeners to the buttons within the box toolbar.
 */
function boxToolbarListeners() {
    // Event listener for the box color picker
    document.getElementById("boxColor").addEventListener("change", (e) => {
        const box = document.getElementById(e.target.parentNode.dataset.boxId);
        box.style.backgroundColor = colorToHex(e.target.value);
    });

    // Event listener for the "addBox" button
    document.getElementById("addBox").addEventListener("click", e => {
        const box = document.getElementById(e.target.parentNode.dataset.boxId);
        addBlock(box);
    });

    // Event listener for the "deleteBox" button
    document.getElementById("deleteBox").addEventListener("click", e => {
        const box = document.getElementById(e.target.parentNode.dataset.boxId);
        deleteBox(box);
    });
}

// --------------------------------------------------------------------------
// Text Highlighting and Link Styling
// --------------------------------------------------------------------------

/**
 * Adds mouseenter and mouseleave event listeners to a span element to apply a glow effect
 * to the associated box.
 * @param {HTMLElement} span - The span element that triggers the glow.
 * @param {string} color - The color of the glow effect.
 */
function addGlow(span, color) {
    span.addEventListener("mouseenter", e => glowBox(e));
    span.addEventListener("mouseleave", e => noGlowBox(e));

    function glowBox(e) {
        const id = e.target.dataset?.boxId;
        document.documentElement.style.setProperty("--glow-color", color);
        document.getElementById(id)?.classList.add("glow");
    }

    function noGlowBox(e) {
        const id = e.target.dataset?.boxId;
        document.getElementById(id)?.classList.remove("glow");
    }
}

// --------------------------------------------------------------------------
// Dropdown Menu for Connecting Boxes
// --------------------------------------------------------------------------

// Toggle the dropdown visibility when the button is hovered over
function initLinkDropdown() {
document.querySelector(".dropdown-button").addEventListener('mouseover', e => {
    const container = document.querySelector(".dropdown-content");
    container.innerHTML = "";
    const boxId = container.parentNode.parentNode.dataset.boxId;
    const allIds = [...boxes.keys()];
    const conectedIds = [...boxes.get(boxId).lines];


    conectedIds.sort((a, b) => a - b);

    allIds.forEach(l => {
        let element = document.createElement("div");
        element.className = "dropdown-item";

        // on click add/remove line
        element.addEventListener("click", (e) => {
            const a = e.target.dataset.a;
            const b = e.target.dataset.b;
            const c = e.target.dataset.c;

            if (+c) {
                deleteLine(document.getElementById(a + "_" + b));
            } else {
                newLine(a, b);
            }
        });

        if (l == boxId) return;
        element.textContent = boxLabel(boxes.get(l).box);
        // Keeps the id reachable on hover, since two boxes can share a label.
        element.title = "Box# " + l;

        if (+boxId < +l) {
            // Add lines connecting box ids
            element.dataset.a = boxId;
            element.dataset.b = l;
        } else {
            // Add lines connecting box ids
            element.dataset.a = l;
            element.dataset.b = boxId;
        }

        // set connection status
        element.dataset.c = 0;

        conectedIds.forEach(e => {
            if (l == e) {
                element.textContent += " ✅";
                conectedIds.shift();
                // set connection status
                element.dataset.c = 1;
            }
        });
        container.appendChild(element);
    });
    e.target.parentNode.classList.add("show");
});

document.querySelector("#link").addEventListener('mouseleave', e => {
    e.target.classList.remove("show");
});
}

// --------------------------------------------------------------------------
// Color Conversion Functions
// --------------------------------------------------------------------------

/**
 * Converts a color string (hex, rgb, or hsl) to its hexadecimal representation.
 * Returns '#f1f1f1' for invalid color formats.
 * @param {string} color - The color string to convert.
 * @returns {string} The hexadecimal representation of the color.
 */
function colorToHex(color) {
    if (color.startsWith("#")) {
        return color;
    }
    if (color.startsWith("rgb")) {
        let rgb = color.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
        if (rgb) {
            return rgbToHex(parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3]));
        }
    }
    if (color.startsWith("hsl")) {
        let hsl = color.match(/hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)/);
        if (hsl) {
            return hslToHex(parseInt(hsl[1]), parseInt(hsl[2]), parseInt(hsl[3]));
        }
    }
    console.warn("Invalid Color ", color);
    return "#f1f1f1";
}

/**
 * Converts RGB color values to a hexadecimal color string.
 * @param {number} r - The red color value (0-255).
 * @param {number} g - The green color value (0-255).
 * @param {number} b - The blue color value (0-255).
 * @returns {string} The hexadecimal representation of the RGB color.
 */
function rgbToHex(r, g, b) {
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Converts HSL color values to a hexadecimal color string.
 * @param {number} h - The hue value (0-360).
 * @param {number} s - The saturation value (0-100).
 * @param {number} l - The lightness value (0-100).
 * @returns {string} The hexadecimal representation of the HSL color.
 */
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = l - c / 2;
    let r, g, b;
    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
}

// --------------------------------------------------------------------------
// Canvas Persistence
// --------------------------------------------------------------------------

/**
 * Captures the current canvas as a plain object suitable for JSON storage.
 * @returns {{boxes: object[], lines: string[][]}} The serialized canvas.
 */
function serializeCanvas() {
    const result = { boxes: [], lines: [] };

    boxes.forEach((entry, id) => {
        const box = entry.box;
        result.boxes.push({
            id: id,
            x: box.offsetLeft,
            y: box.offsetTop,
            color: colorToHex(box.style.backgroundColor || "#f1f1f1"),
            content: box.innerHTML,
        });
    });

    document.querySelectorAll(".line").forEach(line => {
        result.lines.push(line.id.split("_"));
    });

    return result;
}

/**
 * Rebuilds the canvas from a previously serialized object, replacing whatever
 * is currently on it.
 * @param {{boxes: object[], lines: string[][]}} data - Output of serializeCanvas().
 */
function restoreCanvas(data) {
    if (!data || !data.boxes || !data.boxes.length) return;

    const container = document.getElementById("boxes");
    container.innerHTML = "";
    document.getElementById("lines").innerHTML = "";
    boxes = new Map();
    totalBoxes = 0;

    data.boxes.forEach(item => {
        const box = document.createElement("div");
        box.id = item.id;
        box.className = "box";
        box.style.position = "absolute";
        box.style.left = `${item.x}px`;
        box.style.top = `${item.y}px`;
        box.style.backgroundColor = item.color || "#f1f1f1";
        box.innerHTML = item.content;
        box.contentEditable = true;
        container.appendChild(box);

        makeDraggable(box);
        listenForImagePaste(box);
        boxes.set(box.id, {
            box: box,
            lines: []
        });

        // Keep the counter ahead of restored ids so new boxes don't collide.
        if (+item.id > totalBoxes) totalBoxes = +item.id;
    });

    (data.lines || []).forEach(([a, b]) => {
        if (boxes.has(a) && boxes.has(b)) newLine(a, b);
    });
}

/**
 * Clears the canvas back to a single seed box, as it appears on first load.
 */
function resetCanvas() {
    const container = document.getElementById("boxes");
    container.innerHTML = "";
    document.getElementById("lines").innerHTML = "";
    boxes = new Map();
    totalBoxes = 1;

    const seed = document.createElement("div");
    seed.id = "1";
    seed.className = "box";
    seed.style.position = "absolute";
    seed.style.left = "100px";
    seed.style.top = "100px";
    seed.style.backgroundColor = "#f1f1f1";
    seed.textContent = "Seed";
    seed.contentEditable = true;
    container.appendChild(seed);

    makeDraggable(seed);
    listenForImagePaste(seed);
    boxes.set(seed.id, {
        box: seed,
        lines: []
    });
}