import { CButton, CButtonGroup, CPopover } from '@coreui/react'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import type { LayeredStyleStore } from './StyleStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faImage, faPlus, faT, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Tuck } from '../../../Components/Tuck.js'
import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

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
		// TODO-layered prompt for confirmation
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
		<CButton color="white" size="sm" onClick={addLayer} title="Remove">
			<FontAwesomeIcon icon={faTrash} />
		</CButton>
	)
}

export function ToggleVisibilityButton({ controlId, layerId }: { controlId: string; layerId: string }) {
	const { socket } = useContext(RootAppStoreContext)

	const toggleVisibility = useCallback(() => {
		// // TODO-layered prompt for confirmation
		// socket
		// 	.emitPromise('controls:style:remove-layer', [controlId, layerId])
		// 	.then((res) => {
		// 		console.log('Remove layer', res)
		// 	})
		// 	.catch((e) => {
		// 		console.error('Failed to remove layer', e)
		// 	})
	}, [socket, controlId, layerId])

	return (
		<CButton color="white" size="sm" onClick={toggleVisibility} title="Visible">
			<FontAwesomeIcon icon={faEye} style={{ opacity: 0.3 }} />
		</CButton>
	)
}

export function AddLayerDropdownButton({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	return (
		<CPopover
			content={<AddLayerDropdownPopoverContent styleStore={styleStore} controlId={controlId} />}
			trigger="focus"
			animation={false}
			placement="bottom"
			style={{ backgroundColor: 'white' }}
		>
			<CButton color="white" size="sm" title="Add new layer">
				<FontAwesomeIcon icon={faPlus} />
			</CButton>
		</CPopover>
	)
}

function AddLayerDropdownPopoverButton({
	styleStore,
	controlId,
	layerType,
	label,
	icon,
}: {
	styleStore: LayeredStyleStore
	controlId: string
	layerType: SomeButtonGraphicsLayer['type']
	label: string
	icon: IconProp
}) {
	const { socket } = useContext(RootAppStoreContext)

	const addCallback = useCallback(() => {
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
		<CButton onMouseDown={addCallback} color="secondary" title={`Add ${label}`} style={{ textAlign: 'left' }}>
			<Tuck>
				<FontAwesomeIcon icon={icon} />
			</Tuck>
			{label}
		</CButton>
	)
}

function AddLayerDropdownPopoverContent({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	return (
		<>
			{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
			<CButtonGroup vertical>
				<AddLayerDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					layerType="text"
					label="Text"
					icon={faT}
				/>
				<AddLayerDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					layerType="image"
					label="Image"
					icon={faImage}
				/>
			</CButtonGroup>
		</>
	)
}
