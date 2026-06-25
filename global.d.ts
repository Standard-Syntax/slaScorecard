/*
 *  Ambient module declarations for non-code imports.
 */

declare module "*.less";
declare module "*.css";
declare module "*.woff";
declare module "*.woff2";
declare module "*.ttf";
declare module "*.otf";
declare module "*.eot";
declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*svelte-bundle.js" {
    import type { Component } from "svelte";
    const App: Component<Record<string, unknown>>;
    export default App;
}
