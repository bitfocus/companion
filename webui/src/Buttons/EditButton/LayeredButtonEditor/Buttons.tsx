import { CAccordion, CAccordionBody, CAccordionHeader, CAccordionItem, CPopover } from '@coreui/react'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import {
	faCircle,
	faCube,
	faEye,
	faImage,
	faLayerGroup,
	faMinus,
	faPlus,
	faSquare,
	faT,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useMemo, useState } from 'react'
import type { UICompositeElementDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { Button, ButtonGroup } from '~/Components/Button'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Tuck } from '~/Components/Tuck.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { LayeredStyleStore } from './StyleStore.js'

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
		<Button size="sm" onClick={removeElement} title="Remove">
			<FontAwesomeIcon icon={faTrash} />
		</Button>
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
		<Button size="sm" onClick={toggleVisibility} title={isVisible ? 'Preview visible' : 'Preview hidden'}>
			<FontAwesomeIcon icon={faEye} style={{ opacity: isVisible ? undefined : 0.3 }} />
		</Button>
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
			className="add-layered-element-popover"
		>
			<Button size="sm" title="Add element">
				<FontAwesomeIcon icon={faPlus} />
			</Button>
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
	elementType: SomeButtonGraphicsElement['type'] | string
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
		<Button onMouseDown={addCallback} color="secondary" title={`Add ${label}`} className="text-start">
			<Tuck>
				<FontAwesomeIcon icon={icon} />
			</Tuck>
			{label}
		</Button>
	)
}

interface CompositeElementGroup {
	connectionId: string
	connectionLabel: string
	elements: Array<{
		elementId: string
		definition: UICompositeElementDefinition
	}>
}

const CompositeElementConnectionGroup = observer(function CompositeElementConnectionGroup({
	styleStore,
	controlId,
	group,
}: {
	styleStore: LayeredStyleStore
	controlId: string
	group: CompositeElementGroup
}) {
	const [isOpen, setIsOpen] = useState(false)

	const toggleOpen = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setIsOpen((prev) => !prev)
	}, [])

	return (
		<CAccordion activeItemKey={isOpen ? group.connectionId : undefined} flush>
			<CAccordionItem itemKey={group.connectionId}>
				<CAccordionHeader onMouseDown={toggleOpen}>{group.connectionLabel}</CAccordionHeader>
				<CAccordionBody>
					<ButtonGroup vertical>
						{group.elements.map(({ elementId, definition }) => (
							<AddElementDropdownPopoverButton
								key={`${group.connectionId};${elementId}`}
								styleStore={styleStore}
								controlId={controlId}
								elementType={`${group.connectionId};${elementId}`}
								label={definition.name}
								icon={faCube}
							/>
						))}
					</ButtonGroup>
				</CAccordionBody>
			</CAccordionItem>
		</CAccordion>
	)
})

const AddElementDropdownPopoverContent = observer(function AddElementDropdownPopoverContent({
	styleStore,
	controlId,
}: {
	styleStore: LayeredStyleStore
	controlId: string
}) {
	const { compositeElementDefinitions, connections } = useContext(RootAppStoreContext)

	const compositeGroups = useMemo(() => {
		const groups: CompositeElementGroup[] = []

		for (const [connectionId, connectionDefinitions] of compositeElementDefinitions.connections.entries()) {
			if (connectionDefinitions.size === 0) continue

			const connectionLabel = connections.getLabel(connectionId) ?? connectionId
			const elements = Array.from(connectionDefinitions.entries()).map(([elementId, definition]) => ({
				elementId,
				definition,
			}))

			groups.push({
				connectionId,
				connectionLabel,
				elements,
			})
		}

		return groups.sort((a, b) => a.connectionLabel.localeCompare(b.connectionLabel))
	}, [compositeElementDefinitions.connections, connections])

	return (
		<>
			{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
			<ButtonGroup vertical>
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
				<AddElementDropdownPopoverButton
					styleStore={styleStore}
					controlId={controlId}
					elementType="circle"
					label="Circle"
					icon={faCircle}
				/>
			</ButtonGroup>

			{/* Composite Elements grouped by connection */}
			{compositeGroups.map((group) => (
				<CompositeElementConnectionGroup
					key={group.connectionId}
					styleStore={styleStore}
					controlId={controlId}
					group={group}
				/>
			))}
		</>
	)
})
