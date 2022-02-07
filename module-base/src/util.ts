export function literal<T>(v: T): T {
	return v;
}

/** Type assert that a value is never */
export function assertNever(_val: never): void {
	// Nothing to do
}

export interface RgbComponents {
	r: number;
	g: number;
	b: number;
}

export function combineRgb(r: number, g: number, b: number): number {
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function splitRgb(dec: number): RgbComponents {
	return {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: dec & 0x0000ff,
	};
}
