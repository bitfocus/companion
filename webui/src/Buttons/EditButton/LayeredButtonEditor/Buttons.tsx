import { CButton, CButtonGroup, CPopover } from '@coreui/react'
import React, { useCallback } from 'react'
import type { LayeredStyleStore } from './StyleStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faEye,
	faImage,
	faLayerGroup,
	faPlus,
	faSquare,
	faT,
	faTrash,
	faMinus,
} from '@fortawesome/free-solid-svg-icons'
import { Tuck } from '~/Components/Tuck.js'
import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'
import { useMutationExt, trpc } from '~/Resources/TRPC.js'

export function RemoveElementButton({
	controlId,
	elementId,
	confirmModalRef,
}: {
	controlId: string
	elementId: string
	confirmModalRef: React.RefObject<GenericConfirmModalRef>
}): React.JSX.Element {
	const removeElementMutation = useMutationExt(trpc.controls.styles.removeElement.mutationOptions())

	const removeElement = useCallback(() => {
		confirmModalRef.current?.show('Remove Element', 'Are you sure you want to remove this element?', 'Remove', () => {
			removeElementMutation
				.mutateAsync({ controlId, elementId })
				.then((res) => {
					console.log('Remove element', res)
				})
				.catch((e) => {
					console.error('Failed to remove element', e)
				})
		})
	}, [removeElementMutation, confirmModalRef, controlId, elementId])

	return (
		<CButton color="white" size="sm" onClick={removeElement} title="Remove">
			<FontAwesomeIcon icon={faTrash} />
		</CButton>
	)
}

export const ToggleVisibilityButton = observer(function ToggleVisibilityButton({
	styleStore,
	elementId,
}: {
	styleStore: LayeredStyleStore
	elementId: string
}) {
	const toggleVisibility = useCallback(() => styleStore.setElementVisibility(elementId), [styleStore, elementId])

	const isVisible = styleStore.isElementVisible(elementId)

	return (
		<CButton
			color="white"
			size="sm"
			onClick={toggleVisibility}
			title={isVisible ? 'Preview visible' : 'Preview hidden'}
		>
			<FontAwesomeIcon icon={faEye} style={{ opacity: isVisible ? undefined : 0.3 }} />
		</CButton>
	)
})

export function AddElementDropdownButton({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}): React.JSX.Element {
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
	const addElementMutation = useMutationExt(trpc.controls.styles.addElement.mutationOptions())

	const addCallback = useCallback(() => {
		addElementMutation
			.mutateAsync({ controlId, type: elementType, index: null })
			.then((resId) => {
				console.log('Added element', resId)
				if (resId) styleStore.setSelectedElementId(resId)
			})
			.catch((e) => {
				console.error('Failed to add element', e)
			})
	}, [addElementMutation, controlId, elementType, styleStore])

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
					elementType="group"
					label="Group"
					icon={faLayerGroup}
				/>
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
				<AddElementDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					elementType="box"
					label="Box"
					icon={faSquare}
				/>
				<AddElementDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					elementType="line"
					label="Line"
					icon={faMinus}
				/>
			</CButtonGroup>
		</>
	)
}
