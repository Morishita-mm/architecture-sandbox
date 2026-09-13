// The production build validates this value in vite.config.ts.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
export const APP_SHARE_URL = import.meta.env.VITE_APP_SHARE_URL || window.location.origin;
