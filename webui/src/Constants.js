export const MAX_BUTTONS = 32
export const MAX_COLS = 8
export const MAX_ROWS = MAX_BUTTONS / MAX_COLS

const bmpHeaderSize = 54
const bmpHeader = Buffer.alloc(bmpHeaderSize)
bmpHeader.write('BM', 0, 2) // flag
bmpHeader.writeUInt32LE(72 * 72 * 3 + bmpHeaderSize, 2) // filesize
bmpHeader.writeUInt32LE(0, 6) // reserver
bmpHeader.writeUInt32LE(bmpHeaderSize, 10) // data start

bmpHeader.writeUInt32LE(40, 14) // header info size
bmpHeader.writeUInt32LE(72, 18) // width
bmpHeader.writeInt32LE(-72, 22) // height
bmpHeader.writeUInt16LE(1, 26) // planes
bmpHeader.writeUInt16LE(24, 28) // bits per pixel
bmpHeader.writeUInt32LE(0, 30) // compress
bmpHeader.writeUInt32LE(72 * 72 * 3, 34) // data size
bmpHeader.writeUInt32LE(0, 38) // hr
bmpHeader.writeUInt32LE(0, 42) // vr
bmpHeader.writeUInt32LE(0, 46) // colors
bmpHeader.writeUInt32LE(0, 48) // importantColors

export const PREVIEW_BMP_HEADER = bmpHeader

export const FONT_SIZES = [
	{ id: 'auto', label: 'Auto' },
	{ id: '7', label: '7pt' },
	{ id: '14', label: '14pt' },
	{ id: '18', label: '18pt' },
	{ id: '24', label: '24pt' },
	{ id: '30', label: '30pt' },
	{ id: '44', label: '44pt' },
]

export const PRIMARY_COLOR = '#d50215'
