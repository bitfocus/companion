import React, { useCallback, useEffect, useRef } from 'react'
import cssStyles from './ClickAndDragDiv.module.css'
import classNames from 'classnames'

export interface ClickAndDragDivProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	onChange: (e: React.MouseEvent | React.TouchEvent | MouseEvent, container: HTMLDivElement) => void
	dragXy?: boolean
}

export function ClickAndDragDiv({
	children,
	onChange,
	dragXy,
	...divProps
}: React.PropsWithChildren<ClickAndDragDivProps>): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null)
	const unbindRefs = useRef<(() => void) | null>(null)

	useEffect(() => {
		return () => {
			unbindRefs.current?.()
			unbindRefs.current = null
		}
	}, [unbindRefs])

	const handleChange = useCallback(
		(e: React.MouseEvent | React.TouchEvent | MouseEvent) => {
			e.preventDefault()
			if (!containerRef.current) return
			onChange(e, containerRef.current)
		},
		[onChange]
	)

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			handleChange(e)

			const handleMouseUp = () => {
				unbindRefs.current?.()
				unbindRefs.current = null
			}

			window.addEventListener('mousemove', handleChange)
			window.addEventListener('mouseup', handleMouseUp)

			unbindRefs.current?.()
			unbindRefs.current = () => {
				window.removeEventListener('mousemove', handleChange)
				window.removeEventListener('mouseup', handleMouseUp)
			}
		},
		[handleChange]
	)

	return (
		<div
			{...divProps}
			ref={containerRef}
			onMouseDown={handleMouseDown}
			onTouchMove={handleChange}
			onTouchStart={handleChange}
			className={classNames(divProps.className, dragXy ? cssStyles.dragDivXy : cssStyles.dragDiv)}
		>
			{children}
		</div>
	)
}
