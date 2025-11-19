export type HexColor = string

export type HslColor = {
	h: number
	l: number
	s: number
	a?: number
}

export type HsvColor = {
	h: number
	s: number
	v: number
	a?: number
}

export type RgbColor = {
	r: number
	g: number
	b: number
	a?: number
}

export type Color = HexColor | HslColor | HsvColor | RgbColor

export type ColorResult = {
	hex: HexColor
	hsl: HslColor
	hsv: HsvColor
	rgb: RgbColor
	oldHue: number
}
