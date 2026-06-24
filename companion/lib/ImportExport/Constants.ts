import { constants as bufferConstants } from 'node:buffer'

export const FILE_VERSION = 12

export const MAX_IMPORT_FILE_SIZE = 1024 * 1024 * 500 // 500MB. This is small enough that it can be kept in memory

// The decompressed data is immediately converted to a single JS string via toString('utf-8'),
// which cannot exceed MAX_STRING_LENGTH (~512MiB on 64-bit). Allowing more would just let a
// malicious archive allocate more memory before failing at the toString, so cap it here.
export const MAX_DECOMPRESSED_FILE_SIZE = bufferConstants.MAX_STRING_LENGTH
