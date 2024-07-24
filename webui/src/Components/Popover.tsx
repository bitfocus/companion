import React from 'react'
import { useCallback, useRef, useState } from 'react'

export const Popover = ({
	content,
	hoverWait = 500,
	children,
	style = {},
  className = ''
}: {
	content: string
	hoverWait?: number
	children: React.ReactNode
	style?: React.CSSProperties
  className?: string
}): JSX.Element => {
	const timer = useRef<number | null>(null)
	const [visible, setVisible] = useState(false)

	const onMouseEnter = useCallback(() => {
		timer.current = window.setTimeout(() => {
			setVisible(true)
		}, hoverWait)
	}, [hoverWait])

	const onMouseLeave = useCallback(() => {
		if (timer.current !== null) {
			clearTimeout(timer.current)
			timer.current = null
		}
		setVisible(false)
	}, [])

	return (
		<div className="inline-block" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			{children}
			{visible && (
				<div
          className={className}
					style={{
						position: 'absolute',
						zIndex: 1000,
						...style,
					}}
				>
					{content}
				</div>
			)}
		</div>
	)
}
