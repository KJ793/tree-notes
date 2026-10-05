import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import {
  ChartLine, Shapes, Circle, RectangleHorizontal, Square, Squircle, SquareDashed, Diamond,
  Hexagon, Octagon, Triangle, Trash2, Link2, Sparkles, ChevronDown, ChevronRight, X, Check,
  CircleAlert, LoaderCircle, Search, Plus, ArrowUp, Type, PaintBucket, ImagePlus,
  Image as ImageIcon, MoveUpRight, Minus, ArrowRight, CircleX, Maximize2, Minimize2, Settings, Info,
} from "lucide-react";
import SquareDottedIcon from "./icons/SquareDottedIcon";
import VeeIcon from "./icons/VeeIcon";
import VeeNodeIcon from "./icons/VeeNodeIcon";
import FontColorIcon from "./icons/FontColorIcon";
import cytoscape from "cytoscape";
import { semanticSearchGraph } from "../api/graphApi";
import TreeNotesColorPicker from "./TreeNotesColorPicker";

/* =========================================================
   AI PROCESSING / INTERPRETABILITY PREVIEW
   ========================================================= */

/*
  Hans can override these by sending title/description in the
  stream event. These are friendly fallbacks for the minimal
  { step, content } form discussed for the pipeline.
*/

const AI_PROCESSING_STAGE_FALLBACKS = {
  1: {
    title: "Source text",
    description: "Read the original raw notes supplied to graph generation.",
  },
  2: {
    title: "Extract semantic units",
    description: "Identify candidate entities, actions, conditions, and outcomes.",
  },
  3: {
    title: "Resolve pronouns",
    description: "Resolve pronouns and references back to the concepts they describe.",
  },
  4: {
    title: "Distribute shared terms",
    description: "Apply shared subjects and objects to the propositions that inherit them.",
  },
  5: {
    title: "Resolve conditions",
    description: "Associate conditional phrases with the propositions they govern.",
  },
  6: {
    title: "Resolve relationships",
    description: "Determine proposition relationships and higher-order causal links.",
  },
  7: {
    title: "Classify graph semantics",
    description: "Assign qualifiers, classifications, and edge roles used by TreeNotes.",
  },
  8: {
    title: "Validate graph elements",
    description: "Check the extracted semantic structure before graph elements are emitted.",
  },
};
const AI_PROCESSING_MOCK_STEPS = [
  {
    step: 1,
    title: "Source text",
    description: AI_PROCESSING_STAGE_FALLBACKS[1].description,
    content: "When the sun rises, lizards bask on rocks, allowing lizards to gain energy.",
  },
  {
    step: 2,
    title: "Extract semantic units",
    description: AI_PROCESSING_STAGE_FALLBACKS[2].description,
    content: "Entities: Lizards, Rocks, Energy\nCondition: When the sun rises\nActions: bask on, gain\nHigher-order relation: allowing",
  },
  {
    step: 3,
    title: "Resolve pronouns",
    description: AI_PROCESSING_STAGE_FALLBACKS[3].description,
    content: "No unresolved pronouns found. Both propositions retain the subject ‘Lizards’.",
  },
  {
    step: 4,
    title: "Distribute shared terms",
    description: AI_PROCESSING_STAGE_FALLBACKS[4].description,
    content: "Shared subject ‘Lizards’ applied to both: ‘bask on Rocks’ and ‘gain Energy’.",
  },
  {
    step: 5,
    title: "Resolve conditions",
    description: AI_PROCESSING_STAGE_FALLBACKS[5].description,
    content: "‘When the sun rises’ governs both extracted propositions and is owned by ‘Lizards’.",
  },
  {
    step: 6,
    title: "Resolve relationships",
    description: AI_PROCESSING_STAGE_FALLBACKS[6].description,
    content: "Proposition A: Lizards — basks on → Rocks\nProposition B: Lizards — gains → Energy\nA allows B.",
  },
  {
    step: 7,
    title: "Classify graph semantics",
    description: AI_PROCESSING_STAGE_FALLBACKS[7].description,
    content: "Condition node: conditional, owner=Lizards\nProposition edges: standard\nALLOWS edge: reification\nNo qualifier or negative/prerequisite classification detected.",
  },
];
const SHOW_AI_PROCESSING_MOCK = true;

/* =========================================================
   GRAPH THEME HELPERS
   ========================================================= */

/*
  Cytoscape does not automatically resolve CSS variables
  in the same way normal DOM CSS does.

  Read the active TreeNotes theme values from <html>
  and give Cytoscape the resolved colour.
*/

function getThemeColour(variableName, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

function getGraphThemeColours() {
  return {
    nodeBackground: getThemeColour("--graph-node-bg", "#6366F1"),
    nodeBorder: getThemeColour("--graph-node-border", "#818CF8"),
    nodeText: getThemeColour("--graph-node-text", "#ffffff"),
    selectedBorder: getThemeColour("--graph-selected-border", "#41d19f"),
    selectedGlow: getThemeColour("--graph-selected-glow", "rgba(65, 209, 159, 0.28)"),
    edge: getThemeColour("--graph-edge", "#475569"),

    /*
      Use graph-link palette colour 2 for
      "first node selected while linking".
    */

    linkSource: getThemeColour("--graph-link-2", "#f2c94c"),
  };
}
const NODE_SHAPES = [
  {
    value: "ellipse",
    label: "Circle",
    Icon: Circle,
  },
  {
    value: "rectangle",
    label: "Rectangle",
    Icon: RectangleHorizontal,
  },
  {
    value: "round-rectangle",
    label: "Rounded",
    Icon: Squircle,
  },
  {
    value: "diamond",
    label: "Diamond",
    Icon: Diamond,
  },
  {
    value: "triangle",
    label: "Triangle",
    Icon: Triangle,
  },
  {
    value: "vee",
    label: "Vee",
    Icon: VeeNodeIcon,
  },
  {
    value: "hexagon",
    label: "Hexagon",
    Icon: Hexagon,
    rotation: 30,
  },
  {
    value: "octagon",
    label: "Octagon",
    Icon: Octagon,
  },
];
const NODE_BORDER_STYLES = [
  {
    value: "solid",
    label: "Solid border",
    Icon: Square,
  },
  {
    value: "dashed",
    label: "Dashed border",
    Icon: SquareDashed,
  },
  {
    value: "dotted",
    label: "Dotted border",
    Icon: SquareDottedIcon,
  },
];
const EDGE_STYLES = [
  {
    value: "solid",
    label: "Solid",
  },
  {
    value: "dashed",
    label: "Dashed",
  },
  {
    value: "dotted",
    label: "Dotted",
  },
];
const ARROW_SHAPES = [
  {
    value: "triangle",
    label: "Triangle",
    Icon: Triangle,
    rotation: 90,
  },
  {
    value: "vee",
    label: "Vee",
    Icon: VeeIcon,
    rotation: 135,
  },
  {
    value: "chevron",
    label: "Chevron",
    Icon: ChevronRight,
  },
  {
    value: "tee",
    label: "Tee",
    Icon: Minus,
    rotation: 90,
  },
  {
    value: "circle",
    label: "Circle",
    Icon: Circle,
  },
  {
    value: "square",
    label: "Square",
    Icon: Square,
  },
  {
    value: "diamond",
    label: "Diamond",
    Icon: Diamond,
  },
  {
    value: "none",
    label: "No arrow",
    Icon: CircleX,
  },
];

/* =========================================================
   SEMANTIC NODE / EDGE TYPES
   ========================================================= */

const NODE_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "conditional", label: "Conditional" },
];
const EDGE_ROLES = [
  { value: "auto", label: "Auto-detect" },
  { value: "standard", label: "Standard" },
  { value: "reification", label: "Reification" },
];

/*
  Match the muted / pastel preset row in TreeNotesColorPicker.
  Start at the warm orange currently used by the first condition, then
  walk around the rest of the row before returning to the muted coral.
*/

const CONDITIONAL_NODE_MUTED_PALETTE = [
  "#FDBA74",
  "#FDE68A",
  "#BEF264",
  "#86EFAC",
  "#5EEAD4",
  "#7DD3FC",
  "#C4B5FD",
  "#FCA5A5",
];
const CONDITIONAL_NODE_DEFAULT_COLOR = CONDITIONAL_NODE_MUTED_PALETTE[0];
const CONDITIONAL_NODE_DEFAULT_TEXT_COLOR = "#171717";

function getThemeContrastColour() {
  const theme = String(document.documentElement.getAttribute("data-theme") || "").toLowerCase();
  if (theme.includes("light")) {
    return "#111111";
  }
  if (theme.includes("dark")) {
    return "#ffffff";
  }
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "#111111" : "#ffffff";
}

function getConditionalDefaultBorderColour() {
  return getThemeContrastColour();
}

function getReadableTextColour(background) {
  const value = String(background || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return "#ffffff";
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * red +
    0.7152 * green +
    0.0722 * blue) /
    255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function normaliseNodeType(value, conditionOwnerId = "") {
  if (conditionOwnerId) {
    return "conditional";
  }
  return String(value || "standard").toLowerCase() === "conditional" ? "conditional" : "standard";
}

function normaliseEdgeRole(value, reificationFlag = false) {
  if (reificationFlag) {
    return "reification";
  }
  const cleanValue = String(value || "auto").toLowerCase();
  return ["auto", "standard", "reification"].includes(cleanValue) ? cleanValue : "auto";
}

function normaliseEdgeClassification(value) {
  const cleanValue = String(value || "")
    .trim()
    .toLowerCase();
  if (!cleanValue || ["normal", "standard", "none"].includes(cleanValue)) {
    return "normal";
  }
  if (["negative", "negation", "negated"].includes(cleanValue)) {
    return "negative";
  }
  if ([
    "prerequisite",
    "pre-requisite",
    "prereq",
    "requirement",
  ].includes(cleanValue)) {
    return "prerequisite";
  }
  return cleanValue;
}

/*
  Automatic clock-like slots for conditions around their semantic owner.
  The first few favour the right/top/bottom side of the owner, while larger
  groups gradually use the remaining space instead of becoming one tall
  column. Users can drag any conditional afterwards to override its offset.
*/

const CONDITION_AUTO_PLACEMENT_SLOTS = [
  { x: 1, y: 0 },
  { x: 0.72, y: -0.72 },
  { x: 0.72, y: 0.72 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -0.72, y: -0.72 },
  { x: -0.72, y: 0.72 },
  { x: -1, y: 0 },
];

function normaliseIncomingNodeData(nodeData = {}) {
  const conditionOwnerId = String(nodeData.conditionOwnerId ?? nodeData.parentNodeId ?? "").trim();
  const nodeType = normaliseNodeType(nodeData.nodeType ?? (nodeData.isConditional === true ? "conditional"
      : "standard"), conditionOwnerId);
  return {
    ...nodeData,
    nodeType,
    ...(conditionOwnerId ? { conditionOwnerId } : {}),
  };
}

function normaliseIncomingEdgeData(edgeData = {}) {
  const reificationFlag = edgeData.isReification === true || edgeData.reification === true;
  const normalisedClassification = normaliseEdgeClassification(edgeData.classification);
  const conditionId = String(edgeData.conditionId ?? "").trim();
  const fromEdgeId = String(edgeData.fromEdgeId ?? "").trim();
  const toEdgeId = String(edgeData.toEdgeId ?? "").trim();
  const normalised = {
    ...edgeData,
    relationship: String(edgeData.relationship ?? edgeData.label ?? "").trim(),
    qualifier: String(edgeData.qualifier ?? "").trim(),

    /*
      Store only the final TreeNotes vocabulary in graph data.
      Normal is represented by an empty string to match manual edges.
    */

    classification: normalisedClassification === "normal" ? "" : normalisedClassification,
    edgeRole: normaliseEdgeRole(edgeData.edgeRole, reificationFlag),
  };
  if (conditionId) {
    normalised.conditionId = conditionId;
  } else {
    delete normalised.conditionId;
  }
  if (fromEdgeId) {
    normalised.fromEdgeId = fromEdgeId;
  } else {
    delete normalised.fromEdgeId;
  }
  if (toEdgeId) {
    normalised.toEdgeId = toEdgeId;
  } else {
    delete normalised.toEdgeId;
  }
  return normalised;
}

/*
  Hans may either send a reification relation as a standalone edge
  or attach it as data.relation on another streamed edge.  Expand the
  nested form here so Cytoscape still receives ordinary node-to-node edges.
*/

function expandIncomingEdgeData(edgeData = {}) {
  const relation = edgeData?.relation && typeof edgeData.relation === "object" ? edgeData.relation : null;
  const baseEdge = normaliseIncomingEdgeData({
    ...edgeData,
  });
  delete baseEdge.relation;
  const expanded = [baseEdge];
  if (relation && relation.source != null && relation.target != null) {
    expanded.push(normaliseIncomingEdgeData({
      ...relation,
      id: relation.id || `${baseEdge.id || "relation"}-reification`,
      relationship: relation.relationship ?? relation.label ?? "",
      edgeRole: relation.edgeRole || "reification",
      conditionId: relation.conditionId ?? baseEdge.conditionId ?? "",
    }));
  }
  return expanded;
}

/* =========================================================
   NODE AUTO-SIZING
   ========================================================= */

const NODE_MIN_WIDTH = 110;
const NODE_MIN_HEIGHT = 52;
const NODE_FONT_SIZE = 15;
const NODE_LINE_HEIGHT = 19;

/*
  Maximum width of the actual label text before
  Cytoscape wraps it onto another line.
*/

const NODE_TEXT_WRAP_WIDTH = 150;

/* =========================================================
   NODE IMAGE FILL
   ========================================================= */

/*
  Large clipboard screenshots and phone photos should never be
  stored directly inside graph_json. We accept a reasonably large
  source file, then resize/compress it before attaching it to a node.
*/

const NODE_IMAGE_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const NODE_IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/*
  This is the compressed binary size before base64 expansion.
  Keeping it below ~450 KB leaves much more breathing room in the
  note PATCH request than storing the original clipboard image.
*/

const NODE_IMAGE_MAX_STORED_BYTES = 450 * 1024;
const NODE_IMAGE_MAX_SOURCE_DIMENSION = 1024;
const NODE_IMAGE_DEFAULT_POSITION_X = 50;
const NODE_IMAGE_DEFAULT_POSITION_Y = 50;
const NODE_IMAGE_PREVIEW_SCALE = 0.72;

/*
  Rectangle-style image nodes follow the picture's aspect ratio.
  Geometric nodes keep a stable square bounding box so the chosen
  Cytoscape shape remains visually intentional.
*/

const NODE_IMAGE_SIZE_PRESETS = {
  small: {
    rectMaxWidth: 220,
    rectMaxHeight: 180,
    rectMinWidth: 100,
    rectMinHeight: 80,
    geometricSize: 165,
  },
  medium: {
    rectMaxWidth: 280,
    rectMaxHeight: 220,
    rectMinWidth: 120,
    rectMinHeight: 90,
    geometricSize: 200,
  },
  large: {
    rectMaxWidth: 340,
    rectMaxHeight: 270,
    rectMinWidth: 150,
    rectMinHeight: 110,
    geometricSize: 240,
  },
};
const NODE_IMAGE_DEFAULT_SIZE = "medium";
const NODE_IMAGE_LABEL_GAP = 20;

/*
  Shapes have very different amounts of usable
  internal space.

  Rectangles can use almost their entire body.
  Diamond / triangle / vee need substantially more
  outer size to contain the same text comfortably.
*/

const NODE_SHAPE_SIZE_FACTORS = {
  rectangle: {
    width: 1,
    height: 1,
  },
  "round-rectangle": {
    width: 1,
    height: 1,
  },
  ellipse: {
    width: 1.2,
    height: 1.15,
  },
  diamond: {
    width: 1.6,
    height: 1.6,
  },
  triangle: {
    width: 1.8,
    height: 1.9,
  },
  vee: {
    width: 1.9,
    height: 1.9,
  },
  hexagon: {
    width: 1.2,
    height: 1.1,
  },
  octagon: {
    width: 1.15,
    height: 1.1,
  },
};

function calculateNodeSize(label, shape = "round-rectangle") {
  const cleanLabel = String(label || "New Node").trim();

  /*
    Canvas lets us measure approximately the same
    text dimensions Cytoscape is rendering.
  */

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `500 ${NODE_FONT_SIZE}px Inter, system-ui, sans-serif`;
  const words = cleanLabel.split(/\s+/);
  const lines = [];
  let currentLine = "";

  /*
    Find the widest individual word.

    If one word is wider than our normal wrapping
    width, expand the node instead of cutting the word.
  */

  const longestWordWidth = Math.max(...words.map(word => context.measureText(word).width), 1);

  /*
    Normally wrap around 150px.

    A single long word is allowed to make the
    text area wider so it remains intact.
  */

  const effectiveWrapWidth = Math.max(NODE_TEXT_WRAP_WIDTH, longestWordWidth + 4);
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width >
      effectiveWrapWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  const widestLine = Math.max(...lines.map(line => context.measureText(line).width), 1);
  const textHeight = Math.max(lines.length, 1) *
    NODE_LINE_HEIGHT;

  /*
    Normal breathing room around the text.
  */

  const paddedWidth = widestLine + 34;
  const paddedHeight = textHeight + 22;
  const factors = NODE_SHAPE_SIZE_FACTORS[shape] ?? NODE_SHAPE_SIZE_FACTORS["round-rectangle"];
  const width = Math.max(NODE_MIN_WIDTH, Math.ceil(paddedWidth *
    factors.width));
  const height = Math.max(NODE_MIN_HEIGHT, Math.ceil(paddedHeight *
    factors.height));

  /*
    Cytoscape centres labels using the node's
    bounding box.

    A triangle's visual centre sits lower than
    its bounding-box centre, so move only triangle
    labels downward proportionally to their height.
  */

  const textMarginY = shape === "triangle" ? Math.round(height * 0.12) : 0;
  return {
    width,
    height,
    textMaxWidth: Math.ceil(effectiveWrapWidth),
    textMarginY,
  };
}

function clampImagePosition(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function getImagePositionPercent(value, fallback = 50) {
  const parsed = Number.parseFloat(String(value ?? "")
    .replace("%", ""));
  return Number.isFinite(parsed) ? clampImagePosition(parsed) : fallback;
}

function getNodeImagePreviewSize(imageWidth, imageHeight, shape, imageSize) {
  const { width, height, } = calculateImageNodeSize(imageWidth, imageHeight, shape, imageSize);
  return {
    width: Math.round(width *
      NODE_IMAGE_PREVIEW_SCALE),
    height: Math.round(height *
      NODE_IMAGE_PREVIEW_SCALE),
  };
}

function formatNodeImageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getClipboardImageFile(event) {
  const items = Array.from(event?.clipboardData?.items ?? []);
  const imageItem = items.find(item => item.kind === "file" && item.type?.startsWith("image/"));
  return imageItem?.getAsFile?.() ?? null;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("TreeNotes could not read the processed image."));
    reader.readAsDataURL(blob);
  });
}

function loadNodeImageSource(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("TreeNotes could not decode that image."));
    };
    image.src = objectUrl;
  });
}

function canvasToNodeImageBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob), "image/webp", quality);
  });
}
async function processNodeImageFile(file) {
  if (!file) {
    throw new Error("No image was provided.");
  }
  if (!NODE_IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Node images must be PNG, JPEG, or WebP.");
  }
  if (file.size >
    NODE_IMAGE_MAX_INPUT_BYTES) {
    throw new Error(`That image is ${formatNodeImageBytes(file.size)}. The maximum source size is ${formatNodeImageBytes(NODE_IMAGE_MAX_INPUT_BYTES)}.`);
  }
  const sourceImage = await loadNodeImageSource(file);
  const originalWidth = sourceImage.naturalWidth || sourceImage.width;
  const originalHeight = sourceImage.naturalHeight || sourceImage.height;
  if (!Number.isFinite(originalWidth) || !Number.isFinite(originalHeight) || originalWidth <= 0 ||
    originalHeight <= 0) {
    throw new Error("TreeNotes could not determine the image dimensions.");
  }
  const initialScale = Math.min(1, NODE_IMAGE_MAX_SOURCE_DIMENSION /
    Math.max(originalWidth, originalHeight));
  let targetWidth = Math.max(1, Math.round(originalWidth *
    initialScale));
  let targetHeight = Math.max(1, Math.round(originalHeight *
    initialScale));
  let bestBlob = null;
  let bestWidth = targetWidth;
  let bestHeight = targetHeight;
  const qualitySteps = [
    0.86,
    0.78,
    0.70,
    0.62,
    0.54,
  ];

  /*
    Try a few quality levels first. If a very detailed screenshot is
    still too large, reduce dimensions and repeat. At node scale this
    remains far sharper than storing a tiny thumbnail.
  */

  for (let resizePass = 0; resizePass < 8; resizePass += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser could not prepare the node image.");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);
    for (const quality of qualitySteps) {
      const blob = await canvasToNodeImageBlob(canvas, quality);
      if (!blob) {
        continue;
      }
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = targetWidth;
        bestHeight = targetHeight;
      }
      if (blob.size <= NODE_IMAGE_MAX_STORED_BYTES) {
        return {
          dataUrl: await readBlobAsDataUrl(blob),
          mime: blob.type || "image/webp",
          width: targetWidth,
          height: targetHeight,
          originalWidth,
          originalHeight,
          storedBytes: blob.size,
        };
      }
    }
    targetWidth = Math.max(1, Math.round(targetWidth * 0.82));
    targetHeight = Math.max(1, Math.round(targetHeight * 0.82));
  }
  if (bestBlob && bestBlob.size <= NODE_IMAGE_MAX_STORED_BYTES) {
    return {
      dataUrl: await readBlobAsDataUrl(bestBlob),
      mime: bestBlob.type || "image/webp",
      width: bestWidth,
      height: bestHeight,
      originalWidth,
      originalHeight,
      storedBytes: bestBlob.size,
    };
  }
  throw new Error(`TreeNotes could not compress that image below ${formatNodeImageBytes(NODE_IMAGE_MAX_STORED_BYTES)}. Try a smaller image.`);
}

function calculateImageNodeSize(imageWidth, imageHeight, shape, imageSize = NODE_IMAGE_DEFAULT_SIZE) {
  const safeWidth = Math.max(1, Number(imageWidth) || 1);
  const safeHeight = Math.max(1, Number(imageHeight) || 1);
  const isRectangleShape = shape === "rectangle" || shape === "round-rectangle";
  const preset = NODE_IMAGE_SIZE_PRESETS[imageSize] || NODE_IMAGE_SIZE_PRESETS[NODE_IMAGE_DEFAULT_SIZE];
  let width;
  let height;
  if (isRectangleShape) {
    const scale = Math.min(preset.rectMaxWidth /
      safeWidth, preset.rectMaxHeight /
    safeHeight);
    width = Math.max(preset.rectMinWidth, Math.round(safeWidth * scale));
    height = Math.max(preset.rectMinHeight, Math.round(safeHeight * scale));
  } else {
    width = preset.geometricSize;
    height = preset.geometricSize;
  }
  return {
    width,
    height,

    /*
      The node name stays visible below the picture. Keeping this
      width independent of very narrow portrait images prevents
      labels from wrapping into a tall column.
    */

    textMaxWidth: Math.max(150, Math.min(220, width)),

    /*
      Existing rename-overlay maths already honours nodeTextMarginY.
      Moving the normal centred label by half the image-node height
      plus a gap places it neatly underneath the picture.
    */

    textMarginY: Math.round(height / 2 +
      NODE_IMAGE_LABEL_GAP),
  };
}

function getNodeImagePreviewClipPath(shape) {
  switch (shape) {
    case "ellipse":
      return "circle(50% at 50% 50%)";
    case "diamond":
      return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    case "triangle":
      return "polygon(50% 0%, 100% 100%, 0% 100%)";
    case "vee":
      return "polygon(0% 0%, 50% 100%, 100% 0%, 72% 0%, 50% 58%, 28% 0%)";
    case "hexagon":
      return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
    case "octagon":
      return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
    default:
      return "none";
  }
}

function getThemeToken(tokenName, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(tokenName)
    .trim();
  return value || fallback;
}

function getGraphThemeTokens() {
  return {
    nodeBg: getThemeToken("--graph-node-bg", "#6366f1"),
    nodeBorder: getThemeToken("--graph-node-border", "#7772ff"),
    nodeText: getThemeToken("--graph-node-text", "#ffffff"),
    selectedBorder: getThemeToken("--graph-selected-border", "#4fd1a1"),
    selectedGlow: getThemeToken("--graph-selected-glow", "rgba(79, 209, 161, 0.28)"),
    selectedEdge: getThemeToken("--graph-selected-edge", "#4fd1a1"),
    linkSource: getThemeToken("--graph-link-source", "#f2c94c"),
    linkSourceGlow: getThemeToken("--graph-link-source-glow", "rgba(242, 201, 76, 0.28)"),
    edge: getThemeToken("--graph-edge", "#465873"),
    edgeArrow: getThemeToken("--graph-edge-arrow", "#7772ff"),
    edgeLabel: getThemeToken("--graph-edge-label", "#cbd5e1"),
  };
}

function GraphPropertyDropdown({ value, options = [], placeholder = "Select...", isOpen, onToggle, onSelect, searchable = false, searchValue = "", onSearchChange, searchPlaceholder = "Search graph nodes...", emptyMessage = "No matching options", ariaLabel, }) {
  const selectedOption = options.find(option => String(option.value ?? option.id) === String(value ?? "")) || null;
  const query = String(searchValue || "")
    .trim()
    .toLowerCase();
  const filteredOptions = searchable && query ? options.filter(option => String(option.label || "")
      .toLowerCase()
      .includes(query)) : options;
  return (<div className={`graph-property-dropdown ${searchable ? "graph-property-dropdown-searchable" : ""}`}>
    <button type="button" className={`graph-property-dropdown-trigger ${isOpen
      ? "graph-property-dropdown-trigger-open"
      : ""}`} onClick={onToggle} aria-haspopup="listbox" aria-expanded={isOpen} aria-label={ariaLabel}>
      <span className={`graph-property-dropdown-trigger-label ${selectedOption
        ? "" : "is-placeholder"}`}>
        {selectedOption?.label || placeholder}
      </span>

      <ChevronDown className={`graph-property-dropdown-chevron ${isOpen
        ? "graph-property-dropdown-chevron-open" : ""}`} size={15} strokeWidth={1.9} />
    </button>

    {isOpen && (<div className="graph-property-dropdown-menu" role="listbox">
      {searchable && (<div className="graph-property-dropdown-search-wrap">
        <Search size={13} strokeWidth={1.8} aria-hidden="true" />

        <input type="text" className="graph-property-dropdown-search" value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder={searchPlaceholder} autoFocus />
      </div>)}

      <div className="graph-property-dropdown-options">
        {filteredOptions.length > 0 ? (filteredOptions.map(option => {
          const optionValue = String(option.value ?? option.id ?? "");
          const selected = optionValue === String(value ?? "");
          return (<button type="button" key={optionValue} className={`graph-property-dropdown-option ${selected
            ? "graph-property-dropdown-option-selected"
            : ""}`} role="option" aria-selected={selected} onClick={() => onSelect(optionValue)}>
            <span>
              {option.label}
            </span>

            {selected && (<Check size={13} strokeWidth={2} />)}
          </button>);
        })) : (<div className="graph-property-dropdown-empty">
          {emptyMessage}
        </div>)}
      </div>
    </div>)}
  </div>);
}

function GraphSegmentedControl({ label, value, options = [], onChange, statusText, ariaLabel, }) {
  const selectedOption = options.find(option => String(option.value) === String(value)) || null;
  return (<div className="graph-image-control graph-property-segmented-control">
    <div className="graph-image-control-heading">
      <span>{label}</span>

      <span>
        {statusText || selectedOption?.label || ""}
      </span>
    </div>

    <div className="graph-image-segmented graph-property-segmented" role="group" aria-label={ariaLabel || label}>
      {options.map(option => (<button key={option.value} type="button" className={String(value) === String(option.value)
        ? "active" : ""} aria-pressed={String(value) === String(option.value)} onClick={() => onChange(option.value)}>
        {option.label}
      </button>))}
    </div>
  </div>);
}
const GraphPanel = forwardRef(function GraphPanel({ rawNotes, selectedText, addNodeTrigger, noteId, initialGraph, onNavigateLinkedText, isFocused = false, onToggleFocus, }, ref) {
  // << frontend dev >> //
  // Stores graph JSON returned from AI/backend/database //

  /*
    Always initialise GraphPanel with a valid graph object.

    If this note already has a graph_json value from the
    database, use it immediately. Otherwise keep a real empty
    graph so users can manually create nodes before pressing
    Generate Graph.
  */

  const [graphData, setGraphData] = useState(() => ({
    nodes: Array.isArray(initialGraph?.nodes) ? initialGraph.nodes : [],
    edges: Array.isArray(initialGraph?.edges) ? initialGraph.edges : [],
  }));
  // Handles graph loading state //
  const [loading, setLoading] = useState(false);
  // Handles graph generation errors //
  const [error, setError] = useState("");
  // =========================================================
  // AI PROCESSING / INTERPRETABILITY
  // =========================================================
  const [aiProcessingSteps, setAiProcessingSteps] = useState([]);
  const [aiProcessingModalOpen, setAiProcessingModalOpen] = useState(false);
  const [aiProcessingStatus, setAiProcessingStatus] = useState("");
  const [aiProcessingComplete, setAiProcessingComplete] = useState(false);
  const [aiProcessingMock, setAiProcessingMock] = useState(false);
  // References the HTML div where Cytoscape renders //
  const graphContainerRef = useRef(null);
  // References the Graph Editor container for focus management //
  const graphEditorRef = useRef(null);
  const [graphEditorActive, setGraphEditorActive] = useState(false);
  const loadedGraphNoteIdRef = useRef(null);
  // Stores the Cytoscape instance so other functions can access it //
  const cyRef = useRef(null);
  // =========================================================
  // AI GRAPH STREAMING
  // =========================================================
  // Holds streamed edges whose source/target nodes
  // have not arrived yet.
  const pendingStreamEdgesRef = useRef([]);
  // =========================================================
  // STREAM VISUAL POSITIONING
  // =========================================================
  // Temporary centre around which streamed nodes are placed.
  // The final COSE layout will replace these positions.
  const streamAnchorRef = useRef(null);
  // Counts nodes as they arrive so temporary positions
  // can be distributed around the graph canvas.
  const streamNodeIndexRef = useRef(0);
  // =========================================================
  // GRAPH STREAM REQUEST
  // =========================================================
  // Stores the currently active graph-generation request.
  // Allows us to cancel it if the note changes or the
  // component disappears.
  const graphStreamAbortRef = useRef(null);
  // =========================================================
  // EDGE LINKING
  // =========================================================
  // Stores selected edge states
  const [selectedEdge, setSelectedEdge] = useState(null);
  const linkModeRef = useRef(false);
  const firstNodeToLinkRef = useRef(null);
  // Stores currently selected node //
  const [selectedNode, setSelectedNode] = useState(null);
  // Stores an array of selected nodes/edges for multi-selection //
  const [selectionSummary, setSelectionSummary,] = useState({
    nodes: [],
    edges: [],
  });
  // To link nodes//
  const [linkMode, setLinkMode] = useState(false);
  // TO save first node clicked to link to second //
  const [firstNodeToLink, setFirstNodeToLink] = useState(null);
  // =========================================================
  // Node Image Preview Dragging Position
  // =========================================================
  const imagePreviewDragRef = useRef(null);
  const [imagePreviewDragging, setImagePreviewDragging] = useState(false);
  // =========================================================
  // Graph Toolbar
  // =========================================================
  // Hidden native colour picker
  // const nodeColorInputRef = useRef(null);
  // color picker for node text
  // const nodeTextColorInputRef = useRef(null);
  // Node border colour picker
  // const nodeBorderColorInputRef = useRef(null);
  // Node image fill controls
  const nodeImageInputRef = useRef(null);
  const nodeImageTargetIdRef = useRef(null);
  const [nodeImageModalOpen, setNodeImageModalOpen] = useState(false);
  // Node border style popover
  const nodeBorderStyleMenuRef = useRef(null);
  const [nodeBorderStyleMenuOpen, setNodeBorderStyleMenuOpen] = useState(false);
  // Shape selector popover
  const shapeMenuRef = useRef(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  // Custom graph colour pickers
  const nodeColorButtonRef = useRef(null);
  const nodeTextColorButtonRef = useRef(null);
  const nodeBorderColorButtonRef = useRef(null);
  const edgeColorButtonRef = useRef(null);
  const arrowColorButtonRef = useRef(null);
  const [graphColorPicker, setGraphColorPicker] = useState(null);

  function toggleGraphColorPicker(type) {
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(current => current === type ? null : type);
  }
  // Edge style selector popover
  const edgeStyleMenuRef = useRef(null);
  const [edgeStyleMenuOpen, setEdgeStyleMenuOpen] = useState(false);
  // Arrow shape selector popover
  const arrowShapeMenuRef = useRef(null);
  const [arrowShapeMenuOpen, setArrowShapeMenuOpen] = useState(false);
  // Generic temporary feedback for graph actions
  const [graphFeedback, setGraphFeedback] = useState(null);
  // Used to clear graph feedback automatically
  const graphFeedbackTimerRef = useRef(null);
  // =========================================================
  // Graph Semantic Search
  // =========================================================
  const [semanticSearchOpen, setSemanticSearchOpen] = useState(false);
  const [semanticSearchQuery, setSemanticSearchQuery] = useState("");
  const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
  const semanticSearchRef = useRef(null);
  // =========================================================
  // Node Rename
  // =========================================================
  const [editingNodeId, setEditingNodeId] = useState(null);
  const editingNodeIdRef = useRef(null);
  const [renameValue, setRenameValue] = useState("");
  const renameOriginalValueRef = useRef("");
  const [renamePosition, setRenamePosition] = useState({
    x: 0,
    y: 0,
  });
  const [renameZoom, setRenameZoom] = useState(1);
  // =========================================================
  // Edge Relationship Editing
  // =========================================================
  const [editingEdgeId, setEditingEdgeId] = useState(null);
  const editingEdgeIdRef = useRef(null);
  const [relationshipValue, setRelationshipValue] = useState("");
  const relationshipOriginalValueRef = useRef("");
  const [relationshipPosition, setRelationshipPosition] = useState({
    x: 0,
    y: 0,
  });
  const [relationshipZoom, setRelationshipZoom] = useState(1);
  // =========================================================
  // NODE / EDGE SEMANTIC PROPERTIES
  // =========================================================
  const [nodePropertiesModalOpen, setNodePropertiesModalOpen] = useState(false);
  const [nodePropertiesDraft, setNodePropertiesDraft] = useState({
    nodeId: "",
    nodeType: "standard",
    conditionOwnerId: "",
  });
  const [edgePropertiesModalOpen, setEdgePropertiesModalOpen] = useState(false);
  const [edgePropertiesDraft, setEdgePropertiesDraft] = useState({
    edgeId: "",
    relationship: "",
    qualifier: "",
    classification: "",
    edgeRole: "auto",
    conditionId: "",
  });
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(null);
  const [nodeOwnerSearch, setNodeOwnerSearch] = useState("");
  const [edgeConditionSearch, setEdgeConditionSearch] = useState("");
  // =========================================================
  // Node Auto-Sizing / Edge Label Refresh
  // =========================================================
  function resizeNodeToLabel(node) {
    if (!node || node.empty()) {
      return;
    }
    const label = node.data("label") || "New Node";
    const shape = node.data("shape") || "round-rectangle";
    const imageSrc = node.data("imageSrc");

    /*
      Image-filled nodes are sized from the picture rather than the
      label. Rectangle variants preserve image aspect ratio, while
      geometric shapes keep a stable body and crop with cover.
    */

    if (imageSrc) {
      const { width, height, textMaxWidth, textMarginY, } = calculateImageNodeSize(node.data("imageWidth"), node.data("imageHeight"), shape, node.data("imageSize") ||
        NODE_IMAGE_DEFAULT_SIZE);
      node.data({
        nodeWidth: width,
        nodeHeight: height,
        nodeTextMaxWidth: textMaxWidth,
        nodeTextMarginY: textMarginY,
      });
      refreshConnectedEdgeLabels(node);
      return;
    }
    const { width, height, textMaxWidth, textMarginY, } = calculateNodeSize(label, shape);

    /*
      Keep these as node data so the Cytoscape
      stylesheet can consume them automatically.
    */

    node.data({
      nodeWidth: width,
      nodeHeight: height,
      nodeTextMaxWidth: textMaxWidth,
      nodeTextMarginY: textMarginY,
    });
    refreshConnectedEdgeLabels(node);
  }

  function syncImageNodePresentation(node) {
    if (!node || node.empty()) {
      return;
    }
    const shouldHideLabel = Boolean(node.data("imageSrc")) && node.data("showImageLabel") === false;
    if (shouldHideLabel) {
      node.addClass("image-label-hidden");
    } else {
      node.removeClass("image-label-hidden");
    }
  }

  function refreshConnectedEdgeLabels(node) {
    if (!node || node.empty()) {
      return;
    }
    const cy = node.cy();
    const connectedEdges = node.connectedEdges()
      .filter(edge => String(edge.data("relationship") || "").trim());
    if (connectedEdges.length === 0) {
      return;
    }

    /*
      First allow Cytoscape to finish applying
      the node's new width / height.
    */

    requestAnimationFrame(() => {

      /*
        Then give the renderer one more frame to
        recalculate the new edge endpoints.
      */

      requestAnimationFrame(() => {
        connectedEdges.forEach(edge => {
          const displayLabel = edge.data("displayLabel") || edge.data("relationship") || "";

          /*
            Force Cytoscape to rebuild the label's
            rendered bounding box.

            The zero-width character changes the
            underlying label value without creating
            any visible change on screen.
          */

          edge.style("label", `${displayLabel}\u200B`);
        });

        /*
          On the following frame, remove the temporary
          style override so the edge returns to using:

            label: data(displayLabel)

          from the normal Cytoscape stylesheet.
        */

        requestAnimationFrame(() => {
          connectedEdges.forEach(edge => {
            edge.removeStyle("label");
            if (edge.id() !== editingEdgeIdRef.current) {
              edge.style("text-opacity", 1);
            }
          });
          cy.style()
            .update();
        });
      });
    });
  }

  /*
    Keep GraphPanel synced with the graph_json belonging to the
    currently selected note.

    Important: an unsaved/empty graph remains { nodes: [], edges: [] }
    rather than null. That keeps Cytoscape alive so manual graph
    creation still works before Generate Graph is used.
  */

  useEffect(() => {

    /*
      A successful Save replaces the note object and therefore
      gives us a new initialGraph reference.

      Do NOT reload Cytoscape just because the same note was
      saved. The live Cytoscape graph is already authoritative.
    */

    if (loadedGraphNoteIdRef.current === noteId) {
      return;
    }
    loadedGraphNoteIdRef.current = noteId;
    setGraphData({
      nodes: Array.isArray(initialGraph?.nodes) ? initialGraph.nodes : [],
      edges: Array.isArray(initialGraph?.edges) ? initialGraph.edges : [],
    });
    // Clear UI state that belonged to the previously open note.
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectionSummary({
      nodes: [],
      edges: [],
    });
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setGraphFeedback(null);
    setNodeImageModalOpen(false);
    setNodePropertiesModalOpen(false);
    setEdgePropertiesModalOpen(false);
    nodeImageTargetIdRef.current = null;
    setAiProcessingSteps([]);
    setAiProcessingModalOpen(false);
    setAiProcessingStatus("");
    setAiProcessingComplete(false);
    setAiProcessingMock(false);
    // Clear UI state and references belonging to linking mode.
    linkModeRef.current = false;
    firstNodeToLinkRef.current = null;
    setLinkMode(false);
    setFirstNodeToLink(null);
    // Clear UI state belonging to previous editing node and edge.
    editingNodeIdRef.current = null;
    setEditingNodeId(null);
    editingEdgeIdRef.current = null;
    setEditingEdgeId(null);
    setRelationshipValue("");
  }, [noteId, initialGraph]);

  /* =========================================================
   CANCEL AI GRAPH STREAM WHEN NOTE CHANGES / PANEL UNMOUNTS
   ========================================================= */

  useEffect(() => {

    /*
      This cleanup runs:

        - before noteId changes
        - when GraphPanel is unmounted

      If an AI graph is still being streamed, abort that
      HTTP request so it cannot continue feeding graph data
      into a different note.
    */

    return () => {
      if (graphStreamAbortRef.current) {
        graphStreamAbortRef.current.abort();
      }
    };
  }, [noteId]);
  async function generateGraph() {
    // =======================================================
    // VALIDATE NOTES
    // =======================================================
    const notes = rawNotes?.trim();
    if (!notes) {
      setError("Please write some notes before generating a graph.");
      return;
    }
    // =======================================================
    // CANCEL ANY PREVIOUS STREAM
    // =======================================================
    if (graphStreamAbortRef.current) {
      graphStreamAbortRef.current.abort();
    }
    const controller = new AbortController();
    graphStreamAbortRef.current = controller;
    setLoading(true);
    setError("");
    setAiProcessingStatus("Starting AI processing…");
    setAiProcessingComplete(false);
    setAiProcessingMock(false);
    try {
      // =====================================================
      // START STREAMING REQUEST
      // =====================================================
      const response = await fetch("/api/graph/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          noteId: noteId ?? null,

          /*
            IMPORTANT:

            rawNotes should already be the plain-text
            representation supplied by NoteWorkspace.

            Do not send notes_section_html here.
          */

          rawNotes: notes,
        }),
      });
      // =====================================================
      // HTTP-LEVEL ERRORS
      // =====================================================
      if (!response.ok) {
        let message = "Graph generation failed. Please try again.";
        try {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await response.json();
            if (typeof data?.detail === "string") {
              message = data.detail;
            } else if (Array.isArray(data?.detail)) {
              message = data.detail
                  .map((item) => String(item.msg)
                    .replace(/^Value error, /, ""))
                  .join(" ");
            } else if (typeof data?.message === "string") {
              message = data.message;
            }
          } else {
            const text = await response.text();
            if (text.trim()) {
              message = text.trim();
            }
          }
        }
        catch {

          /*
            Keep the normal fallback error message
            if the server response cannot be parsed.
          */

        }
        throw new Error(message);
      }
      // =====================================================
      // MAKE SURE THE BROWSER GAVE US A STREAM
      // =====================================================
      if (!response.body) {
        throw new Error("Graph streaming is not available in this browser.");
      }
      // =====================================================
      // CREATE STREAM READER
      // =====================================================
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      /*
        Network chunks do NOT necessarily line up with
        JSON objects.

        For example, one chunk could contain:

          {"type":"no

        and the next:

          de","data":...}\n

        So we keep incomplete text here until a newline
        tells us that one complete NDJSON event exists.
      */

      let buffer = "";
      // =====================================================
      // READ STREAM
      // =====================================================
      while (true) {
        const { value, done, } = await reader.read();
        if (done) {
          break;
        }

        /*
          Convert the Uint8Array network chunk into text.

          stream: true tells TextDecoder that the next
          chunk may continue a character from this one.
        */

        buffer += decoder.decode(value, {
            stream: true,
          });

        /*
          One chunk may contain:

            one event
            several events
            part of an event

          Split only on newline boundaries.
        */

        const lines = buffer.split("\n");

        /*
          The final item might be incomplete.

          Keep it in the buffer for the next read.
        */

        buffer = lines.pop() ?? "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }
          try {
            const event = JSON.parse(line);

            /*
              This is the function we already tested
              using testGraphStreaming().
            */

            handleGraphStreamEvent(event);
          }
          catch (parseError) {
            console.error("Unable to parse graph stream event:", line, parseError);
          }
        }
      }
      // =====================================================
      // FLUSH TEXTDECODER
      // =====================================================
      buffer += decoder.decode();

      /*
        Usually every backend event ends in \\n.

        This fallback lets us safely process a final JSON
        event even if the final newline was omitted.
      */

      const finalLine = buffer.trim();
      if (finalLine) {
        try {
          const finalEvent = JSON.parse(finalLine);
          handleGraphStreamEvent(finalEvent);
        }
        catch (parseError) {
          console.error("Unable to parse final graph stream event:", finalLine, parseError);
        }
      }
    }
    catch (error) {
      // =====================================================
      // REQUEST CANCELLED
      // =====================================================
      if (error?.name === "AbortError") {
        console.log("Graph generation stream cancelled.");
        return;
      }
      // =====================================================
      // REQUEST FAILED
      // =====================================================
      console.error("Graph generation error:", error);
      setError(error?.message || "Unable to generate graph. Please try again.");
      setAiProcessingStatus("Generation stopped");
      setAiProcessingComplete(false);
    }
    finally {

      /*
        Only clear the ref if this is still the
        currently active request.

        This matters if another request was started
        while an older request was shutting down.
      */

      if (graphStreamAbortRef.current === controller) {
        graphStreamAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  /* =========================================================
     CONDITIONAL / REIFICATION GRAPH HELPERS
     ========================================================= */

  function isInternalConditionOwnerEdge(edge) {
    return (edge?.data?.("graphInternal") === "condition-owner");
  }

  function getConditionalNodes(cy = cyRef.current) {
    if (!cy) {
      return [];
    }
    return cy.nodes().filter(node => normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional");
  }

  function getConditionalNodeColour(node) {
    if (!node || node.empty()) {
      return CONDITIONAL_NODE_DEFAULT_COLOR;
    }
    return (node.data("conditionColor") || node.data("color") || CONDITIONAL_NODE_DEFAULT_COLOR);
  }

  function getNextConditionalPaletteColour(cy = cyRef.current, excludeNodeId = "") {
    if (!cy) {
      return CONDITIONAL_NODE_DEFAULT_COLOR;
    }
    const conditionalCount = cy.nodes()
      .filter(node => !node.data("graphInternal") && node.id() !== excludeNodeId &&
        normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional")
      .length;
    return CONDITIONAL_NODE_MUTED_PALETTE[conditionalCount %
      CONDITIONAL_NODE_MUTED_PALETTE.length];
  }

  function syncConditionalDefaultBorders(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const defaultBorder = getConditionalDefaultBorderColour();
    getConditionalNodes(cy).forEach(node => {
      if (node.data("conditionBorderAuto") === true) {
        node.data("borderColor", defaultBorder);
      }
    });
  }

  function syncImageNodeDefaultTextColours(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const defaultTextColour = getThemeContrastColour();
    const automaticColourCandidates = new Set([
      "#ffffff",
      "#fff",
      "#111111",
      "#111",
      "#000000",
      "#000",
      String(getThemeColour("--graph-node-text", defaultTextColour) || "").toLowerCase(),
    ]);
    cy.nodes()
      .filter(node => Boolean(node.data("imageSrc")) && !node.data("graphInternal"))
      .forEach(node => {
        if (node.data("textColorUserSet") === true) {
          return;
        }

        /*
          Older saved graphs predate textColorUserSet. Preserve an
          obviously custom colour, but treat the normal white/black
          defaults as automatic so existing picture nodes migrate cleanly.
        */

        const currentTextColour = String(node.data("textColor") || "")
          .trim()
          .toLowerCase();
        if (currentTextColour && !automaticColourCandidates.has(currentTextColour)) {
          node.data("textColorUserSet", true);
          return;
        }
        node.data("textColor", defaultTextColour);
      });
  }

  function measureEdgeLabelHalfWidth(text, fontSize = 12) {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return 0;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return cleanText.length *
        fontSize * 0.28;
    }
    context.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
    return context.measureText(cleanText).width / 2;
  }

  function syncEdgeLabelGeometry(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    cy.edges()
      .filter(edge => !edge.data("graphInternal"))
      .forEach(edge => {
        const sourcePosition = edge.source().position();
        const targetPosition = edge.target().position();
        const deltaX = targetPosition.x -
          sourcePosition.x;
        const deltaY = targetPosition.y -
          sourcePosition.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const isVertical = absY > 30 && absX <= Math.max(24, absY * 0.18);
        const classification = normaliseEdgeClassification(edge.data("classification"));
        const relationship = String(edge.data("displayLabel") || edge.data("relationship") || "");
        const qualifier = String(edge.data("qualifier") || "");
        let relationshipMarginX = 0;
        let relationshipMarginY = -11;
        let qualifierMarginX = 0;
        let qualifierMarginY = 11;
        if (classification === "prerequisite") {
          relationshipMarginX = 0;
          relationshipMarginY = 0;
          qualifierMarginY = 18;
        } else if (isVertical) {

          /*
            Keep vertical relationships horizontally readable.  The
            relationship always lives to the left and the qualifier to
            the right, regardless of arrow direction, so scanning stays
            predictable throughout the graph.
          */

          relationshipMarginX = -(measureEdgeLabelHalfWidth(relationship, 12) + 14);
          qualifierMarginX = measureEdgeLabelHalfWidth(qualifier, 9) + 14;
          relationshipMarginY = 0;
          qualifierMarginY = 0;
        } else if (classification === "negative") {

          /*
            Keep negation labels centred on the red cross even when the
            edge is diagonal. A normal vector moves relationship and
            qualifier perpendicular to the edge instead of simply moving
            them up/down in screen space, which caused the diagonal drift.
          */

          const edgeLength = Math.max(1, Math.hypot(deltaX, deltaY));
          let normalX = -deltaY / edgeLength;
          let normalY = deltaX / edgeLength;

          /*
            Relationship always occupies the visually upper side of a
            non-vertical edge; qualifier mirrors it on the lower side.
          */

          if (normalY > 0 || (Math.abs(normalY) < 0.001 && normalX > 0)) {
            normalX *= -1;
            normalY *= -1;
          }
          const negationLabelOffset = 19;
          relationshipMarginX = normalX *
            negationLabelOffset;
          relationshipMarginY = normalY *
            negationLabelOffset;
          qualifierMarginX = -normalX *
            negationLabelOffset;
          qualifierMarginY = -normalY *
            negationLabelOffset;
        }
        edge.data({
          labelOrientation: isVertical ? "vertical" : "standard",
          relationshipMarginX,
          relationshipMarginY,
          qualifierMarginX,
          qualifierMarginY,
        });
        const qualifierAnnotation = cy.getElementById(`__edge-qualifier__${edge.id()}`);
        if (qualifierAnnotation && !qualifierAnnotation.empty()) {
          qualifierAnnotation.data({
            labelOrientation: isVertical ? "vertical" : "standard",
            qualifierMarginX,
            qualifierMarginY,
          });
        }
      });
  }

  function isSemanticOwnerGroupNode(node) {
    return (node?.data?.("graphInternal") === "semantic-owner-group");
  }

  function clearSemanticOwnerCompounds(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const ownerGroups = cy.nodes().filter(node => isSemanticOwnerGroupNode(node));

    /*
      Never remove a compound parent while real semantic nodes are still
      children of it. Cytoscape would remove the descendants as well.
      Move the semantic nodes back to the graph root first, then discard
      only the renderer-only parent.
    */

    ownerGroups.forEach(group => {
      const children = group.children();
      if (!children.empty()) {
        children.move({
          parent: null,
        });
      }
    });
    ownerGroups.remove();
  }

  function getConditionsForOwner(ownerId, cy = cyRef.current) {
    if (!cy || !ownerId) {
      return [];
    }
    return getConditionalNodes(cy)
      .filter(conditionNode => String(conditionNode.data("conditionOwnerId") || "").trim() === String(ownerId))
      .sort((first, second) => first.id().localeCompare(second.id()));
  }

  function positionSemanticOwnerGroup(ownerNode, cy = cyRef.current) {
    if (!cy || !ownerNode || ownerNode.empty()) {
      return;
    }
    const conditions = getConditionsForOwner(ownerNode.id(), cy);
    if (conditions.length === 0) {
      return;
    }
    const ownerPosition = ownerNode.position();
    const ownerWidth = Number(ownerNode.outerWidth()) || 110;
    const ownerHeight = Number(ownerNode.outerHeight()) || 52;
    conditions.forEach((conditionNode, index) => {
      const savedOffsetX = Number(conditionNode.data("conditionOffsetX"));
      const savedOffsetY = Number(conditionNode.data("conditionOffsetY"));
      const placementMode = String(conditionNode.data("conditionPlacement") || "auto").toLowerCase();
      const hasSavedOffset = Number.isFinite(savedOffsetX) && Number.isFinite(savedOffsetY);
      let offsetX;
      let offsetY;

      /*
        A manually dragged conditional keeps its exact relative offset.
        This lets users nudge conditions around the owner while the whole
        cluster can still move as one semantic compound.
      */

      if (placementMode === "manual" && hasSavedOffset) {
        offsetX = savedOffsetX;
        offsetY = savedOffsetY;
      } else {
        const conditionWidth = Number(conditionNode.outerWidth()) || 110;
        const conditionHeight = Number(conditionNode.outerHeight()) || 52;
        const slot = CONDITION_AUTO_PLACEMENT_SLOTS[index %
          CONDITION_AUTO_PLACEMENT_SLOTS.length];
        const ring = Math.floor(index /
          CONDITION_AUTO_PLACEMENT_SLOTS.length);
        const horizontalRadius = ownerWidth / 2 +
          conditionWidth / 2 +
          38 +
          ring * 140;
        const verticalRadius = ownerHeight / 2 +
          conditionHeight / 2 +
          34 +
          ring * 100;
        offsetX = slot.x * horizontalRadius;
        offsetY = slot.y * verticalRadius;
        conditionNode.data({
          conditionPlacement: "auto",
          conditionOffsetX: offsetX,
          conditionOffsetY: offsetY,
        });
      }
      conditionNode.position({
        x: ownerPosition.x +
          offsetX,
        y: ownerPosition.y +
          offsetY,
      });
    });
  }

  function positionAllSemanticOwnerGroups(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const positionedOwnerIds = new Set();
    getConditionalNodes(cy).forEach(conditionNode => {
      const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
      if (!ownerId || positionedOwnerIds.has(ownerId)) {
        return;
      }
      const ownerNode = cy.getElementById(ownerId);
      if (!ownerNode || ownerNode.empty() || ownerNode.id() === conditionNode.id()) {
        return;
      }
      positionedOwnerIds.add(ownerId);
      positionSemanticOwnerGroup(ownerNode, cy);
    });
  }

  function syncSemanticOwnerCompounds(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    clearSemanticOwnerCompounds(cy);

    /*
      The old invisible owner -> condition layout edge is unnecessary in
      semantic mode once both nodes share an actual compound parent.
    */

    cy.edges()
      .filter(edge => isInternalConditionOwnerEdge(edge))
      .remove();
    const conditionsByOwner = new Map();
    getConditionalNodes(cy).forEach(conditionNode => {
      const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
      if (!ownerId) {
        return;
      }
      const ownerNode = cy.getElementById(ownerId);
      if (!ownerNode || ownerNode.empty() || ownerNode.id() === conditionNode.id() || ownerNode.data("graphInternal")) {
        return;
      }
      if (!conditionsByOwner.has(ownerId)) {
        conditionsByOwner.set(ownerId, []);
      }
      conditionsByOwner
        .get(ownerId)
        .push(conditionNode);
    });
    conditionsByOwner.forEach((conditionNodes, ownerId) => {
      const ownerNode = cy.getElementById(ownerId);
      if (!ownerNode || ownerNode.empty()) {
        return;
      }
      const groupId = `__semantic-owner-group__${ownerId}`;
      const ownerGroup = cy.add({
        group: "nodes",
        data: {
          id: groupId,
          label: "",
          graphInternal: "semantic-owner-group",
          semanticOwnerId: ownerId,
        },
        selectable: false,
        grabbable: false,
      });
      ownerNode.move({
        parent: ownerGroup.id(),
      });
      conditionNodes.forEach(conditionNode => {
        conditionNode.move({
          parent: ownerGroup.id(),
        });
      });
      positionSemanticOwnerGroup(ownerNode, cy);
    });
    cy.style().update();
  }

  function getConditionPropositionEdges(conditionNode) {
    if (!conditionNode || conditionNode.empty()) {
      return [];
    }
    return conditionNode
      .connectedEdges()
      .filter(edge => !isInternalConditionOwnerEdge(edge) &&
        normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
          edge.data("reification") === true) !== "reification");
  }

  function getConditionChildIds(conditionNode) {
    const childIds = new Set();
    getConditionPropositionEdges(conditionNode).forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      const otherId = sourceId === conditionNode.id() ? targetId : sourceId;
      if (otherId && otherId !== conditionNode.data("conditionOwnerId")) {
        childIds.add(otherId);
      }
    });
    return childIds;
  }

  function findConditionForReificationEdge(edge, conditionNodes = getConditionalNodes()) {
    if (!edge || edge.empty()) {
      return null;
    }
    const currentRole = normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
      edge.data("reification") === true);

    /*
      Auto edges must remain genuinely auto-detected.  A conditionId
      cached from a previous pass must not make the result sticky if
      the graph is edited later.
    */

    const explicitConditionId = currentRole === "auto" ? "" : String(edge.data("conditionId") || "").trim();
    if (explicitConditionId) {
      const explicitCondition = edge.cy().getElementById(explicitConditionId);
      if (explicitCondition && !explicitCondition.empty() &&
        normaliseNodeType(explicitCondition.data("nodeType"), explicitCondition.data("conditionOwnerId")) === "conditional") {
        return explicitCondition;
      }
    }
    const sourceId = edge.source().id();
    const targetId = edge.target().id();
    for (let index = 0; index < conditionNodes.length; index += 1) {
      const conditionNode = conditionNodes[index];
      const childIds = getConditionChildIds(conditionNode);
      if (childIds.has(sourceId) && childIds.has(targetId)) {
        return conditionNode;
      }
    }
    return null;
  }

  function findConditionPropositionEdge(conditionNode, childNodeId) {
    if (!conditionNode || conditionNode.empty() || !childNodeId) {
      return null;
    }
    const candidate = getConditionPropositionEdges(conditionNode)
      .filter(edge => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        return ((sourceId === conditionNode.id() && targetId === childNodeId) || (targetId === conditionNode.id() &&
            sourceId === childNodeId));
      });
    return candidate.length > 0 ? candidate[0] : null;
  }

  function getEdgeDisplayLabel(edge) {
    if (!edge || edge.empty()) {
      return "";
    }
    const relationship = String(edge.data("relationship") || "").trim();
    if (!relationship) {
      return "";
    }
    if (edge.data("resolvedEdgeRole") === "reification") {
      return relationship.toUpperCase();
    }
    const sourceNode = edge.source();
    const targetNode = edge.target();
    const sourceIsConditional = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId")) === "conditional";
    const targetIsConditional = normaliseNodeType(targetNode.data("nodeType"), targetNode.data("conditionOwnerId")) === "conditional";
    const conditionNode = sourceIsConditional ? sourceNode : targetIsConditional ? targetNode : null;
    if (!conditionNode) {
      return relationship;
    }
    const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
    const ownerNode = ownerId ? edge.cy().getElementById(ownerId) : null;
    if (!ownerNode || ownerNode.empty()) {
      return relationship;
    }
    const ownerLabel = String(ownerNode.data("label") || ownerNode.id()).trim();
    if (!ownerLabel) {
      return relationship;
    }
    if (relationship
      .toLowerCase()
      .startsWith(ownerLabel.toLowerCase())) {
      return relationship;
    }
    return `${ownerLabel} ${relationship}`;
  }

  function isEdgeAnnotationElement(element) {
    const internalType = String(element?.data?.("graphInternal") || "");
    return (internalType === "edge-qualifier-label" || internalType === "edge-negative-mark" || internalType ===
      "edge-prerequisite-tag");
  }

  function clearEdgeAnnotationPresentation(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    cy.edges()
      .filter(edge => isEdgeAnnotationElement(edge))
      .remove();
  }

  function syncEdgeAnnotationPresentation(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    clearEdgeAnnotationPresentation(cy);
    const annotationEdges = [];
    cy.edges()
      .filter(edge => !edge.data("graphInternal"))
      .forEach(edge => {
        const qualifier = String(edge.data("qualifier") || "").trim();
        const classification = normaliseEdgeClassification(edge.data("classification"));
        if (qualifier) {
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-qualifier__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: qualifier,
              graphInternal: "edge-qualifier-label",
              semanticEdgeId: edge.id(),
            },
            selectable: false,
          });
        }
        if (classification === "prerequisite") {
          const badgeColour = edge.data("prerequisiteBadgeColor") || getThemeColour("--graph-node-bg", "#6366F1");
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-prerequisite-tag__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: "requires",
              graphInternal: "edge-prerequisite-tag",
              semanticEdgeId: edge.id(),
              prerequisiteBadgeColor: badgeColour,
              prerequisiteBadgeTextColor: edge.data("prerequisiteBadgeTextColor") || getReadableTextColour(badgeColour),
            },
            selectable: false,
          });
        }
        if (classification === "negative") {
          annotationEdges.push({
            group: "edges",
            data: {
              id: `__edge-negative__${edge.id()}`,
              source: edge.source().id(),
              target: edge.target().id(),
              displayLabel: "×",
              graphInternal: "edge-negative-mark",
              semanticEdgeId: edge.id(),
            },
            selectable: false,
          });
        }
      });
    if (annotationEdges.length > 0) {
      cy.add(annotationEdges);
    }
    syncEdgeLabelGeometry(cy);
  }

  function getVisibleGraphElements(cy = cyRef.current) {
    if (!cy) {
      return null;
    }
    return cy.elements().filter(element => element.visible());
  }

  function fitVisibleGraph(cy = cyRef.current, padding = 50) {
    if (!cy) {
      return;
    }
    const elements = getVisibleGraphElements(cy);
    if (!elements || elements.empty()) {
      return;
    }
    cy.fit(elements, padding);
    if (cy.zoom() > 1.35) {
      cy.zoom(1.35);
      cy.center(elements);
    }
  }

  function syncConditionalGraphSemantics(cy = cyRef.current) {
    if (!cy) {
      return;
    }

    /*
      Rebuild renderer-only semantic helpers from the real saved graph.
      Conditional nodes and their semantic owner share an invisible
      Cytoscape compound parent; annotation edges are presentation-only.
    */

    clearEdgeAnnotationPresentation(cy);
    clearSemanticOwnerCompounds(cy);
    syncSemanticOwnerCompounds(cy);
    const conditionalNodes = getConditionalNodes(cy);
    conditionalNodes.forEach((conditionNode, conditionIndex) => {
      const existingConditionColour = conditionNode.data("conditionColor");
      const existingNodeColour = conditionNode.data("color");
      const hadConditionColour = Boolean(existingConditionColour || existingNodeColour);
      const conditionColour = hadConditionColour ? (existingConditionColour || existingNodeColour)
        : CONDITIONAL_NODE_MUTED_PALETTE[conditionIndex %
        CONDITIONAL_NODE_MUTED_PALETTE.length];
      const existingBorder = conditionNode.data("borderColor");
      const borderAutoSetting = conditionNode.data("conditionBorderAuto");

      /*
        Older GraphPanel builds defaulted the border to the same colour
        as the conditional fill. Treat that combination as the legacy
        automatic border unless the user has explicitly customised it.
      */

      const looksLikeLegacyAutoBorder = borderAutoSetting == null && (!existingBorder || existingBorder ===
          existingConditionColour || existingBorder === conditionColour);
      const useAutomaticBorder = borderAutoSetting === true || looksLikeLegacyAutoBorder;
      conditionNode.data({
        nodeType: "conditional",
        conditionColor: conditionColour,
        color: conditionColour,
        conditionColorAuto: hadConditionColour ? Boolean(conditionNode.data("conditionColorAuto")) : true,
        textColor: conditionNode.data("textColor") || CONDITIONAL_NODE_DEFAULT_TEXT_COLOR,
        borderColor: useAutomaticBorder ? getConditionalDefaultBorderColour() : existingBorder,
        conditionBorderAuto: useAutomaticBorder,
      });
    });
    cy.edges().forEach(edge => {
      if (edge.data("graphInternal")) {
        return;
      }
      const requestedRole = normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
        edge.data("reification") === true);
      edge.data("edgeRole", requestedRole);
      const inferredCondition = findConditionForReificationEdge(edge, conditionalNodes);
      const resolvedRole = requestedRole === "reification" ? "reification" : requestedRole === "standard" ? "standard"
          : inferredCondition ? "reification" : "standard";
      edge.data("resolvedEdgeRole", resolvedRole);
      const resolvedClassification = normaliseEdgeClassification(edge.data("classification"));
      edge.data("resolvedClassification", resolvedClassification);
      if (resolvedClassification === "prerequisite") {
        const badgeColour = edge.data("badgeColor") || edge.data("edgeColor") ||
          getThemeColour("--graph-node-bg", "#6366F1");
        edge.data({
          prerequisiteBadgeColor: badgeColour,
          prerequisiteBadgeTextColor: getReadableTextColour(badgeColour),
        });
      } else {
        edge.removeData("prerequisiteBadgeColor");
        edge.removeData("prerequisiteBadgeTextColor");
      }
      const sourceNode = edge.source();
      const targetNode = edge.target();
      const sourceIsConditional = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId")) === "conditional";
      const targetIsConditional = normaliseNodeType(targetNode.data("nodeType"), targetNode.data("conditionOwnerId")) === "conditional";
      const directConditionNode = sourceIsConditional ? sourceNode : targetIsConditional ? targetNode : null;
      if (directConditionNode) {
        edge.data("conditionEdge", true);
        if (!edge.data("conditionId")) {
          edge.data("conditionId", directConditionNode.id());
        }
      } else {
        edge.removeData("conditionEdge");
        if (requestedRole === "auto" && !inferredCondition) {
          edge.removeData("conditionId");
        }
      }
      if (resolvedRole === "reification") {

        /*
          Preserve explicit proposition-edge IDs supplied by the AI.
          This matters when streamed edges arrive out of order or when a
          condition contains multiple proposition edges involving the same
          visible node. Missing IDs are still inferred below as a fallback.
        */

        const suppliedFromEdgeId = String(edge.data("fromEdgeId") || "").trim();
        const suppliedToEdgeId = String(edge.data("toEdgeId") || "").trim();
        const conditionNode = inferredCondition || (edge.data("conditionId")
            ? cy.getElementById(String(edge.data("conditionId"))) : null);
        if (conditionNode && !conditionNode.empty()) {
          const conditionColour = getConditionalNodeColour(conditionNode);
          edge.data({
            conditionId: conditionNode.id(),
            conditionColor: conditionColour,
          });
          const fromProposition = findConditionPropositionEdge(conditionNode, sourceNode.id());
          const toProposition = findConditionPropositionEdge(conditionNode, targetNode.id());
          if (suppliedFromEdgeId) {
            edge.data("fromEdgeId", suppliedFromEdgeId);
          } else if (fromProposition) {
            edge.data("fromEdgeId", fromProposition.id());
          }
          if (suppliedToEdgeId) {
            edge.data("toEdgeId", suppliedToEdgeId);
          } else if (toProposition) {
            edge.data("toEdgeId", toProposition.id());
          }
        } else {
          edge.data("conditionColor", CONDITIONAL_NODE_DEFAULT_COLOR);
        }
      } else {
        edge.removeData("conditionColor");
        edge.removeData("fromEdgeId");
        edge.removeData("toEdgeId");
      }
      edge.data("displayLabel", getEdgeDisplayLabel(edge));
    });
    syncEdgeAnnotationPresentation(cy);
    syncEdgeLabelGeometry(cy);
    cy.style().update();
  }

  function placeConditionalNextToOwner(conditionNode) {
    if (!conditionNode || conditionNode.empty()) {
      return;
    }
    const ownerId = String(conditionNode.data("conditionOwnerId") || "").trim();
    if (!ownerId) {
      return;
    }
    const ownerNode = conditionNode.cy().getElementById(ownerId);
    if (!ownerNode || ownerNode.empty()) {
      return;
    }

    /*
      Re-position the whole owner/condition cluster so multiple conditions
      are stacked neatly instead of fighting for the same coordinates.
    */

    positionSemanticOwnerGroup(ownerNode, conditionNode.cy());
  }

  function applyGraphTheme(cy = cyRef.current) {
    if (!cy) {
      return;
    }
    const graphTheme = getGraphThemeTokens();

    /*
      Conditional borders use a theme-aware automatic default: white in
      dark mode and black in light mode. User-customised borders are left
      untouched.
    */

    syncConditionalDefaultBorders(cy);
    syncImageNodeDefaultTextColours(cy);
    cy.style()
      // =====================================================
      // DEFAULT NODE
      // =====================================================
      .selector("node")
      .style({
        "background-color": graphTheme.nodeBg,
        "border-color": graphTheme.nodeBorder,
        color: graphTheme.nodeText,
      })
      // =====================================================
      // CUSTOM NODE APPEARANCE
      // =====================================================
      .selector("node[color]")
      .style({
        "background-color": "data(color)",
      })
      .selector("node[textColor]")
      .style({
        color: "data(textColor)",
      })
      .selector("node[shape]")
      .style({
        shape: "data(shape)",
      })
      .selector("node[borderColor]")
      .style({
        "border-color": "data(borderColor)",
      })
      .selector("node[borderStyle]")
      .style({
        "border-style": "data(borderStyle)",
      })
      // =====================================================
      // CONDITIONAL NODE
      // =====================================================
      .selector('node[nodeType = "conditional"]')
      .style({
        "background-color": CONDITIONAL_NODE_DEFAULT_COLOR,
      })
      .selector('node[nodeType = "conditional"][conditionColor]')
      .style({
        "background-color": "data(conditionColor)",
      })
      // =====================================================
      // NODE IMAGE FILL
      // =====================================================
      .selector("node[imageSrc]")
      .style({
        "background-image": "data(imageSrc)",
        "background-fit": "cover",
        "background-clip": "node",
        "background-opacity": 1,
        color: getThemeContrastColour(),
      })
      .selector("node[imageSrc][imageFit]")
      .style({
        "background-fit": "data(imageFit)",
      })
      .selector("node[imageSrc][imagePositionX][imagePositionY]")
      .style({
        "background-position-x": "data(imagePositionX)",
        "background-position-y": "data(imagePositionY)",
      })
      .selector("node.image-label-hidden")
      .style({
        label: "",
      })

      /*
        When there is no explicitly chosen border colour, reuse the
        old node fill colour as an accent around the image.
      */

      .selector("node[imageSrc][color]")
      .style({
        "border-color": "data(color)",
        "border-width": 3,
      })
      .selector("node[imageSrc][borderColor]")
      .style({
        "border-color": "data(borderColor)",
      })
      .selector("node[imageSrc][textColor][textColorUserSet]")
      .style({
        color: "data(textColor)",
      })
      // =====================================================
      // INVISIBLE SEMANTIC OWNER COMPOUND
      // =====================================================
      .selector('node[graphInternal = "semantic-owner-group"]')
      .style({
        "background-opacity": 0,
        "border-width": 0,
        "border-opacity": 0,
        label: "",
        "text-opacity": 0,
        padding: 8,
        "compound-sizing-wrt-label": "exclude",
        "overlay-opacity": 0,
        events: "no",
      })
      // =====================================================
      // SELECTED NODE
      // =====================================================
      .selector("node:selected")
      .style({
        "underlay-color": graphTheme.selectedBorder,
        "underlay-opacity": 0.28,
        "underlay-padding": 10,
      })
      // =====================================================
      // LINKED RAW NOTES HOVER
      // =====================================================
      .selector("node.linked-text-hover")
      .style({
        "underlay-color": "data(linkColor)",
        "underlay-opacity": 0.38,
        "underlay-padding": 20,
      })
      // =====================================================
      // LINK SOURCE
      // =====================================================
      .selector("node.link-source")
      .style({
        "border-width": 4,
        "border-style": "dashed",
        "border-color": graphTheme.linkSource,
        "underlay-color": graphTheme.linkSource,
        "underlay-opacity": 0.22,
        "underlay-padding": 8,
      })
      // =====================================================
      // DEFAULT EDGE
      // =====================================================
      .selector("edge")
      .style({
        width: 2,
        "line-color": graphTheme.edge,
        "target-arrow-color": graphTheme.edgeArrow,
        "target-arrow-shape": "triangle",
        "line-style": "solid",
        "curve-style": "straight",
        color: graphTheme.edgeLabel,
        opacity: 0.8,
        label: "data(displayLabel)",
        "font-size": "12px",
        "font-weight": "500",
        "text-margin-x": 0,
        "text-margin-y": -11,
        "text-rotation": "autorotate",
        "text-events": "yes",
      })
      .selector("edge[relationshipMarginX][relationshipMarginY]")
      .style({
        "text-margin-x": "data(relationshipMarginX)",
        "text-margin-y": "data(relationshipMarginY)",
      })
      .selector('edge[labelOrientation = "vertical"]')
      .style({
        "text-rotation": "none",
      })
      // =====================================================
      // CUSTOM EDGE APPEARANCE
      // =====================================================
      .selector("edge[edgeColor]")
      .style({
        "line-color": "data(edgeColor)",
      })
      .selector("edge[arrowColor]")
      .style({
        "target-arrow-color": "data(arrowColor)",
      })
      .selector("edge[arrowShape]")
      .style({
        "target-arrow-shape": "data(arrowShape)",
      })
      .selector("edge[lineStyle]")
      .style({
        "line-style": "data(lineStyle)",
      })
      // =====================================================
      // CONDITIONAL / REIFICATION EDGES
      // =====================================================
      .selector('edge[graphInternal = "condition-owner"]')
      .style({
        width: 0.1,
        opacity: 0,
        "target-arrow-shape": "none",
        label: "",
      })
      .selector("edge[conditionEdge]")
      .style({
        "line-style": "dashed",
      })
      .selector('edge[resolvedClassification = "prerequisite"]')
      .style({
        "line-style": "dashed",
        "text-rotation": "none",
        "text-background-color": "data(prerequisiteBadgeColor)",
        "text-background-opacity": 1,
        "text-background-padding": 5,
        "text-background-shape": "roundrectangle",
        "text-border-color": "data(prerequisiteBadgeColor)",
        "text-border-width": 1,
        "text-border-opacity": 1,
        color: "data(prerequisiteBadgeTextColor)",
        "font-weight": "650",
      })
      .selector('edge[graphInternal = "edge-qualifier-label"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: graphTheme.edgeLabel,
        "text-opacity": 0.62,
        "font-size": "9px",
        "font-weight": "400",
        "text-margin-x": "data(qualifierMarginX)",
        "text-margin-y": "data(qualifierMarginY)",
        "text-rotation": "autorotate",
        events: "no",
      })
      .selector('edge[graphInternal = "edge-qualifier-label"][labelOrientation = "vertical"]')
      .style({
        "text-rotation": "none",
      })
      .selector('edge[graphInternal = "edge-prerequisite-tag"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: "data(prerequisiteBadgeTextColor)",
        "font-size": "8px",
        "font-weight": "700",
        "text-margin-y": -15,
        "text-rotation": "none",
        "text-background-color": "data(prerequisiteBadgeColor)",
        "text-background-opacity": 1,
        "text-background-padding": 1,
        "text-background-shape": "roundrectangle",
        "text-border-color": "data(prerequisiteBadgeColor)",
        "text-border-width": 1,
        "text-border-opacity": 1,
        events: "no",
      })
      .selector('edge[graphInternal = "edge-negative-mark"]')
      .style({
        width: 0.1,
        "line-opacity": 0,
        "target-arrow-shape": "none",
        "source-arrow-shape": "none",
        opacity: 1,
        label: "data(displayLabel)",
        color: "#ef4444",
        "font-size": "16px",
        "font-weight": "800",
        "text-margin-y": 0,
        "text-rotation": "none",
        "text-outline-color": "#111827",
        "text-outline-width": 2,
        events: "no",
      })
      .selector('edge[resolvedEdgeRole = "reification"]')
      .style({
        width: 4,
        "line-color": CONDITIONAL_NODE_DEFAULT_COLOR,
        "target-arrow-color": CONDITIONAL_NODE_DEFAULT_COLOR,
        "target-arrow-shape": "triangle",
        "line-style": "solid",
        "arrow-scale": 1.25,
        color: CONDITIONAL_NODE_DEFAULT_COLOR,
        "font-weight": "700",
        opacity: 1,
      })
      .selector('edge[resolvedEdgeRole = "reification"][conditionColor]')
      .style({
        "line-color": "data(conditionColor)",
        "target-arrow-color": "data(conditionColor)",
        color: "data(conditionColor)",
      })

      /* Classification wins over user/role line style. */

      .selector('edge[resolvedClassification = "prerequisite"]')
      .style({
        "line-style": "dashed",
      })
      // =====================================================
      // SELECTED EDGE
      // Must come AFTER custom edge styles.
      // =====================================================
      .selector("edge:selected")
      .style({
        "underlay-color": graphTheme.selectedEdge,
        "underlay-opacity": 0.32,
        "underlay-padding": 6,
      })
      .update();
  }

  function addStreamEdge(edgeData) {
    const cy = cyRef.current;
    if (!cy || !edgeData) {
      return false;
    }
    edgeData = normaliseIncomingEdgeData(edgeData);
    const sourceId = String(edgeData.source ?? "");
    const targetId = String(edgeData.target ?? "");
    if (!sourceId || !targetId) {
      console.warn("Streamed edge is missing source/target:", edgeData);
      return false;
    }
    const sourceNode = cy.getElementById(sourceId);
    const targetNode = cy.getElementById(targetId);

    /*
      An edge cannot safely be added until both
      of its nodes exist.
    */

    if (sourceNode.empty() || targetNode.empty()) {
      return false;
    }

    /*
      Hans should ideally provide edge IDs.

      This fallback gives us something usable
      during development if he doesn't yet.
    */

    const edgeId = String(edgeData.id || `ai-edge-${sourceId}-${targetId}-${edgeData.relationship || "link"}`);
    const existing = cy.getElementById(edgeId);

    /*
      If this edge already exists, update it
      instead of creating a duplicate.
    */

    if (!existing.empty()) {
      existing.data({
        ...existing.data(),
        ...edgeData,
        id: edgeId,
        source: sourceId,
        target: targetId,
      });
      syncConditionalGraphSemantics(cy);
      return true;
    }
    cy.add({
      group: "edges",
      data: {
        ...edgeData,
        id: edgeId,
        source: sourceId,
        target: targetId,
      },
    });
    syncConditionalGraphSemantics(cy);
    return true;
  }

  function getStreamNodePosition() {
    const cy = cyRef.current;
    if (!cy) {
      return {
        x: 0,
        y: 0,
      };
    }

    /*
      On the first streamed node, capture the centre
      of the currently visible Cytoscape viewport.

      All subsequent temporary positions are based
      around this point.
    */

    if (!streamAnchorRef.current) {
      const extent = cy.extent();
      streamAnchorRef.current = {
        x: (extent.x1 + extent.x2) / 2,
        y: (extent.y1 + extent.y2) / 2,
      };
    }
    const anchor = streamAnchorRef.current;
    const index = streamNodeIndexRef.current++;

    /*
      First node goes directly into the centre.
    */

    if (index === 0) {
      return {
        ...anchor,
      };
    }

    /*
      Place later nodes in a loose spiral.

      These are ONLY temporary positions while
      generation is underway.
    */

    const goldenAngle = 137.508 * (Math.PI / 180);
    const angle = index * goldenAngle;
    const radius = 90 + Math.sqrt(index) * 65;
    return {
      x: anchor.x +
        Math.cos(angle) * radius,
      y: anchor.y +
        Math.sin(angle) * radius,
    };
  }

  function focusStreamElements(elements) {
    const cy = cyRef.current;
    if (!cy || !elements || elements.empty()) {
      return;
    }

    /*
      Stop any previous viewport animation so a newly
      streamed element immediately becomes the focus.
    */

    cy.stop();

    /*
      Keep a fairly stable viewing zoom during streaming.

      We don't want every individual node to fill the
      entire Graph View.
    */

    const focusZoom = Math.min(Math.max(cy.zoom(), 0.95), 1.15);
    cy.animate({
      center: {
        eles: elements,
      },
      zoom: focusZoom,
    }, {
      duration: 350,
      easing: "ease-in-out-cubic",
    });
  }

  function flushPendingStreamEdges() {
    const cy = cyRef.current;
    if (!cy || pendingStreamEdgesRef.current.length === 0) {
      return;
    }
    const stillPending = [];
    for (const edgeData of pendingStreamEdgesRef.current) {
      const added = addStreamEdge(edgeData);
      if (!added) {
        stillPending.push(edgeData);
      }
    }
    pendingStreamEdgesRef.current = stillPending;
  }

  function normaliseAiProcessingStep(event) {
    const data = event?.data && typeof event.data === "object" ? event.data : event || {};
    const stepValue = data.step ?? event?.step ?? data.index ?? event?.index ?? (aiProcessingSteps.length + 1);
    const numericStep = Number.isFinite(Number(stepValue)) ? Number(stepValue) : aiProcessingSteps.length + 1;
    const fallback = AI_PROCESSING_STAGE_FALLBACKS[numericStep] || {};
    const contentValue = data.content ?? data.output ?? data.result ?? event?.content ?? event?.message ?? "";
    return {
      id: String(data.id ?? event?.id ?? `ai-processing-${numericStep}`),
      step: numericStep,
      title: String(data.title ?? data.name ?? event?.title ?? fallback.title ?? `Processing step ${numericStep}`),
      description: String(data.description ?? data.task ?? event?.description ?? fallback.description ?? "AI processing output"),
      content: Array.isArray(contentValue) ? contentValue.map(item => String(item)).join("\n")
        : String(contentValue ?? ""),
    };
  }

  function addAiProcessingStep(event) {
    const nextStep = normaliseAiProcessingStep(event);
    setAiProcessingSteps(current => {
      const existingIndex = current.findIndex(item => item.id === nextStep.id || item.step === nextStep.step);
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], ...nextStep };
      } else {
        next.push(nextStep);
      }
      return next.sort((a, b) => a.step - b.step);
    });
    setAiProcessingStatus(nextStep.title);
    setAiProcessingComplete(false);
    setAiProcessingMock(false);
  }

  function loadAiProcessingMockPreview() {
    setAiProcessingSteps(AI_PROCESSING_MOCK_STEPS);
    setAiProcessingStatus("Mock processing preview");
    setAiProcessingComplete(true);
    setAiProcessingMock(true);
  }

  function handleGraphStreamEvent(event) {
    const cy = cyRef.current;
    if (!cy || !event) {
      return;
    }
    console.log("Graph stream event:", event);
    switch (event.type) {
      // =====================================================
      // STREAM STARTED
      // =====================================================
      case "start": {

        /*
          Generate Graph currently replaces the existing
          generated graph, so preserve that behaviour.

          We clear the graph once when the stream begins,
          NOT every time an element arrives.
        */

        cy.elements().remove();
        pendingStreamEdgesRef.current = [];
        streamAnchorRef.current = null;
        streamNodeIndexRef.current = 0;
        cy.elements().unselect();
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectionSummary({
          nodes: [],
          edges: [],
        });
        setShapeMenuOpen(false);
        setNodeBorderStyleMenuOpen(false);
        setEdgeStyleMenuOpen(false);
        setArrowShapeMenuOpen(false);
        setGraphFeedback(null);
        setAiProcessingSteps([]);
        setAiProcessingStatus("Starting AI processing…");
        setAiProcessingComplete(false);
        setAiProcessingMock(false);
        console.log("AI graph stream started.");
        break;
      }
      // =====================================================
      // STREAMED NODE
      // =====================================================
      case "node": {
        const nodeData = normaliseIncomingNodeData(event.data || {});
        if (!nodeData?.id) {
          console.warn("Streamed node has no id:", event);
          break;
        }
        const nodeId = String(nodeData.id);
        const existingNode = cy.getElementById(nodeId);
        let node;

        /*
          Update existing node if the backend repeats
          or enriches it later in the stream.
        */

        if (!existingNode.empty()) {
          existingNode.data({
            ...existingNode.data(),
            ...nodeData,
            id: nodeId,
          });
          node = existingNode;
        } else {
          node = cy.add({
              group: "nodes",
              data: {
                ...nodeData,
                id: nodeId,
                label: nodeData.label || nodeId,
              },

              /*
                Give the new node a temporary stable position.

                Existing streamed nodes are NOT rearranged.
              */

              position: getStreamNodePosition(),
            });
        }

        /*
          Apply TreeNotes' existing automatic node sizing.
        */

        resizeNodeToLabel(node);

        /*
          A newly arrived node might unlock an edge that
          had to wait for this endpoint.
        */

        flushPendingStreamEdges();
        syncConditionalGraphSemantics(cy);
        cy.style().update();

        /*
          Smoothly move the viewport to the node
          that has just appeared.
        */

        focusStreamElements(node);
        break;
      }
      // =====================================================
      // STREAMED EDGE
      // =====================================================
      case "edge": {
        const incomingEdgeData = event.data;
        if (!incomingEdgeData) {
          break;
        }
        const expandedEdges = expandIncomingEdgeData(incomingEdgeData);
        for (const edgeData of expandedEdges) {
          const added = addStreamEdge(edgeData);

          /*
            If the required nodes have not arrived yet,
            hold this edge temporarily.
          */

          if (!added) {
            const pendingId = edgeData.id;
            const alreadyWaiting = pendingStreamEdgesRef.current
              .some((edge) => pendingId && edge.id === pendingId);
            if (!alreadyWaiting) {
              pendingStreamEdgesRef.current.push(edgeData);
            }
            continue;
          }
          const sourceNode = cy.getElementById(String(edgeData.source));
          const targetNode = cy.getElementById(String(edgeData.target));
          if (!sourceNode.empty() && !targetNode.empty()) {
            const connectedNodes = sourceNode.union(targetNode);
            focusStreamElements(connectedNodes);
          }
        }
        syncConditionalGraphSemantics(cy);
        break;
      }
      // =====================================================
      // AI PROCESSING / INTERPRETABILITY STEP
      // =====================================================
      case "processing":
      case "processing_step":
      case "process":
      case "interpretation":
      case "trace": {
        addAiProcessingStep(event);
        break;
      }
      // =====================================================
      // OPTIONAL STATUS MESSAGE
      // =====================================================
      case "status": {
        console.log("AI graph status:", event.message);
        if (event?.step != null || event?.data?.step != null || event?.content != null ||
          event?.data?.content != null) {
          addAiProcessingStep(event);
        } else if (event?.message) {
          setAiProcessingStatus(String(event.message));
        }
        break;
      }
      // =====================================================
      // STREAM COMPLETE
      // =====================================================
      case "done": {
        flushPendingStreamEdges();
        if (pendingStreamEdgesRef.current.length > 0) {
          console.warn("Graph stream finished with unresolved edges:", pendingStreamEdgesRef.current);
        }
        syncConditionalGraphSemantics(cy);

        /*
          Final layout now that the complete graph
          has arrived.
        */

        if (!cy.elements().empty()) {
          const finalLayout = cy.layout({
            name: "cose",
            animate: true,
            fit: true,
            padding: 50,
            randomize: false,
          });
          finalLayout.one("layoutstop", () => {
            cy.resize();
            positionAllSemanticOwnerGroups(cy);
            fitVisibleGraph(cy, 50);
          });
          finalLayout.run();
        }
        const semanticNodeCount = cy.nodes().filter(node => !node.data("graphInternal")).length;
        const semanticEdgeCount = cy.edges().filter(edge => !edge.data("graphInternal")).length;
        showGraphFeedback(`Graph generated: ${semanticNodeCount} nodes, ${semanticEdgeCount} links`, "success");
        setAiProcessingStatus("Processing complete");
        setAiProcessingComplete(true);
        console.log("AI graph stream complete.");
        break;
      }
      // =====================================================
      // STREAM ERROR
      // =====================================================
      case "error": {
        const message = event.message || "Unable to generate graph.";
        setError(message);
        setAiProcessingStatus("Generation stopped");
        setAiProcessingComplete(false);
        console.error("AI graph stream error:", message);
        break;
      }
      default: {
        console.warn("Unknown graph stream event:", event);
      }
    }
  }
  async function testGraphStreaming() {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    handleGraphStreamEvent({
      type: "start",
    });
    await wait(400);
    handleGraphStreamEvent({
      type: "node",
      data: {
        id: "stream-programming",
        label: "Programming",
      },
    });
    await wait(400);

    /*
      Deliberately send this edge BEFORE Java exists.

      This tests our pending-edge system.
    */

    handleGraphStreamEvent({
      type: "edge",
      data: {
        id: "stream-programming-java",
        source: "stream-programming",
        target: "stream-java",
        relationship: "includes",
      },
    });
    await wait(400);
    handleGraphStreamEvent({
      type: "node",
      data: {
        id: "stream-java",
        label: "Java",
      },
    });
    await wait(400);
    handleGraphStreamEvent({
      type: "node",
      data: {
        id: "stream-csharp",
        label: "C#",
      },
    });
    await wait(400);
    handleGraphStreamEvent({
      type: "edge",
      data: {
        id: "stream-programming-csharp",
        source: "stream-programming",
        target: "stream-csharp",
        relationship: "includes",
      },
    });
    await wait(400);
    handleGraphStreamEvent({
      type: "done",
    });
  }
  // =========================================================
  // CYTOSCAPE INITIALISATION
  // Create Cytoscape once and keep the instance alive.
  // =========================================================
  useEffect(() => {
    if (!graphContainerRef.current || cyRef.current) {
      return;
    }
    const graphTheme = getGraphThemeTokens();
    const cy = cytoscape({
      container: graphContainerRef.current,
      elements: [],

      /*
        Start with an empty graph.

        Saved graphs, AI graphs and streamed graph
        elements will be inserted separately.
      */

      selectionType: "additive",
      minZoom: 0.25,
      maxZoom: 1.5,

      /*
        There is nothing to arrange yet.

        A layout will be run after graph elements
        are loaded or streamed.
      */

      layout: {
        name: "preset",
      },
      style: [

        /* =====================================================
          NORMAL NODE
          ===================================================== */

        {
          selector: "node",
          style: {
            "background-color": graphTheme.nodeBg,
            width: 110,
            height: 52,
            shape: "round-rectangle",
            label: "data(label)",
            color: graphTheme.nodeText,
            "font-size": "15px",
            "font-weight": "500",
            "font-family": "Inter, system-ui, sans-serif",
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "75px",
            "text-overflow-wrap": "whitespace",
            "text-justification": "center",
            "line-height": 1.15,
            "border-width": 2,
            "border-color": graphTheme.nodeBorder,
            "overlay-opacity": 0,
          },
        },

        /* =====================================================
          DYNAMIC NODE SIZE
          ===================================================== */

        {
          selector: "node[nodeWidth][nodeHeight]",
          style: {
            width: "data(nodeWidth)",
            height: "data(nodeHeight)",
            "text-max-width": "data(nodeTextMaxWidth)",
            "text-margin-y": "data(nodeTextMarginY)",
          },
        },

        /* =====================================================
          INVISIBLE SEMANTIC OWNER COMPOUND
          ===================================================== */

        {
          selector: 'node[graphInternal = "semantic-owner-group"]',
          style: {
            "background-opacity": 0,
            "border-width": 0,
            "border-opacity": 0,
            label: "",
            "text-opacity": 0,
            padding: 8,
            "compound-sizing-wrt-label": "exclude",
            "overlay-opacity": 0,
            events: "no",
          },
        },

        /* =====================================================
          SAVED NODE BORDER COLOUR
          ===================================================== */

        {
          selector: "node[borderColor]",
          style: {
            "border-color": "data(borderColor)",
          },
        },

        /* =====================================================
          SAVED NODE BORDER STYLE
          ===================================================== */

        {
          selector: "node[borderStyle]",
          style: {
            "border-style": "data(borderStyle)",
          },
        },

        /*
          ========================================================= SELECTED NODE
          =========================================================

          Solid outline.

          This intentionally does NOT change
          the node's actual background colour.
        */

        {
          selector: "node:selected",
          style: {
            "underlay-color": graphTheme.selectedBorder,
            "underlay-opacity": 0.28,
            "underlay-padding": 10,
          },
        },

        /* =========================================================
          LINKED RAW NOTES HOVER
          ========================================================= */

        {
          selector: "node.linked-text-hover",
          style: {
            "underlay-color": "data(linkColor)",
            "underlay-opacity": 0.38,
            "underlay-padding": 20,
          },
        },

        /*
          ========================================================= LINK SOURCE NODE
          =========================================================

          Dashed outline gives us an additional
          non-colour accessibility cue.
        */

        {
          selector: "node.link-source",
          style: {
            "border-width": 4,
            "border-style": "dashed",
            "border-color": graphTheme.linkSource,
            "overlay-color": graphTheme.linkSource,
            "overlay-opacity": 0.22,
            "overlay-padding": 8,
          },
        },

        /* =====================================================
          SAVED CUSTOM NODE COLOUR
          ===================================================== */

        {
          selector: "node[color]",
          style: {
            "background-color": "data(color)",
          },
        },
        {
          selector: "node[textColor]",
          style: {
            color: "data(textColor)",
          },
        },

        /* =====================================================
          SAVED NODE SHAPE
          ===================================================== */

        {
          selector: "node[shape]",
          style: {
            shape: "data(shape)",
          },
        },

        /* =====================================================
          CONDITIONAL NODE
          ===================================================== */

        {
          selector: 'node[nodeType = "conditional"]',
          style: {
            "background-color": CONDITIONAL_NODE_DEFAULT_COLOR,
          },
        },
        {
          selector: 'node[nodeType = "conditional"][conditionColor]',
          style: {
            "background-color": "data(conditionColor)",
          },
        },

        /* =====================================================
          NODE IMAGE FILL
          ===================================================== */

        {
          selector: "node[imageSrc]",
          style: {
            "background-image": "data(imageSrc)",
            "background-fit": "cover",
            "background-clip": "node",
            "background-opacity": 1,
            color: getThemeContrastColour(),
          },
        },
        {
          selector: "node[imageSrc][imageFit]",
          style: {
            "background-fit": "data(imageFit)",
          },
        },
        {
          selector: "node.image-label-hidden",
          style: {
            label: "",
          },
        },
        {
          selector: "node[imageSrc][color]",
          style: {
            "border-color": "data(color)",
            "border-width": 3,
          },
        },
        {
          selector: "node[imageSrc][borderColor]",
          style: {
            "border-color": "data(borderColor)",
          },
        },
        {
          selector: "node[imageSrc][textColor][textColorUserSet]",
          style: {
            color: "data(textColor)",
          },
        },

        /* =====================================================
          DEFAULT EDGE
          ===================================================== */

        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": graphTheme.edge,
            "target-arrow-color": graphTheme.edgeArrow,
            "target-arrow-shape": "triangle",
            "curve-style": "straight",
            opacity: 0.8,
            "arrow-scale": 1.1,

            /*
              Relationship label
            */

            label: "data(displayLabel)",
            color: graphTheme.edgeLabel,
            "font-size": "12px",
            "font-weight": "500",
            "text-wrap": "none",
            "text-overflow-wrap": "whitespace",

            /*
              Lift the label slightly above the edge
              rather than drawing the line through it.
            */

            "text-margin-x": 0,
            "text-margin-y": -11,

            /*
              Keep relationship text parallel to the edge.
            */

            "text-rotation": "autorotate",

            /*
              Allows clicking/double-clicking the
              label itself to count as interacting
              with the edge.
            */

            "text-events": "yes",
          },
        },
        {
          selector: "edge[relationshipMarginX][relationshipMarginY]",
          style: {
            "text-margin-x": "data(relationshipMarginX)",
            "text-margin-y": "data(relationshipMarginY)",
          },
        },
        {
          selector: 'edge[labelOrientation = "vertical"]',
          style: {
            "text-rotation": "none",
          },
        },

        /*
          ========================================================= CUSTOM EDGE COLOUR
          =========================================================
        */

        {
          selector: "edge[edgeColor]",
          style: {
            "line-color": "data(edgeColor)",
          },
        },

        /*
          ========================================================= CUSTOM ARROW COLOUR
          =========================================================
        */

        {
          selector: "edge[arrowColor]",
          style: {
            "target-arrow-color": "data(arrowColor)",
          },
        },

        /*
          ========================================================= CUSTOM ARROW SHAPE
          =========================================================
        */

        {
          selector: "edge[arrowShape]",
          style: {
            "target-arrow-shape": "data(arrowShape)",
          },
        },

        /*
          ========================================================= CUSTOM EDGE STYLE
          =========================================================
        */

        {
          selector: "edge[lineStyle]",
          style: {
            "line-style": "data(lineStyle)",
          },
        },

        /* =====================================================
          CONDITIONAL / REIFICATION EDGES
          ===================================================== */

        {
          selector: 'edge[graphInternal = "condition-owner"]',
          style: {
            width: 0.1,
            opacity: 0,
            "target-arrow-shape": "none",
            label: "",
          },
        },
        {
          selector: "edge[conditionEdge]",
          style: {
            "line-style": "dashed",
          },
        },
        {
          selector: 'edge[resolvedClassification = "prerequisite"]',
          style: {
            "line-style": "dashed",
            "text-rotation": "none",
            "text-background-color": "data(prerequisiteBadgeColor)",
            "text-background-opacity": 1,
            "text-background-padding": 5,
            "text-background-shape": "roundrectangle",
            "text-border-color": "data(prerequisiteBadgeColor)",
            "text-border-width": 1,
            "text-border-opacity": 1,
            color: "data(prerequisiteBadgeTextColor)",
            "font-weight": "650",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-qualifier-label"]',
          style: {
            width: 0.1,
            "line-opacity": 0,
            "target-arrow-shape": "none",
            "source-arrow-shape": "none",
            opacity: 1,
            label: "data(displayLabel)",
            color: graphTheme.edgeLabel,
            "text-opacity": 0.62,
            "font-size": "9px",
            "font-weight": "400",
            "text-margin-x": "data(qualifierMarginX)",
            "text-margin-y": "data(qualifierMarginY)",
            "text-rotation": "autorotate",
            events: "no",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-qualifier-label"][labelOrientation = "vertical"]',
          style: {
            "text-rotation": "none",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-prerequisite-tag"]',
          style: {
            width: 0.1,
            "line-opacity": 0,
            "target-arrow-shape": "none",
            "source-arrow-shape": "none",
            opacity: 1,
            label: "data(displayLabel)",
            color: "data(prerequisiteBadgeTextColor)",
            "font-size": "8px",
            "font-weight": "700",
            "text-margin-y": -15,
            "text-rotation": "none",
            "text-background-color": "data(prerequisiteBadgeColor)",
            "text-background-opacity": 1,
            "text-background-padding": 1,
            "text-background-shape": "roundrectangle",
            "text-border-color": "data(prerequisiteBadgeColor)",
            "text-border-width": 1,
            "text-border-opacity": 1,
            events: "no",
          },
        },
        {
          selector: 'edge[graphInternal = "edge-negative-mark"]',
          style: {
            width: 0.1,
            "line-opacity": 0,
            "target-arrow-shape": "none",
            "source-arrow-shape": "none",
            opacity: 1,
            label: "data(displayLabel)",
            color: "#ef4444",
            "font-size": "16px",
            "font-weight": "800",
            "text-margin-y": 0,
            "text-rotation": "none",
            "text-outline-color": "#111827",
            "text-outline-width": 2,
            events: "no",
          },
        },
        {
          selector: 'edge[resolvedEdgeRole = "reification"]',
          style: {
            width: 4,
            "line-color": CONDITIONAL_NODE_DEFAULT_COLOR,
            "target-arrow-color": CONDITIONAL_NODE_DEFAULT_COLOR,
            "target-arrow-shape": "triangle",
            "line-style": "solid",
            "arrow-scale": 1.25,
            color: CONDITIONAL_NODE_DEFAULT_COLOR,
            "font-weight": "700",
            opacity: 1,
          },
        },
        {
          selector: 'edge[resolvedEdgeRole = "reification"][conditionColor]',
          style: {
            "line-color": "data(conditionColor)",
            "target-arrow-color": "data(conditionColor)",
            color: "data(conditionColor)",
          },
        },
        {
          selector: 'edge[resolvedClassification = "prerequisite"]',
          style: {
            "line-style": "dashed",
          },
        },

        /* =====================================================
          ACTIVE NODE
          ===================================================== */

        {
          selector: "node:active",
          style: {
            "overlay-opacity": 0.08,
          },
        },

        /*
          ========================================================= SELECTED EDGE
          =========================================================

          Selected edges become both coloured
          AND thicker.
        */

        {
          selector: "edge:selected",
          style: {
            "underlay-color": graphTheme.selectedEdge,
            "underlay-opacity": 0.32,
            "underlay-padding": 6,
          },
        },
      ],
    });
    cyRef.current = cy;

    /*
      Size every node after the graph has been
      created or loaded.
    */

    cy.nodes().forEach(node => {
      resizeNodeToLabel(node);
    });
    cy.style().update();

    /* =========================================================
      WATCH TREE NOTES THEME / ACCESSIBILITY CHANGES
      ========================================================= */

    const themeObserver = new MutationObserver((mutations) => {
      const themeChanged = mutations.some((mutation) => mutation.attributeName === "data-theme" ||
        mutation.attributeName === "data-color-vision");
      if (!themeChanged) {
        return;
      }
      applyGraphTheme(cy);

      /*
        Keep the Selected Node toolbar colour
        consistent with the newly active theme
        when the node does not have a custom colour.
      */

      setSelectedNode((current) => {
        if (!current) {
          return current;
        }
        const currentCyNode = cy.getElementById(current.id);
        if (!currentCyNode || currentCyNode.empty()) {
          return current;
        }
        const savedColour = currentCyNode.data("color");
        return {
          ...current,
          color: savedColour || getThemeColour("--graph-node-bg", "#6366F1"),
          borderColor: currentCyNode.data("borderColor") || getThemeColour("--graph-node-border", "#818CF8"),
        };
      });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-theme",
        "data-color-vision",
      ],
    });
    // =========================================================
    // DOUBLE CLICK NODE = RENAME NODE
    // =========================================================
    cy.on("dbltap", "node", (event) => {
      const node = event.target;
      const position = node.renderedPosition();
      const zoom = cy.zoom();
      cy.elements().unselect();
      node.select();
      setSelectedNode({
        ...node.data(),
        color: node.data("color") || getThemeColour("--graph-node-bg", "#6366F1"),
        textColor: node.data("textColor") || getThemeColour("--graph-node-text", "#ffffff"),
        shape: node.data("shape") || "round-rectangle",
      });
      setSelectedEdge(null);
      const currentLabel = node.data("label") || "";
      renameOriginalValueRef.current = currentLabel;
      setRenameValue(currentLabel);
      const textMarginY = Number(node.data("nodeTextMarginY")) || 0;
      setRenamePosition({
        x: position.x,

        /*
          renderedPosition() is already in screen
          coordinates, while nodeTextMarginY is in
          graph coordinates, so scale it by zoom.
        */

        y: position.y +
          textMarginY * zoom,
      });
      setRenameZoom(zoom);

      /*
        Hide Cytoscape's painted text while
        the HTML text field sits over it.
      */

      node.style("text-opacity", 0);
      editingNodeIdRef.current = node.id();
      setEditingNodeId(node.id());
    });
    // =========================================================
    // DOUBLE CLICK EDGE = EDIT RELATIONSHIP
    // =========================================================
    cy.on("dbltap", "edge", (event) => {

      /*
        Don't start relationship editing while
        the user is actively creating a link.
      */

      if (linkModeRef.current) {
        return;
      }
      const edge = event.target;
      const sourceNode = edge.source();
      const targetNode = edge.target();
      const midpoint = edge.renderedMidpoint();
      const currentRelationship = edge.data("relationship") || "";

      /*
        Keep normal graph selection synchronised.
      */

      cy.elements().unselect();
      edge.select();
      setSelectedEdge({
        ...edge.data(),
        sourceLabel: sourceNode.data("label") || sourceNode.id(),
        targetLabel: targetNode.data("label") || targetNode.id(),
      });
      setSelectedNode(null);
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);

      /*
        Store existing value so Escape can
        effectively leave it unchanged.
      */

      relationshipOriginalValueRef.current = currentRelationship;
      setRelationshipValue(currentRelationship);
      setRelationshipPosition({
        x: midpoint.x,
        y: midpoint.y,
      });
      setRelationshipZoom(cy.zoom());

      /*
        Hide Cytoscape's normal painted label
        while our editable field is on top.
      */

      edge.style("text-opacity", 0);
      editingEdgeIdRef.current = edge.id();
      setEditingEdgeId(edge.id());
    });
    // =========================================================
    // NODE SELECTION
    // =========================================================
    cy.on("tap", "node", (event) => {
      const clickedNode = event.target;
      const shiftPressed = Boolean(event.originalEvent?.shiftKey);

      /*
        SHIFT + click toggles this node while preserving
        the rest of the current selection.

        Normal click returns to single-selection behaviour.
      */

      if (shiftPressed && !linkModeRef.current) {

        /*
          selectionType: "additive" has already toggled
          the Cytoscape selection for us.

          Wait until Cytoscape has fully settled the
          selection, then synchronise React state.
        */

        requestAnimationFrame(() => {
          syncGraphSelectionState(clickedNode);
          console.log("Graph multi-selection:", cy.$(":selected").length, "elements");
        });
        setShapeMenuOpen(false);
        setNodeBorderStyleMenuOpen(false);
        setEdgeStyleMenuOpen(false);
        setArrowShapeMenuOpen(false);
        setGraphColorPicker(null);
        return;
      }

      /*
        Cytoscape now uses additive selection.

        Wait until its own click handling has completed,
        then deliberately normalise a plain click back to
        exactly one selected element.
      */

      requestAnimationFrame(() => {

        /*
          The element might theoretically have disappeared
          before this frame, so guard against that.
        */

        if (!cyRef.current || clickedNode.removed()) {
          return;
        }
        cy.elements().unselect();
        clickedNode.select();

        /*
          React state + selectionSummary are now built
          from Cytoscape's final selection state.
        */

        syncGraphSelectionState(clickedNode);
      });
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);
      // =====================================================
      // NORMAL NODE SELECTION
      // =====================================================
      if (!linkModeRef.current) {
        console.log("Selected node:", clickedNode.data());
        return;
      }
      // =====================================================
      // LINK MODE: SELECT FIRST NODE
      // =====================================================
      if (!firstNodeToLinkRef.current) {
        firstNodeToLinkRef.current = clickedNode.id();
        setFirstNodeToLink(clickedNode.id());
        clickedNode.addClass("link-source");
        console.log("First node selected for link:", clickedNode.data("label"));
        return;
      }
      // =====================================================
      // PREVENT SELF LINK
      // =====================================================
      if (firstNodeToLinkRef.current === clickedNode.id()) {
        return;
      }
      // =====================================================
      // CREATE LINK
      // =====================================================
      const sourceId = firstNodeToLinkRef.current;
      const targetId = clickedNode.id();
      const sourceNode = cy.getElementById(sourceId);
      const sourceLabel = sourceNode.data("label") || sourceId;
      const targetLabel = clickedNode.data("label") || targetId;
      const edgeId = `manual-edge-${Date.now()}`;
      cy.add({
        group: "edges",
        data: {
          id: edgeId,
          source: sourceId,
          target: targetId,
          relationship: "",
          qualifier: "",
          classification: "",

          /*
            Manual edges start in Auto mode. If both endpoints
            are proposition targets of the same conditional node,
            TreeNotes will render this as a reification edge.
          */

          edgeRole: "auto",
        },
      });
      syncConditionalGraphSemantics(cy);
      sourceNode.removeClass("link-source");
      linkModeRef.current = false;
      firstNodeToLinkRef.current = null;
      setLinkMode(false);
      setFirstNodeToLink(null);
      showGraphFeedback(`Link created: ${sourceLabel} → ${targetLabel}`, "success");
    });
    // =========================================================
    // EDGE SELECTION
    // =========================================================
    cy.on("tap", "edge", (event) => {
      const clickedEdge = event.target;
      const shiftPressed = Boolean(event.originalEvent?.shiftKey);

      /*
        SHIFT + click toggles this edge without
        disturbing nodes or other selected edges.
      */

      if (shiftPressed) {
        requestAnimationFrame(() => {
          syncGraphSelectionState(clickedEdge);
          console.log("Graph multi-selection:", cy.$(":selected").length, "elements");
        });
        setShapeMenuOpen(false);
        setNodeBorderStyleMenuOpen(false);
        setEdgeStyleMenuOpen(false);
        setArrowShapeMenuOpen(false);
        setGraphColorPicker(null);
        return;
      }
      requestAnimationFrame(() => {
        if (!cyRef.current || clickedEdge.removed()) {
          return;
        }
        cy.elements().unselect();
        clickedEdge.select();
        syncGraphSelectionState(clickedEdge);
      });
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);
      console.log("Selected edge:", clickedEdge.data());
    });
    // =========================================================
    // BACKGROUND CLICK = DESELECT EVERYTHING
    // =========================================================
    cy.on("tap", (event) => {

      /*
        Cytoscape core itself is the event target
        when the empty graph background is clicked.

        Node and edge taps also bubble through here,
        so only clear selection when target === cy.
      */

      if (event.target !== cy) {
        return;
      }
      cy.elements().unselect();
      setSelectedNode(null);
      setSelectedEdge(null);
      setSelectionSummary({
        nodes: [],
        edges: [],
      });
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);
      console.log("Graph selection cleared");
    });

    /* =========================================================
       KEEP INLINE NODE RENAME SYNCED WITH GRAPH
       ========================================================= */

    function syncRenameOverlay() {
      const nodeId = editingNodeIdRef.current;
      if (!nodeId) {
        return;
      }
      const node = cy.getElementById(nodeId);
      if (!node || node.empty()) {
        return;
      }
      const position = node.renderedPosition();
      const zoom = cy.zoom();
      const textMarginY = Number(node.data("nodeTextMarginY")) || 0;
      setRenamePosition({
        x: position.x,
        y: position.y +
          textMarginY * zoom,
      });
      setRenameZoom(cy.zoom());
    }

    /* =========================================================
       KEEP EDGE RELATIONSHIP EDITOR SYNCED WITH GRAPH
       ========================================================= */

    function syncRelationshipOverlay() {
      const edgeId = editingEdgeIdRef.current;
      if (!edgeId) {
        return;
      }
      const edge = cy.getElementById(edgeId);
      if (!edge || edge.empty()) {
        return;
      }
      const midpoint = edge.renderedMidpoint();
      setRelationshipPosition({
        x: midpoint.x,
        y: midpoint.y,
      });
      setRelationshipZoom(cy.zoom());
    }

    /*
      Keep the HTML rename field aligned with the
      Cytoscape node while zooming or panning.
    */

    cy.on("zoom pan", syncRenameOverlay);
    cy.on("zoom pan", syncRelationshipOverlay);
    cy.on("drag position", "node", () => {
      syncRelationshipOverlay();
      syncEdgeLabelGeometry(cy);
    });

    /*
      Keep it aligned if the node itself is dragged
      while it is being renamed.
    */

    cy.on("drag", "node", (event) => {
      if (event.target.id() === editingNodeIdRef.current) {
        syncRenameOverlay();
      }

      /*
        Dragging a semantic owner moves its conditional companions with it.
        The invisible compound keeps them structurally grouped, while this
        small positional rule preserves the clean side-by-side mind-map look.
      */

      if (!event.target.data("graphInternal") &&
        normaliseNodeType(event.target.data("nodeType"), event.target.data("conditionOwnerId")) !== "conditional") {
        positionSemanticOwnerGroup(event.target, cy);
      }
    });
    cy.on("free", "node", (event) => {
      if (event.target.data("graphInternal")) {
        return;
      }
      const releasedNode = event.target;
      const releasedIsConditional = normaliseNodeType(releasedNode.data("nodeType"), releasedNode.data("conditionOwnerId")) === "conditional";
      if (releasedIsConditional) {
        const ownerId = String(releasedNode.data("conditionOwnerId") || "").trim();
        const ownerNode = ownerId ? cy.getElementById(ownerId) : null;

        /*
          Do not snap a conditional back to its automatic slot. Capture the
          user's new offset instead. Moving the owner later will preserve this
          relative placement, giving the cluster a flexible mind-map feel.
        */

        if (ownerNode && !ownerNode.empty()) {
          const conditionPosition = releasedNode.position();
          const ownerPosition = ownerNode.position();
          releasedNode.data({
            conditionPlacement: "manual",
            conditionOffsetX: conditionPosition.x -
              ownerPosition.x,
            conditionOffsetY: conditionPosition.y -
              ownerPosition.y,
          });
        }
      } else {

        /*
          If the semantic owner itself moved, keep all conditional companions
          at their saved automatic/manual offsets around it.
        */

        positionSemanticOwnerGroup(releasedNode, cy);
      }
      syncRelationshipOverlay();
      syncEdgeLabelGeometry(cy);
    });
    return () => {
      themeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);
  // =========================================================
  // LOAD GRAPH DATA INTO EXISTING CYTOSCAPE INSTANCE
  // =========================================================
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes.map(nodeElement => {
        const rawData = nodeElement?.data ?? nodeElement ?? {};
        return nodeElement?.data ? {
            ...nodeElement,
            data: normaliseIncomingNodeData(rawData),
          } : {
            group: "nodes",
            data: normaliseIncomingNodeData(rawData),
          };
      }) : [];
    const rawEdges = Array.isArray(graphData?.edges) ? graphData.edges : [];
    const edgeMap = new Map();
    rawEdges.forEach(edgeElement => {
      const rawData = edgeElement?.data ?? edgeElement ?? {};
      expandIncomingEdgeData(rawData).forEach(expandedData => {
        const edgeId = String(expandedData.id ||
          `loaded-edge-${expandedData.source}-${expandedData.target}-${expandedData.relationship || "link"}`);
        edgeMap.set(edgeId, edgeElement?.data ? {
            ...edgeElement,
            group: "edges",
            data: {
              ...expandedData,
              id: edgeId,
            },
          } : {
            group: "edges",
            data: {
              ...expandedData,
              id: edgeId,
            },
          });
      });
    });
    const edges = Array.from(edgeMap.values());

    /*
      Determine whether this graph came from the database
      with saved node positions.
    */

    const hasSavedPositions = nodes.length > 0 && nodes.every((node) => Number.isFinite(node?.position?.x) &&
        Number.isFinite(node?.position?.y));

    /*
      Replace the currently displayed graph without
      destroying Cytoscape itself.
    */

    cy.batch(() => {
      cy.elements().remove();
      if (nodes.length > 0 || edges.length > 0) {
        cy.add([
          ...nodes,
          ...edges,
        ]);
      }
    });

    /*
      Apply TreeNotes node auto-sizing to newly
      inserted nodes.
    */

    cy.nodes().forEach((node) => {
      resizeNodeToLabel(node);
      syncImageNodePresentation(node);
    });
    syncConditionalGraphSemantics(cy);
    applyGraphTheme(cy);
    cy.style().update();

    /*
      Nothing else needs doing for an empty graph.
    */

    if (cy.elements().empty()) {
      return;
    }

    /*
      Saved graphs retain their positions.

      Fresh AI graphs get automatically arranged. Renderer-only semantic
      owner compounds are rebuilt from conditionOwnerId before layout.
    */

    const layout = cy.layout(hasSavedPositions ? {
        name: "preset",
        fit: true,
        padding: 50,
      } : {
        name: "cose",
        animate: true,
        fit: true,
        padding: 50,
      });
    layout.one("layoutstop", () => {
      cy.resize();
      positionAllSemanticOwnerGroups(cy);
      fitVisibleGraph(cy, 50);
    });
    layout.run();
  }, [graphData]);

  function addSelectedTextNode() {
    if (!cyRef.current || !selectedText) {
      return;
    }
    const cy = cyRef.current;
    const nodeAlreadyExists = cy.nodes().some((node) => {
      return (node.data("label")?.trim().toLowerCase() === selectedText.trim().toLowerCase());
    });
    if (nodeAlreadyExists) {
      console.log("Node already exists:", selectedText);
      return;
    }
    const newNodeId = typeof crypto.randomUUID === "function" ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}-${Math.random()}`;
    const extent = cy.extent();
    const centreX = (extent.x1 + extent.x2) / 2;
    const centreY = (extent.y1 + extent.y2) / 2;
    const newNode = cy.add({
      group: "nodes",
      data: {
        id: newNodeId,
        label: selectedText,
        nodeType: "standard",
      },
      position: {
        x: centreX + 60,
        y: centreY + 60,
      },
    });
    resizeNodeToLabel(newNode);
  }
  useEffect(() => {
    if (addNodeTrigger === 0) {
      return;
    }
    addSelectedTextNode();
  }, [addNodeTrigger]);
  // getting latest graph with all the chnages
  function getEditedGraphData({ includeNodeImages = true, } = {}) {
    if (!cyRef.current) {
      return null;
    }
    const cy = cyRef.current;
    const nodes = cy.nodes()
      .filter(node => !node.data("graphInternal"))
      .map((node) => {
        const data = {
          ...node.data(),
        };

        /*
          Cytoscape stores compound membership in data.parent. The invisible
          semantic owner group is presentation-only, so never persist that
          renderer-only ID in graph_json. conditionOwnerId remains the semantic
          source of truth and rebuilds the grouping when the graph loads.
        */

        delete data.parent;
        delete data.graphInternal;

        /*
          Semantic graph search only needs conceptual graph data.
          Never send large base64 image payloads to the embedding/search
          endpoint. Saving still uses the default includeNodeImages=true.
        */

        if (!includeNodeImages) {
          delete data.imageSrc;
          delete data.imageMime;
          delete data.imageName;
          delete data.imageWidth;
          delete data.imageHeight;
          delete data.imageOriginalWidth;
          delete data.imageOriginalHeight;
          delete data.imageStoredBytes;
          delete data.imageFit;
        }
        return {
          data,
          position: {
            x: node.position("x"),
            y: node.position("y"),
          },
        };
      });
    const edges = cy.edges()
      .filter(edge => !edge.data("graphInternal"))
      .map((edge) => {
        const data = {
          ...edge.data(),
        };

        /*
          These fields are renderer/layout derivatives. Rebuild them
          when the graph loads so saved JSON remains semantic and clean.
        */

        delete data.displayLabel;
        delete data.resolvedEdgeRole;
        delete data.resolvedClassification;
        delete data.conditionColor;
        delete data.conditionEdge;
        delete data.graphInternal;
        return {
          data,
        };
      });
    return {
      nodes,
      edges,
    };
  }

  /*
    Graph persistence is handled by NoteWorkspace.saveEverything().
    That keeps title, Raw Notes, rich HTML, summary and graph_json
    inside one atomic PATCH request.
  */

  function startLinkMode() {

    /*
      Clicking the active Link button
      again cancels link mode.
    */

    if (linkModeRef.current) {
      cancelLinkMode();
      return;
    }
    cyRef.current ?.nodes()
      .removeClass("link-source");
    linkModeRef.current = true;
    firstNodeToLinkRef.current = null;
    setLinkMode(true);
    setFirstNodeToLink(null);
    setGraphFeedback(null);
  }

  function cancelLinkMode() {
    cyRef.current ?.nodes()
      .removeClass("link-source");
    linkModeRef.current = false;
    firstNodeToLinkRef.current = null;
    setLinkMode(false);
    setFirstNodeToLink(null);
  }

  function createLinkedTextNode(label, linkColor) {
    if (!cyRef.current || !label?.trim()) {
      return null;
    }
    const cy = cyRef.current;

    /*
      If this concept already exists, link to the
      existing node instead of making a duplicate.
    */

    const existingNodes = cy.nodes().filter((node) => {
      return (node.data("label")?.trim().toLowerCase() === label.trim().toLowerCase());
    });
    if (existingNodes.length > 0) {
      const existingNode = existingNodes[0];
      existingNode.data("linkColor", linkColor);
      return existingNode.id();
    }
    const newNodeId = typeof crypto.randomUUID === "function" ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}`;
    const extent = cy.extent();
    const centreX = (extent.x1 + extent.x2) / 2;
    const centreY = (extent.y1 + extent.y2) / 2;
    const newNode = cy.add({
      group: "nodes",
      data: {
        id: newNodeId,
        label: label,
        nodeType: "standard",
      },
      position: {
        x: centreX + 60,
        y: centreY + 60,
      },
    });
    resizeNodeToLabel(newNode);
    return newNodeId;
  }

  function focusNode(nodeId) {
    if (!cyRef.current) {
      return false;
    }
    const cy = cyRef.current;
    const node = cy.getElementById(nodeId);
    if (!node || node.empty()) {
      return false;
    }
    cy.elements().unselect();
    node.select();
    setSelectedNode({
      ...node.data(),
    });
    setSelectedEdge(null);
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    cy.animate({
      center: {
        eles: node,
      },
      zoom: Math.max(cy.zoom(), 1.35),
    }, {
      duration: 350,
    });
    return true;
  }

  function setLinkedNodeHover(nodeId, color, isHovered) {
    if (!cyRef.current) {
      return;
    }
    const node = cyRef.current.getElementById(nodeId);
    if (!node || node.empty()) {
      return;
    }
    if (isHovered) {
      node.data("linkColor", color);

      /*
        Use a class instead of direct style overrides.

        This allows normal selected styling to return
        automatically after hover ends.
      */

      node.addClass("linked-text-hover");
    } else {
      node.removeClass("linked-text-hover");
    }
  }

  function setLinkedNodeColor(nodeId, color) {
    if (!cyRef.current) {
      return;
    }
    const node = cyRef.current.getElementById(nodeId);
    if (!node || node.empty()) {
      return;
    }
    node.data("linkColor", color);

    /*
      If the node is currently being hovered,
      Cytoscape automatically refreshes the
      linked-text-hover halo from data(linkColor).
    */

    node.updateStyle();
  }

  function getSelectedCyNodes() {
    if (!cyRef.current) {
      return null;
    }
    const nodes = cyRef.current.nodes(":selected");
    return (nodes.length > 0 ? nodes : null);
  }

  function getSelectedCyEdges() {
    if (!cyRef.current) {
      return null;
    }
    const edges = cyRef.current.edges(":selected");
    return (edges.length > 0 ? edges : null);
  }

  function buildSelectedNodeData(node) {
    if (!node || node.empty()) {
      return null;
    }
    return {
      ...node.data(),
      color: node.data("color") || getThemeColour("--graph-node-bg", "#6366F1"),
      textColor: node.data("textColor") || getThemeColour("--graph-node-text", "#ffffff"),
      shape: node.data("shape") || "round-rectangle",
    };
  }

  function buildSelectedEdgeData(edge) {
    if (!edge || edge.empty()) {
      return null;
    }
    const sourceNode = edge.source();
    const targetNode = edge.target();
    return {
      ...edge.data(),
      sourceLabel: sourceNode.data("label") || sourceNode.id(),
      targetLabel: targetNode.data("label") || targetNode.id(),
    };
  }

  function getReificationProposition(cy, endpointNode, conditionId) {
    if (!cy || !endpointNode || endpointNode.empty?.() || !conditionId) {
      return null;
    }

    /*
      Find proposition edges in the same conditional scope
      that terminate at this endpoint.

      Example:

        When temperatures fall -> Shelter
               seeks

      For the reification edge:

        Shelter -> Body heat
               allowing
    */

    const matchingEdges = cy
      .edges()
      .filter((candidate) => {
        if (isInternalConditionOwnerEdge(candidate)) {
          return false;
        }
        const candidateRole = candidate.data("resolvedEdgeRole") || normaliseEdgeRole(candidate.data("edgeRole"));

        /*
          Never use another reification edge
          as the proposition source.
        */

        if (candidateRole === "reification") {
          return false;
        }
        const candidateConditionId = String(candidate.data("conditionId") || "").trim();
        return (candidate.target().id() === endpointNode.id() && candidateConditionId === conditionId);
      });
    if (!matchingEdges || matchingEdges.length === 0) {
      return null;
    }

    /*
      Prefer an edge coming directly from the
      condition node itself.

      This makes the lookup deterministic if a
      large graph happens to contain multiple
      edges targeting the same node.
    */

    const directConditionEdges = matchingEdges.filter(candidate => candidate.source().id() === conditionId);
    const propositionEdge = directConditionEdges.length > 0 ? directConditionEdges.first() : matchingEdges.first();
    if (!propositionEdge || propositionEdge.empty()) {
      return null;
    }
    const sourceNode = propositionEdge.source();
    const sourceNodeType = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId"));

    /*
      Normally the proposition edge starts from
      the conditional node.

      Instead of displaying:

        When temperatures fall seeks Shelter

      resolve that condition's owner:

        Lizards seeks Shelter
    */

    let subjectLabel = sourceNode.data("label") || sourceNode.id();
    if (sourceNodeType === "conditional") {
      const ownerId = String(sourceNode.data("conditionOwnerId") || "").trim();
      if (ownerId) {
        const ownerNode = cy.getElementById(ownerId);
        if (ownerNode && !ownerNode.empty()) {
          subjectLabel = ownerNode.data("label") || ownerNode.id();
        }
      }
    }
    return {
      subject: subjectLabel,
      relationship: String(propositionEdge.data("relationship") || "").trim(),
      qualifier: String(propositionEdge.data("qualifier") || "").trim(),
      object: endpointNode.data("label") || endpointNode.id(),
      edgeId: propositionEdge.id(),
    };
  }

  function formatProposition(proposition) {
    if (!proposition) {
      return "";
    }
    return [
      proposition.subject,
      proposition.relationship,
      proposition.object,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function syncGraphSelectionState(preferredElement = null) {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const selectedNodes = cy.nodes(":selected");
    const selectedEdges = cy.edges(":selected");

    /*
      Keep a React-friendly summary of the entire
      Cytoscape selection.

      selectedNode / selectedEdge remain representative
      items for toolbar controls.
    */

    setSelectionSummary({
      nodes: selectedNodes.map((node) => {
        const nodeType = normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId"));
        const ownerId = String(node.data("conditionOwnerId") || "").trim();
        let ownerLabel = "";
        if (ownerId) {
          const ownerNode = cy.getElementById(ownerId);
          if (ownerNode && !ownerNode.empty()) {
            ownerLabel = ownerNode.data("label") || ownerNode.id();
          }
        }
        return {
          id: node.id(),
          label: node.data("label") || node.id(),
          nodeType,
          conditionOwnerId: ownerId,
          conditionOwnerLabel: ownerLabel,
          hasImage: Boolean(node.data("imageSrc")),
        };
      }),
      edges: selectedEdges
        .filter(edge => !isInternalConditionOwnerEdge(edge))
        .map((edge) => {
          const sourceNode = edge.source();
          const targetNode = edge.target();
          const actualSourceLabel = sourceNode.data("label") || sourceNode.id();
          const targetLabel = targetNode.data("label") || targetNode.id();
          const conditionId = String(edge.data("conditionId") || "").trim();
          let conditionLabel = "";
          if (conditionId) {
            const conditionNode = cy.getElementById(conditionId);
            if (conditionNode && !conditionNode.empty()) {
              conditionLabel = conditionNode.data("label") || conditionNode.id();
            }
          }

          /*
            If this edge comes directly out of a
            conditional node, display the condition's
            semantic owner instead.

            Actual graph:
              When temperatures fall -> Shelter

            Selection panel:
              Lizards -> Shelter
              seeks
              Scope: When temperatures fall
          */

          const sourceNodeType = normaliseNodeType(sourceNode.data("nodeType"), sourceNode.data("conditionOwnerId"));
          const conditionOwnerId = String(sourceNode.data("conditionOwnerId") || "").trim();
          let semanticSourceLabel = actualSourceLabel;
          let conditionalSource = false;
          if (sourceNodeType === "conditional" && conditionOwnerId) {
            const ownerNode = cy.getElementById(conditionOwnerId);
            if (ownerNode && !ownerNode.empty()) {
              semanticSourceLabel = ownerNode.data("label") || ownerNode.id();
              conditionalSource = true;
            }
          }
          const resolvedClassification = edge.data("resolvedClassification") ||
            normaliseEdgeClassification(edge.data("classification"));
          const resolvedEdgeRole = edge.data("resolvedEdgeRole") || normaliseEdgeRole(edge.data("edgeRole"));

          /*
            Reification edges get additional semantic
            information reconstructed from their linked
            proposition edges.
          */

          let sourceProposition = null;
          let targetProposition = null;
          if (resolvedEdgeRole === "reification" && conditionId) {
            sourceProposition = getReificationProposition(cy, sourceNode, conditionId);
            targetProposition = getReificationProposition(cy, targetNode, conditionId);
          }
          return {
            id: edge.id(),

            /*
              sourceLabel is the human-readable semantic
              source used by the selection card.
            */

            sourceLabel: semanticSourceLabel,

            /*
              Keep the real graph endpoint too in case it
              is useful elsewhere later.
            */

            actualSourceLabel,
            targetLabel,
            conditionalSource,
            conditionOwnerId,
            relationship: String(edge.data("relationship") || "").trim(),
            qualifier: String(edge.data("qualifier") || "").trim(),
            classification: resolvedClassification,
            edgeRole: resolvedEdgeRole,
            conditionId,
            conditionLabel,
            sourceProposition,
            targetProposition,
          };
        }),
    });

    /*
      For toolbar indicators, use the element most
      recently clicked when possible.

      Otherwise use the final selected element.
    */

    let representativeNode = null;
    if (preferredElement?.isNode?.() && preferredElement.selected()) {
      representativeNode = preferredElement;
    } else if (selectedNodes.length > 0) {
      representativeNode = selectedNodes[selectedNodes.length - 1];
    }
    let representativeEdge = null;
    if (preferredElement?.isEdge?.() && preferredElement.selected()) {
      representativeEdge = preferredElement;
    } else if (selectedEdges.length > 0) {
      representativeEdge = selectedEdges[selectedEdges.length - 1];
    }
    setSelectedNode(representativeNode ? buildSelectedNodeData(representativeNode) : null);
    setSelectedEdge(representativeEdge ? buildSelectedEdgeData(representativeEdge) : null);
  }

  function changeSelectedNodeColor(newColor) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("color", newColor);
      if (normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional") {
        node.data({
          conditionColor: newColor,
          conditionColorAuto: false,
        });
      }
      node.updateStyle();
    });
    syncConditionalGraphSemantics(cyRef.current);

    /*
      Keep the toolbar representative in sync.
    */

    setSelectedNode(current => current ? {
        ...current,
        color: newColor,
      } : current);
  }

  function getSingleNodeForImageEdit(nodeId = null) {
    const cy = cyRef.current;
    if (!cy) {
      return null;
    }
    if (nodeId) {
      const node = cy.getElementById(String(nodeId));
      return (node && !node.empty() ? node : null);
    }
    const selected = cy.$(":selected");
    if (selected.length !== 1 || !selected[0]?.isNode?.()) {
      return null;
    }
    return selected[0];
  }
  async function attachImageToNode(file, nodeId = null) {
    const targetNode = getSingleNodeForImageEdit(nodeId);
    if (!targetNode) {
      showGraphFeedback("Select exactly one node before attaching an image.", "error");
      return false;
    }
    const targetNodeId = targetNode.id();
    const targetNoteId = loadedGraphNoteIdRef.current;
    showGraphFeedback("Processing node image...", "info");
    try {
      const processed = await processNodeImageFile(file);
      const cy = cyRef.current;
      if (!cy || loadedGraphNoteIdRef.current !== targetNoteId) {
        return false;
      }
      const node = cy.getElementById(targetNodeId);
      if (!node || node.empty()) {
        showGraphFeedback("That node no longer exists.", "error");
        return false;
      }
      node.data({
        imageSrc: processed.dataUrl,
        imageMime: processed.mime,
        imageName: file.name || "Pasted image",
        imageWidth: processed.width,
        imageHeight: processed.height,
        imageOriginalWidth: processed.originalWidth,
        imageOriginalHeight: processed.originalHeight,
        imageStoredBytes: processed.storedBytes,
        imageFit: node.data("imageFit") || "cover",
        imageSize: node.data("imageSize") || NODE_IMAGE_DEFAULT_SIZE,
        imagePositionX: `${getImagePositionPercent(node.data("imagePositionX"), NODE_IMAGE_DEFAULT_POSITION_X)}%`,
        imagePositionY: `${getImagePositionPercent(node.data("imagePositionY"), NODE_IMAGE_DEFAULT_POSITION_Y)}%`,
        showImageLabel: node.data("showImageLabel") !== false,
      });
      resizeNodeToLabel(node);
      syncImageNodePresentation(node);
      syncImageNodeDefaultTextColours(cy);
      node.updateStyle();
      cy.style().update();
      if (node.selected()) {
        syncGraphSelectionState(node);
      }
      showGraphFeedback(`Image attached to ${node.data("label") ||
        "node"} (${formatNodeImageBytes(processed.storedBytes)})`, "success");
      return true;
    }
    catch (error) {
      console.error("Unable to attach node image:", error);
      showGraphFeedback(error?.message || "Unable to attach that image.", "error");
      return false;
    }
  }

  function openNodeImageModal() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before editing its image.", "error");
      return;
    }
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setNodeImageModalOpen(true);
  }

  function closeNodeImageModal() {
    setNodeImageModalOpen(false);
  }

  function changeSelectedNodeImageFit(imageFit) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc") || !["cover", "contain"].includes(imageFit)) {
      return;
    }
    node.data("imageFit", imageFit);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
  }

  function changeSelectedNodeImageSize(imageSize) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc") || !NODE_IMAGE_SIZE_PRESETS[imageSize]) {
      return;
    }
    node.data("imageSize", imageSize);
    resizeNodeToLabel(node);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
  }

  function changeSelectedNodeImagePosition(x, y) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc")) {
      return;
    }
    const safeX = clampImagePosition(x);
    const safeY = clampImagePosition(y);
    node.data({
      imagePositionX: `${safeX}%`,
      imagePositionY: `${safeY}%`,
    });
    node.updateStyle();
    cyRef.current ?.style()
      .update();
    syncGraphSelectionState(node);
  }

  function resetSelectedNodeImagePosition() {
    changeSelectedNodeImagePosition(NODE_IMAGE_DEFAULT_POSITION_X, NODE_IMAGE_DEFAULT_POSITION_Y);
  }

  function changeSelectedNodeImageLabelVisibility(visible) {
    const node = getSingleNodeForImageEdit();
    if (!node || !node.data("imageSrc")) {
      return;
    }
    node.data("showImageLabel", Boolean(visible));
    syncImageNodePresentation(node);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
  }

  function openNodeImagePicker() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before attaching an image.", "error");
      return;
    }
    nodeImageTargetIdRef.current = node.id();
    nodeImageInputRef.current ?.click();
  }

  function handleNodeImageFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    const targetNodeId = nodeImageTargetIdRef.current;
    nodeImageTargetIdRef.current = null;

    /*
      Reset the native input so choosing the same file again still
      fires a change event after a remove/replace operation.
    */

    event.target.value = "";
    if (!file || !targetNodeId) {
      return;
    }
    void attachImageToNode(file, targetNodeId);
  }

  function removeImageFromSelectedNode() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before removing an image.", "error");
      return;
    }
    if (!node.data("imageSrc")) {
      return;
    }
    [
      "imageSrc",
      "imageMime",
      "imageName",
      "imageWidth",
      "imageHeight",
      "imageOriginalWidth",
      "imageOriginalHeight",
      "imageStoredBytes",
      "imageFit",
      "imageSize",
      "showImageLabel",
    ].forEach(key => node.removeData(key));
    resizeNodeToLabel(node);
    syncImageNodePresentation(node);
    node.updateStyle();
    cyRef.current?.style().update();
    syncGraphSelectionState(node);
    showGraphFeedback(`Removed image from ${node.data("label") || "node"}`, "success");
  }

  function handleNodeRenameImagePaste(event) {
    const imageFile = getClipboardImageFile(event);
    if (!imageFile) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void attachImageToNode(imageFile, editingNodeIdRef.current || editingNodeId);
  }

  function startNodeImagePreviewDrag(event) {
    if (event.button !== 0 || !selectedNode?.imageSrc || selectedNode.imageFit === "contain") {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const startX = getImagePositionPercent(selectedNode.imagePositionX, NODE_IMAGE_DEFAULT_POSITION_X);
    const startY = getImagePositionPercent(selectedNode.imagePositionY, NODE_IMAGE_DEFAULT_POSITION_Y);
    imagePreviewDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX,
      startY,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
    target.setPointerCapture?.(event.pointerId);
    setImagePreviewDragging(true);
  }

  function moveNodeImagePreviewDrag(event) {
    const drag = imagePreviewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();

    /*
      With cover, increasing background-position
      shifts the visible crop toward the opposite
      side of the oversized image.

      Subtracting the drag delta makes this behave
      like physically grabbing the photograph.
    */

    const deltaX = (event.clientX -
      drag.startClientX) /
      drag.width *
      100;
    const deltaY = (event.clientY -
      drag.startClientY) /
      drag.height *
      100;
    changeSelectedNodeImagePosition(drag.startX -
      deltaX, drag.startY -
    deltaY);
  }

  function finishNodeImagePreviewDrag(event) {
    const drag = imagePreviewDragRef.current;
    if (!drag) {
      return;
    }
    if (event.currentTarget
      .hasPointerCapture?.(event.pointerId)) {
      event.currentTarget
        .releasePointerCapture(event.pointerId);
    }
    imagePreviewDragRef.current = null;
    setImagePreviewDragging(false);
  }

  function changeSelectedNodeShape(newShape) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("shape", newShape);
      node.updateStyle();

      /*
        Different shapes require different dimensions.
      */

      resizeNodeToLabel(node);
    });
    setSelectedNode(current => current ? {
        ...current,
        shape: newShape,
      } : current);
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
  }

  function changeSelectedNodeBorderColor(newColor) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("borderColor", newColor);
      if (normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional") {
        node.data("conditionBorderAuto", false);
      }
      node.updateStyle();
    });
    setSelectedNode(current => current ? {
        ...current,
        borderColor: newColor,
      } : current);
  }

  function changeSelectedNodeBorderStyle(newStyle) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data("borderStyle", newStyle);
      node.updateStyle();
    });
    setSelectedNode(current => current ? {
        ...current,
        borderStyle: newStyle,
      } : current);
    setNodeBorderStyleMenuOpen(false);
  }

  function changeSelectedEdgeColor(colour) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("edgeColor", colour);
      edge.updateStyle();
    });
    setSelectedEdge(current => current ? {
        ...current,
        edgeColor: colour,
      } : current);

    /*
      Prerequisite badges inherit the selected edge colour, so refresh the
      derived badge and annotation presentation immediately.
    */

    syncConditionalGraphSemantics(cyRef.current);
  }

  function changeSelectedEdgeStyle(lineStyle) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("lineStyle", lineStyle);
      edge.updateStyle();
    });
    setSelectedEdge(current => current ? {
        ...current,
        lineStyle,
      } : current);
    setEdgeStyleMenuOpen(false);
  }

  function changeSelectedArrowColor(colour) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("arrowColor", colour);
      edge.updateStyle();
    });

    /*
      Keep the toolbar indicator synced with
      the most recently selected / representative edge.
    */

    setSelectedEdge(current => current ? {
        ...current,
        arrowColor: colour,
      } : current);
  }

  function changeSelectedArrowShape(shape) {
    const edges = getSelectedCyEdges();
    if (!edges) {
      return;
    }
    edges.forEach(edge => {
      edge.data("arrowShape", shape);
      edge.updateStyle();
    });
    setSelectedEdge(current => current ? {
        ...current,
        arrowShape: shape,
      } : current);
    setArrowShapeMenuOpen(false);
  }

  /* =========================================================
     NODE / EDGE SEMANTIC PROPERTIES
     ========================================================= */

  function getNodePropertyOptions(excludedNodeId = "") {
    const cy = cyRef.current;
    if (!cy) {
      return [];
    }
    return cy.nodes()
      .filter(node => !node.data("graphInternal") && node.id() !== excludedNodeId &&
        normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) !== "conditional")
      .map(node => ({
        id: node.id(),
        label: node.data("label") || node.id(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function getConditionalPropertyOptions() {
    return getConditionalNodes()
      .map(node => ({
        id: node.id(),
        label: node.data("label") || node.id(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function getSingleSelectedEdgeForProperties(edgeId = "") {
    const cy = cyRef.current;
    if (!cy) {
      return null;
    }
    if (edgeId) {
      const edge = cy.getElementById(edgeId);
      return (edge && !edge.empty() && edge.isEdge() && !isInternalConditionOwnerEdge(edge)) ? edge : null;
    }
    const selectedEdges = cy.edges(":selected")
      .filter(edge => !isInternalConditionOwnerEdge(edge));
    return selectedEdges.length === 1 ? selectedEdges[0] : null;
  }

  function closeNodePropertiesModal() {
    setNodePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setNodeOwnerSearch("");
  }

  function closeEdgePropertiesModal() {
    setEdgePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setEdgeConditionSearch("");
  }

  function openNodePropertiesModal() {
    const node = getSingleNodeForImageEdit();
    if (!node) {
      showGraphFeedback("Select exactly one node before editing node properties.", "error");
      return;
    }
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setEdgePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setNodeOwnerSearch("");
    setNodePropertiesDraft({
      nodeId: node.id(),
      nodeType: normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")),
      conditionOwnerId: String(node.data("conditionOwnerId") || ""),
    });
    setNodePropertiesModalOpen(true);
  }

  function saveNodeProperties() {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const node = cy.getElementById(nodePropertiesDraft.nodeId);
    if (!node || node.empty()) {
      closeNodePropertiesModal();
      return;
    }
    const nextNodeType = normaliseNodeType(nodePropertiesDraft.nodeType);
    const ownerId = String(nodePropertiesDraft.conditionOwnerId || "").trim();
    if (nextNodeType === "conditional" && !ownerId) {
      showGraphFeedback("Choose a parent / owner node for this conditional.", "error");
      return;
    }
    if (nextNodeType === "conditional" && ownerId === node.id()) {
      showGraphFeedback("A conditional node cannot use itself as its parent.", "error");
      return;
    }
    if (nextNodeType === "conditional") {
      const ownerNode = cy.getElementById(ownerId);
      if (!ownerNode || ownerNode.empty()) {
        showGraphFeedback("That parent node no longer exists.", "error");
        return;
      }
      const wasConditional = normaliseNodeType(node.data("nodeType"), node.data("conditionOwnerId")) === "conditional";
      const previousOwnerId = String(node.data("conditionOwnerId") || "").trim();
      if (!wasConditional || previousOwnerId !== ownerId) {
        node.data("conditionPlacement", "auto");
        node.removeData("conditionOffsetX");
        node.removeData("conditionOffsetY");
      }
      const conditionColour = wasConditional ? getConditionalNodeColour(node)
        : getNextConditionalPaletteColour(cy, node.id());
      const useAutomaticBorder = !wasConditional || node.data("conditionBorderAuto") === true ||
        !node.data("borderColor");
      node.data({
        nodeType: "conditional",
        conditionOwnerId: ownerId,
        conditionColor: conditionColour,
        conditionColorAuto: wasConditional ? Boolean(node.data("conditionColorAuto")) : true,
        color: conditionColour,
        textColor: wasConditional ? node.data("textColor") || CONDITIONAL_NODE_DEFAULT_TEXT_COLOR
          : CONDITIONAL_NODE_DEFAULT_TEXT_COLOR,
        borderColor: useAutomaticBorder ? getConditionalDefaultBorderColour() : node.data("borderColor"),
        conditionBorderAuto: useAutomaticBorder,
      });
      syncConditionalGraphSemantics(cy);
      placeConditionalNextToOwner(node);
    } else {
      const oldConditionColour = node.data("conditionColor");
      const oldConditionBorderWasAuto = node.data("conditionBorderAuto") === true;
      node.data("nodeType", "standard");
      node.removeData("conditionOwnerId");
      node.removeData("conditionColor");
      node.removeData("conditionColorAuto");
      node.removeData("conditionBorderAuto");
      node.removeData("conditionPlacement");
      node.removeData("conditionOffsetX");
      node.removeData("conditionOffsetY");
      if (oldConditionColour && node.data("color") === oldConditionColour) {
        node.data("color", getThemeColour("--graph-node-bg", "#6366F1"));
      }
      if (oldConditionBorderWasAuto || (oldConditionColour && node.data("borderColor") === oldConditionColour)) {
        node.data("borderColor", getThemeColour("--graph-node-border", "#818CF8"));
      }
      if (node.data("textColor") === CONDITIONAL_NODE_DEFAULT_TEXT_COLOR) {
        node.data("textColor", getThemeColour("--graph-node-text", "#ffffff"));
      }
      syncConditionalGraphSemantics(cy);
    }
    resizeNodeToLabel(node);
    node.updateStyle();
    syncGraphSelectionState(node);
    setNodePropertiesModalOpen(false);
    showGraphFeedback(nextNodeType === "conditional" ? "Conditional node properties saved"
      : "Node properties saved", "success");
  }

  function openEdgePropertiesModal() {
    const edge = getSingleSelectedEdgeForProperties();
    if (!edge) {
      showGraphFeedback("Select exactly one edge before editing edge properties.", "error");
      return;
    }
    syncConditionalGraphSemantics(edge.cy());
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setNodePropertiesModalOpen(false);
    setPropertyDropdownOpen(null);
    setEdgeConditionSearch("");
    setEdgePropertiesDraft({
      edgeId: edge.id(),
      relationship: String(edge.data("relationship") || ""),
      qualifier: String(edge.data("qualifier") || ""),
      classification: normaliseEdgeClassification(edge.data("classification")),
      edgeRole: normaliseEdgeRole(edge.data("edgeRole"), edge.data("isReification") === true ||
        edge.data("reification") === true),
      conditionId: String(edge.data("conditionId") || ""),
    });
    setEdgePropertiesModalOpen(true);
  }

  function saveEdgeProperties() {
    const edge = getSingleSelectedEdgeForProperties(edgePropertiesDraft.edgeId);
    if (!edge) {
      closeEdgePropertiesModal();
      return;
    }
    const nextRole = normaliseEdgeRole(edgePropertiesDraft.edgeRole);
    edge.data({
      relationship: edgePropertiesDraft.relationship.trim(),
      qualifier: edgePropertiesDraft.qualifier.trim(),
      classification: edgePropertiesDraft.classification === "normal" ? ""
        : normaliseEdgeClassification(edgePropertiesDraft.classification),
      edgeRole: nextRole,
    });
    const selectedConditionId = String(edgePropertiesDraft.conditionId || "").trim();
    if (selectedConditionId && nextRole !== "standard") {
      edge.data("conditionId", selectedConditionId);
    } else {
      edge.removeData("conditionId");
    }

    /*
      Legacy backend flags are converted into edgeRole once the user edits
      the edge, preventing two sources of truth from fighting each other.
    */

    edge.removeData("isReification");
    edge.removeData("reification");
    syncConditionalGraphSemantics(edge.cy());
    syncGraphSelectionState(edge);
    setEdgePropertiesModalOpen(false);
    showGraphFeedback(edge.data("resolvedEdgeRole") === "reification" ? "Reification edge properties saved"
      : "Edge properties saved", "success");
  }

  function showGraphFeedback(message, type = "success") {
    setGraphFeedback({
      message,
      type,
    });
    if (graphFeedbackTimerRef.current) {
      clearTimeout(graphFeedbackTimerRef.current);
    }
    graphFeedbackTimerRef.current = setTimeout(() => {
        setGraphFeedback(null);
      }, 2500);
  }

  function deleteSelectedElement() {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const selected = cy.$(":selected");
    if (selected.empty()) {
      return;
    }
    const nodeCount = selected.nodes().length;
    const edgeCount = selected.edges().length;

    /*
      Removing selected nodes also removes their connected
      Cytoscape edges automatically.
    */

    selected.remove();
    syncConditionalGraphSemantics(cy);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectionSummary({
      nodes: [],
      edges: [],
    });
    if (nodeCount > 0 && edgeCount > 0) {
      showGraphFeedback(`Deleted ${nodeCount} node${nodeCount === 1 ? "" : "s"} and ${edgeCount} selected link${edgeCount === 1 ? "" : "s"}`, "success");
    } else if (nodeCount > 0) {
      showGraphFeedback(`Deleted ${nodeCount} node${nodeCount === 1 ? "" : "s"}`, "success");
    } else {
      showGraphFeedback(`Deleted ${edgeCount} link${edgeCount === 1 ? "" : "s"}`, "success");
    }
  }

  function createManualNode() {
    const cy = cyRef.current;
    if (!cy)
      return;
    const nodeId = `manual-node-${Date.now()}`;
    const extent = cy.extent();
    const newNode = cy.add({
      group: "nodes",
      data: {
        id: nodeId,
        label: "New Node",
        nodeType: "standard",
        color: getThemeColour("--graph-node-bg", "#6366F1"),
        textColor: getThemeColour("--graph-node-text", "#ffffff"),
        shape: "round-rectangle",
      },
      position: {
        x: (extent.x1 + extent.x2) / 2,
        y: (extent.y1 + extent.y2) / 2,
      },
    });
    resizeNodeToLabel(newNode);
    cy.elements().unselect();
    newNode.select();
    setSelectedEdge(null);
    setSelectedNode({
      ...newNode.data(),
    });
    showGraphFeedback("New node created", "success");
  }

  function finishNodeRename({ cancel = false, } = {}) {
    if (!cyRef.current || !editingNodeId) {
      return;
    }
    const node = cyRef.current.getElementById(editingNodeId);
    if (!node || node.empty()) {
      editingNodeIdRef.current = null;
      setEditingNodeId(null);
      return;
    }
    if (!cancel) {
      const cleanLabel = renameValue.trim();
      if (cleanLabel) {
        node.data("label", cleanLabel);
        syncConditionalGraphSemantics(cyRef.current);

        /*
          Label changed, so recompute the node body.
        */

        resizeNodeToLabel(node);
        setSelectedNode((current) => {
          if (!current || current.id !== editingNodeId) {
            return current;
          }
          return {
            ...current,
            label: cleanLabel,
          };
        });
        showGraphFeedback(`Renamed node to: ${cleanLabel}`, "success");
      }
    }

    /*
      Restore Cytoscape's own label.
    */

    node.style("text-opacity", 1);
    setEditingNodeId(null);
  }

  function finishEdgeRelationship({ cancel = false, } = {}) {
    if (!cyRef.current) {
      return;
    }
    const edgeId = editingEdgeIdRef.current;
    if (!edgeId) {
      return;
    }
    const edge = cyRef.current.getElementById(edgeId);
    if (!edge || edge.empty()) {
      editingEdgeIdRef.current = null;
      setEditingEdgeId(null);
      return;
    }

    /*
      ESCAPE:
      Nothing has been written into Cytoscape yet,
      so simply restore the old painted label.
    */

    if (cancel) {
      setRelationshipValue(relationshipOriginalValueRef.current);
      edge.style("text-opacity", 1);
      editingEdgeIdRef.current = null;
      setEditingEdgeId(null);
      return;
    }
    const cleanRelationship = relationshipValue.trim();
    const oldRelationship = relationshipOriginalValueRef.current
      .trim();

    /*
      Empty value means remove the relationship.
    */

    if (cleanRelationship) {
      edge.data("relationship", cleanRelationship);
    } else {
      edge.data("relationship", "");
      cyRef.current
        .style()
        .update();
    }
    syncConditionalGraphSemantics(cyRef.current);

    /*
      Keep React's Selected Edge card in sync.
    */

    setSelectedEdge(current => {
      if (!current || current.id !== edgeId) {
        return current;
      }
      return {
        ...current,
        relationship: cleanRelationship,
      };
    });
    edge.style("text-opacity", 1);
    relationshipOriginalValueRef.current = cleanRelationship;
    editingEdgeIdRef.current = null;
    setEditingEdgeId(null);

    /*
      Avoid firing feedback if nothing actually changed.
    */

    if (cleanRelationship !== oldRelationship) {
      showGraphFeedback(cleanRelationship ? `Relationship updated: ${cleanRelationship}`
        : "Relationship removed", "success");
    }
  }

  function changeSelectedNodeTextColor(newColor) {
    const nodes = getSelectedCyNodes();
    if (!nodes) {
      return;
    }
    nodes.forEach(node => {
      node.data({
        textColor: newColor,
        textColorUserSet: true,
      });
      node.updateStyle();
    });
    setSelectedNode(current => current ? {
        ...current,
        textColor: newColor,
      } : current);
  }
  async function handleSemanticSearch() {
    const query = semanticSearchQuery.trim();
    if (!query) {
      return;
    }
    // Collapse the search UI as soon as the search is submitted.
    setSemanticSearchOpen(false);
    if (!noteId) {
      showGraphFeedback("Unable to search because no note is selected.", "error");
      return;
    }
    setSemanticSearchLoading(true);
    try {
      showGraphFeedback(`Searching graph for "${query}"...`, "info");
      const result = await semanticSearchGraph(noteId, query, getEditedGraphData({
        includeNodeImages: false,
      }) ?? graphData);
      if (!result?.match) {
        showGraphFeedback(`No matching node found for "${query}".`, "error");
        return;
      }
      const match = result.match;
      const found = focusNode(match.node_id);
      if (!found) {
        showGraphFeedback("The matching node could not be found in the current graph.", "error");
        return;
      }
      showGraphFeedback(`Closest match to "${query}": ${match.label}`, "success");
      setSemanticSearchQuery("");
    }
    catch (error) {
      console.error("Semantic graph search failed:", error);
      showGraphFeedback("Unable to search the graph. Please try again.", "error");
    }
    finally {
      setSemanticSearchLoading(false);
    }
  }
  useEffect(() => {
    if (!semanticSearchOpen) {
      return;
    }

    function handleSemanticSearchOutside(event) {
      if (semanticSearchRef.current && !semanticSearchRef.current.contains(event.target)) {
        setSemanticSearchOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleSemanticSearchOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleSemanticSearchOutside, true);
    };
  }, [semanticSearchOpen]);
  useEffect(() => {

    function handlePointerDownOutside(event) {
      if (graphEditorRef.current && !graphEditorRef.current.contains(event.target)) {
        setGraphEditorActive(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, []);

  /* =========================================================
     CLIPBOARD IMAGE -> SELECTED NODE
     ========================================================= */

  useEffect(() => {

    function handleGraphImagePaste(event) {
      if (!graphEditorActive) {
        return;
      }
      const imageFile = getClipboardImageFile(event);
      if (!imageFile) {
        return;
      }
      const target = event.target;

      /*
        Normal text fields keep normal paste behaviour. The inline node
        rename field has its own image-paste handler so it can target the
        node being edited directly.
      */

      if (target instanceof Element) {
        if (target.closest(".graph-inline-rename")) {
          return;
        }
        if (target.closest('input, textarea, [contenteditable="true"]')) {
          return;
        }
      }
      event.preventDefault();
      const node = getSingleNodeForImageEdit();
      if (!node) {
        showGraphFeedback("Select exactly one node before pasting an image.", "error");
        return;
      }
      event.stopPropagation();
      void attachImageToNode(imageFile, node.id());
    }
    document.addEventListener("paste", handleGraphImagePaste);
    return () => {
      document.removeEventListener("paste", handleGraphImagePaste);
    };
  }, [graphEditorActive]);

  /* =========================================================
     KEYBOARD DELETE
     Delete the currently selected graph node / edge.
     ========================================================= */

  useEffect(() => {

    function handleGraphDeleteKey(event) {

      /*
        Only respond while the Graph Editor is active.
        This prevents Delete from affecting the graph
        while the user is working in Raw Notes, Summary,
        or somewhere else on the page.
      */

      if (!graphEditorActive) {
        return;
      }

      /*
        For now we use the physical Delete key only.

        Backspace is deliberately excluded because it is
        commonly used while editing text.
      */

      if (event.key !== "Delete") {
        return;
      }

      /*
        Never delete a graph element while the user is
        typing into an input, textarea, select, or
        contentEditable element.
      */

      const target = event.target;
      const isTypingTarget = target instanceof HTMLElement && (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (isTypingTarget) {
        return;
      }

      /*
        Also protect Cytoscape's inline editing modes.

        These checks are useful even if focus handling
        changes later.
      */

      if (editingNodeId || editingEdgeId) {
        return;
      }

      /*
        Nothing selected, nothing to delete.
      */

      if (!selectedNode && !selectedEdge) {
        return;
      }

      /*
        Stop the browser / another handler from
        interpreting this Delete press.
      */

      event.preventDefault();

      /*
        Use the SAME deletion logic as the toolbar
        trash button.
      */

      deleteSelectedElement();
    }
    document.addEventListener("keydown", handleGraphDeleteKey);
    return () => {
      document.removeEventListener("keydown", handleGraphDeleteKey);
    };
  }, [
    graphEditorActive,
    selectedNode,
    selectedEdge,
    editingNodeId,
    editingEdgeId,
  ]);
  useEffect(() => {

    function handlePopoverPointerDown(event) {
      const clickedInsideShape = shapeMenuRef.current?.contains(event.target);
      const clickedInsideNodeBorderStyle = nodeBorderStyleMenuRef.current &&
        nodeBorderStyleMenuRef.current.contains(event.target);
      const clickedInsideEdgeStyle = edgeStyleMenuRef.current?.contains(event.target);
      const clickedInsideArrowShape = arrowShapeMenuRef.current?.contains(event.target);

      /*
        Close each menu when the click occurs
        outside its own wrapper.

        Capture mode means this runs before
        Cytoscape or another control can consume
        the pointer event.
      */

      if (!clickedInsideShape) {
        setShapeMenuOpen(false);
      }
      if (!clickedInsideNodeBorderStyle) {
        setNodeBorderStyleMenuOpen(false);
      }
      if (!clickedInsideEdgeStyle) {
        setEdgeStyleMenuOpen(false);
      }
      if (!clickedInsideArrowShape) {
        setArrowShapeMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key !== "Escape") {
        return;
      }
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setNodeImageModalOpen(false);
      setNodePropertiesModalOpen(false);
      setEdgePropertiesModalOpen(false);
      setPropertyDropdownOpen(null);
      setNodeOwnerSearch("");
      setEdgeConditionSearch("");
      if (linkModeRef.current) {
        cancelLinkMode();
      }
    }
    document.addEventListener("pointerdown", handlePopoverPointerDown, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePopoverPointerDown, true);
      document.removeEventListener("keydown", handleEscape);
      if (graphFeedbackTimerRef.current) {
        clearTimeout(graphFeedbackTimerRef.current);
      }
    };
  }, []);
  useImperativeHandle(ref, () => ({
    getGraphData() {
      return getEditedGraphData();
    },
    resizeGraph() {
      const cy = cyRef.current;
      if (!cy) {
        return;
      }
      // Recalculate Cytoscape's viewport for the new panel size.
      // Do not fit() here: preserving the user's current pan/zoom
      // keeps divider dragging visually stable.
      cy.resize();
    },
    createLinkedTextNode(label, linkColor) {
      return createLinkedTextNode(label, linkColor);
    },
    focusNode(nodeId) {
      return focusNode(nodeId);
    },
    setLinkedNodeHover(nodeId, color, isHovered) {
      setLinkedNodeHover(nodeId, color, isHovered);
    },
    setLinkedNodeColor(nodeId, color) {
      setLinkedNodeColor(nodeId, color);
    },
  }));

  /* =========================================================
     CURRENT TOOLBAR ICONS
     ========================================================= */

  const currentNodeShape = selectedNode ? NODE_SHAPES.find(option => option.value === (selectedNode.shape ||
        "round-rectangle")) : null;
  const CurrentNodeShapeIcon = selectedNode ? (currentNodeShape?.Icon || Squircle) : Shapes;
  const currentNodeBorderStyle = NODE_BORDER_STYLES.find(option => option.value === (selectedNode?.borderStyle ||
      "solid")) || NODE_BORDER_STYLES.find(option => option.value === "solid");
  const CurrentNodeBorderStyleIcon = currentNodeBorderStyle?.Icon || Square;
  const imagePreviewCanDrag = Boolean(selectedNode?.imageSrc && selectedNode?.imageFit !== "contain");
  const currentArrowShape = ARROW_SHAPES.find(option => option.value === (selectedEdge?.arrowShape || "triangle")) ||
    ARROW_SHAPES.find(option => option.value === "triangle");
  const CurrentArrowShapeIcon = currentArrowShape?.Icon || Triangle;
  const nodePropertiesDisplayName = (() => {
    const cy = cyRef.current;
    if (!cy || !nodePropertiesDraft.nodeId) {
      return selectedNode?.label || "";
    }
    const node = cy.getElementById(nodePropertiesDraft.nodeId);
    return !node.empty() ? node.data("label") || node.id() : selectedNode?.label || "";
  })();
  const edgePropertiesDisplayName = (() => {
    const cy = cyRef.current;
    if (!cy || !edgePropertiesDraft.edgeId) {
      return "";
    }
    const edge = cy.getElementById(edgePropertiesDraft.edgeId);
    if (!edge || edge.empty()) {
      return "";
    }
    const sourceLabel = edge.source().data("label") || edge.source().id();
    const targetLabel = edge.target().data("label") || edge.target().id();
    return `${sourceLabel} → ${targetLabel}`;
  })();
  const edgePropertiesRoleStatus = (() => {
    const requestedRole = normaliseEdgeRole(edgePropertiesDraft.edgeRole);
    const requestedLabel = EDGE_ROLES.find(option => option.value === requestedRole)?.label || "Auto-detect";
    if (requestedRole !== "auto") {
      return requestedLabel;
    }
    const cy = cyRef.current;
    if (!cy || !edgePropertiesDraft.edgeId) {
      return requestedLabel;
    }
    const edge = cy.getElementById(edgePropertiesDraft.edgeId);
    if (!edge || edge.empty()) {
      return requestedLabel;
    }
    const resolvedRole = normaliseEdgeRole(edge.data("resolvedEdgeRole"));
    const resolvedLabel = EDGE_ROLES.find(option => option.value === resolvedRole)?.label ||
      (resolvedRole === "reification" ? "Reification" : "Standard");
    return `${requestedLabel} → ${resolvedLabel}`;
  })();
  const nodePropertyOwnerOptions = [
    {
      value: "",
      label: "Select parent node...",
    },
    ...getNodePropertyOptions(nodePropertiesDraft.nodeId).map(option => ({
      value: option.id,
      label: option.label,
    })),
  ];
  const conditionalPropertyOptions = [
    {
      value: "",
      label: "Auto / none",
    },
    ...getConditionalPropertyOptions()
      .map(option => ({
        value: option.id,
        label: option.label,
      })),
  ];
  // =========================================================
  // CURRENT GRAPH SELECTION DISPLAY
  // =========================================================
  const selectedItemCount = selectionSummary.nodes.length + selectionSummary.edges.length;
  const singleSelectedNode = selectedItemCount === 1 && selectionSummary.nodes.length === 1 ? selectionSummary.nodes[0]
    : null;
  const singleSelectedEdge = selectedItemCount === 1 && selectionSummary.edges.length === 1 ? selectionSummary.edges[0]
    : null;
  const isSemanticReification = Boolean(singleSelectedEdge) && singleSelectedEdge.edgeRole === "reification" &&
    Boolean(singleSelectedEdge.sourceProposition) && Boolean(singleSelectedEdge.targetProposition);
  const isMultiSelection = selectedItemCount > 1;

  /* =========================================================
     RENDER
     ========================================================= */

  return (<section className="graph-panel">

    {/* ================================================= */}
    {/* GRAPH HEADER                                      */}
    {/* ================================================= */}

    <div className="graph-panel-heading">

      <div className="graph-panel-heading-title">
        <h2>Graph View</h2>

        <ChartLine size={21} strokeWidth={1.8} aria-hidden="true" />
      </div>

      <div className="graph-panel-header-actions">

        <div className="graph-header-status-slot">
          {error ? (<span className="graph-header-error" title={error}>
            {error}
          </span>) : loading && aiProcessingStatus ? (<span className="graph-header-status" title={aiProcessingStatus}>
            {aiProcessingStatus}
          </span>) : null}
        </div>

        <div className="graph-generation-actions">
          <button type="button" className={`panel-focus-button graph-processing-info-button tooltip-align-right ${loading
            ? "graph-processing-info-button-live"
            : ""}`} onClick={() => setAiProcessingModalOpen(true)} aria-label="View AI processing details" aria-haspopup="dialog" aria-expanded={aiProcessingModalOpen} data-tooltip="View AI processing details">
            <Info size={18} strokeWidth={1.9} aria-hidden="true" />

            {loading && (<span className="graph-processing-live-dot" aria-hidden="true" />)}

            {aiProcessingSteps.length > 0 && (<span className="graph-processing-step-count" aria-label={`${aiProcessingSteps.length} processing steps available`}>
              {aiProcessingSteps.length > 9 ? "9+" : aiProcessingSteps.length}
            </span>)}
          </button>

          <button type="button" className="graph-generate-button primary-action" onClick={generateGraph} disabled={loading}>
            <Sparkles strokeWidth={1.8} />

            <span>
              {loading ? "Generating..." : "Generate Graph"}
            </span>
          </button>

        </div>

        <button type="button" className="panel-focus-button tooltip-align-right" onClick={(event) => {
          event.stopPropagation();
          onToggleFocus?.();
        }} aria-label={isFocused ? "Exit Graph View focus mode"
          : "Focus Graph View"} aria-pressed={isFocused} data-tooltip={isFocused ? "Restore layout"
            : "Focus Graph View"}>
          {isFocused ? (<Minimize2 size={18} strokeWidth={1.9} />) : (<Maximize2 size={18} strokeWidth={1.9} />)}
        </button>

      </div>

    </div>

    {/* ================================================= */}
    {/* GRAPH EDITOR                                      */}
    {/* Mirrors raw-notes-editor                          */}
    {/* ================================================= */}

    <div ref={graphEditorRef} className={`graph-editor ${graphEditorActive
      ? "graph-editor-active" : ""}`} onPointerDownCapture={() => {
        setGraphEditorActive(true);
      }}>

      {/* =============================================== */}
      {/* GRAPH TOOLBAR                                   */}
      {/* =============================================== */}

      <div className="graph-node-toolbar" role="toolbar" aria-label="Graph editing">
        {/* ================================================= */}
        {/* NODE TOOLS                                        */}
        {/* ================================================= */}

        {/* CREATE NODE */}

        <button type="button" className="graph-toolbar-button" onClick={createManualNode} data-tooltip="Create node" aria-label="Create node">
          <span className="graph-create-action-icon">

            <Squircle size={18} strokeWidth={1.8} />

            <Plus className="graph-create-action-plus" size={9} strokeWidth={2.5} />

          </span>
        </button>

        {/* NODE PROPERTIES */}

        <button type="button" className={`graph-toolbar-button ${nodePropertiesModalOpen
          ? "graph-toolbar-button-active"
          : ""}`} disabled={!selectedNode} onClick={openNodePropertiesModal} data-tooltip={selectedNode
            ? "Node properties"
            : "Select a node first"} aria-label="Node properties" aria-haspopup="dialog" aria-expanded={nodePropertiesModalOpen}>
          <span className="graph-create-action-icon">
            <Squircle size={18} strokeWidth={1.8} />

            <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
          </span>
        </button>

        {/* NODE SHAPE */}

        <div className="graph-toolbar-popover-wrapper" ref={shapeMenuRef}>

          <button type="button" className={`graph-toolbar-button graph-shape-trigger ${shapeMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedNode} onClick={() => {
              setShapeMenuOpen(current => !current);
              setEdgeStyleMenuOpen(false);
              setArrowShapeMenuOpen(false);
            }} data-tooltip={selectedNode ? "Node shape"
              : "Select a node first"} aria-label="Node shape" aria-haspopup="true" aria-expanded={shapeMenuOpen}>
            <CurrentNodeShapeIcon size={19} strokeWidth={1.8} style={currentNodeShape?.rotation
              ? {
                transform: `rotate(${currentNodeShape.rotation}deg)`,
              } : undefined} />

            <ChevronDown size={12} strokeWidth={1.8} />
          </button>

          {shapeMenuOpen && (<div className="
                  graph-shape-popover
                  graph-icon-grid-popover
                ">

            {NODE_SHAPES.map(({ value, label, Icon, rotation, }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedNode?.shape ||
              "round-rectangle") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedNodeShape(value)} data-tooltip={label} aria-label={label}>
              <Icon size={18} strokeWidth={1.8} style={rotation
                ? {
                  transform: `rotate(${rotation}deg)`,
                } : undefined} />
            </button>))}

          </div>)}

        </div>

        {/* NODE FILL COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={nodeColorButtonRef} type="button" className={`graph-toolbar-button tooltip-align-left ${graphColorPicker === "node-fill"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedNode} onClick={() => toggleGraphColorPicker("node-fill")} data-tooltip={selectedNode
              ? "Node colour"
              : "Select a node first"} aria-label="Node colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "node-fill"}>
            <span className="graph-toolbar-color-icon">

              <PaintBucket size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedNode?.color || getThemeColour("--graph-node-bg", "#6366F1"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "node-fill"} anchorRef={nodeColorButtonRef} value={selectedNode?.color ||
            getThemeColour("--graph-node-bg", "#6366F1")} onChange={changeSelectedNodeColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        {/* NODE IMAGE FILL */}

        <input ref={nodeImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleNodeImageFileChange} />

        <button type="button" className={`graph-toolbar-button ${nodeImageModalOpen
          ? "graph-toolbar-button-active"
          : ""}`} disabled={!selectedNode} onClick={openNodeImageModal} data-tooltip={selectedNode
            ? selectedNode.imageSrc ? "Edit node image" : "Add node image"
            : "Select a node first"} aria-label={selectedNode?.imageSrc ? "Edit node image"
              : "Add node image"} aria-haspopup="dialog" aria-expanded={nodeImageModalOpen}>
          <ImageIcon size={19} strokeWidth={1.8} />
        </button>

        {/* NODE TEXT COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={nodeTextColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "node-text"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedNode} onClick={() => toggleGraphColorPicker("node-text")} data-tooltip={selectedNode
              ? "Text colour"
              : "Select a node first"} aria-label="Text colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "node-text"}>
            <span className="graph-toolbar-color-icon">

              <FontColorIcon size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedNode?.textColor || getThemeColour("--graph-node-text", "#ffffff"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "node-text"} anchorRef={nodeTextColorButtonRef} value={selectedNode?.textColor ||
            getThemeColour("--graph-node-text", "#ffffff")} onChange={changeSelectedNodeTextColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        {/* NODE BORDER STYLE */}

        <div className="graph-toolbar-popover-wrapper" ref={nodeBorderStyleMenuRef}>
          <button type="button" className={`graph-toolbar-button ${nodeBorderStyleMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedNode} onClick={() => {
              setNodeBorderStyleMenuOpen(current => !current);
              setShapeMenuOpen(false);
              setEdgeStyleMenuOpen(false);
              setArrowShapeMenuOpen(false);
            }} data-tooltip={selectedNode ? "Node border style"
              : "Select a node first"} aria-label="Node border style" aria-haspopup="true" aria-expanded={nodeBorderStyleMenuOpen}>
            <CurrentNodeBorderStyleIcon size={19} strokeWidth={1.8} />

            <ChevronDown size={11} strokeWidth={1.8} />
          </button>

          {nodeBorderStyleMenuOpen && (<div className="graph-shape-popover">

            {NODE_BORDER_STYLES.map(({ value, label, Icon, }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedNode
              ?.borderStyle || "solid") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedNodeBorderStyle(value)} data-tooltip={label} aria-label={label}>
              <Icon size={18} strokeWidth={1.8} />
            </button>))}

          </div>)}
        </div>

        {/* NODE BORDER COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={nodeBorderColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "node-border"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedNode} onClick={() => toggleGraphColorPicker("node-border")} data-tooltip={selectedNode
              ? "Node border colour"
              : "Select a node first"} aria-label="Node border colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "node-border"}>
            <span className="graph-toolbar-color-icon">

              <SquareDashed size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedNode?.borderColor || getThemeColour("--graph-node-border", "#818CF8"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "node-border"} anchorRef={nodeBorderColorButtonRef} value={selectedNode?.borderColor ||
            getThemeColour("--graph-node-border", "#818CF8")} onChange={changeSelectedNodeBorderColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        <span className="graph-toolbar-divider" />

        {/* ================================================= */}
        {/* EDGE / RELATIONSHIP TOOLS                         */}
        {/* ================================================= */}

        {/* LINK NODES */}

        <button type="button" className={`graph-toolbar-button ${linkMode
          ? "graph-toolbar-button-active" : ""}`} onClick={startLinkMode} data-tooltip={linkMode ? "Cancel linking"
            : "Create link"} aria-label={linkMode ? "Cancel linking" : "Create link"} aria-pressed={linkMode}>
          <span className="graph-create-action-icon">

            <MoveUpRight size={18} strokeWidth={1.8} />

            <Plus className="graph-create-action-plus" size={9} strokeWidth={2.5} />

          </span>
        </button>

        {/* EDGE PROPERTIES */}

        <button type="button" className={`graph-toolbar-button ${edgePropertiesModalOpen
          ? "graph-toolbar-button-active"
          : ""}`} disabled={!selectedEdge} onClick={openEdgePropertiesModal} data-tooltip={selectedEdge
            ? "Edge properties"
            : "Select an edge first"} aria-label="Edge properties" aria-haspopup="dialog" aria-expanded={edgePropertiesModalOpen}>
          <span className="graph-create-action-icon">
            <MoveUpRight size={18} strokeWidth={1.8} />

            <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
          </span>
        </button>

        {/* EDGE STYLE */}

        <div className="graph-toolbar-popover-wrapper" ref={edgeStyleMenuRef}>

          <button type="button" className={`graph-toolbar-button ${edgeStyleMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedEdge} onClick={() => {
              setEdgeStyleMenuOpen(current => !current);
              setShapeMenuOpen(false);
              setArrowShapeMenuOpen(false);
            }} data-tooltip={selectedEdge ? "Edge style" : "Select an edge first"} aria-label="Edge style">

            <span className={`
                  graph-edge-style-preview
                  graph-edge-style-${selectedEdge?.lineStyle || "solid"}
                `} />

            <ChevronDown size={11} strokeWidth={1.8} />

          </button>

          {edgeStyleMenuOpen && (<div className="graph-shape-popover">

            {EDGE_STYLES.map(({ value, label }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedEdge?.lineStyle ||
              "solid") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedEdgeStyle(value)} data-tooltip={label} aria-label={label}>

              <span className={`
                          graph-edge-style-preview
                          graph-edge-style-${value}
                        `} />

            </button>))}

          </div>)}

        </div>

        {/* EDGE COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={edgeColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "edge"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedEdge} onClick={() => toggleGraphColorPicker("edge")} data-tooltip={selectedEdge
              ? "Edge colour"
              : "Select an edge first"} aria-label="Edge colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "edge"}>
            <span className="graph-toolbar-color-icon">

              <Minus size={20} strokeWidth={2} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedEdge?.edgeColor || getThemeColour("--graph-edge", "#465873"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "edge"} anchorRef={edgeColorButtonRef} value={selectedEdge?.edgeColor ||
            getThemeColour("--graph-edge", "#465873")} onChange={changeSelectedEdgeColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        {/* ARROW SHAPE */}

        <div className="graph-toolbar-popover-wrapper" ref={arrowShapeMenuRef}>

          <button type="button" className={`graph-toolbar-button ${arrowShapeMenuOpen
            ? "graph-toolbar-button-active" : ""}`} disabled={!selectedEdge} onClick={() => {
              setArrowShapeMenuOpen(current => !current);
              setShapeMenuOpen(false);
              setEdgeStyleMenuOpen(false);
            }} data-tooltip={selectedEdge ? "Arrow shape" : "Select an edge first"} aria-label="Arrow shape">

            <CurrentArrowShapeIcon size={19} strokeWidth={1.8} style={currentArrowShape?.rotation
              ? {
                transform: `rotate(${currentArrowShape.rotation}deg)`,
              } : undefined} />

            <ChevronDown size={11} strokeWidth={1.8} />

          </button>

          {arrowShapeMenuOpen && (<div className="
                  graph-shape-popover
                  graph-icon-grid-popover
                ">

            {ARROW_SHAPES.map(({ value, label, Icon, rotation, }) => (<button key={value} type="button" className={`graph-shape-option ${(selectedEdge?.arrowShape ||
              "triangle") === value ? "graph-shape-option-active"
              : ""}`} onClick={() => changeSelectedArrowShape(value)} data-tooltip={label} aria-label={label}>

              <Icon size={18} strokeWidth={1.8} style={rotation
                ? {
                  transform: `rotate(${rotation}deg)`,
                } : undefined} />

            </button>))}

          </div>)}

        </div>

        {/* ARROW COLOUR */}

        <div className="graph-toolbar-popover-wrapper">

          <button ref={arrowColorButtonRef} type="button" className={`graph-toolbar-button ${graphColorPicker === "arrow"
            ? "graph-toolbar-button-active"
            : ""}`} disabled={!selectedEdge} onClick={() => toggleGraphColorPicker("arrow")} data-tooltip={selectedEdge
              ? "Arrow colour"
              : "Select an edge first"} aria-label="Arrow colour" aria-haspopup="dialog" aria-expanded={graphColorPicker === "arrow"}>
            <span className="graph-toolbar-color-icon">

              <ArrowRight size={19} strokeWidth={1.8} />

              <span className="graph-toolbar-color-indicator" style={{
                backgroundColor: selectedEdge?.arrowColor || getThemeColour("--graph-edge-arrow", "#7772ff"),
              }} />

            </span>
          </button>

          <TreeNotesColorPicker open={graphColorPicker === "arrow"} anchorRef={arrowColorButtonRef} value={selectedEdge?.arrowColor ||
            getThemeColour("--graph-edge-arrow", "#7772ff")} onChange={changeSelectedArrowColor} onClose={() => setGraphColorPicker(null)} />

        </div>

        <span className="graph-toolbar-divider" />

        {/* ================================================= */}
        {/* GENERAL TOOLS                                     */}
        {/* ================================================= */}

        {/* FIND LINKED TEXT */}

        <button type="button" className="graph-toolbar-button" disabled={!selectedNode} onClick={() => {
          if (!selectedNode) {
            return;
          }
          onNavigateLinkedText?.(selectedNode.id, selectedNode.label);
        }} data-tooltip={selectedNode ? "Find linked references"
          : "Select a node first"} aria-label="Find linked references">
          <Search size={19} strokeWidth={1.8} />
        </button>

        {/* DELETE ELEMENT */}

        <button type="button" className="graph-toolbar-button" onClick={deleteSelectedElement} disabled={!selectedNode && !selectedEdge} data-tooltip={selectedNode
          ? "Delete node" : selectedEdge ? "Delete edge"
            : "Select a node or edge first"} aria-label="Delete selected item">
          <Trash2 size={19} strokeWidth={1.8} />
        </button>

      </div>

      {/* =============================================== */}
      {/* GRAPH CANVAS                                    */}
      {/* =============================================== */}

      <div className={`graph-canvas-shell ${loading ? "graph-generating" : ""}`}>

        <div ref={graphContainerRef} className="graph-container" />

        {loading && (<div className="graph-generation-overlay">
          <div className="graph-generation-glow" />

          <div className="graph-generation-content">
            <span className="graph-generation-label">
              Generating graph
            </span>

            <span className="graph-generation-dots">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>)}

        {aiProcessingModalOpen && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setAiProcessingModalOpen(false);
          }
        }}>
          <div className="graph-image-modal graph-ai-processing-modal" role="dialog" aria-modal="true" aria-labelledby="graph-ai-processing-modal-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-ai-processing-modal-title" className="graph-image-modal-title">
                <Info size={18} strokeWidth={1.9} />
                <span>AI Processing Details</span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={() => setAiProcessingModalOpen(false)} aria-label="Close AI processing details">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body graph-ai-processing-modal-body">
              <div className="graph-ai-processing-summary">
                <div>
                  <strong>Graph interpretation trace</strong>
                  <span>
                    Read-only feedback showing how the AI interpreted the raw notes before creating graph elements.
                  </span>
                </div>

                <span className={`graph-ai-processing-state ${loading
                  ? "is-live" : aiProcessingComplete ? "is-complete" : ""}`}>
                  {aiProcessingMock ? "Mock preview" : loading ? "Processing" : aiProcessingComplete ? "Complete"
                        : "Waiting"}
                </span>
              </div>

              {aiProcessingSteps.length === 0 ? (<div className="graph-ai-processing-empty">
                <Info size={26} strokeWidth={1.5} />
                <strong>
                  {loading ? "Waiting for processing details…" : "No processing trace is available yet."}
                </strong>
                <span>
                  Once processing-step events are streamed, they will appear here as read-only stages.
                </span>

                {SHOW_AI_PROCESSING_MOCK && !loading && (<button type="button" className="graph-ai-processing-mock-button" onClick={loadAiProcessingMockPreview}>
                  Preview mock processing data
                </button>)}
              </div>) : (<div className="graph-ai-processing-list">
                {aiProcessingSteps.map((step, index) => (<article className="graph-ai-processing-step" key={step.id}>
                  <div className="graph-ai-processing-step-marker">
                    {step.step || index + 1}
                  </div>

                  <div className="graph-ai-processing-step-main">
                    <div className="graph-ai-processing-step-heading">
                      <div>
                        <strong>{step.title}</strong>
                        <span>{step.description}</span>
                      </div>
                      <Check size={16} strokeWidth={2} aria-hidden="true" />
                    </div>

                    <pre className="graph-ai-processing-output">
                      {step.content || "No output returned for this stage."}
                    </pre>
                  </div>
                </article>))}
              </div>)}
            </div>
          </div>
        </div>)}

        {nodeImageModalOpen && selectedNode && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeNodeImageModal();
          }
        }}>
          <div className="graph-image-modal" role="dialog" aria-modal="true" aria-labelledby="graph-image-modal-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-image-modal-title" className="graph-image-modal-title">
                <ImageIcon size={18} strokeWidth={1.8} />
                <span>
                  Node Image · {selectedNode.label || "Selected node"}
                </span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={closeNodeImageModal} aria-label="Close node image settings">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body">
              <div className="graph-image-preview-shell">
                {selectedNode.imageSrc ? (() => {
                  const previewSize = getNodeImagePreviewSize(selectedNode.imageWidth, selectedNode.imageHeight, selectedNode.shape ||
                    "round-rectangle", selectedNode.imageSize || NODE_IMAGE_DEFAULT_SIZE);
                  const positionX = getImagePositionPercent(selectedNode.imagePositionX, NODE_IMAGE_DEFAULT_POSITION_X);
                  const positionY = getImagePositionPercent(selectedNode.imagePositionY, NODE_IMAGE_DEFAULT_POSITION_Y);
                  const canDrag = selectedNode.imageFit !== "contain";
                  return (<div className="graph-image-preview-tooltip-anchor" data-tooltip={imagePreviewCanDrag
                    ? "Drag to reposition image. Double-click to centre." : "Fit mode displays the entire image."}>
                    <div className={`graph-image-preview-node ${imagePreviewCanDrag
                      ? "graph-image-preview-node-draggable" : ""} ${imagePreviewDragging
                        ? "graph-image-preview-node-dragging" : ""}`} style={{
                          width: `${previewSize.width}px`,
                          height: `${previewSize.height}px`,
                          clipPath: getNodeImagePreviewClipPath(selectedNode.shape || "round-rectangle"),
                          borderRadius: selectedNode.shape === "round-rectangle" ? "14px" : selectedNode.shape ===
                              "rectangle" ? "2px" : undefined,
                        }} onPointerDown={startNodeImagePreviewDrag} onPointerMove={moveNodeImagePreviewDrag} onPointerUp={finishNodeImagePreviewDrag} onPointerCancel={finishNodeImagePreviewDrag} onDoubleClick={resetSelectedNodeImagePosition}>
                      <img src={selectedNode.imageSrc} alt="" className="graph-image-preview" draggable={false} style={{
                        objectFit: selectedNode.imageFit === "contain" ? "contain" : "cover",
                        objectPosition: `${positionX}% ${positionY}%`,
                      }} />
                    </div>
                  </div>);
                })() : (<div className="graph-image-preview-empty">
                  <ImageIcon size={38} strokeWidth={1.35} />
                  <span>
                    No image attached to this node yet.
                  </span>
                </div>)}
              </div>

              {selectedNode.imageSrc && (<div className="graph-image-modal-meta">
                {selectedNode.imageWidth || "?"} × {selectedNode.imageHeight || "?"} px
                {selectedNode.imageStoredBytes ? ` · ${formatNodeImageBytes(selectedNode.imageStoredBytes)}` : ""}
              </div>)}

              <div className="graph-image-modal-actions">
                <button type="button" className="graph-image-modal-action primary" onClick={openNodeImagePicker}>
                  <ImagePlus size={16} strokeWidth={1.9} />
                  {selectedNode.imageSrc ? "Replace image" : "Choose image"}
                </button>

                {selectedNode.imageSrc && (<button type="button" className="graph-image-modal-action danger" onClick={removeImageFromSelectedNode}>
                  <Trash2 size={16} strokeWidth={1.9} />
                  Remove
                </button>)}
              </div>

              <div className="graph-image-modal-hint">
                You can also copy an image and press Ctrl+V while this node is selected.
              </div>

              {selectedNode.imageSrc && (<>
                <div className="graph-image-control">
                  <div className="graph-image-control-heading">
                    <span>Image fit</span>
                    <span>
                      {selectedNode.imageFit === "contain" ? "Fit" : "Fill"}
                    </span>
                  </div>

                  <div className="graph-image-segmented">
                    <button type="button" className={(selectedNode.imageFit ||
                      "cover") === "cover" ? "active" : ""} onClick={() => changeSelectedNodeImageFit("cover")}>
                      Fill
                    </button>

                    <button type="button" className={selectedNode.imageFit ===
                      "contain" ? "active" : ""} onClick={() => changeSelectedNodeImageFit("contain")}>
                      Fit
                    </button>
                  </div>
                </div>

                <div className="graph-image-control">
                  <div className="graph-image-control-heading">
                    <span>Node size</span>
                    <span>
                      {(selectedNode.imageSize || NODE_IMAGE_DEFAULT_SIZE)
                        .charAt(0)
                        .toUpperCase() +
                        (selectedNode.imageSize || NODE_IMAGE_DEFAULT_SIZE).slice(1)}
                    </span>
                  </div>

                  <div className="graph-image-segmented">
                    {[
                      "small",
                      "medium",
                      "large",
                    ].map((size) => (<button key={size} type="button" className={(selectedNode.imageSize ||
                      NODE_IMAGE_DEFAULT_SIZE) === size ? "active"
                      : ""} onClick={() => changeSelectedNodeImageSize(size)}>
                      {size.charAt(0).toUpperCase() +
                        size.slice(1)}
                    </button>))}
                  </div>
                </div>

                <label className="graph-image-toggle-row">
                  <span>Show node name</span>
                  <input type="checkbox" checked={selectedNode.showImageLabel !==
                    false} onChange={(event) => changeSelectedNodeImageLabelVisibility(event.target.checked)} />
                </label>

                {![
                  "rectangle",
                  "round-rectangle",
                ].includes(selectedNode.shape || "round-rectangle") && (<div className="graph-image-modal-hint">
                    Geometric node shapes crop the image to their silhouette. Rectangle and Rounded Rectangle preserve the most readable picture area.
                  </div>)}
              </>)}
            </div>
          </div>
        </div>)}

        {/* NODE PROPERTIES MODAL */}

        {nodePropertiesModalOpen && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeNodePropertiesModal();
          }
        }}>
          <div className="graph-image-modal graph-property-modal" role="dialog" aria-modal="true" aria-labelledby="graph-node-properties-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-node-properties-title" className="graph-image-modal-title">
                <span className="graph-property-modal-title-icon graph-create-action-icon">
                  <Squircle size={18} strokeWidth={1.8} />

                  <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
                </span>

                <span className="graph-property-modal-title-text">
                  Node Properties
                  {nodePropertiesDisplayName ? ` · ${nodePropertiesDisplayName}` : ""}
                </span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={closeNodePropertiesModal} aria-label="Close node properties">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body graph-property-modal-body">
              <GraphSegmentedControl label="Node type" value={nodePropertiesDraft.nodeType} options={NODE_TYPES} statusText={NODE_TYPES.find(option => option.value ===
                nodePropertiesDraft.nodeType)?.label || "Standard"} onChange={(nextValue) => setNodePropertiesDraft(current => ({
                  ...current,
                  nodeType: nextValue,
                  conditionOwnerId: nextValue === "conditional" ? current.conditionOwnerId : "",
                }))} ariaLabel="Node type" />

              {nodePropertiesDraft.nodeType ===
                "conditional" && (<div className="graph-image-control graph-property-dropdown-control">
                  <div className="graph-image-control-heading">
                    <span>
                      Parent / owner node
                    </span>
                  </div>

                  <GraphPropertyDropdown value={nodePropertiesDraft.conditionOwnerId} options={nodePropertyOwnerOptions} placeholder="Select parent node..." isOpen={propertyDropdownOpen ===
                    "nodeOwner"} onToggle={() => {
                      setNodeOwnerSearch("");
                      setPropertyDropdownOpen(current => current === "nodeOwner" ? null : "nodeOwner");
                    }} onSelect={(nextValue) => {
                      setNodePropertiesDraft(current => ({
                        ...current,
                        conditionOwnerId: nextValue,
                      }));
                      setPropertyDropdownOpen(null);
                      setNodeOwnerSearch("");
                    }} searchable searchValue={nodeOwnerSearch} onSearchChange={setNodeOwnerSearch} searchPlaceholder="Search graph nodes..." emptyMessage="No matching graph nodes" ariaLabel="Parent or owner node" />
                </div>)}

              <div className="graph-image-modal-hint">
                Conditional nodes stay associated with their parent for layout. Links from the conditional define the propositions in that condition&apos;s scope.
              </div>

              <div className="graph-image-modal-actions">
                <button type="button" className="graph-image-modal-action" onClick={closeNodePropertiesModal}>
                  Cancel
                </button>

                <button type="button" className="graph-image-modal-action primary" onClick={saveNodeProperties}>
                  <Check size={16} strokeWidth={1.9} />
                  Save properties
                </button>
              </div>
            </div>
          </div>
        </div>)}

        {/* EDGE PROPERTIES MODAL */}

        {edgePropertiesModalOpen && (<div className="graph-image-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeEdgePropertiesModal();
          }
        }}>
          <div className="graph-image-modal graph-property-modal" role="dialog" aria-modal="true" aria-labelledby="graph-edge-properties-title" onPointerDown={(event) => event.stopPropagation()}>
            <div className="graph-image-modal-header">
              <div id="graph-edge-properties-title" className="graph-image-modal-title">
                <span className="graph-property-modal-title-icon graph-create-action-icon">
                  <MoveUpRight size={18} strokeWidth={1.8} />

                  <Settings className="graph-create-action-plus" size={10} strokeWidth={2.2} />
                </span>

                <span className="graph-property-modal-title-text">
                  Edge Properties
                  {edgePropertiesDisplayName ? ` · ${edgePropertiesDisplayName}` : ""}
                </span>
              </div>

              <button type="button" className="graph-image-modal-close" onClick={closeEdgePropertiesModal} aria-label="Close edge properties">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>

            <div className="graph-image-modal-body graph-property-modal-body">
              {[
                {
                  key: "relationship",
                  label: "Relationship",
                  placeholder: "allows, gains, basks on...",
                },
                {
                  key: "qualifier",
                  label: "Qualifier",
                  placeholder: "without, during, when...",
                },
              ].map(field => (<label key={field.key} className="graph-image-control graph-property-text-control">
                <div className="graph-image-control-heading">
                  <span>{field.label}</span>
                </div>

                <input type="text" className="graph-property-input" value={edgePropertiesDraft[field.key]} placeholder={field.placeholder} onChange={(event) => setEdgePropertiesDraft(current => ({
                  ...current,
                  [field.key]: event.target.value,
                }))} />
              </label>))}

              <GraphSegmentedControl label="Classification" value={normaliseEdgeClassification(edgePropertiesDraft.classification)} options={[
                {
                  value: "normal",
                  label: "Normal",
                },
                {
                  value: "negative",
                  label: "Negative",
                },
                {
                  value: "prerequisite",
                  label: "Prerequisite",
                },
              ]} statusText={{
                normal: "Normal",
                negative: "Negative",
                prerequisite: "Prerequisite",
              }[normaliseEdgeClassification(edgePropertiesDraft.classification)]} onChange={(nextValue) => setEdgePropertiesDraft(current => ({
                ...current,
                classification: nextValue,
              }))} ariaLabel="Edge classification" />

              <GraphSegmentedControl label="Edge role" value={edgePropertiesDraft.edgeRole} options={EDGE_ROLES} statusText={edgePropertiesRoleStatus} onChange={(nextValue) => setEdgePropertiesDraft(current => ({
                ...current,
                edgeRole: nextValue,
              }))} ariaLabel="Edge role" />

              {edgePropertiesDraft.edgeRole !==
                "standard" && (<div className="graph-image-control graph-property-dropdown-control">
                  <div className="graph-image-control-heading">
                    <span>
                      Conditional scope
                    </span>
                  </div>

                  <GraphPropertyDropdown value={edgePropertiesDraft.conditionId} options={conditionalPropertyOptions} placeholder="Auto / none" isOpen={propertyDropdownOpen ===
                    "edgeCondition"} onToggle={() => {
                      setEdgeConditionSearch("");
                      setPropertyDropdownOpen(current => current === "edgeCondition" ? null : "edgeCondition");
                    }} onSelect={(nextValue) => {
                      setEdgePropertiesDraft(current => ({
                        ...current,
                        conditionId: nextValue,
                      }));
                      setPropertyDropdownOpen(null);
                      setEdgeConditionSearch("");
                    }} searchable searchValue={edgeConditionSearch} onSearchChange={setEdgeConditionSearch} searchPlaceholder="Search conditions..." emptyMessage="No matching conditions" ariaLabel="Conditional scope" />
                </div>)}

              <div className="graph-image-modal-hint">
                Auto-detect resolves this edge to <strong>{edgePropertiesRoleStatus.replace("Auto-detect → ", "")}</strong> using the current graph semantics. Reification edges use the conditional colour, a thicker arrow, and a bold relationship label.
              </div>

              <div className="graph-image-modal-actions">
                <button type="button" className="graph-image-modal-action" onClick={closeEdgePropertiesModal}>
                  Cancel
                </button>

                <button type="button" className="graph-image-modal-action primary" onClick={saveEdgeProperties}>
                  <Check size={16} strokeWidth={1.9} />
                  Save properties
                </button>
              </div>
            </div>
          </div>
        </div>)}

        {editingNodeId && (<input className="graph-inline-rename" type="text" value={renameValue} autoFocus style={{
          left: `${renamePosition.x}px`,
          top: `${renamePosition.y}px`,
          width: `${(selectedNode?.imageSrc ? Math.max(selectedNode?.nodeTextMaxWidth || 150, selectedNode?.nodeWidth ||
            110) : (selectedNode?.nodeWidth || 110)) * renameZoom}px`,
          height: `${(selectedNode?.imageSrc ? 36 : (selectedNode?.nodeHeight || 52)) * renameZoom}px`,
          fontSize: `${15 * renameZoom}px`,
          lineHeight: `${(selectedNode?.imageSrc ? 34 : 52) * renameZoom}px`,
          color: selectedNode?.textColor || getThemeColour("--graph-node-text", "#ffffff"),
        }} onChange={(event) => setRenameValue(event.target.value)} onPaste={handleNodeRenameImagePaste} onBlur={() => finishNodeRename()} onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finishNodeRename();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finishNodeRename({
              cancel: true,
            });
          }
        }} />)}

        {editingEdgeId && (<input className="graph-inline-edge-relationship" type="text" value={relationshipValue} autoFocus spellCheck={false} placeholder="Relationship" style={{
          left: `${relationshipPosition.x}px`,
          top: `${relationshipPosition.y}px`,
          width: `${Math.max(90, Math.min(220, relationshipValue.length * 7 +
            36)) *
            relationshipZoom}px`,
          height: `${28 *
            relationshipZoom}px`,
          fontSize: `${12 *
            relationshipZoom}px`,
          lineHeight: `${26 *
            relationshipZoom}px`,
        }} onChange={event => setRelationshipValue(event.target.value)} onBlur={() => finishEdgeRelationship()} onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            finishEdgeRelationship();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finishEdgeRelationship({
              cancel: true,
            });
          }
        }} />)}

        {/* TOP GRAPH OVERLAYS */}

        {(selectionSummary.nodes.length > 0 || selectionSummary.edges.length > 0 ||
          linkMode) && (<div className="graph-top-overlay-stack">

            {/* CURRENT GRAPH SELECTION */}

            {selectedItemCount > 0 && (<div className="graph-selection-overlay">

              {isMultiSelection ? (<>
                <span className="graph-selection-kicker">
                  {selectionSummary.nodes.length > 0 && selectionSummary.edges.length > 0 ? "Selected items"
                    : selectionSummary.nodes.length > 0 ? "Selected nodes" : "Selected edges"}
                </span>

                <strong className="graph-selection-title">
                  {selectionSummary.nodes.length > 0 && (<>
                    {selectionSummary.nodes.length}{" "}
                    node{selectionSummary.nodes.length === 1 ? "" : "s"}
                  </>)}

                  {selectionSummary.nodes.length > 0 && selectionSummary.edges.length > 0 && " · "}

                  {selectionSummary.edges.length > 0 && (<>
                    {selectionSummary.edges.length}{" "}
                    edge{selectionSummary.edges.length === 1 ? "" : "s"}
                  </>)}
                </strong>
              </>) : singleSelectedNode ? (<>
                <span className="graph-selection-kicker">
                  {singleSelectedNode.nodeType === "conditional" ? "Selected conditional node" : "Selected node"}
                </span>

                <strong className="graph-selection-title">
                  {singleSelectedNode.label}
                </strong>

                {singleSelectedNode.nodeType === "conditional" &&
                  singleSelectedNode.conditionOwnerLabel && (<div className="graph-selection-meta">
                    <span>Parent:</span>

                    <strong>
                      {singleSelectedNode.conditionOwnerLabel}
                    </strong>
                  </div>)}

                {singleSelectedNode.nodeType !== "conditional" &&
                  singleSelectedNode.hasImage && (<div className="graph-selection-secondary">
                    Image node
                  </div>)}
              </>) : singleSelectedEdge ? (<>
                <span className="graph-selection-kicker">
                  Selected edge
                </span>

                {isSemanticReification ? (<>
                  <div className="graph-selection-proposition" title={formatProposition(singleSelectedEdge.sourceProposition)}>
                    {formatProposition(singleSelectedEdge.sourceProposition)}
                  </div>

                  {singleSelectedEdge.relationship && (<div className="graph-selection-reification-link">
                    {singleSelectedEdge.relationship}
                  </div>)}

                  <div className="graph-selection-proposition" title={formatProposition(singleSelectedEdge.targetProposition)}>
                    {formatProposition(singleSelectedEdge.targetProposition)}
                  </div>

                  {singleSelectedEdge.conditionLabel && (<div className="graph-selection-meta">
                    <span>Scope:</span>

                    <strong>
                      {singleSelectedEdge.conditionLabel}
                    </strong>
                  </div>)}
                </>) : (<>
                  <strong className="graph-selection-title">
                    {singleSelectedEdge.sourceLabel}
                    {" → "}
                    {singleSelectedEdge.targetLabel}
                  </strong>

                  {singleSelectedEdge.relationship && (<div className="graph-selection-relationship">
                    {singleSelectedEdge.relationship}
                  </div>)}

                  {singleSelectedEdge.qualifier && (<div className="graph-selection-qualifier">
                    {singleSelectedEdge.qualifier}
                  </div>)}

                  {singleSelectedEdge.conditionLabel && (<div className="graph-selection-meta">
                    <span>Scope:</span>

                    <strong>
                      {singleSelectedEdge.conditionLabel}
                    </strong>
                  </div>)}
                </>)}

                {(singleSelectedEdge.classification === "negative" || singleSelectedEdge.classification ===
                  "prerequisite" || singleSelectedEdge.edgeRole ===
                  "reification") && (<div className="graph-selection-badges">

                    {singleSelectedEdge.classification === "negative" && (<span className="graph-selection-badge">
                        Negative
                      </span>)}

                    {singleSelectedEdge.classification === "prerequisite" && (<span className="graph-selection-badge">
                        Prerequisite
                      </span>)}

                    {singleSelectedEdge.edgeRole === "reification" && (<span className="graph-selection-badge">
                        Reification
                      </span>)}

                  </div>)}
              </>) : null}

            </div>)}

            {/* LINK MODE */}

            {linkMode && (<div className="graph-link-mode-overlay">

              <Link2 size={16} strokeWidth={1.8} />

              <div>

                {!firstNodeToLink ? (<>
                  <strong>
                    Link nodes
                  </strong>

                  <span>
                    Select the first node
                  </span>
                </>) : (<>
                  <strong>
                    First node:{" "}
                    {cyRef.current ?.getElementById(firstNodeToLink)
                      .data("label")}
                  </strong>

                  <span>
                    Select the second node
                  </span>
                </>)}

              </div>

              <button type="button" onClick={cancelLinkMode} aria-label="Cancel linking">
                <X size={15} strokeWidth={1.8} />
              </button>

            </div>)}

          </div>)}

        {/* GRAPH FEEDBACK */}

        {graphFeedback && (<div className={`graph-feedback graph-feedback-${graphFeedback.type}`}>
          {graphFeedback.type === "error" ? (<CircleAlert size={16} strokeWidth={2} />) : graphFeedback.type === "info" ? (<LoaderCircle size={16} strokeWidth={2} className="graph-feedback-spinner" />) : (<Check size={16} strokeWidth={2} />)}

          <span>
            {graphFeedback.message}
          </span>
        </div>)}

        {/* SEMANTIC GRAPH SEARCH */}

        <div ref={semanticSearchRef} className={`graph-semantic-search ${semanticSearchOpen
          ? "graph-semantic-search-open" : ""}`}>

          {semanticSearchOpen ? (<>
            <Search size={17} strokeWidth={1.8} className="graph-semantic-search-icon" />

            <input type="text" value={semanticSearchQuery} onChange={(event) => setSemanticSearchQuery(event.target.value)} placeholder="Search graph..." autoFocus onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSemanticSearch();
              }
              if (event.key === "Escape") {
                setSemanticSearchOpen(false);
              }
            }} />

            <button type="button" className="graph-semantic-submit" aria-label="Search graph" data-tooltip="Semantic search" disabled={semanticSearchLoading ||
              !semanticSearchQuery.trim()} onClick={handleSemanticSearch}>

              <ArrowUp size={17} strokeWidth={2} />

            </button>
          </>) : (<button type="button" className="graph-semantic-search-toggle" aria-label="Semantic graph search" data-tooltip="Semantic search" onClick={() => setSemanticSearchOpen(true)}>

            <Search size={18} strokeWidth={1.9} />

          </button>)}

        </div>

      </div>

    </div>

  </section>);
});
export default GraphPanel;