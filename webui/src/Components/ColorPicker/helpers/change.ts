import type React from 'react'

export function calculateXyPercent(
	e: React.MouseEvent | React.TouchEvent | MouseEvent,
	container: HTMLElement
): { x: number; y: number } {
	const x =
		typeof (e as React.MouseEvent).pageX === 'number'
			? (e as React.MouseEvent).pageX
			: (e as React.TouchEvent).touches[0].pageX
	const y =
		typeof (e as React.MouseEvent).pageY === 'number'
			? (e as React.MouseEvent).pageY
			: (e as React.TouchEvent).touches[0].pageY
	const left = x - (container.getBoundingClientRect().left + window.pageXOffset)
	const top = y - (container.getBoundingClientRect().top + window.pageYOffset)

	return {
		x: Math.min(Math.max(left / container.clientWidth, 0), 1),
		y: Math.min(Math.max(top / container.clientHeight, 0), 1),
	}
}
