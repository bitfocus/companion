import React, { memo, useCallback, useContext, useMemo } from 'react'
import { EventDefinitionsContext } from '../util.js'
import Select from 'react-select'
import { MenuPortalContext } from '../Components/DropdownInputField.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'

const noOptionsMessage = ({}) => {
	return 'No events found'
}
interface AddEventDropdownProps {
	onSelect: (value: DropdownChoiceId) => void
}
export const AddEventDropdown = memo(function AddEventDropdown({ onSelect }: AddEventDropdownProps) {
	const menuPortal = useContext(MenuPortalContext)
	const EventDefinitions = useContext(EventDefinitionsContext)

	const options = useMemo(() => {
		const options: DropdownChoice[] = []
		for (const [eventId, event] of Object.entries(EventDefinitions || {})) {
			if (!event) continue
			options.push({
				id: eventId,
				label: event.name,
			})
		}

		// Sort by name
		options.sort((a, b) => a.label.localeCompare(b.label))

		return options
	}, [EventDefinitions])

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
