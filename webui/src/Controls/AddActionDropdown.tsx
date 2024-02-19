import React, { useCallback, useContext } from 'react'
import { ConnectionsContext, useComputed } from '../util.js'
import Select, { createFilter } from 'react-select'
import { MenuPortalContext } from '../Components/DropdownInputField.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'

const baseFilter = createFilter<AddActionOption>()
const filterOptions: ReturnType<typeof createFilter<AddActionOption>> = (candidate, input): boolean => {
	if (input) {
		return !candidate.data.isRecent && baseFilter(candidate, input)
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
}
interface AddActionGroup {
	label: string
	options: AddActionOption[]
}
interface AddActionDropdownProps {
	onSelect: (actionType: string) => void
	placeholder: string
}
export const AddActionDropdown = observer(function AddActionDropdown({
	onSelect,
	placeholder,
}: AddActionDropdownProps) {
	const { actionDefinitions, recentlyAddedActions } = useContext(RootAppStoreContext)
	const menuPortal = useContext(MenuPortalContext)
	const connectionsContext = useContext(ConnectionsContext)

	const options = useComputed(() => {
		const options: Array<AddActionOption | AddActionGroup> = []
		for (const [connectionId, connectionActions] of actionDefinitions.connections.entries()) {
			for (const [actionId, action] of connectionActions.entries()) {
				const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
				options.push({
					isRecent: false,
					value: `${connectionId}:${actionId}`,
					label: `${connectionLabel}: ${action.label}`,
				})
			}
		}

		const recents: AddActionOption[] = []
		for (const actionType of recentlyAddedActions.recentIds) {
			if (actionType) {
				const [connectionId, actionId] = actionType.split(':', 2)
				const actionInfo = actionDefinitions.connections.get(connectionId)?.get(actionId)
				if (actionInfo) {
					const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
					recents.push({
						isRecent: true,
						value: `${connectionId}:${actionId}`,
						label: `${connectionLabel}: ${actionInfo.label}`,
					})
				}
			}
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [actionDefinitions, connectionsContext, recentlyAddedActions.recentIds])

	const innerChange = useCallback(
		(e: AddActionOption | null) => {
			if (e?.value) {
				recentlyAddedActions.trackId(e.value)

				onSelect(e.value)
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
