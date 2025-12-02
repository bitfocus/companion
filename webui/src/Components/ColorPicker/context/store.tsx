import { type IObservableValue, observable, runInAction } from 'mobx'
import type { Color, ColorResult, HexColor, HslColor, HsvColor, RgbColor } from '../colors'
import { colord, type Colord } from 'colord'

export class ColorsStore {
	readonly state: IObservableValue<ColorResult>

	constructor(defaultColor: Color) {
		this.state = observable.box(toState(colord(defaultColor)))
	}

	get hex(): HexColor {
		return this.state.get().hex
	}
	get rgb(): RgbColor {
		return this.state.get().rgb
	}
	get hsl(): HslColor {
		return this.state.get().hsl
	}
	get hsv(): HsvColor {
		return this.state.get().hsv
	}

	update(newcol: Colord): ColorResult {
		return runInAction(() => {
			const newState = toState(newcol)
			this.state.set(newState)

			return newState
		})
	}
}

function toState(col: Colord): ColorResult {
	const hsl = col.toHsl()

	return {
		hsl,
		hex: col.toHex(),
		rgb: col.toRgb(),
		hsv: col.toHsv(),
		oldHue: hsl.h,
	}
}
