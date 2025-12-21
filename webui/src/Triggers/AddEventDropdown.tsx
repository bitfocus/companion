import React, { useCallback, useContext } from 'react'
import Select from 'react-select'
import { MenuPortalContext } from '~/Components/MenuPortalContext'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { useComputed } from '~/Resources/util.js'

const noOptionsMessage = () => {
	return 'No events found'
}
interface AddEventDropdownProps {
	onSelect: (value: DropdownChoiceId) => void
}
export const AddEventDropdown = observer(function AddEventDropdown({ onSelect }: AddEventDropdownProps) {
	const menuPortal = useContext(MenuPortalContext)
	const { eventDefinitions } = useContext(RootAppStoreContext)

	const options = useComputed(() => {
		const options: DropdownChoice[] = []
		for (const [eventId, event] of eventDefinitions.definitions) {
			if (!event) continue

			options.push({
				id: eventId,
				label: event.name,
			})
		}

		// Sort by name
		options.sort((a, b) => a.label.localeCompare(b.label))

		return options
	}, [eventDefinitions])

	const innerChange = useCallback(
		(e: DropdownChoice | null) => {
			if (e?.id) {
				onSelect(e.id)
			}
		},
		[onSelect]
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
			placeholder="+ Add event"
			value={null}
			onChange={innerChange}
			noOptionsMessage={noOptionsMessage}
		/>
	)
})
