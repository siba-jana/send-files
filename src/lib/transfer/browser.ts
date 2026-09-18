/** Browser capability detection for the transfer engine and UI. */

export function webrtcSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.RTCPeerConnection !== 'undefined' &&
    typeof RTCDataChannel !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    (navigator.mediaDevices !== undefined || true) // getUserMedia not required for DataChannels
  );
}

/** File System Access API (showSaveFilePicker) — Chrome/Edge desktop. */
export function fsAccessSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

/** Directory picker (multi-file streaming straight to a folder). */
export function dirPickerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Files dropped from a directory drag need webkitGetAsEntry traversal. */
export function dragDropDirSupported(): boolean {
  if (typeof DataTransferItem === 'undefined') return false;
  return typeof DataTransferItem.prototype.webkitGetAsEntry === 'function';
}
