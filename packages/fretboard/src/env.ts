// Portable environment flags. This package is consumed by two bundlers
// (Vite for the web app, Metro for the Expo DOM island); process.env.NODE_ENV
// is the only env probe both replace statically. Never use import.meta here.
export const IS_DEV: boolean = process.env.NODE_ENV !== "production";
export const IS_TEST: boolean = process.env.NODE_ENV === "test";
