import { useDraggable, useDragOperation, useDroppable } from '@dnd-kit/react'
import { memo, useCallback, useMemo, useState } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { PreviewRenderSize } from '@companion-app/shared/Model/Preview.js'
import type { SurfaceSchemaLedsConfig } from '@companion-app/shared/Model/Surfaces.js'
import {
	isRotaryKind,
	type SurfaceControlFeedback,
	type SurfaceControlKind,
} from '@companion-app/shared/SurfaceLayout.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import {
	useButtonGridView,
	useGridDragAnyButton,
	useGridDragPreviewValid,
	useGridDropGhostSource,
	useGridIsSelected,
	useGridIsTransferSource,
	useGridPendingChange,
	useGridPressMode,
} from './ButtonGridViewContext.js'
import { GRID_BUTTON_DRAG_TYPE, type GridButtonDragItem } from './GridButtonDragItem.js'
import { makeGridButtonDroppableId } from './GridButtonDroppableId.js'
import { GridButtonPreview, type GridButtonModifiers } from './GridButtonPreview.js'
import { ROTARY_STEP_DEGREES } from './SurfaceView/rotaryDrag.js'
import { SurfaceControlDetail } from './SurfaceView/SurfaceControlDetail.js'
import { SurfaceLeds } from './SurfaceView/SurfaceLeds.js'

export interface GridButtonCellProps {
	location: ControlLocation
	/** The size to draw this button's image at */
	renderSize: PreviewRenderSize
	/** What sort of control it is, so it is drawn as one: a knob rather than a round key */
	kind: SurfaceControlKind
	/**
	 * What the control shows of the button. One which shows only a colour is drawn as that colour, as the image
	 * would be squeezed into something too small to read and is not what the device shows anyway.
	 */
	feedback: SurfaceControlFeedback
	/** The leds the control has, drawn around it lit as the button would light them; null for none */
	leds: SurfaceSchemaLedsConfig | null
	/** Where the button goes and how big it is. Whatever is drawing it decides; this only wears it. */
	style: React.CSSProperties
	contextMenuOpen: boolean
}

/**
 * A button of the editor, wherever it is being drawn.
 *
 * Knows which button it is and how to interact with it, and nothing about why it is where it is: the caller hands
 * it a style which places and sizes it. That is what lets the same cell be one square of the infinite grid and one
 * control of a surface drawn at its own size and shape.
 */
export const GridButtonCell = memo(function GridButtonCell({
	location,
	renderSize,
	kind,
	feedback,
	leds,
	style,
	contextMenuOpen,
}: GridButtonCellProps) {
	const { pageNumber, row, column } = location
	const { store, actions, onContextMenu } = useButtonGridView()

	const { ref: drop, isDropTarget } = useDroppable({
		id: makeGridButtonDroppableId(pageNumber, column, row),
		accept: ['preset', GRID_BUTTON_DRAG_TYPE],
	})

	// A preset can go on any button, which is worth saying while one is in flight. Dragging a button
	// around the grid can also land anywhere, so marking every cell says nothing - what matters there
	// is the landing region, which lights up on its own.
	const { source } = useDragOperation()
	const canDrop = source?.type === 'preset'

	const locationKey = formatLocation(location)

	// Read straight from the store rather than taking these as props, so a selection change re-renders
	// only the cells whose own answer changed
	const selected = useGridIsSelected(locationKey)
	const isTransferSource = useGridIsTransferSource(locationKey)
	const pressMode = useGridPressMode()
	const dragAnyButton = useGridDragAnyButton()

	// Which button would end up here if the drag were released, so the cell can ghost it. Seeing the
	// buttons themselves is what makes it possible to check a large block has lined up.
	const pendingChange = useGridPendingChange(locationKey)
	const ghostSource = useGridDropGhostSource(locationKey)
	const dropWouldWork = useGridDragPreviewValid()

	// Already subscribed by the cell the button actually lives on, and subscriptions are shared
	const ghost = useButtonImageForLocation(ghostSource ?? location, renderSize, !ghostSource)

	const { image, isUsed, color, leds: ledGauge } = useButtonImageForLocation(location, renderSize)
	const colorOnly = feedback === 'color'

	// An empty cell has nothing to pick up, so dragging one is a gesture that can only end in nothing
	// happening. In select mode only an already-selected button drags, so dragging anywhere else can
	// still rubber-band. Arrange lets any button drag. Press mode lets none - a drag must never
	// swallow a press that is about to fire real actions.
	const dragData: GridButtonDragItem = useMemo(() => ({ location }), [location])
	const dragDisabled = pressMode || !isUsed || !(dragAnyButton || selected)
	const { ref: dragRef, isDragSource } = useDraggable<GridButtonDragItem>({
		id: `griddrag:${locationKey}`,
		type: GRID_BUTTON_DRAG_TYPE,
		data: dragData,
		disabled: dragDisabled,
	})

	const onTap = useCallback(
		(tapLocation: ControlLocation, modifiers: GridButtonModifiers) => store.handleTap(tapLocation, modifiers, actions),
		[store, actions]
	)
	const onPress = useCallback(
		(pressLocation: ControlLocation, isDown: boolean) => store.handlePress(pressLocation, isDown, actions),
		[store, actions]
	)
	// How far this control has been turned from here, so each step sent turns what is drawn with it. A knob has no
	// position to read back, so this counts turns made, not where the knob is.
	const [turn, setTurn] = useState(0)
	const onRotate = useCallback(
		(rotateLocation: ControlLocation, isRightward: boolean) => {
			setTurn((degrees) => degrees + (isRightward ? ROTARY_STEP_DEGREES : -ROTARY_STEP_DEGREES))
			store.handleRotate(rotateLocation, isRightward, actions)
		},
		[store, actions]
	)

	return (
		<GridButtonPreview
			location={location}
			kind={kind}
			image={isUsed && !colorOnly ? image : null}
			color={isUsed && colorOnly ? color : null}
			overlay={
				<>
					<SurfaceControlDetail kind={kind} turn={turn} />
					{leds && <SurfaceLeds config={leds} leds={isUsed ? ledGauge : null} />}
				</>
			}
			style={style}
			title={locationKey}
			placeholder={`${row}/${column}`}
			pressMode={pressMode}
			onPress={onPress}
			onRotate={isRotaryKind(kind) ? onRotate : null}
			onTap={onTap}
			onContextMenu={onContextMenu}
			selected={selected}
			copySource={isTransferSource}
			pendingChange={pendingChange}
			contextMenuOpen={contextMenuOpen}
			canDrop={canDrop}
			dropHover={isDropTarget}
			ghostImage={ghostSource && ghost.isUsed ? ghost.image : null}
			dropDestination={!!ghostSource}
			dropInvalid={!!ghostSource && !dropWouldWork}
			// Withheld rather than passed disabled: dnd-kit marks whatever holds this ref as a draggable,
			// and a disabled one as `aria-disabled`. A cell you cannot drag is still a cell you can click,
			// so saying otherwise is wrong for anything reading the page rather than looking at it.
			dragRef={dragDisabled ? null : dragRef}
			dropRef={drop}
			isDragSource={isDragSource}
		/>
	)
})
