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
