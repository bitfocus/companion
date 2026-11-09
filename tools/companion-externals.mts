/**
 * Native addons that must not be bundled — installed separately alongside the binary.
 * This list is shared between the esbuild bundler and the dist packager.
 * (sodium-native is the libsodium binding used by noise-handshake for the encrypted direct Link transport)
 */
export const companionNativeExternals: string[] = ['usb', '@napi-rs/canvas', 'sodium-native']
