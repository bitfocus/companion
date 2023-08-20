import { Buffer } from 'buffer'

// Hack for csv library which needs a global 'Buffer'
window.Buffer = Buffer

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
