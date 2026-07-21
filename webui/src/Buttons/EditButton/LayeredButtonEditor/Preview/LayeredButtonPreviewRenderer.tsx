import { observer } from 'mobx-react-lite'
import QuickLRU from 'quick-lru'
import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocalStorage, useResizeObserver } from 'usehooks-ts'
import type { TextLayoutCache } from '@companion-app/shared/Graphics/ImageBase.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import type { ResolveButtonStylePropertiesConfig } from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import type { DropdownChoice } from '@companion-module/base'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { FormLabel } from '~/Components/Form'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { LayeredStyleStore } from '../StyleStore.js'
import { buildBoundsValues, getDraggableBoundsFields, type BoundsFractions, type BoundsKey } from './boundsFields.js'
import { fitCanvasSize, PAD_X, PAD_Y } from './canvasSize.js'
import { useLayeredButtonDrawStyleParser } from './DrawStyleParser.js'
import { buildElementRects, findElementRect, hitTestElements } from './elementHitTest.js'
import FontLoader from './FontLoader.js'
import { GraphicsImage } from './Image.js'
import { QuickActionsToolbar } from './QuickActionsToolbar.js'
import { SelectionOverlay } from './SelectionOverlay.js'

interface LayeredButtonPreviewRendererProps {
	controlId: string
	location: ControlLocation
	styleStore: LayeredStyleStore
}
export const LayeredButtonPreviewRenderer = observer(function LayeredButtonPreviewRenderer({
	controlId,
	location,
	styleStore,
}: LayeredButtonPreviewRendererProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const drawConfig = useComputed<ResolveButtonStylePropertiesConfig>(
		() => ({
			buttons_decoration: userConfig.properties?.buttons_decoration ?? ButtonGraphicsDecorationType.TopBar,
			buttons_status_icons: userConfig.properties?.buttons_status_icons ?? 'show',
		}),
		[userConfig]
	)

	const drawStyle = useLayeredButtonDrawStyleParser(controlId, location, drawConfig, styleStore)

	const [aspectRatio, setAspectRatio] = useLocalStorage('layered-button-preview-aspect-ratio', '1:1')

	// The canvas is sized in JS to fit the measured container. It can't be done in CSS: the wrapper has to
	// shrink-wrap the canvas exactly (the selection overlay positions itself as a percentage of that box),
	// which leaves the canvas's own `max-height: 100%` resolving against an auto-height parent, so it would
	// never scale down and would overflow the panel instead.
	const containerRef = useRef<HTMLDivElement>(null)
	const { width: containerWidth = 0, height: containerHeight = 0 } = useResizeObserver({ ref: containerRef })

	const { width, height } = useMemo(
		() => fitCanvasSize(aspectRatio, containerWidth, containerHeight),
		[aspectRatio, containerWidth, containerHeight]
	)

	const aspectRatioFieldId = useId()

	// Owned here rather than in the overlay: the toolbar toggles them and the overlay's drag math reads
	// them. Refs are what the drag listeners read, since they're registered once per drag.
	const [linked, setLinked] = useState(false)
	const linkedRef = useRef(false)
	const toggleLinked = useCallback(() => {
		linkedRef.current = !linkedRef.current
		setLinked(linkedRef.current)
	}, [])

	const [snapEnabled, setSnapEnabled] = useState(true)
	const snapEnabledRef = useRef(true)
	const toggleSnapEnabled = useCallback(() => {
		snapEnabledRef.current = !snapEnabledRef.current
		setSnapEnabled(snapEnabledRef.current)
	}, [])

	return (
		<>
			<div className="button-layer-canvas-container" ref={containerRef}>
				<LayeredButtonCanvas
					className="button-layer-canvas"
					width={width}
					height={height}
					location={location}
					drawStyle={drawStyle}
					hiddenElements={styleStore.hiddenElements}
					selectedElementId={styleStore.selectedElementId}
					controlId={controlId}
					styleStore={styleStore}
					linkedRef={linkedRef}
					snapEnabledRef={snapEnabledRef}
				/>
			</div>
			<ElementQuickActions
				controlId={controlId}
				styleStore={styleStore}
				linked={linked}
				onToggleLinked={toggleLinked}
				snapEnabled={snapEnabled}
				onToggleSnapEnabled={toggleSnapEnabled}
			/>
			<div>
				<FormLabel htmlFor={aspectRatioFieldId}>Preview Aspect Ratio</FormLabel>
				<DropdownInputField
					htmlName={aspectRatioFieldId}
					allowCustom
					choices={ASPECT_RATIO_OPTIONS}
					value={aspectRatio}
					setValue={setAspectRatio as any}
				/>
			</div>
		</>
	)
})

/**
 * The command half of the editor (centre / fill / aspect-lock / z-order), as opposed to the direct
 * manipulation the SelectionOverlay provides.
 */
const ElementQuickActions = observer(function ElementQuickActions({
	controlId,
	styleStore,
	linked,
	onToggleLinked,
	snapEnabled,
	onToggleSnapEnabled,
}: {
	controlId: string
	styleStore: LayeredStyleStore
	linked: boolean
	onToggleLinked: () => void
	snapEnabled: boolean
	onToggleSnapEnabled: () => void
}) {
	const updateOptionsMutation = useMutationExt(trpc.controls.styles.updateOptions.mutationOptions())
	const moveElementMutation = useMutationExt(trpc.controls.styles.moveElement.mutationOptions())

	const selectedElement = styleStore.getSelectedElement()
	const elementId = selectedElement?.id
	const boundsFields = selectedElement ? getDraggableBoundsFields(selectedElement) : null

	// Only top-level elements with plain bounds can be repositioned from here
	const indexInParent = styleStore.elements.findIndex((el) => el.id === elementId)
	const isTopLevel = indexInParent >= 0
	const disabled = !elementId || !boundsFields || !isTopLevel

	const commit = useCallback(
		(fields: BoundsFractions, changedKeys: readonly BoundsKey[]) => {
			if (!elementId) return
			updateOptionsMutation
				.mutateAsync({ controlId, elementId, values: buildBoundsValues(fields, changedKeys) })
				.catch((e) => console.error('Failed to update element bounds', e))
		},
		[updateOptionsMutation, controlId, elementId]
	)

	const centerHorizontal = useCallback(() => {
		if (boundsFields) commit({ ...boundsFields, x: (1 - boundsFields.width) / 2 }, ['x'])
	}, [boundsFields, commit])

	const centerVertical = useCallback(() => {
		if (boundsFields) commit({ ...boundsFields, y: (1 - boundsFields.height) / 2 }, ['y'])
	}, [boundsFields, commit])

	const fillBounds = useCallback(() => {
		commit({ x: 0, y: 0, width: 1, height: 1 }, ['x', 'y', 'width', 'height'])
	}, [commit])

	const moveToZ = useCallback(
		(newIndex: number) => {
			if (!elementId) return
			moveElementMutation
				.mutateAsync({ controlId, elementId, parentElementId: null, newIndex })
				.catch((e) => console.error('Failed to reorder element', e))
		},
		[moveElementMutation, controlId, elementId]
	)

	const siblingCount = styleStore.elements.length
	// `newIndex` is applied after the element is spliced out, so the top slot is length-1. Data index 0 is
	// the locked canvas background, so the lowest a real element can sit is 1.
	const bringToFront = useCallback(() => moveToZ(siblingCount - 1), [moveToZ, siblingCount])
	const sendToBack = useCallback(() => moveToZ(1), [moveToZ])

	return (
		<QuickActionsToolbar
			onCenterHorizontal={centerHorizontal}
			onCenterVertical={centerVertical}
			onFill={fillBounds}
			linked={linked}
			onToggleLinked={onToggleLinked}
			snapEnabled={snapEnabled}
			onToggleSnapEnabled={onToggleSnapEnabled}
			onBringToFront={bringToFront}
			onSendToBack={sendToBack}
			canBringToFront={isTopLevel && indexInParent < siblingCount - 1}
			canSendToBack={isTopLevel && indexInParent > 1}
			disabled={disabled}
		/>
	)
})

const ASPECT_RATIO_OPTIONS: DropdownChoice[] = [
	{ id: '1:1', label: 'Square (1:1)' },
	{ id: '9:7', label: 'Stream Deck Studio (9:7)' },
	{ id: '2:1', label: 'Stream Deck Plus & Plus XL (2:1)' },
]

interface LayeredButtonCanvasProps {
	width: number
	height: number
	location: ControlLocation
	drawStyle: RendererButtonStyle | null
	hiddenElements: ReadonlySet<string>
	selectedElementId: string | null
	className?: string
	controlId: string
	styleStore: LayeredStyleStore
	linkedRef: React.RefObject<boolean>
	snapEnabledRef: React.RefObject<boolean>
}
const LayeredButtonCanvas = observer(function LayeredButtonCanvas({
	width,
	height,
	location,
	drawStyle,
	hiddenElements,
	selectedElementId,
	className,
	controlId,
	styleStore,
	linkedRef,
	snapEnabledRef,
}: LayeredButtonCanvasProps) {
	const drawContext = useRef<RendererDrawContext | null>(null)

	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	useEffect(() => {
		if (!canvas || !drawStyle) return

		// Setup the context on the first run, or when something changes
		if (!drawContext.current || drawContext.current.canvas !== canvas)
			drawContext.current = new RendererDrawContext(canvas)

		// Update any cached properties
		drawContext.current.setHiddenElements(hiddenElements)
		drawContext.current.setSelectedElementId(selectedElementId)

		// Pass the new draw style to the context
		drawContext.current.draw(drawStyle)
	}, [canvas, location, drawStyle, hiddenElements, selectedElementId])

	// Ensure the fonts are loaded
	// Future: maybe the first paint should be blocked until either the fonts are loaded, or a timeout is reached?
	useEffect(() => {
		const unsub = FontLoader.listenForFontLoad(() => {
			console.log('font loaded!', Date.now())
			if (drawContext.current) drawContext.current.redraw()
		})

		return () => {
			if (unsub !== 'loaded') {
				// Stop listening for font load events
				return unsub()
			}
		}
	}, [])

	const canvasWidthPx = width + PAD_X * 2
	const canvasHeightPx = height + PAD_Y * 2

	const selectedElement = selectedElementId ? styleStore.getSelectedElement() : undefined

	// Use the fully-resolved per-button decoration (drawStyle.decoration), not the global default - a button's
	// own canvas element can override it (eg to "None"), which changes whether top-bar space is reserved and
	// would otherwise throw off the overlay's alignment with what's actually drawn.
	const contentBoundsPx = useMemo(
		() =>
			drawStyle
				? GraphicsLayeredButtonRenderer.computeContentBounds(
						canvasWidthPx,
						canvasHeightPx,
						{ x: PAD_X, y: PAD_Y },
						drawStyle.decoration
					)
				: null,
		[drawStyle, canvasWidthPx, canvasHeightPx]
	)

	// Absolute pixel rects for every element, used both for click-to-select and for outlining a selection
	// the overlay can't edit.
	const selectableIds = styleStore.selectableElementIds
	const elementRects = useMemo(
		() =>
			drawStyle && contentBoundsPx
				? buildElementRects(drawStyle.elements, contentBoundsPx, hiddenElements, selectableIds)
				: [],
		[drawStyle, contentBoundsPx, hiddenElements, selectableIds]
	)

	const selectElementById = useCallback((id: string) => styleStore.setSelectedElementId(id), [styleStore])

	const onCanvasPointerDown = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			if (!canvas) return

			const rect = canvas.getBoundingClientRect()
			const x = ((e.clientX - rect.left) * canvas.width) / rect.width
			const y = ((e.clientY - rect.top) * canvas.height) / rect.height

			styleStore.setSelectedElementId(hitTestElements(elementRects, x, y)?.id ?? null)
		},
		[canvas, elementRects, styleStore]
	)

	const canvasEl = (
		<canvas
			// Use the dimensions as a key to force a redraw when they change
			key={`${width}x${height}`}
			className={className}
			ref={setCanvas}
			width={canvasWidthPx}
			height={canvasHeightPx}
			onPointerDown={onCanvasPointerDown}
		/>
	)

	return (
		<div className="button-layer-canvas-wrapper">
			{canvasEl}
			{canvas && drawStyle && contentBoundsPx && selectedElement && (
				<SelectionOverlay
					controlId={controlId}
					canvas={canvas}
					selectedElement={selectedElement}
					selectedElementRect={findElementRect(elementRects, selectedElement.id)?.rect ?? null}
					isTopLevelSelection={styleStore.elements.some((el) => el.id === selectedElement.id)}
					elementRects={elementRects}
					contentBoundsPx={contentBoundsPx}
					canvasSizePx={{ width: canvasWidthPx, height: canvasHeightPx }}
					linkedRef={linkedRef}
					snapEnabledRef={snapEnabledRef}
					onSelectElement={selectElementById}
				/>
			)}
		</div>
	)
})

class RendererDrawContext {
	readonly #image: GraphicsImage
	readonly #debounce: PromiseDebounce
	readonly canvas: HTMLCanvasElement

	#hiddenElements: ReadonlySet<string> = new Set()
	#selectedElementId: string | null = null

	constructor(canvas: HTMLCanvasElement) {
		const textLayoutCache: TextLayoutCache = new QuickLRU({ maxSize: 200 })
		const image = GraphicsImage.create(canvas, textLayoutCache)
		if (!image) throw new Error('Failed to create image')

		this.#image = image
		this.#debounce = new PromiseDebounce(this.#debounceDraw, 1, 10)
		this.canvas = canvas
	}

	#lastDrawStyle: RendererButtonStyle | null = null
	#debounceDraw = async () => {
		try {
			if (!this.#lastDrawStyle) throw new Error('No draw style!')

			this.#image.clear()

			// draw checkerboard
			const box_size = 10
			const max_x = this.#image.width - PAD_X * 2
			const max_y = this.#image.height - PAD_Y * 2
			for (let x = 0; x < Math.ceil(max_x / box_size); x++) {
				for (let y = 0; y < Math.ceil(max_y / box_size); y++) {
					if (x % 2 === y % 2) continue

					const x2 = Math.min(PAD_X + (x + 1) * box_size, max_x + PAD_X)
					const y2 = Math.min(PAD_Y + (y + 1) * box_size, max_y + PAD_Y)

					this.#image.box(PAD_X + x * box_size, PAD_Y + y * box_size, x2, y2, 'rgba(0,0,0,0.1)')
				}
			}

			await GraphicsLayeredButtonRenderer.draw(
				this.#image,
				this.#lastDrawStyle,
				this.#hiddenElements,
				this.#selectedElementId,
				{ x: PAD_X, y: PAD_Y }
			)

			this.#image.drawComplete()
		} catch (e) {
			console.error('draw failed!', e)
		}
	}

	setHiddenElements(hiddenElements: ReadonlySet<string>) {
		this.#hiddenElements = hiddenElements
		this.#debounce.trigger()
	}

	setSelectedElementId(selectedElementId: string | null) {
		this.#selectedElementId = selectedElementId
		this.#debounce.trigger()
	}

	draw(drawStyleFull: RendererButtonStyle) {
		this.#lastDrawStyle = drawStyleFull
		this.#debounce.trigger()
	}

	redraw() {
		this.#debounce.trigger()
	}
}
