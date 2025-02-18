import { CButton } from '@coreui/react'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import type { LayeredStyleStore } from './StyleStore.js'

export function AddLayerOfTypeButton({
	controlId,
	layerType,
	label,
	styleStore,
}: {
	controlId: string
	layerType: string
	label: string
	styleStore: LayeredStyleStore
}) {
	const { socket } = useContext(RootAppStoreContext)

	const addLayer = useCallback(() => {
		socket
			.emitPromise('controls:style:add-layer', [controlId, layerType, null])
			.then((resId) => {
				console.log('Added layer', resId)
				if (resId) styleStore.setSelectedLayerId(resId)
			})
			.catch((e) => {
				console.error('Failed to add layer', e)
			})
	}, [socket, controlId, layerType, styleStore])

	return (
		<CButton color="primary" onClick={addLayer}>
			{label}
		</CButton>
	)
}
export function RemoveLayerButton({ controlId, layerId }: { controlId: string; layerId: string }) {
	const { socket } = useContext(RootAppStoreContext)

	const addLayer = useCallback(() => {
		socket
			.emitPromise('controls:style:remove-layer', [controlId, layerId])
			.then((res) => {
				console.log('Remove layer', res)
			})
			.catch((e) => {
				console.error('Failed to remove layer', e)
			})
	}, [socket, controlId, layerId])

	return (
		<CButton color="danger" onClick={addLayer}>
			Remove
		</CButton>
	)
}
