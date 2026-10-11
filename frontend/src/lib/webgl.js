// Whether this browser can draw 3D (WebGL). Old graphics drivers, disabled
// hardware acceleration or company policies turn it off; the constructor
// then shows the flat product photos instead of the 3D models.
export const WEBGL_AVAILABLE = (() => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
})();
