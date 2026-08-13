import type { PluginCreator } from 'postcss'

// Type declaration for the plain-JS PostCSS plugin (postcss-wrap-layer.mjs), so it can be imported
// from TypeScript (vite.config.ts and its unit test) without an implicit-any error.
declare const postcssWrapLayer: PluginCreator<void>
export default postcssWrapLayer
