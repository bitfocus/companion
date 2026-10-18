export async function blobToDataURL(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const loader = new FileReader()
		loader.onload = (e) => {
			if (!e.target?.result) {
				reject(new Error('Failed to load blob as data URL'))
			} else {
				resolve(e.target.result as string)
			}
		}
		loader.onerror = (e) => {
			reject(new Error('Failed to load blob as data URL: ' + e.target?.error?.message))
		}
		loader.readAsDataURL(blob)
	})
}

/**
 * Compute the size in bytes of the payload of a data URL, without decoding it
 */
export function getDataUrlByteSize(dataUrl: string): number {
	const commaIndex = dataUrl.indexOf(',')
	if (commaIndex === -1) return dataUrl.length

	const header = dataUrl.slice(0, commaIndex)
	const payloadLength = dataUrl.length - commaIndex - 1

	if (!header.endsWith(';base64')) {
		// Percent-encoded data, roughly one byte per character
		return payloadLength
	}

	let padding = 0
	if (dataUrl.endsWith('==')) padding = 2
	else if (dataUrl.endsWith('=')) padding = 1
	return Math.floor((payloadLength * 3) / 4) - padding
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
