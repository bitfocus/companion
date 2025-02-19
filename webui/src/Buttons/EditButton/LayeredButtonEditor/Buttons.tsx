import { CButton, CButtonGroup, CPopover } from '@coreui/react'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'
import type { LayeredStyleStore } from './StyleStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faImage, faPlus, faT, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Tuck } from '../../../Components/Tuck.js'
import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { GenericConfirmModalRef } from '../../../Components/GenericConfirmModal.js'

export function RemoveElementButton({
	controlId,
	elementId,
	confirmModalRef,
}: {
	controlId: string
	elementId: string
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
}) {
	const { socket } = useContext(RootAppStoreContext)

	const removeElement = useCallback(() => {
		confirmModalRef.current?.show('Remove Element', 'Are you sure you want to remove this element?', 'Remove', () => {
			socket
				.emitPromise('controls:style:remove-element', [controlId, elementId])
				.then((res) => {
					console.log('Remove element', res)
				})
				.catch((e) => {
					console.error('Failed to remove element', e)
				})
		})
	}, [socket, controlId, elementId])

	return (
		<CButton color="white" size="sm" onClick={removeElement} title="Remove">
			<FontAwesomeIcon icon={faTrash} />
		</CButton>
	)
}

export function ToggleVisibilityButton({ controlId, elementId }: { controlId: string; elementId: string }) {
	const { socket } = useContext(RootAppStoreContext)

	const toggleVisibility = useCallback(() => {
		// TODO - implement
	}, [socket, controlId, elementId])

	return (
		<CButton color="white" size="sm" onClick={toggleVisibility} title="Visible">
			<FontAwesomeIcon icon={faEye} style={{ opacity: 0.3 }} />
		</CButton>
	)
}

export function AddElementDropdownButton({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	return (
		<CPopover
			content={<AddElementDropdownPopoverContent styleStore={styleStore} controlId={controlId} />}
			trigger="focus"
			animation={false}
			placement="bottom"
			style={{ backgroundColor: 'white' }}
		>
			<CButton color="white" size="sm" title="Add element">
				<FontAwesomeIcon icon={faPlus} />
			</CButton>
		</CPopover>
	)
}

function AddElementDropdownPopoverButton({
	styleStore,
	controlId,
	elementType,
	label,
	icon,
}: {
	styleStore: LayeredStyleStore
	controlId: string
	elementType: SomeButtonGraphicsElement['type']
	label: string
	icon: IconProp
}) {
	const { socket } = useContext(RootAppStoreContext)

	const addCallback = useCallback(() => {
		socket
			.emitPromise('controls:style:add-element', [controlId, elementType, null])
			.then((resId) => {
				console.log('Added element', resId)
				if (resId) styleStore.setSelectedElementId(resId)
			})
			.catch((e) => {
				console.error('Failed to add element', e)
			})
	}, [socket, controlId, elementType, styleStore])

	return (
		<CButton onMouseDown={addCallback} color="secondary" title={`Add ${label}`} style={{ textAlign: 'left' }}>
			<Tuck>
				<FontAwesomeIcon icon={icon} />
			</Tuck>
			{label}
		</CButton>
	)
}

function AddElementDropdownPopoverContent({
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
				<AddElementDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					elementType="text"
					label="Text"
					icon={faT}
				/>
				<AddElementDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					elementType="image"
					label="Image"
					icon={faImage}
				/>
			</CButtonGroup>
		</>
	)
}
