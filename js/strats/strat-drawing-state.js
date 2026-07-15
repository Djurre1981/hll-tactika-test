export const MAX_UNDO = 40;
export const NUDGE_STEP = 0.15;
export const PASTE_OFFSET = 0.8;

let _svgLayer = null;
let _previewLayer = null;
let _handlesLayer = null;
let _onObjectsChanged = null;
let _onSelectionChange = null;
let _onClipboardChange = null;
let _selectedObjectId = null;
let _clipboardObject = null;
let _pasteIteration = 0;
let _drawSession = null;
let _objectDragSession = null;
let _handleDragSession = null;
let _activeMapViewer = null;

export function getSvgLayer() { return _svgLayer; }
export function setSvgLayer(v) { _svgLayer = v; }

export function getPreviewLayer() { return _previewLayer; }
export function setPreviewLayer(v) { _previewLayer = v; }

export function getHandlesLayer() { return _handlesLayer; }
export function setHandlesLayer(v) { _handlesLayer = v; }

export function getOnObjectsChanged() { return _onObjectsChanged; }
export function setOnObjectsChanged(v) { _onObjectsChanged = v; }

export function getOnSelectionChange() { return _onSelectionChange; }
export function setOnSelectionChange(v) { _onSelectionChange = v; }

export function getOnClipboardChange() { return _onClipboardChange; }
export function setOnClipboardChange(v) { _onClipboardChange = v; }

export function getSelectedObjectId() { return _selectedObjectId; }
export function setSelectedObjectId(v) { _selectedObjectId = v; }

export function getClipboardObject() { return _clipboardObject; }
export function setClipboardObject(v) { _clipboardObject = v; }

export function getPasteIteration() { return _pasteIteration; }
export function setPasteIteration(v) { _pasteIteration = v; }

export function getDrawSession() { return _drawSession; }
export function setDrawSession(v) { _drawSession = v; }

export function getObjectDragSession() { return _objectDragSession; }
export function setObjectDragSession(v) { _objectDragSession = v; }

export function getHandleDragSession() { return _handleDragSession; }
export function setHandleDragSession(v) { _handleDragSession = v; }

export function getActiveMapViewer() { return _activeMapViewer; }
export function setActiveMapViewer(v) { _activeMapViewer = v; }
