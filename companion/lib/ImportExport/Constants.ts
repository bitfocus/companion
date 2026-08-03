import { constants as bufferConstants } from 'node:buffer'

export const FILE_VERSION = 12

// Uploads are held in memory as a single Buffer while being parsed (see MultipartUploader).
// JSON (plain or gz) is parsed by streaming, so it is not bound by MAX_STRING_LENGTH - only by
// available memory. 1GiB gives plenty of headroom for a large uncompressed JSON upload while
// keeping the in-memory buffer bounded. (A large config exported as json-gz uploads compressed,
// so it stays well under this regardless.)
export const MAX_IMPORT_FILE_SIZE = 1024 * 1024 * 1024 // 1GiB

// The YAML import path (and any small file) is decompressed/read into a single JS string via
// toString('utf-8'), which cannot exceed MAX_STRING_LENGTH (~512MiB on 64-bit). Files larger than
// this cannot be handled as YAML and are rejected with a clear message rather than crashing.
export const MAX_DECOMPRESSED_FILE_SIZE = bufferConstants.MAX_STRING_LENGTH

// The streaming JSON import path never builds a single JS string, so it is not bound by
// MAX_STRING_LENGTH. It still holds the fully-parsed object graph in memory, so cap the total
// decompressed byte count to protect against a decompression bomb inflating far beyond the upload.
// Keep this within reach of the V8 heap: the parsed object graph costs several times the byte count,
// so a much larger cap would OOM before it could reject cleanly. Matches the 1GiB plain-JSON upload cap.
export const MAX_STREAMED_DECOMPRESSED_FILE_SIZE = 1024 * 1024 * 1024 // 1GiB
