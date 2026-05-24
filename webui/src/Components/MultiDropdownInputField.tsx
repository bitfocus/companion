import { Combobox } from '@base-ui/react/combobox'
import classNames from 'classnames'
import { prepare as fuzzyPrepare } from 'fuzzysort'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { DropdownInputPopup } from '~/Components/DropdownInputField/Popup.js'
import { useFuzzyChoices, type FuzzyChoice, type FuzzyGroup } from '~/Components/DropdownInputField/useFuzzyChoices.js'
import { useComputed } from '~/Resources/util.js'
import { fuzzyFilterSort } from '~/util/fuzzy.js'
import type { DropdownChoicesOrGroups } from './DropdownChoices.js'
import { useRegex } from './useRegex.js'

interface MultiDropdownInputFieldProps {
	htmlName: string | undefined
	className?: string
	choices: DropdownChoicesOrGroups
	allowCustom?: boolean
	minSelection?: number
	maxSelection?: number
	sortSelection?: boolean
	tooltip?: string
	regex?: string
	value: DropdownChoiceId[]
	setValue: (value: DropdownChoiceId[]) => void
	checkValid?: (value: DropdownChoiceId[]) => boolean
	disabled?: boolean
	onBlur?: () => void
}

export const MultiDropdownInputField = observer(function MultiDropdownInputField({
	htmlName,
	className,
	choices,
	allowCustom,
	minSelection,
	maxSelection,
	sortSelection,
	tooltip,
	regex,
	value,
	setValue,
	checkValid,
	disabled,
	onBlur,
}: MultiDropdownInputFieldProps) {
	if (value === undefined) value = []

	// Convert DropdownChoicesOrGroups -> base-ui Combobox format (choices may be mobx proxies)
	// Always search labels only for multi-dropdown (no id-based search needed)
	const { allItems, flatItems } = useFuzzyChoices(choices, true)

	// The popup doesn't handle groups when virtualised, so detect if there are any groups
	const hasGroups = allItems.some((item) => 'items' in item)

	// Compile the regex (and cache)
	const compiledRegex = useRegex(regex)

	const currentValue = useComputed(() => {
		const selectedValue = Array.isArray(value) ? value : [value]
		const res: DropdownChoice[] = []
		for (const val of selectedValue) {
			const entry = flatItems.find((o) => o.id == val) // Intentionally loose for compatibility
			if (entry) {
				res.push(entry)
			} else if (allowCustom) {
				res.push({ id: val, label: String(val) })
			} else {
				res.push({ id: val, label: `?? (${val})` })
			}
		}
		if (sortSelection) {
			res.sort((a, b) => {
				const aIndex = flatItems.findIndex((o) => o.id == a.id)
				const bIndex = flatItems.findIndex((o) => o.id == b.id)
				if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
				if (aIndex !== -1) return -1
				if (bIndex !== -1) return 1
				return String(a.label).localeCompare(String(b.label))
			})
		}
		return res
	}, [value, flatItems, allowCustom, sortSelection])

	const [inputValue, setInputValue] = useState('')

	const isValidCustom = useCallback((input: string) => !compiledRegex || !!input.match(compiledRegex), [compiledRegex])

	const syntheticItem = useComputed((): FuzzyChoice | null => {
		if (!allowCustom || !inputValue || !isValidCustom(inputValue)) return null
		if (flatItems.some((o) => o.id == inputValue)) return null
		return {
			id: inputValue,
			label: `Create "${inputValue}"`,
			fuzzy: fuzzyPrepare(inputValue),
			plusIndicator: true,
		}
	}, [allowCustom, inputValue, isValidCustom, flatItems])

	// Items master list — must include the synthetic item so base-ui can resolve it on selection
	const effectiveItems = useComputed(
		(): Array<FuzzyChoice | FuzzyGroup> => (syntheticItem ? [syntheticItem, ...allItems] : allItems),
		[syntheticItem, allItems]
	)

	const filteredItems = useComputed((): Array<FuzzyChoice | FuzzyGroup> => {
		if (!inputValue) return allItems

		const result: Array<FuzzyChoice | FuzzyGroup> = []

		// Batch root-level choices between groups so they get sorted together by score
		const pendingRoot: FuzzyChoice[] = []
		for (const item of allItems) {
			if ('items' in item) {
				if (pendingRoot.length > 0) {
					result.push(...fuzzyFilterSort(pendingRoot, inputValue))
					pendingRoot.length = 0
				}
				const filtered = fuzzyFilterSort(item.items, inputValue)
				if (filtered.length > 0) result.push({ ...item, items: filtered })
			} else {
				pendingRoot.push(item)
			}
		}
		if (pendingRoot.length > 0) result.push(...fuzzyFilterSort(pendingRoot, inputValue))

		if (syntheticItem) result.unshift(syntheticItem)

		return result
	}, [allItems, syntheticItem, inputValue])

	const onValueChange = useCallback(
		(newIds: DropdownChoiceId[]) => {
			if (typeof minSelection === 'number' && newIds.length < minSelection && newIds.length <= value.length) {
				return
			}
			if (typeof maxSelection === 'number' && newIds.length > maxSelection && newIds.length >= value.length) {
				return
			}
			setValue(newIds)
		},
		[setValue, value, minSelection, maxSelection]
	)

	const removeValue = useCallback(
		(id: DropdownChoiceId) => {
			const isAtMinimum = typeof minSelection === 'number' && value.length <= minSelection
			if (isAtMinimum) return
			setValue(value.filter((v) => v != id)) // Intentionally loose for compatibility
		},
		[setValue, value, minSelection]
	)

	const isAtMinimum = typeof minSelection === 'number' && currentValue.length <= minSelection
	const isMaxReached = typeof maxSelection === 'number' && value.length >= maxSelection

	return (
		<div
			className={classNames(
				'dropdown-field',
				{ 'dropdown-field-invalid': !!checkValid && !checkValid(currentValue.map((v) => v.id)) },
				className
			)}
			title={tooltip}
		>
			<Combobox.Root<DropdownChoiceId, true>
				multiple={true}
				virtualized={!hasGroups}
				autoHighlight
				value={value}
				items={effectiveItems}
				filteredItems={filteredItems}
				disabled={disabled}
				onValueChange={onValueChange}
				onInputValueChange={setInputValue}
			>
				<Combobox.InputGroup className="dropdown-field-input-group dropdown-field-multi-input-group">
					{currentValue.map((item) => (
						<span className="dropdown-field-pill" key={String(item.id)}>
							<span className="dropdown-field-pill-label">{item.label}</span>
							<button
								type="button"
								className="dropdown-field-pill-remove"
								disabled={isAtMinimum || disabled}
								onClick={(e) => {
									e.stopPropagation()
									removeValue(item.id)
								}}
								tabIndex={-1}
								aria-label={`Remove ${item.label}`}
							>
								<XIcon className="dropdown-field-pill-remove-icon" />
							</button>
						</span>
					))}
					<Combobox.Input className="dropdown-field-input" name={htmlName} onBlur={onBlur} />
					<Combobox.Trigger className="dropdown-field-trigger">
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>

				<DropdownInputPopup
					noOptionsMessage={allowCustom ? 'Begin typing to use a custom value' : undefined}
					showIndicator
					disableUnselected={isMaxReached}
					virtualized={!hasGroups}
				/>
			</Combobox.Root>
		</div>
	)
})
