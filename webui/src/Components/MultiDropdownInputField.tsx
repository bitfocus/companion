import { Combobox } from '@base-ui/react/combobox'
import classNames from 'classnames'
import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useState } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import {
	DropdownInputPopup,
	type DropdownChoiceWithMeta,
	type DropdownGroupBase,
} from '~/Components/DropdownInputField/Popup.js'
import { useComputed } from '~/Resources/util.js'
import type { DropdownChoicesOrGroups } from './DropdownChoices.js'
import { MenuPortalContext } from './MenuPortalContext.js'

type FuzzyChoice = DropdownChoiceWithMeta & { fuzzy: ReturnType<typeof fuzzyPrepare> }
type FuzzyGroup = DropdownGroupBase & { items: FuzzyChoice[] }

interface MultiDropdownInputFieldProps {
	htmlName?: string
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
	const menuPortal = useContext(MenuPortalContext)

	if (value === undefined) value = []

	// Convert DropdownChoicesOrGroups -> base-ui Combobox format (choices may be mobx proxies)
	const { allItems, flatItems } = useComputed(() => {
		const flatItems: FuzzyChoice[] = []
		const allItems: Array<FuzzyChoice | FuzzyGroup> = []

		const toFuzzy = (c: DropdownChoice): FuzzyChoice => ({
			id: c.id,
			label: String(c.label),
			fuzzy: fuzzyPrepare(String(c.label)),
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
	}, [choices])

	// Compile the regex (and cache)
	const compiledRegex = useMemo(() => {
		if (regex) {
			const match = regex.match(/^\/(.*)\/(.*)$/)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}
		return null
	}, [regex])

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

		const filterFlat = (items: FuzzyChoice[]): FuzzyChoice[] =>
			items.filter((o) => (fuzzySingle(inputValue, o.fuzzy)?.score ?? 0) >= 0.5)

		const result: Array<FuzzyChoice | FuzzyGroup> = []

		for (const item of allItems) {
			if ('items' in item) {
				const filtered = filterFlat(item.items)
				if (filtered.length > 0) result.push({ ...item, items: filtered })
			} else {
				if ((fuzzySingle(inputValue, item.fuzzy)?.score ?? 0) >= 0.5) result.push(item)
			}
		}

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
			setValue(value.filter((v) => v !== id))
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
				virtualized
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
					menuPortal={menuPortal ?? undefined}
					noOptionsMessage={allowCustom ? 'Begin typing to use a custom value' : undefined}
					showIndicator
					disableUnselected={isMaxReached}
					virtualized
				/>
			</Combobox.Root>
		</div>
	)
})
