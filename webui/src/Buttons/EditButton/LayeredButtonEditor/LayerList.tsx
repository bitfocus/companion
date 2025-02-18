import { observer } from 'mobx-react-lite'
import React from 'react'
import { RemoveLayerButton } from './Buttons.js'
import { LayeredStyleStore } from './StyleStore.js'
import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'

export const LayerList = observer(function LayerList({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	return (
		<ul>
			{styleStore.layers.map((layer) => (
				<LayerListItem key={layer.id} layer={layer} styleStore={styleStore} controlId={controlId} />
			))}
		</ul>
	)
})

const LayerListItem = observer(function LayerListItem({
	layer,
	styleStore,
	controlId,
}: {
	layer: SomeButtonGraphicsLayer
	styleStore: LayeredStyleStore
	controlId: string
}) {
	return (
		<li key={layer.id}>
			<span
				style={{
					color: styleStore.selectedLayerId === layer.id ? 'red' : '',
				}}
				onClick={() => styleStore.setSelectedLayerId(layer.id)}
			>
				{layer.name ?? layer.type} ({layer.id})
			</span>{' '}
			<RemoveLayerButton controlId={controlId} layerId={layer.id} />
		</li>
	)
})
