/**
 * CRC32 implementation for chunk integrity verification.
 * Uses the standard CRC-32 polynomial (0xEDB88320).
 */

/** Pre-computed CRC32 lookup table */
const CRC32_TABLE = new Uint32Array(256)

// Generate CRC32 lookup table
for (let i = 0; i < 256; i++) {
	let crc = i
	for (let j = 0; j < 8; j++) {
		crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
	}
	CRC32_TABLE[i] = crc
}

/**
 * Compute CRC32 checksum of a buffer.
 * @param data - Input buffer
 * @returns CRC32 checksum as an unsigned 32-bit integer
 */
export function crc32(data: Buffer | Uint8Array): number {
	let crc = 0xffffffff

	for (let i = 0; i < data.length; i++) {
		crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff]
	}

	return (crc ^ 0xffffffff) >>> 0
}
