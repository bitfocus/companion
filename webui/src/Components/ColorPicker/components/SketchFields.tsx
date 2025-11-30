import React, { useCallback } from 'react'
import { EditableInput } from './EditableInput.js'
import { useColor, type OnChangeFn } from '../context/useColor.js'

export interface SketchFieldsProps {
	disableAlpha?: boolean
}

export function SketchFields({ disableAlpha }: SketchFieldsProps): React.JSX.Element {
	const { colors, changeRgbColor, changeHexColor } = useColor()

	const styles: Record<string, React.CSSProperties> = {
		fields: {
			display: 'flex',
			paddingTop: '4px',
		},
		single: {
			flex: '1',
			paddingLeft: '6px',
		},
		alpha: {
			flex: '1',
			paddingLeft: '6px',
		},
		double: {
			flex: '2',
		},
	}

	const changeRed: OnChangeFn<string | number> = useCallback(
		(v, e) => changeRgbColor({ r: Number(v) }, e),
		[changeRgbColor]
	)
	const changeGreen: OnChangeFn<string | number> = useCallback(
		(v, e) => changeRgbColor({ g: Number(v) }, e),
		[changeRgbColor]
	)
	const changeBlue: OnChangeFn<string | number> = useCallback(
		(v, e) => changeRgbColor({ b: Number(v) }, e),
		[changeRgbColor]
	)
	const changeAlpha: OnChangeFn<string | number> = useCallback(
		(v, e) => changeRgbColor({ a: Number(v) / 100 }, e),
		[changeRgbColor]
	)

	return (
		<div style={styles.fields} className="flexbox-fix">
			<div style={styles.double}>
				<EditableInput
					label="hex"
					value={colors.hex.replace('#', '').toUpperCase()}
					onChange={changeHexColor as OnChangeFn<string | number>}
				/>
			</div>
			<div style={styles.single}>
				<EditableInput label="r" value={colors.rgb.r} onChange={changeRed} dragLabel dragMax={255} />
			</div>
			<div style={styles.single}>
				<EditableInput label="g" value={colors.rgb.g} onChange={changeGreen} dragLabel dragMax={255} />
			</div>
			<div style={styles.single}>
				<EditableInput label="b" value={colors.rgb.b} onChange={changeBlue} dragLabel dragMax={255} />
			</div>
			{!disableAlpha && (
				<div style={styles.alpha}>
					<EditableInput
						label="a"
						value={Math.round((colors.rgb.a ?? 1) * 100)}
						onChange={changeAlpha}
						dragLabel
						dragMax={100}
					/>
				</div>
			)}
		</div>
	)
}
