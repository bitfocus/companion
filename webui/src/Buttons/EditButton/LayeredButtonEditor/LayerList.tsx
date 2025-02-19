import { observer } from 'mobx-react-lite'
import React, { useContext, useRef } from 'react'
import { AddLayerDropdownButton, RemoveLayerButton } from './Buttons.js'
import { LayeredStyleStore } from './StyleStore.js'
import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { useDrop, useDrag } from 'react-dnd'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'

export const LayerList = observer(function LayerList({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	return (
		<table className="button-layer-layerlist-table">
			<thead>
				<th className="compact">&nbsp;</th>
				{/* <th className="compact">&nbsp;</th> */}
				<th>Name</th>
				<th className="compact">
					<AddLayerDropdownButton styleStore={styleStore} controlId={controlId} />
				</th>
			</thead>

			<tbody>
				{styleStore.layers
					.map((layer, i) => (
						<LayerListItem key={layer.id} layer={layer} index={i} styleStore={styleStore} controlId={controlId} />
					))
					.toReversed()}
			</tbody>
		</table>
	)
})

const DRAG_ID = 'button-layer-item'

interface LayerListDragItem {
	layerId: string
	index: number
}

interface LayerListRowDragStatus {
	isDragging: boolean
}

const LayerListItem = observer(function LayerListItem({
	layer,
	index,
	styleStore,
	controlId,
}: {
	layer: SomeButtonGraphicsLayer
	index: number
	styleStore: LayeredStyleStore
	controlId: string
}) {
	const { socket } = useContext(RootAppStoreContext)

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<LayerListDragItem>({
		accept: DRAG_ID,
		drop(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const hoverIndex = index
			const hoverId = layer.id

			// Don't replace items with themselves
			if (item.layerId === hoverId || item.index === hoverIndex) {
				return
			}

			// Time to actually perform the change
			// serviceFactory.moveCard(item.listId, item.entityId, hoverOwnerId, index)
			socket.emitPromise('controls:style:move-layer', [controlId, item.layerId, hoverIndex]).catch((e) => {
				console.error('Failed to move layer', e)
			})

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<LayerListDragItem, unknown, LayerListRowDragStatus>({
		type: DRAG_ID,
		canDrag: layer.type !== 'canvas',
		item: {
			layerId: layer.id,
			index: index,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	let commonClasses = styleStore.selectedLayerId === layer.id ? 'selected-row' : ''
	if (isDragging) commonClasses += ' dragging'

	if (layer.type === 'canvas') {
		return (
			<tr key={layer.id} ref={ref} className={classNames(commonClasses, 'last-row')}>
				<td></td>
				{/* <td></td> */}

				<td className="clickable" onClick={() => styleStore.setSelectedLayerId(layer.id)}>
					{layer.name || 'Background'}
				</td>

				<td></td>
			</tr>
		)
	}

	return (
		<tr key={layer.id} ref={ref} className={classNames(commonClasses, '')}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			{/* <td>
				<ToggleVisibilityButton controlId={controlId} layerId={layer.id} />
			</td> */}

			<td className="clickable" onClick={() => styleStore.setSelectedLayerId(layer.id)}>
				{layer.name ?? layer.type}
			</td>

			<td>
				<RemoveLayerButton controlId={controlId} layerId={layer.id} />
			</td>
		</tr>
	)
})
