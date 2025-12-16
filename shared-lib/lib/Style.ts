export const ButtonStyleProperties: { id: string; label: string }[] = [
	{ id: 'text', label: 'Text' },
	{ id: 'size', label: 'Font Size' },
	{ id: 'png64', label: 'PNG' },
	{ id: 'alignment', label: 'Text Alignment' },
	{ id: 'pngalignment', label: 'PNG Alignment' },
	{ id: 'color', label: 'Color' },
	{ id: 'bgcolor', label: 'Background' },
]

export const ButtonStylePropertiesWithBuffer: typeof ButtonStyleProperties = [
	...ButtonStyleProperties,
	{ id: 'imageBuffers', label: 'Image Buffers (Deprecated)' },
]
