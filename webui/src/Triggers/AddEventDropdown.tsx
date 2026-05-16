import { Combobox } from '@base-ui/react/combobox'
import { ChevronDownIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { DropdownInputPopup } from '~/Components/DropdownInputField/Popup'
import { MenuPortalContext } from '~/Components/MenuPortalContext'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

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

	const onChange = useCallback(
		(id: DropdownChoice['id'] | null) => {
			if (id) onSelect(id)
		},
		[onSelect]
	)

	const inputRef = useRef<HTMLInputElement>(null)

	const onOpenChange = useCallback((open: boolean) => {
		if (!open) {
			inputRef.current?.blur()
		}
	}, [])

	return (
		<div className="dropdown-field">
			<Combobox.Root
				value={null}
				items={options}
				multiple={false}
				autoHighlight
				onValueChange={onChange}
				onOpenChange={onOpenChange}
			>
				<Combobox.InputGroup className="dropdown-field-input-group rounded-end-0">
					<Combobox.Input className="dropdown-field-input" placeholder={'+ Add event'} ref={inputRef} />
					<Combobox.Trigger className="dropdown-field-trigger">
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>
				<DropdownInputPopup menuPortal={menuPortal ?? undefined} noOptionsMessage="No events found" />
			</Combobox.Root>
		</div>
	)
})
