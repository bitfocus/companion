import { Combobox } from '@base-ui/react/combobox'
import classNames from 'classnames'
import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'
import { ChevronDownIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { useComputed } from '~/Resources/util.js'
import { type DropdownChoicesOrGroups } from './DropdownChoices.js'
import { DropdownInputPopup, type DropdownChoiceWithMeta, type DropdownGroupBase } from './DropdownInputField/Popup.js'
import { MenuPortalContext } from './MenuPortalContext.js'

type FuzzyChoice = DropdownChoiceWithMeta & { fuzzy: ReturnType<typeof fuzzyPrepare> }
type FuzzyGroup = DropdownGroupBase & { items: FuzzyChoice[] }

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
	onPasteIntercept?: (value: string) => string
	checkValid?: (value: DropdownChoiceId) => boolean
	fancyFormat?: boolean
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
	onPasteIntercept,
	checkValid,
	fancyFormat = false,
	searchLabelsOnly = true,
}: DropdownInputFieldProps): React.JSX.Element {
	const menuPortal = useContext(MenuPortalContext)

	// fancyFormat always searches both label and id
	if (fancyFormat) searchLabelsOnly = false

	// Build fuzzy-prepared item lists from choices (choices may be MobX observables)
	const { allItems, flatItems } = useComputed(() => {
		const flatItems: FuzzyChoice[] = []
		const allItems: Array<FuzzyChoice | FuzzyGroup> = []

		const toFuzzy = (c: DropdownChoice): FuzzyChoice => ({
			id: c.id,
			label: String(c.label),
			fuzzy: fuzzyPrepare(searchLabelsOnly ? String(c.label) : `${String(c.label)} ${String(c.id)}`),
		})

		if (Array.isArray(choices)) {
			for (const item of choices) {
				if ('options' in item) {
					const opts = item.options.map(toFuzzy)
					allItems.push({ id: String(item.label), label: String(item.label), items: opts })
					flatItems.push(...opts)
				} else {
					const f = toFuzzy(item)
					allItems.push(f)
					flatItems.push(f)
				}
			}
		} else if (typeof choices === 'object') {
			for (const choice of Object.values(choices)) {
				const f = toFuzzy(choice)
				allItems.push(f)
				flatItems.push(f)
			}
		}

		return { allItems, flatItems }
	}, [choices, searchLabelsOnly])

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

	// Resolve the current value to a display item
	const currentItem = useComputed((): FuzzyChoice => {
		const entry = flatItems.find((o) => o.id == localDisplayValue) // Intentionally loose for compatibility
		if (entry) return entry
		const strValue = String(localDisplayValue)
		if (allowCustom) return { id: localDisplayValue, label: strValue, fuzzy: fuzzyPrepare(strValue) }
		if (localDisplayValue === '' || localDisplayValue === undefined || localDisplayValue === null)
			return { id: localDisplayValue, label: '', fuzzy: fuzzyPrepare('') }
		const unknownLabel = `?? (${strValue})`
		return { id: localDisplayValue, label: unknownLabel, fuzzy: fuzzyPrepare(unknownLabel) }
	}, [localDisplayValue, flatItems, allowCustom])

	// Synthetic "Use X" item — appears when the user has typed a value that passes regex
	// and doesn't exactly match any existing option.
	const syntheticItem = useComputed((): FuzzyChoice | null => {
		if (!allowCustom || !inputValue || !isValidCustom(inputValue)) return null
		if (flatItems.some((o) => o.id == inputValue)) return null
		return {
			id: inputValue,
			label: `Use "${inputValue}"`,
			fuzzy: fuzzyPrepare(inputValue),
			plusIndicator: true,
		}
	}, [allowCustom, inputValue, isValidCustom, flatItems])

	// Items for base-ui value resolution. Includes the synthetic item and, when the current
	// value is a custom/unknown entry, the current item itself so itemToStringLabel can find it.
	const effectiveItems = useComputed((): Array<FuzzyChoice | FuzzyGroup> => {
		const isCurrentKnown = flatItems.some((o) => o.id == localDisplayValue)
		const isSyntheticMatchesCurrent = syntheticItem != null && syntheticItem.id == localDisplayValue

		const prefixed: FuzzyChoice[] = []
		if (syntheticItem) prefixed.push(syntheticItem)
		// Ensure the current value is resolvable even when it's not in the choices list
		if (!isCurrentKnown && !isSyntheticMatchesCurrent) {
			prefixed.push(currentItem)
		}

		return [...prefixed, ...allItems]
	}, [syntheticItem, allItems, flatItems, value, currentItem])

	// Items displayed in the popup (excluding the hidden resolution entry for the current custom value)
	const filteredItems = useComputed((): Array<FuzzyChoice | FuzzyGroup> => {
		// In editing mode, when the input still shows the pre-filled raw value (user hasn't typed
		// anything different), show all options rather than filtering.
		const fuzzyInput =
			isEditingMode && controlledInputValue !== undefined && inputValue === String(localDisplayValue) ? '' : inputValue

		if (!fuzzyInput) return allItems

		const filterFlat = (items: FuzzyChoice[]): FuzzyChoice[] =>
			items.filter((o) => (fuzzySingle(fuzzyInput, o.fuzzy)?.score ?? 0) >= 0.5)

		const result: Array<FuzzyChoice | FuzzyGroup> = []
		for (const item of allItems) {
			if ('items' in item) {
				const filtered = filterFlat(item.items)
				if (filtered.length > 0) result.push({ ...item, items: filtered })
			} else {
				if ((fuzzySingle(fuzzyInput, item.fuzzy)?.score ?? 0) >= 0.5) result.push(item)
			}
		}

		if (syntheticItem) result.unshift(syntheticItem)
		return result
	}, [allItems, syntheticItem, inputValue, isEditingMode, controlledInputValue, value])

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
		if (fancyFormat) return String(localDisplayValue)
		return flatItems.find((o) => o.id == localDisplayValue)?.label ?? String(localDisplayValue)
	}, [disableEditingCustom, allowCustom, fancyFormat, localDisplayValue, flatItems])

	// Paste interception: transforms the pasted value and dispatches a native input event so
	// base-ui picks up the change via onInputValueChange.
	const onPaste = useMemo(() => {
		if (!onPasteIntercept) return undefined
		return (e: React.ClipboardEvent<HTMLInputElement>) => {
			if (!e.clipboardData) return
			const rawValue = e.clipboardData.getData('text')
			const newValue = onPasteIntercept(rawValue)

			// Nothing changed, let default behaviour happen
			if (newValue === rawValue) return

			e.preventDefault()

			// Set the value of the input, using the native setter
			const target = e.currentTarget
			// eslint-disable-next-line @typescript-eslint/unbound-method
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
			nativeInputValueSetter.call(target, newValue)

			// Dispatch a change event
			target.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}, [onPasteIntercept])

	return (
		<div
			className={classNames(
				'dropdown-field',
				{ 'dropdown-field-invalid': !!checkValid && !checkValid(currentItem.id) },
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
							(fancyFormat
								? String(localDisplayValue)
								: (flatItems.find((o) => o.id == localDisplayValue)?.label ?? String(localDisplayValue))))
						: undefined
				}
				itemToStringLabel={(id: DropdownChoiceId) => {
					if (disableEditingCustom && allowCustom) return ''
					if (fancyFormat) return String(id)
					const item = flatItems.find((o) => o.id == id)
					if (item) return item.label
					const strId = String(id)
					if (!allowCustom && strId) return `?? (${strId})`
					return strId
				}}
			>
				<Combobox.InputGroup className="dropdown-field-input-group">
					{' '}
					{fancyFormat && (
						<div className="dropdown-field-fancy-display" aria-hidden="true">
							<div className="var-name">{String(localDisplayValue) || '\u00A0'}</div>
							<div className="var-label">
								{(flatItems.find((o) => o.id == localDisplayValue)?.label ?? String(localDisplayValue)) || '\u00A0'}
							</div>
						</div>
					)}{' '}
					<Combobox.Input
						className={classNames('dropdown-field-input', {
							'variable-dropdown-edit': fancyFormat,
							'dropdown-field-input-value-placeholder': !fancyFormat && inputPlaceholder !== undefined,
						})}
						name={htmlName}
						placeholder={inputPlaceholder}
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
					fancyFormat={fancyFormat}
					virtualized={!hasGroups}
				/>
			</Combobox.Root>
		</div>
	)
})
