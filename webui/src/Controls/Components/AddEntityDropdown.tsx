import React, { useCallback, useContext } from 'react'
import { useComputed } from '~/util.js'
import Select, { createFilter } from 'react-select'
import { MenuPortalContext } from '~/Components/MenuPortalContext'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'

const filterOptions: ReturnType<typeof createFilter<AddEntityOption>> = (candidate, input): boolean => {
	if (input) {
		return !candidate.data.isRecent && (fuzzySingle(input, candidate.data.fuzzy)?.score ?? 0) >= 0.5
	} else {
		return candidate.data.isRecent
	}
}

interface AddEntityOption {
	isRecent: boolean
	value: string
	label: string
	fuzzy: ReturnType<typeof fuzzyPrepare>
}
interface AddEntityGroup {
	label: string
	options: AddEntityOption[]
}
interface AddEntityDropdownProps {
	onSelect: (connectionId: string, definitionId: string) => void
	entityType: EntityModelType
	entityTypeLabel: string
	onlyFeedbackType: ClientEntityDefinition['feedbackType']
	disabled: boolean
}
export const AddEntityDropdown = observer(function AddEntityDropdown({
	onSelect,
	entityType,
	entityTypeLabel,
	onlyFeedbackType,
	disabled,
}: AddEntityDropdownProps) {
	const { entityDefinitions, connections } = useContext(RootAppStoreContext)
	const menuPortal = useContext(MenuPortalContext)

	const definitions = entityDefinitions.getEntityDefinitionsStore(entityType)
	const recentlyUsedStore = entityDefinitions.getRecentlyUsedEntityDefinitionsStore(entityType)

	const options = useComputed(() => {
		const options: Array<AddEntityOption | AddEntityGroup> = []
		for (const [connectionId, entityDefinitions] of definitions.connections.entries()) {
			for (const [definitionId, definition] of entityDefinitions.entries()) {
				if (onlyFeedbackType && definition.feedbackType !== onlyFeedbackType) continue

				const connectionLabel = connections.getLabel(connectionId) ?? connectionId
				const optionLabel = `${connectionLabel}: ${definition.label}`
				options.push({
					isRecent: false,
					value: `${connectionId}:${definitionId}`,
					label: optionLabel,
					fuzzy: fuzzyPrepare(optionLabel),
				})
			}
		}

		const recents: AddEntityOption[] = []
		for (const definitionPair of recentlyUsedStore.recentIds) {
			if (!definitionPair) continue

			const [connectionId, definitionId] = definitionPair.split(':', 2)
			const definition = definitions.connections.get(connectionId)?.get(definitionId)
			if (!definition) continue

			if (onlyFeedbackType && definition.feedbackType !== onlyFeedbackType) continue

			const connectionLabel = connections.getLabel(connectionId) ?? connectionId
			const optionLabel = `${connectionLabel}: ${definition.label}`
			recents.push({
				isRecent: true,
				value: `${connectionId}:${definitionId}`,
				label: optionLabel,
				fuzzy: fuzzyPrepare(optionLabel),
			})
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [definitions, connections, recentlyUsedStore.recentIds, onlyFeedbackType])

	const innerChange = useCallback(
		(e: AddEntityOption | null) => {
			if (e?.value) {
				recentlyUsedStore.trackId(e.value)

				const [connectionId, definitionId] = e.value.split(':', 2)
				onSelect(connectionId, definitionId)
			}
		},
		[onSelect, recentlyUsedStore]
	)

	const noOptionsMessage = useCallback(
		({ inputValue }: { inputValue: string }) => {
			if (inputValue) {
				return `No ${entityTypeLabel}s found`
			} else {
				return `No recently used ${entityTypeLabel}s`
			}
		},
		[entityTypeLabel]
	)

	return (
		<Select
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPortalTarget={menuPortal || document.body}
			menuPosition={'fixed'}
			classNamePrefix="select-control"
			menuPlacement="auto"
			isClearable={false}
			isSearchable={true}
			isMulti={false}
			options={options}
			placeholder={`+ Add ${entityTypeLabel}`}
			value={null}
			onChange={innerChange}
			filterOption={filterOptions}
			noOptionsMessage={noOptionsMessage}
			isDisabled={disabled}
		/>
	)
})
