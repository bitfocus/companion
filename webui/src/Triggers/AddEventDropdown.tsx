import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { AddDropdown } from '~/Components/AddDropdown.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface AddEventDropdownProps {
	onSelect: (value: DropdownChoiceId) => void
}
export const AddEventDropdown = observer(function AddEventDropdown({ onSelect }: AddEventDropdownProps) {
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

	return (
		<AddDropdown choices={options} placeholder="+ Add event" noOptionsMessage="No events found" onSelect={onSelect} />
	)
})
