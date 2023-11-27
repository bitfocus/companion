export type KeyMap = Record<number, [number, number] | undefined>

// Added last row for logitec controllers (PageUp, PageDown, F5, Escape, .)
export const keyboardKeymap: KeyMap = {
	49: [0, 0],
	50: [1, 0],
	51: [2, 0],
	52: [3, 0],
	53: [4, 0],
	54: [5, 0],
	55: [6, 0],
	56: [7, 0],
	81: [0, 1],
	87: [1, 1],
	69: [2, 1],
	82: [3, 1],
	84: [4, 1],
	89: [5, 1],
	85: [6, 1],
	73: [7, 1],
	65: [0, 2],
	83: [1, 2],
	68: [2, 2],
	70: [3, 2],
	71: [4, 2],
	72: [5, 2],
	74: [6, 2],
	75: [7, 2],
	90: [0, 3],
	88: [1, 3],
	67: [2, 3],
	86: [3, 3],
	66: [4, 3],
	78: [5, 3],
	77: [6, 3],
	188: [7, 3],
}

export const logitecKeymap: KeyMap = {
	33: [1, 0],
	34: [2, 0],
	190: [3, 0],
	116: [1, 1],
	27: [2, 1],
}

export const dsanMastercueKeymap: KeyMap = {
	37: [1, 0],
	39: [2, 0],
	66: [3, 0],
}
