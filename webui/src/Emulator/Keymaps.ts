export type KeyMap = Record<string | number, [number, number] | undefined>

// Added last row for logitec controllers (PageUp, PageDown, F5, Escape, .)
export const keyboardKeymap: KeyMap = {
	Digit1: [0, 0],
	Digit2: [1, 0],
	Digit3: [2, 0],
	Digit4: [3, 0],
	Digit5: [4, 0],
	Digit6: [5, 0],
	Digit7: [6, 0],
	Digit8: [7, 0],
	Digit9: [8, 0],
	Digit0: [9, 0],
	KeyQ: [0, 1],
	KeyW: [1, 1],
	KeyE: [2, 1],
	KeyR: [3, 1],
	KeyT: [4, 1],
	KeyY: [5, 1],
	KeyU: [6, 1],
	KeyI: [7, 1],
	KeyO: [8, 1],
	KeyP: [9, 1],
	KeyA: [0, 2],
	KeyS: [1, 2],
	KeyD: [2, 2],
	KeyF: [3, 2],
	KeyG: [4, 2],
	KeyH: [5, 2],
	KeyJ: [6, 2],
	KeyK: [7, 2],
	KeyL: [8, 2],
	Semicolon: [9, 2],
	KeyZ: [0, 3],
	KeyX: [1, 3],
	KeyC: [2, 3],
	KeyV: [3, 3],
	KeyB: [4, 3],
	KeyN: [5, 3],
	KeyM: [6, 3],
	Comma: [7, 3],
	Period: [8, 3],
	Slash: [9, 3],
}

export const logitecKeymap: KeyMap = {
	PageUp: [1, 0],
	PageDown: [2, 0],
	Period: [3, 0], // Clashes with above
	116: [1, 1], // F5?
	27: [2, 1], // Escape
}

export const dsanMastercueKeymap: KeyMap = {
	ArrowLeft: [1, 0],
	ArrowRight: [2, 0],
	KeyB: [3, 0], // Clashes with above
}
