import React, { useCallback, useEffect, useState } from 'react'
import classnames from 'classnames'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

// Single pixel of red
// eslint-disable-next-line react-refresh/only-export-components
export const RedImage: string =
	'data:image/bmp;base64,Qk2OAAAAAAAAAIoAAAB8AAAAAQAAAP////8BACAAAwAAAAQAAAAnAAAAJwAAAAAAAAAAAAAA/wAAAAD/AAAAAP8AAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAA=='

export interface ButtonPreviewProps extends Omit<ButtonPreviewBaseProps, 'onClick'> {
	onClick?: (location: ControlLocation, pressed: boolean) => void
	location: ControlLocation
}

export const ButtonPreview = React.memo(function ButtonPreview(props: ButtonPreviewProps) {
	const classes = {
		'button-control': true,
		fixed: !!props.fixedSize,
		drophere: props.canDrop,
		drophover: props.dropHover,
		draggable: !!props.dragRef,
		selected: props.selected,
		clickable: !!props.onClick,
		right: !!props.right,
	}

	const preloadedImage = useImagePreloader(props.preview || null)

	const hasPointerEvents = 'onpointerdown' in window

	const rawOnClick = props.onClick
	const rawLocation = props.location

	const doPress = useCallback(
		(e: React.UIEvent) => {
			if (e.type !== 'pointerdown' && e.type !== 'mousedown') e.preventDefault()
			e.stopPropagation()

			rawOnClick?.(rawLocation, true)
		},
		[rawOnClick, rawLocation]
	)
	const doRelease = useCallback(
		(e: React.UIEvent) => {
			e.preventDefault()
			e.stopPropagation()

			rawOnClick?.(rawLocation, false)
		},
		[rawOnClick, rawLocation]
	)

	return (
		<div
			ref={props.dropRef}
			className={classnames(classes)}
			style={props.style}
			// Prefer the newer pointer events
			onPointerDown={hasPointerEvents ? doPress : undefined}
			onPointerUp={hasPointerEvents ? doRelease : undefined}
			// Setup the older mouse and touch events for compatibility
			onMouseDown={!hasPointerEvents ? doPress : undefined}
			onMouseUp={!hasPointerEvents ? doRelease : undefined}
			onTouchStart={!hasPointerEvents ? doPress : undefined}
			onTouchEnd={!hasPointerEvents ? doRelease : undefined}
			onTouchCancel={!hasPointerEvents ? doRelease : undefined}
			onContextMenu={(e) => {
				e.preventDefault()
				e.stopPropagation()
				return false
			}}
		>
			<div
				className="button-border"
				ref={props.dragRef}
				style={{
					backgroundImage: preloadedImage ? `url(${preloadedImage})` : undefined,
				}}
				title={props.title}
			>
				{!preloadedImage && props.placeholder && <div className="button-placeholder">{props.placeholder}</div>}
			</div>
		</div>
	)
})

export interface ButtonPreviewBaseProps {
	fixedSize?: boolean
	canDrop?: boolean
	dropHover?: boolean
	dragRef?: React.RefCallback<HTMLDivElement>
	selected?: boolean
	onClick?: (pressed: boolean) => void
	right?: boolean
	dropRef?: React.RefCallback<HTMLDivElement>
	style?: React.CSSProperties
	preview: string | undefined | null | false
	placeholder?: string
	title?: string
}

export const ButtonPreviewBase = React.memo(function ButtonPreview(props: ButtonPreviewBaseProps) {
	const classes = {
		'button-control': true,
		fixed: !!props.fixedSize,
		drophere: props.canDrop,
		drophover: props.dropHover,
		draggable: !!props.dragRef,
		selected: props.selected,
		clickable: !!props.onClick,
		right: !!props.right,
	}

	const preloadedImage = useImagePreloader(props.preview || null)

	return (
		<div
			ref={props.dropRef}
			className={classnames(classes)}
			style={props.style}
			onMouseDown={() => props.onClick?.(true)}
			onMouseUp={() => props.onClick?.(false)}
			onTouchStart={(e) => {
				e.preventDefault()
				props?.onClick?.(true)
			}}
			onTouchEnd={(e) => {
				e.preventDefault()
				props?.onClick?.(false)
			}}
			onTouchCancel={(e) => {
				e.preventDefault()
				e.stopPropagation()

				props?.onClick?.(false)
			}}
			onContextMenu={(e) => {
				e.preventDefault()
				e.stopPropagation()
				return false
			}}
		>
			<div
				className="button-border"
				ref={props.dragRef}
				style={{
					backgroundImage: preloadedImage ? `url(${preloadedImage})` : undefined,
				}}
				title={props.title}
			>
				{!preloadedImage && props.placeholder && <div className="button-placeholder">{props.placeholder}</div>}
			</div>
		</div>
	)
})

function useImagePreloader(imageUrl: string | null) {
	const [preloadedImage, setPreloadedImage] = useState<string | null>(imageUrl)
	useEffect(() => {
		let aborted = false

		if (!imageUrl) {
			setPreloadedImage(imageUrl ?? null)
			return
		}

		const image = new Image()
		image.onload = () => {
			if (!aborted) {
				setPreloadedImage(imageUrl)
			}
		}
		image.src = imageUrl

		return () => {
			aborted = true
		}
	}, [imageUrl])

	return preloadedImage
}
