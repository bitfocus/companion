import { Combobox } from '@base-ui/react/combobox'
import classNames from 'classnames'
import { ChevronDownIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { type DropdownChoicesOrGroups } from './DropdownChoices.js'
import { DropdownInputPopup } from './DropdownInputField/Popup.js'
import { useDropdownComboboxItems } from './DropdownInputField/useDropdownComboboxItems.js'
import { useFuzzyChoices } from './DropdownInputField/useFuzzyChoices.js'
import { MenuPortalContext } from './MenuPortalContext.js'

interface VariablePickerFieldProps {
	className?: string
	choices: DropdownChoicesOrGroups
	allowCustom?: boolean
	regex?: string
	value: DropdownChoiceId
	setValue: (value: DropdownChoiceId) => void
	disabled?: boolean
	onPasteIntercept?: (value: string) => string
}

/**
 * A specialised dropdown field component, intended for picking variables
 * This means it displays in a "fancy" way with both variable id and label, and searches both fields as well.
 */
export const VariablePickerField = observer(function VariablePickerField({
	className,
	choices,
	allowCustom,
	regex,
	value,
	setValue,
	disabled,
	onPasteIntercept,
}: VariablePickerFieldProps): React.JSX.Element {
	const menuPortal = useContext(MenuPortalContext)

	// Always search both label and id for variable pickers
	const { allItems, flatItems } = useFuzzyChoices(choices, false)

	const hasGroups = allItems.some((item) => 'items' in item)

	// Compile the regex for custom value validation
	const compiledRegex = useMemo(() => {
		if (regex) {
			const match = regex.match(/^\/(.*)\/(.*)$/)
			if (match) return new RegExp(match[1], match[2])
		}
		return null
	}, [regex])

	const isValidCustom = useCallback((input: string) => !compiledRegex || !!input.match(compiledRegex), [compiledRegex])

	const [inputValue, setInputValue] = useState('')

	const [controlledInputValue, setControlledInputValue] = useState<string | undefined>(undefined)
	const controlledInputValueRef = useRef<string | undefined>(undefined)

	const setControlledInput = useCallback((v: string | undefined) => {
		controlledInputValueRef.current = v
		setControlledInputValue(v)
	}, [])

	const triggerRef = useRef<HTMLButtonElement>(null)

	// isEditingMode: always true when allowCustom (no disableEditingCustom concept here)
	const isEditingMode = !!allowCustom

	const [localDisplayValue, setLocalDisplayValue] = useState<DropdownChoiceId>(value)
	useEffect(() => setLocalDisplayValue(value), [value])

	const isKnownValue = flatItems.length === 0 || flatItems.some((o) => o.id == localDisplayValue)

	const { effectiveItems, filteredItems } = useDropdownComboboxItems({
		allItems,
		flatItems,
		localDisplayValue,
		inputValue,
		controlledInputValue,
		allowCustom,
		isValidCustom,
		isEditingMode,
	})

	const onValueChange = useCallback(
		(newId: DropdownChoiceId | null) => {
			if (newId !== null) {
				setLocalDisplayValue(newId)
				setValue(newId)
				setControlledInput(undefined)
				setInputValue('')
				triggerRef.current?.focus()
			}
		},
		[setValue, setControlledInput]
	)

	const onInputValueChange = useCallback(
		(v: string, eventDetails: Combobox.Root.ChangeEventDetails) => {
			setInputValue(v)
			if (controlledInputValueRef.current !== undefined && eventDetails.reason === 'input-change') {
				setControlledInput(v)
			}
		},
		[setControlledInput]
	)

	const onInputFocus = useCallback(() => {
		if (!isEditingMode) return
		setControlledInput(String(localDisplayValue))
	}, [isEditingMode, localDisplayValue, setControlledInput])

	const onInputBlur = useCallback(() => {
		if (isEditingMode && controlledInputValueRef.current !== undefined) {
			setValue(controlledInputValueRef.current)
			setControlledInput(undefined)
			setInputValue('')
		}
	}, [isEditingMode, setValue, setControlledInput])

	// Paste interception: transforms the pasted value and dispatches a native input event so
	// base-ui picks up the change via onInputValueChange.
	const onPaste = useCallback(
		(e: React.ClipboardEvent<HTMLInputElement>) => {
			if (!onPasteIntercept || !e.clipboardData) return
			const rawValue = e.clipboardData.getData('text')
			const newValue = onPasteIntercept(rawValue)

			// Nothing changed, let default behaviour happen
			if (newValue === rawValue) return

			e.preventDefault()

			const target = e.currentTarget
			// eslint-disable-next-line @typescript-eslint/unbound-method
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
			nativeInputValueSetter.call(target, newValue)

			target.dispatchEvent(new Event('input', { bubbles: true }))
		},
		[onPasteIntercept]
	)

	return (
		<div
			className={classNames('dropdown-field', { 'dropdown-field-warning': !!allowCustom && !isKnownValue }, className)}
		>
			<Combobox.Root<DropdownChoiceId>
				virtualized={!hasGroups}
				autoHighlight
				value={localDisplayValue}
				items={effectiveItems}
				filteredItems={filteredItems}
				disabled={disabled}
				onValueChange={onValueChange}
				onInputValueChange={onInputValueChange}
				inputValue={isEditingMode ? (controlledInputValue ?? String(localDisplayValue)) : undefined}
				itemToStringLabel={(id: DropdownChoiceId) => String(id)}
			>
				<Combobox.InputGroup className="dropdown-field-input-group">
					{' '}
					<div className="dropdown-field-fancy-display" aria-hidden="true">
						<div className="var-name">{String(localDisplayValue) || '\u00A0'}</div>
						<div className="var-label">
							{(flatItems.find((o) => o.id == localDisplayValue)?.label ?? String(localDisplayValue)) || '\u00A0'}
						</div>
					</div>{' '}
					<Combobox.Input
						className="dropdown-field-input variable-dropdown-edit"
						onFocus={onInputFocus}
						onBlur={onInputBlur}
						onPaste={onPaste}
					/>
					<Combobox.Trigger className="dropdown-field-trigger" ref={triggerRef}>
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>

				<DropdownInputPopup
					menuPortal={menuPortal ?? undefined}
					noOptionsMessage={allowCustom ? 'Begin typing to use a custom value' : undefined}
					showIndicator={!!allowCustom}
					fancyFormat={true}
					virtualized={!hasGroups}
				/>
			</Combobox.Root>
		</div>
	)
})
