import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import {
	faCircle,
	faCopy,
	faCube,
	faEye,
	faGauge,
	faImage,
	faLayerGroup,
	faLink,
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
import { Accordion } from '~/Components/Accordion'
import { Button } from '~/Components/Button'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Popover } from '~/Components/Popover'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { LayeredStyleStore } from './StyleStore.js'

const ELEMENT_TYPE_ICONS: Record<string, IconProp> = {
	text: faT,
	image: faImage,
	box: faSquare,
	line: faMinus,
	group: faLayerGroup,
	circle: faCircle,
	gauge: faGauge,
	reference: faLink,
	composite: faCube,
}

// Icon representing an element's type, matching the icons in the add-element dropdown. Composite elements
// (whose stored type is `composite`, or `connectionId;elementId` in the dropdown) fall back to the cube.
export function getElementTypeIcon(type: string): IconProp {
	return ELEMENT_TYPE_ICONS[type] ?? faCube
}

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

export function DuplicateElementButton({
	controlId,
	elementId,
}: {
	controlId: string
	elementId: string
}): React.JSX.Element {
	const duplicateElementMutation = useMutationExt(trpc.controls.styles.duplicateElement.mutationOptions())

	const duplicateElement = useCallback(() => {
		duplicateElementMutation.mutateAsync({ controlId, elementId }).catch((e) => {
			console.error('Failed to duplicate element', e)
		})
	}, [duplicateElementMutation, controlId, elementId])

	return (
		<Button size="sm" onClick={duplicateElement} title="Duplicate">
			<FontAwesomeIcon icon={faCopy} />
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
		<Popover.Root>
			<Popover.Trigger size="sm" title="Add element" color={null}>
				<FontAwesomeIcon icon={faPlus} />
			</Popover.Trigger>
			<Popover.Popup side="left" arrow align="center">
				<AddElementDropdownPopoverContent styleStore={styleStore} controlId={controlId} />
			</Popover.Popup>
		</Popover.Root>
	)
}

function AddElementDropdownPopoverButton({
	styleStore,
	controlId,
	elementType,
	label,
}: {
	styleStore: LayeredStyleStore
	controlId: string
	elementType: SomeButtonGraphicsElement['type'] | string
	label: string
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
		<Popover.Item onClick={addCallback} title={`Add ${label}`}>
			<FontAwesomeIcon icon={getElementTypeIcon(elementType)} className="me-2" />
			{label}
		</Popover.Item>
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

	return (
		<Accordion.Root
			value={isOpen ? [group.connectionId] : []}
			onValueChange={(open) => {
				setIsOpen(open.includes(group.connectionId))
			}}
		>
			<Accordion.Item value={group.connectionId}>
				<Accordion.Header>
					<Accordion.Trigger>{group.connectionLabel}</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Panel>
					{group.elements.map(({ elementId, definition }) => (
						<AddElementDropdownPopoverButton
							key={`${group.connectionId};${elementId}`}
							styleStore={styleStore}
							controlId={controlId}
							elementType={`${group.connectionId};${elementId}`}
							label={definition.name}
						/>
					))}
				</Accordion.Panel>
			</Accordion.Item>
		</Accordion.Root>
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
			<AddElementDropdownPopoverButton
				styleStore={styleStore}
				controlId={controlId}
				elementType="group"
				label="Group"
			/>
			<AddElementDropdownPopoverButton styleStore={styleStore} controlId={controlId} elementType="text" label="Text" />
			<AddElementDropdownPopoverButton
				styleStore={styleStore}
				controlId={controlId}
				elementType="image"
				label="Image"
			/>
			<AddElementDropdownPopoverButton styleStore={styleStore} controlId={controlId} elementType="box" label="Box" />
			<AddElementDropdownPopoverButton styleStore={styleStore} controlId={controlId} elementType="line" label="Line" />
			<AddElementDropdownPopoverButton
				styleStore={styleStore}
				controlId={controlId}
				elementType="circle"
				label="Circle"
			/>
			<AddElementDropdownPopoverButton
				styleStore={styleStore}
				controlId={controlId}
				elementType="gauge"
				label="Gauge"
			/>
			<AddElementDropdownPopoverButton
				styleStore={styleStore}
				controlId={controlId}
				elementType="reference"
				label="Reference"
			/>

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
