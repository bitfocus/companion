/**
 * Native addons that must not be bundled — installed separately alongside the binary.
 * This list is shared between the esbuild bundler and the dist packager.
 */
export const companionNativeExternals: string[] = ['usb', '@napi-rs/canvas']
