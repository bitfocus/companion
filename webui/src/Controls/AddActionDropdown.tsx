import React, { useCallback, useContext } from 'react'
import { useComputed } from '../util.js'
import Select, { createFilter } from 'react-select'
import { MenuPortalContext } from '../Components/DropdownInputField.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'

const filterOptions: ReturnType<typeof createFilter<AddActionOption>> = (candidate, input): boolean => {
	if (input) {
		return !candidate.data.isRecent && (fuzzySingle(input, candidate.data.fuzzy)?.score ?? 0) >= 0.5
	} else {
		return candidate.data.isRecent
	}
}
const noOptionsMessage = ({ inputValue }: { inputValue: string }) => {
	if (inputValue) {
		return 'No actions found'
	} else {
		return 'No recently used actions'
	}
}
interface AddActionOption {
	isRecent: boolean
	value: string
	label: string
	fuzzy: ReturnType<typeof fuzzyPrepare>
}
interface AddActionGroup {
	label: string
	options: AddActionOption[]
}
interface AddActionDropdownProps {
	onSelect: (connectionId: string, definitionId: string) => void
	placeholder: string
}
export const AddActionDropdown = observer(function AddActionDropdown({
	onSelect,
	placeholder,
}: AddActionDropdownProps) {
	const { actionDefinitions, connections, recentlyAddedActions } = useContext(RootAppStoreContext)
	const menuPortal = useContext(MenuPortalContext)

	const options = useComputed(() => {
		const options: Array<AddActionOption | AddActionGroup> = []
		for (const [connectionId, connectionActions] of actionDefinitions.connections.entries()) {
			for (const [actionId, action] of connectionActions.entries()) {
				const connectionLabel = connections.getLabel(connectionId) ?? connectionId
				const optionLabel = `${connectionLabel}: ${action.label}`
				options.push({
					isRecent: false,
					value: `${connectionId}:${actionId}`,
					label: optionLabel,
					fuzzy: fuzzyPrepare(optionLabel),
				})
			}
		}

		const recents: AddActionOption[] = []
		for (const actionType of recentlyAddedActions.recentIds) {
			if (actionType) {
				const [connectionId, actionId] = actionType.split(':', 2)
				const actionInfo = actionDefinitions.connections.get(connectionId)?.get(actionId)
				if (actionInfo) {
					const connectionLabel = connections.getLabel(connectionId) ?? connectionId
					const optionLabel = `${connectionLabel}: ${actionInfo.label}`
					recents.push({
						isRecent: true,
						value: `${connectionId}:${actionId}`,
						label: optionLabel,
						fuzzy: fuzzyPrepare(optionLabel),
					})
				}
			}
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [actionDefinitions, connections, recentlyAddedActions.recentIds])

	const innerChange = useCallback(
		(e: AddActionOption | null) => {
			if (e?.value) {
				recentlyAddedActions.trackId(e.value)

				const [connectionId, definitionId] = e.value.split(':', 2)
				onSelect(connectionId, definitionId)
			}
		},
		[onSelect, recentlyAddedActions]
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
			placeholder={placeholder}
			value={null}
			onChange={innerChange}
			filterOption={filterOptions}
			noOptionsMessage={noOptionsMessage}
		/>
	)
})
