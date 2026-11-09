/**
 * Layout of the macOS DMG window, shared by the background generator (build_installer_art.mts) and the
 * electron-builder config (package.mts) so the drawn tiles and arrow line up with where Finder puts the icons.
 */
/**
 * The background image. electron-builder sizes the whole Finder window to it, title bar included, so the bottom
 * 32pt or so are hidden behind the title bar, and the path/status bars hide more when the user has them on.
 */
export const DMG_BACKGROUND = { width: 540, height: 412 }
export const DMG_ICON_SIZE = 112
export const DMG_APP_POSITION = { x: 140, y: 196 }
export const DMG_APPLICATIONS_POSITION = { x: 400, y: 196 }
