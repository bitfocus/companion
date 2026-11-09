/**
 * Size limits for the image library. Kept in their own module, as both the library and its REST API need them
 */

/** Largest image data URL accepted by the image library */
export const MAX_IMPORT_FILE_SIZE = 1024 * 1024 * 10 // 10MB limit, just in case

/** Largest raw image accepted by the image library, so that its data URL stays within MAX_IMPORT_FILE_SIZE */
export const MAX_IMAGE_DATA_SIZE = Math.floor((MAX_IMPORT_FILE_SIZE * 3) / 4) - 1024
