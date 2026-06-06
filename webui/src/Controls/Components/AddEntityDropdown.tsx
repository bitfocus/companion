import { Combobox } from '@base-ui/react/combobox'
import { prepare as fuzzyPrepare } from 'fuzzysort'
import { ChevronDownIcon } from 'lucide-react'
import { toJS } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { DropdownInputPopup } from '~/Components/DropdownInputField/Popup'
import { useComputed } from '~/Resources/util.js'
import type { AddEntityGroup, AddEntityOption } from '~/Stores/EntityDefinitionsStore'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { fuzzyFilterSort } from '~/util/fuzzy.js'

interface AddEntityDropdownProps {
	onSelect: (connectionId: string, definitionId: string) => void
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
	disabled: boolean
}
export const AddEntityDropdown = observer(function AddEntityDropdown({
	onSelect,
	entityType,
	entityTypeLabel,
	feedbackListType,
	disabled,
}: AddEntityDropdownProps) {
	const { entityDefinitions, connections } = useContext(RootAppStoreContext)

	const definitions = entityDefinitions.getEntityDefinitionsStore(entityType)
	const recentlyUsedStore = entityDefinitions.getRecentlyUsedEntityDefinitionsStore(entityType)

	const baseGroups = definitions.buildBaseOptions(feedbackListType)

	const options = useComputed(() => {
		const recents: AddEntityOption[] = []
		for (const definitionPair of recentlyUsedStore.recentIds) {
			if (!definitionPair) continue

			const [connectionId, definitionId] = definitionPair.split(':', 2)
			const definition = definitions.connections.get(connectionId)?.get(definitionId)
			if (!definition) continue

			if (!canAddEntityToFeedbackList(feedbackListType, definition)) continue

			const connectionLabel = connections.getLabel(connectionId) ?? connectionId
			const optionLabel = `${connectionLabel}: ${definition.label}`
			recents.push({
				id: `${connectionId}:${definitionId}`,
				label: optionLabel,
				sortKey: definition.sortKey ?? definition.label,
				fuzzy: fuzzyPrepare(optionLabel),
			})
		}

		return [
			...baseGroups,
			{
				id: '__recent__',
				label: 'Recently Used',
				showWhenUnfiltered: true,
				items: recents,
			},
		]
	}, [baseGroups, definitions, connections, recentlyUsedStore.recentIds, feedbackListType])

	const onChange = useCallback(
		(id: DropdownChoice['id'] | null) => {
			if (!id) return
			const id2 = String(id)
			recentlyUsedStore.trackId(id2)

			const [connectionId, definitionId] = id2.split(':', 2)
			onSelect(connectionId, definitionId)
		},
		[onSelect, recentlyUsedStore]
	)

	const inputRef = useRef<HTMLInputElement>(null)

	const [inputValue, setInputValue] = useState<string>('')

	const onOpenChange = useCallback((open: boolean) => {
		if (!open) {
			inputRef.current?.blur()
		}
	}, [])

	const filterOptions = useComputed<Array<AddEntityGroup> | undefined>(() => {
		const res: Array<AddEntityGroup> = []

		for (const group of options) {
			if (inputValue) {
				if (group.showWhenUnfiltered) continue
				const items = fuzzyFilterSort(group.items, inputValue)
				if (items.length > 0) res.push({ ...group, items })
			} else {
				if (group.showWhenUnfiltered && group.items.length > 0) res.push(group)
			}
		}

		return toJS(res)
	}, [options, inputValue])

	return (
		<div className="dropdown-field">
			<Combobox.Root<DropdownChoice['id'] | null>
				value={null}
				items={options}
				multiple={false}
				autoHighlight
				onValueChange={onChange}
				onInputValueChange={setInputValue}
				onOpenChange={onOpenChange}
				disabled={disabled}
				filteredItems={filterOptions}
			>
				<Combobox.InputGroup className="dropdown-field-input-group rounded-end-0">
					<Combobox.Input className="dropdown-field-input" placeholder={`+ Add ${entityTypeLabel}`} ref={inputRef} />
					<Combobox.Trigger className="dropdown-field-trigger">
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>
				<DropdownInputPopup
					noOptionsMessage={inputValue ? `No ${entityTypeLabel}s found` : `No recently used ${entityTypeLabel}s`}
				/>
			</Combobox.Root>
		</div>
	)
})
