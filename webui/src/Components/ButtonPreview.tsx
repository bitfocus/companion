import classnames from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

// Single pixel of red
// eslint-disable-next-line react-refresh/only-export-components
export const RedImage: string =
	'data:image/bmp;base64,Qk2OAAAAAAAAAIoAAAB8AAAAAQAAAP////8BACAAAwAAAAQAAAAnAAAAJwAAAAAAAAAAAAAA/wAAAAD/AAAAAP8AAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAA=='

export interface ButtonPreviewProps extends Omit<ButtonPreviewBaseProps, 'onClick'> {
	onClick?: (location: ControlLocation, pressed: boolean) => void
	onContextMenu?: (location: ControlLocation, x: number, y: number) => void
	copySource?: boolean
	contextMenuOpen?: boolean
	location: ControlLocation
}

export const ButtonPreview = memo(function ButtonPreview(props: ButtonPreviewProps) {
	const classes = {
		'button-control': true,
		fixed: !!props.fixedSize && props.fixedSize !== 100,
		'fixed-100': props.fixedSize === 100,
		drophere: props.canDrop,
		drophover: props.dropHover,
		draggable: !!props.dragRef,
		selected: props.selected,
		'copy-source': !!props.copySource,
		'context-menu-open': !!props.contextMenuOpen,
		clickable: !!props.onClick,
		right: !!props.right,
	}

	const preloadedImage = useImagePreloader(props.preview || null)

	const hasPointerEvents = 'onpointerdown' in window

	const rawOnClick = props.onClick
	const rawLocation = props.location
	const rawOnContextMenu = props.onContextMenu

	// Tracks whether a press-down was actually fired, so we can ensure a matching release.
	// Also guards against pointercancel (button=0) firing spuriously after right-click.
	const isPressedRef = useRef(false)

	// Merge our own ref onto the root element (alongside any dnd dropRef) so we can attach a native,
	// non-passive touchstart listener below.
	const rootElementRef = useRef<HTMLDivElement | null>(null)
	const dropRef = props.dropRef
	const setRootRef = useCallback(
		(el: HTMLDivElement | null) => {
			rootElementRef.current = el
			dropRef?.(el)
		},
		[dropRef]
	)

	// On plain hold buttons (no context menu, e.g. the Surface Emulator and the Tablet/Web buttons
	// page) suppress the browser's long-press gesture entirely: on a stationary touch Android Chrome
	// otherwise fires a haptic buzz and a context-menu/pointercancel that releases the button early.
	// This requires a native non-passive listener - React's synthetic onTouchStart is passive and its
	// preventDefault() is a no-op. Grid buttons (with a context menu) intentionally keep the long-press.
	useEffect(() => {
		const el = rootElementRef.current
		if (!el || rawOnContextMenu) return

		const handleTouchStart = (e: TouchEvent) => {
			e.preventDefault()
		}
		el.addEventListener('touchstart', handleTouchStart, { passive: false })
		return () => el.removeEventListener('touchstart', handleTouchStart)
	}, [rawOnContextMenu])

	const doPress = useCallback(
		(e: React.UIEvent) => {
			if (e.type !== 'pointerdown' && e.type !== 'mousedown') e.preventDefault()
			e.stopPropagation()

			// Skip primary action for right-click/secondary pointer — context menu only
			const isSecondaryButton = 'button' in e && (e as React.PointerEvent).button === 2
			if (!isSecondaryButton) {
				rawOnClick?.(rawLocation, true)
				isPressedRef.current = true
			}
		},
		[rawOnClick, rawLocation]
	)

	const doRelease = useCallback(
		(e: React.UIEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (isPressedRef.current) {
				isPressedRef.current = false
				rawOnClick?.(rawLocation, false)
			}
		},
		[rawOnClick, rawLocation]
	)

	const handleNativeContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
			e.preventDefault()
			e.stopPropagation()

			// Without a context menu (e.g. the Surface Emulator or the Tablet/Web buttons page) a
			// long-press must not release the button - the press has to continue until the finger is
			// lifted. Otherwise the browser's long-press gesture cancels a stationary hold (issue #4322).
			if (!rawOnContextMenu) return

			// A press was started (mobile long-press), release it before opening the menu
			if (isPressedRef.current) {
				isPressedRef.current = false
				rawOnClick?.(rawLocation, false)
			}
			rawOnContextMenu(rawLocation, e.clientX, e.clientY)
		},
		[rawOnContextMenu, rawOnClick, rawLocation]
	)

	return (
		<div
			ref={setRootRef}
			className={classnames(classes)}
			style={props.style}
			// Prefer the newer pointer events
			onPointerDown={hasPointerEvents ? doPress : undefined}
			onPointerUp={hasPointerEvents ? doRelease : undefined}
			// Only release on pointercancel when a context menu is present. For plain hold buttons
			// (emulator/tablet), a stationary touch triggers a spurious pointercancel on Android Chrome
			// that would release the button early; there we keep it held until pointerup (issue #4322).
			onPointerCancel={hasPointerEvents && rawOnContextMenu ? doRelease : undefined}
			// Setup the older mouse and touch events for compatibility
			onMouseDown={!hasPointerEvents ? doPress : undefined}
			onMouseUp={!hasPointerEvents ? doRelease : undefined}
			onTouchStart={!hasPointerEvents ? doPress : undefined}
			onTouchEnd={!hasPointerEvents ? doRelease : undefined}
			onTouchCancel={!hasPointerEvents ? doRelease : undefined}
			onContextMenu={handleNativeContextMenu}
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
	className?: string
	fixedSize?: boolean | 100
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

export const ButtonPreviewBase = memo(function ButtonPreview(props: ButtonPreviewBaseProps) {
	const classes = {
		'button-control': true,
		fixed: !!props.fixedSize && props.fixedSize !== 100,
		'fixed-100': props.fixedSize === 100,
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
			// dnd-kit clones the element holding the drag ref into a top-layer popover as the drag
			// feedback. It must be the outer .button-control (which carries the `.fixed` sizing for
			// its child .button-border) - putting it on the inner element detaches it from `.fixed`
			// and the `padding-bottom: 100%` aspect hack then resolves against the viewport.
			ref={props.dragRef ?? props.dropRef}
			className={classnames(classes, props.className)}
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
