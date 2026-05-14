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

interface DropdownInputFieldProps {
	htmlName?: string
	className?: string
	choices: DropdownChoicesOrGroups
	allowCustom?: boolean
	disableEditingCustom?: boolean
	tooltip?: string
	regex?: string
	value: DropdownChoiceId
	setValue: (value: DropdownChoiceId) => void
	disabled?: boolean
	onBlur?: () => void
	checkValid?: (value: DropdownChoiceId) => boolean
	searchLabelsOnly?: boolean
}

export const DropdownInputField = observer(function DropdownInputField({
	htmlName,
	className,
	choices,
	allowCustom,
	disableEditingCustom,
	tooltip,
	regex,
	value,
	setValue,
	disabled,
	onBlur,
	checkValid,
	searchLabelsOnly = true,
}: DropdownInputFieldProps): React.JSX.Element {
	const menuPortal = useContext(MenuPortalContext)

	const { allItems, flatItems } = useFuzzyChoices(choices, searchLabelsOnly)

	// The popup doesn't handle groups whwn virtualised, so detect if there are any groups
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

	// Input value for fuzzy filtering
	const [inputValue, setInputValue] = useState('')

	// In editing mode the Combobox.Input is controlled so the user can edit the raw value.
	// undefined = not in editing mode (input is uncontrolled / driven by the Combobox).
	// string   = focused in editing mode; the ref mirrors it for stale-closure-free reads.
	const [controlledInputValue, setControlledInputValue] = useState<string | undefined>(undefined)
	const controlledInputValueRef = useRef<string | undefined>(undefined)

	const setControlledInput = useCallback((v: string | undefined) => {
		controlledInputValueRef.current = v
		setControlledInputValue(v)
	}, [])

	const triggerRef = useRef<HTMLButtonElement>(null)

	// Editing mode: when allowCustom=true and disableEditingCustom=false, focusing the field
	// pre-fills the input with the raw value so it can be edited directly like a text field.
	const isEditingMode = !disableEditingCustom && !!allowCustom

	// localDisplayValue mirrors the committed value but is updated synchronously on selection,
	// staying one render ahead of the parent prop. Without this, selecting "Use XX" clears
	// inputValue immediately while the parent's MobX value hasn't propagated yet, causing a
	// flash of the old label.
	// prevValueProp is not a real value — it is only used to detect when the parent prop
	// changes so we can reset localDisplayValue (standard React derived-state pattern).
	const [localDisplayValue, setLocalDisplayValue] = useState<DropdownChoiceId>(value)
	useEffect(() => setLocalDisplayValue(value), [value])

	const isKnownValue = !!allowCustom || flatItems.length === 0 || flatItems.some((o) => o.id == localDisplayValue)

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

				// Shift focus to the trigger
				triggerRef.current?.focus()
			}
		},
		[setValue, setControlledInput]
	)

	const onInputValueChange = useCallback(
		(v: string, eventDetails: Combobox.Root.ChangeEventDetails) => {
			setInputValue(v)
			// Only mirror into the controlled value when the user is actually typing.
			// When base-ui resets the input (e.g. popup close, item selection), the reason
			// is 'none' or 'item-press' — in those cases we must NOT overwrite the raw id
			// that was pre-filled on focus.
			if (controlledInputValueRef.current !== undefined && eventDetails.reason === 'input-change') {
				setControlledInput(v)
			}
		},
		[setControlledInput]
	)

	// On focus in editing mode: pre-fill the controlled input value with the raw id so it can be
	// edited directly. The controlled inputValue prop on Combobox.Root takes over from base-ui's
	// itemToStringLabel-based display.
	const onInputFocus = useCallback(() => {
		if (!isEditingMode) return
		setControlledInput(String(localDisplayValue))
	}, [isEditingMode, localDisplayValue, setControlledInput])

	// On blur: if in editing mode and no item was selected via onValueChange, commit the
	// current input text as the new value. In search-only mode (disableEditingCustom=true),
	// just reset the filter and focus state.
	const onInputBlur = useCallback(() => {
		if (isEditingMode && controlledInputValueRef.current !== undefined) {
			setValue(controlledInputValueRef.current)
			setControlledInput(undefined)
			setInputValue('')
		} else if (!isEditingMode && allowCustom) {
			setInputValue('')
		}
		onBlur?.()
	}, [isEditingMode, allowCustom, setValue, setControlledInput, onBlur])

	// In disableEditingCustom mode, when focused the input is cleared for searching but the
	// current value is shown as a placeholder so the user knows what's selected.
	const inputPlaceholder = useMemo(() => {
		if (!disableEditingCustom || !allowCustom) return undefined
		return flatItems.find((o) => o.id == localDisplayValue)?.label ?? String(localDisplayValue)
	}, [disableEditingCustom, allowCustom, localDisplayValue, flatItems])

	return (
		<div
			className={classNames(
				'dropdown-field',
				{ 'dropdown-field-invalid': !isKnownValue || (!!checkValid && !checkValid(localDisplayValue)) },
				className
			)}
			title={tooltip}
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
				inputValue={
					isEditingMode
						? (controlledInputValue ??
							flatItems.find((o) => o.id == localDisplayValue)?.label ??
							String(localDisplayValue))
						: disableEditingCustom && allowCustom
							? inputValue
							: undefined
				}
				itemToStringLabel={(id: DropdownChoiceId) => {
					if (disableEditingCustom && allowCustom) return ''
					const item = flatItems.find((o) => o.id == id)
					if (item) return item.label
					const strId = String(id)
					if (!allowCustom && strId) return `?? (${strId})`
					return strId
				}}
			>
				<Combobox.InputGroup className="dropdown-field-input-group">
					<Combobox.Input
						className={classNames('dropdown-field-input', {
							'dropdown-field-input-value-placeholder': inputPlaceholder !== undefined,
						})}
						name={htmlName}
						placeholder={inputPlaceholder}
						onFocus={onInputFocus}
						onBlur={onInputBlur}
					/>
					<Combobox.Trigger className="dropdown-field-trigger" ref={triggerRef}>
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>

				<DropdownInputPopup
					menuPortal={menuPortal ?? undefined}
					noOptionsMessage={allowCustom ? 'Begin typing to use a custom value' : undefined}
					showIndicator={!!allowCustom}
					virtualized={!hasGroups}
				/>
			</Combobox.Root>
		</div>
	)
})
