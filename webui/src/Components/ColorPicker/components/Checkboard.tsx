import React from 'react'
import { renderCheckboardCached } from '../helpers/checkboard.js'

export type CheckboardProps = {
	borderRadius?: string | number
	boxShadow?: string
}

export function Checkboard({ borderRadius, boxShadow }: CheckboardProps): React.JSX.Element {
	const gridStyle: React.CSSProperties = {
		borderRadius,
		boxShadow,
		position: 'absolute',
		inset: '0px',
		background: `url(${renderCheckboardCached('transparent', 'rgba(0,0,0,.08)', 8)}) center left`,
	}

	return <div style={gridStyle} />
}
