import { PencilIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import QuickLRU from 'quick-lru'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import type { ElementGeometry } from '@companion-app/shared/Graphics/Geometry.js'
import type { TextLayoutCache } from '@companion-app/shared/Graphics/ImageBase.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawBounds, type ResolveButtonStylePropertiesConfig } from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import type { DropdownChoice } from '@companion-module/base'
import { InputGroup, InputGroupText } from '~/Components/Form.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { Popover } from '~/Components/Popover.js'
import { useResizeObserver } from '~/Hooks/useResizeObserver.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { LayeredStyleStore } from '../StyleStore.js'
import {
	buildOptionValues,
	getDraggableBoundsFields,
	getDraggableLineFields,
	type BoundsFractions,
	type BoundsKey,
} from './boundsFields.js'
import { fitCanvasSize, PAD_X, PAD_Y, parseAspectRatio } from './canvasSize.js'
import { useLayeredButtonDrawStyleParser } from './DrawStyleParser.js'
import { filterElementRects, findElementRect, hitTestElements } from './elementHitTest.js'
import FontLoader from './FontLoader.js'
import { GraphicsImage } from './Image.js'
import { LineSelectionOverlay } from './LineSelectionOverlay.js'
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
		<div className="button-layer-preview-main">
			<ElementQuickActions
				controlId={controlId}
				styleStore={styleStore}
				linked={linked}
				onToggleLinked={toggleLinked}
				snapEnabled={snapEnabled}
				onToggleSnapEnabled={toggleSnapEnabled}
			/>
			<div className="button-layer-canvas-section">
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
				<div className="button-layer-canvas-footer">
					<span className="button-layer-footer-label">Aspect Ratio</span>
					<div className="button-layer-aspect-options">
						{ASPECT_RATIO_OPTIONS.map((option) => {
							const id = String(option.id)
							return (
								<button
									key={id}
									type="button"
									title={option.label}
									className={`button-layer-aspect-option${aspectRatio === id ? ' active' : ''}`}
									onClick={() => setAspectRatio(id)}
								>
									<AspectRatioGlyph ratio={parseAspectRatio(id)} />
								</button>
							)
						})}
						<CustomAspectRatioButton
							value={aspectRatio}
							setValue={setAspectRatio}
							active={!ASPECT_RATIO_OPTIONS.some((option) => String(option.id) === aspectRatio)}
						/>
					</div>
				</div>
			</div>
		</div>
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
	const boundsDisabled = !elementId || !boundsFields || !isTopLevel

	// The only place these explanations reach the user: the outline the overlays draw over a selection they
	// can't edit is `pointer-events: none`, so a `title` on it would never be hovered.
	const boundsDisabledReason = !elementId
		? 'Select an element to edit it on the canvas'
		: selectedElement?.type === 'canvas'
			? 'The Canvas layer has no position or scale to edit'
			: !isTopLevel
				? 'Elements inside a group are not yet editable in the preview'
				: selectedElement?.type === 'line'
					? getDraggableLineFields(selectedElement)
						? 'Lines have no position or scale - drag their endpoints on the canvas instead'
						: 'The line endpoints are set by an expression - edit them in the properties below'
					: !boundsFields
						? 'Preview editing is disabled because this element uses an expression to control its position or scale.'
						: null

	const commit = useCallback(
		(fields: BoundsFractions, changedKeys: readonly BoundsKey[]) => {
			if (!elementId) return
			updateOptionsMutation
				.mutateAsync({ controlId, elementId, values: buildOptionValues(fields, changedKeys) })
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

	// The canvas is pinned to the bottom of the stack and isn't a drawable layer, so it has no z-order to change
	const canReorder = isTopLevel && selectedElement?.type !== 'canvas'

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
			canBringToFront={canReorder && indexInParent < siblingCount - 1}
			canSendToBack={canReorder && indexInParent > 1}
			boundsDisabled={boundsDisabled}
			boundsDisabledReason={boundsDisabledReason}
		/>
	)
})

const ASPECT_RATIO_OPTIONS: DropdownChoice[] = [
	{ id: '1:1', label: '1:1 (Square)' },
	{ id: '9:7', label: '9:7 (Stream Deck Studio)' },
	{ id: '2:1', label: '2:1 (Stream Deck Plus & Plus XL)' },
]

const CUSTOM_RATIO_MIN = 1
const CUSTOM_RATIO_MAX = 100

/**
 * Lets a ratio be entered by hand, for surfaces that don't have a preset button. The value is the same
 * "w:h" string the presets use, so it needs no special handling anywhere else.
 */
function CustomAspectRatioButton({
	value,
	setValue,
	active,
}: {
	value: string
	setValue: (value: string) => void
	active: boolean
}) {
	// Seeded from whatever is currently applied, preset or not, so opening this is a starting point rather
	// than a jump to some unrelated ratio
	const [w, h] = value.split(':').map(Number)
	const width = isFinite(w) && w > 0 ? w : 4
	const height = isFinite(h) && h > 0 ? h : 3

	const clamp = (val: number) => Math.min(CUSTOM_RATIO_MAX, Math.max(CUSTOM_RATIO_MIN, Math.round(val)))

	return (
		<Popover.Root>
			<Popover.Trigger
				color={null}
				className={`button-layer-aspect-option${active ? ' active' : ''}`}
				title="Custom aspect ratio"
			>
				<PencilIcon size={14} />
			</Popover.Trigger>
			<Popover.Popup className="button-layer-aspect-custom" align="end">
				<InputGroup>
					<InputGroupText>W</InputGroupText>
					<NumberInputField
						id={undefined}
						value={width}
						setValue={(val) => setValue(`${clamp(val)}:${height}`)}
						min={CUSTOM_RATIO_MIN}
						max={CUSTOM_RATIO_MAX}
					/>
				</InputGroup>
				<InputGroup>
					<InputGroupText>H</InputGroupText>
					<NumberInputField
						id={undefined}
						value={height}
						setValue={(val) => setValue(`${width}:${clamp(val)}`)}
						min={CUSTOM_RATIO_MIN}
						max={CUSTOM_RATIO_MAX}
					/>
				</InputGroup>
			</Popover.Popup>
		</Popover.Root>
	)
}

// A little outlined rectangle drawn to the ratio, so the option reads at a glance
function AspectRatioGlyph({ ratio }: { ratio: number }) {
	const max = 15
	const glyphWidth = ratio >= 1 ? max : max * ratio
	const glyphHeight = ratio >= 1 ? max / ratio : max
	return <span className="button-layer-aspect-glyph" style={{ width: glyphWidth, height: glyphHeight }} />
}

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

	// Element geometry as resolved by the renderer itself, so the editor never has to recompute the layout
	const [geometry, setGeometry] = useState<readonly ElementGeometry[]>([])

	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	useEffect(() => {
		if (!canvas || !drawStyle) return

		// Setup the context on the first run, or when something changes
		if (!drawContext.current || drawContext.current.canvas !== canvas) {
			// Drop the previous canvas' geometry rather than hit-testing against a stale layout
			setGeometry([])
			drawContext.current = new RendererDrawContext(canvas, setGeometry)
		}

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
						new DrawBounds(PAD_X, PAD_Y, width, height),
						drawStyle.decoration
					)
				: null,
		[drawStyle, width, height]
	)

	// Rects for every selectable element, used for click-to-select and for outlining an unselectable section
	const selectableIds = styleStore.selectableElementIds
	const elementRects = useMemo(
		() => (drawStyle ? filterElementRects(geometry, drawStyle.elements, hiddenElements, selectableIds) : []),
		[drawStyle, geometry, hiddenElements, selectableIds]
	)

	const selectElementById = useCallback((id: string) => styleStore.setSelectedEntryId(id), [styleStore])

	const onCanvasPointerDown = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			if (!canvas) return

			const rect = canvas.getBoundingClientRect()
			const x = ((e.clientX - rect.left) * canvas.width) / rect.width
			const y = ((e.clientY - rect.top) * canvas.height) / rect.height

			styleStore.setSelectedEntryId(hitTestElements(elementRects, x, y)?.id ?? null)
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
			{canvas &&
				drawStyle &&
				contentBoundsPx &&
				selectedElement &&
				// Lines are defined by two endpoints rather than bounds, so they get their own overlay
				(selectedElement.type === 'line' ? (
					<LineSelectionOverlay
						controlId={controlId}
						canvas={canvas}
						selectedElement={selectedElement}
						selectedElementRect={findElementRect(elementRects, selectedElement.id) ?? null}
						isTopLevelSelection={styleStore.elements.some((el) => el.id === selectedElement.id)}
						elementRects={elementRects}
						contentBoundsPx={contentBoundsPx}
						canvasSizePx={{ width: canvasWidthPx, height: canvasHeightPx }}
						snapEnabledRef={snapEnabledRef}
					/>
				) : (
					<SelectionOverlay
						controlId={controlId}
						canvas={canvas}
						selectedElement={selectedElement}
						selectedElementRect={findElementRect(elementRects, selectedElement.id) ?? null}
						isTopLevelSelection={styleStore.elements.some((el) => el.id === selectedElement.id)}
						elementRects={elementRects}
						contentBoundsPx={contentBoundsPx}
						canvasSizePx={{ width: canvasWidthPx, height: canvasHeightPx }}
						linkedRef={linkedRef}
						snapEnabledRef={snapEnabledRef}
						onSelectElement={selectElementById}
					/>
				))}
		</div>
	)
})

class RendererDrawContext {
	readonly #image: GraphicsImage
	readonly #debounce: PromiseDebounce
	readonly #onGeometry: (geometry: readonly ElementGeometry[]) => void
	readonly canvas: HTMLCanvasElement

	#hiddenElements: ReadonlySet<string> = new Set()
	#selectedElementId: string | null = null

	constructor(canvas: HTMLCanvasElement, onGeometry: (geometry: readonly ElementGeometry[]) => void) {
		const textLayoutCache: TextLayoutCache = new QuickLRU({ maxSize: 200 })
		const image = GraphicsImage.create(canvas, textLayoutCache)
		if (!image) throw new Error('Failed to create image')

		this.#image = image
		this.#debounce = new PromiseDebounce(this.#debounceDraw, 1, 10)
		this.#onGeometry = onGeometry
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

			const geometry = await GraphicsLayeredButtonRenderer.draw(
				this.#image,
				this.#lastDrawStyle,
				this.#hiddenElements,
				this.#selectedElementId,
				{ x: PAD_X, y: PAD_Y }
			)

			this.#image.drawComplete()
			this.#onGeometry(geometry)
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
