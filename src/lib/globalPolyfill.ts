// Polyfill: opus-media-recorder uses 'global' (Node.js) instead of 'window'
// This must be imported BEFORE opus-media-recorder
if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}
