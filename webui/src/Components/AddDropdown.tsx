import { Combobox } from '@base-ui/react/combobox'
import { ChevronDownIcon } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { DropdownInputPopup } from '~/Components/DropdownInputField/Popup'

interface AddDropdownProps {
	/** The kinds of thing which can be added */
	choices: DropdownChoice[]
	/** Shown in the field, such as `+ Add event` */
	placeholder: string
	noOptionsMessage: string
	onSelect: (id: DropdownChoiceId) => void
}

/**
 * A searchable dropdown at the end of a list, to add something to the list by choosing what kind of thing it is
 */
export function AddDropdown({ choices, placeholder, noOptionsMessage, onSelect }: AddDropdownProps): React.JSX.Element {
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
				items={choices}
				multiple={false}
				autoHighlight
				onValueChange={onChange}
				onOpenChange={onOpenChange}
			>
				<Combobox.InputGroup className="form-input dropdown-field-input-group">
					<Combobox.Input className="dropdown-field-input" placeholder={placeholder} ref={inputRef} />
					<Combobox.Trigger className="dropdown-field-trigger">
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>
				<DropdownInputPopup noOptionsMessage={noOptionsMessage} />
			</Combobox.Root>
		</div>
	)
}
