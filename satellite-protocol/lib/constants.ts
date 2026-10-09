/**
 * Version of this API. This follows semver, to allow for clients to check their compatibility
 * 1.0.0 - Initial release
 * 1.1.0 - Add KEY-STATE TYPE and PRESSED properties
 * 1.2.0 - Add DEVICEID to any ERROR responses when known
 * 1.3.0 - Add KEY-ROTATE message
 * 1.4.0 - Add TEXT_STYLE as ADD-DEVICE flags with FONT_SIZE as KEY-STATE property
 * 1.5.0 - Specify desired bitmap size with BITMAPS parameter when adding device
 * 1.5.1 - Remove surface size limit
 * 1.6.0 - Allow for row/column notation,
 * 		 - add streaming of text color when color is requested,
 * 		 - allow choice of returned color format
 * 		 - compatibility with internal CSS colors,
 * 		 - allow buttons > 32
 * 1.7.0 - Support for transferable values. This allows surfaces to emit and consume values that don't align with a control in the grid.
 *       - allow surface to opt out of brightness slider and messages
 * 1.7.1 - Respond with variable name in SET-VARIABLE-VALUE success message
 * 1.8.0 - Add support for remote surface to handle display of locked state
 * 1.9.0 - Add support for complex surface schemas
 * 1.10.0 - Add button subscription API (ADD-SUB, REMOVE-SUB, SUB-PRESS, SUB-ROTATE, SUB-STATE)
 *        - KEY-STATE now includes LOCATION=page/row/column for all button types when location is known
 *        - Add FIRMWARE-UPDATE-INFO to report firmware update availability
 *        - Add CONFIG_FIELDS to ADD-DEVICE for device-specific config fields
 *        - Add DEVICE-CONFIG to relay current config values back to the device
 *        - Add CHANGE-PAGE message for surfaces to navigate pages
 * 1.10.1 - LOCKED-STATE now includes ROTATION
 * 1.11.0 - Add NONSQUARE to CAPS to indicate support for non-square buttons
 * 1.12.0 - Add BITMAP_FORMATS to CAPS and BITMAP_FORMAT to ADD-DEVICE and ADD-SUB to negotiate bitmap encoding (rgb/png/webp)
 * 1.13.0 - Add `leds` capability to advanced-mode style presets (addressable LED strips/rings)
 * 1.14.0 - DIRECTION on KEY-ROTATE and SUB-ROTATE may now be a signed number to carry a rotation
 *          amount (velocity/step count): sign is the direction, magnitude is the number of steps.
 *          `0` still means a single counter-clockwise step for backwards compatibility. Support is
 *          advertised via ROTARY_AMOUNT in CAPS.
 * 1.14.1 - `\` and `"` inside quoted string values are now escaped with a `\`, so values containing
 *          them are no longer corrupted.
 */
export const API_VERSION = '1.14.1'

/**
 * Maximum length of a single line (command) the receive buffer will accumulate before the
 * connection is dropped. This bounds the per-connection memory and closes off a "buffer bomb"
 * where a client streams data forever without ever sending a newline. 2MB is comfortably more
 * than any legitimate line needs (e.g. a base64 bitmap, layout manifest or variable value).
 */
export const MAX_LINE_LENGTH = 2 * 1024 * 1024

/**
 * Upper bounds for the legacy grid description, to prevent a client requesting an absurd grid
 * that would allocate huge amounts of memory (one control object is created per key).
 */
export const MAX_KEYS_TOTAL = 2000
export const MAX_KEYS_PER_ROW = 1000

/**
 * Bitmap encodings a satellite can negotiate for button images.
 * `rgb` is raw pixel data (the universal fallback), `png`/`webp` are lossless compressed images.
 */
export type SatelliteBitmapFormat = 'rgb' | 'png' | 'webp'

/**
 * The bitmap formats defined by the protocol, advertised by Companion via `BITMAP_FORMATS` in CAPS.
 * `rgb` must always be present as the fallback for surfaces without an image decoder.
 */
export const SATELLITE_BITMAP_FORMATS: readonly SatelliteBitmapFormat[] = ['rgb', 'png', 'webp']
