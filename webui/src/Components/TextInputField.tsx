import { Input } from '@base-ui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { DropdownChoiceInt } from './DropdownChoices.js'
import { VariableSuggestionPopup } from './DropdownInputField/Popup.js'

interface TextInputFieldSimpleProps {
	id: string | undefined
	tooltip?: string
	placeholder?: string
	value: string
	className?: string
	setValue: (value: string) => void
	checkValid?: boolean | ((value: string) => boolean)
	disabled?: boolean
	/**
	 * When provided, enables the variable suggestion popup with these options.
	 */
	variableOptions?: DropdownChoice[]
	multiline?: boolean
	autoFocus?: boolean
	onBlur?: () => void
	onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement> | React.KeyboardEvent<HTMLTextAreaElement>) => void
	/**
	 * If the value is written to local storage, set this to opt out of the internal temporary focus value
	 */
	immediateValue?: boolean
}

interface TextInputFieldProps extends Omit<TextInputFieldSimpleProps, 'variableOptions'> {
	useVariables?: boolean
	localVariables?: DropdownChoiceInt[]
}

const EMPTY_VARIABLE_DEFS: never[] = []

export function TextInputFieldSimple({
	id,
	tooltip,
	placeholder,
	value,
	className,
	setValue,
	checkValid,
	disabled,
	variableOptions,
	multiline,
	autoFocus,
	onBlur,
	onKeyDown: onKeyDownProp,
	immediateValue,
}: TextInputFieldSimpleProps): React.JSX.Element {
	const useVariables = !!variableOptions

	const [tmpValue, setTmpValue] = useState<string | null>(null)
	const [cursorPosition, setCursorPosition] = useState<number | null>(null)
	const [focusedIndex, setFocusedIndex] = useState(0)

	const currentValueRef = useRef<string>()
	currentValueRef.current = value ?? ''

	const storeValue = useCallback(
		(val: string) => {
			if (!immediateValue) setTmpValue(val)
			setValue(val)
		},
		[immediateValue, setValue]
	)

	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.FormEvent<HTMLInputElement>) => {
			storeValue(e.currentTarget.value)
			setCursorPosition(e.currentTarget.selectionStart)
		},
		[storeValue]
	)

	const showValue = ((immediateValue ? null : tmpValue) ?? value ?? '').toString()
	const valueIsInvalid = typeof checkValid === 'boolean' ? !checkValid : !!checkValid && !checkValid(showValue)

	const { isPickerOpen, searchValue, setIsForceHidden } = useIsPickerOpen(useVariables ? showValue : '', cursorPosition)

	const options = variableOptions ?? EMPTY_VARIABLE_DEFS

	const filteredItems = useMemo(
		() =>
			searchValue.trim() === ''
				? options
				: options.filter(
						(opt) =>
							String(opt.id).toLowerCase().includes(searchValue.toLowerCase()) ||
							opt.label.toLowerCase().includes(searchValue.toLowerCase())
					),
		[options, searchValue]
	)

	useEffect(() => {
		setFocusedIndex(0)
	}, [searchValue])

	const valueRef = useRef<string>()
	valueRef.current = showValue

	const cursorPositionRef = useRef<number | null>()
	cursorPositionRef.current = cursorPosition

	const inputRef = useRef<HTMLInputElement | null>(null)
	const wrapperRef = useRef<HTMLDivElement | null>(null)

	const onVariableSelect = useCallback(
		(variable: DropdownChoice) => {
			const oldValue = valueRef.current
			if (!oldValue) return

			if (cursorPositionRef.current == null) return

			const openIndex = FindVariableStartIndexFromCursor(oldValue, cursorPositionRef.current)
			if (openIndex === -1) return

			storeValue(oldValue.slice(0, openIndex) + `$(${variable.id})` + oldValue.slice(cursorPositionRef.current))

			const newSelection = openIndex + String(variable.id).length + 3
			setTimeout(() => {
				if (inputRef.current) inputRef.current.setSelectionRange(newSelection, newSelection)
			}, 0)
		},
		[storeValue]
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.code === 'Escape' && isPickerOpen) {
				setIsForceHidden(true)
			} else if (isPickerOpen && e.code === 'ArrowDown') {
				e.preventDefault()
				if (filteredItems.length > 0) setFocusedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
			} else if (isPickerOpen && e.code === 'ArrowUp') {
				e.preventDefault()
				setFocusedIndex((i) => Math.max(i - 1, 0))
			} else if (isPickerOpen && e.code === 'Enter' && filteredItems[focusedIndex]) {
				e.preventDefault()
				onVariableSelect(filteredItems[focusedIndex])
			} else {
				onKeyDownProp?.(e)
			}
			setCursorPosition(e.currentTarget.selectionStart)
		},
		[isPickerOpen, filteredItems, focusedIndex, onVariableSelect, setIsForceHidden, onKeyDownProp]
	)

	const input = (
		<Input
			id={id}
			ref={inputRef}
			type="text"
			className={classNames('text-input-field', { 'invalid-value': valueIsInvalid }, className)}
			render={multiline ? <textarea rows={2} /> : undefined}
			disabled={disabled}
			value={showValue}
			title={tooltip}
			onChange={doOnChange}
			onFocus={(e) => {
				if (!immediateValue) setTmpValue(currentValueRef.current ?? '')
				setCursorPosition(e.currentTarget.selectionStart)
			}}
			onBlur={() => {
				if (!immediateValue) setTmpValue(null)
				setCursorPosition(null)
				onBlur?.()
			}}
			onKeyDown={handleKeyDown}
			onSelect={(e) => {
				setCursorPosition(e.currentTarget.selectionStart)
			}}
			placeholder={placeholder}
			autoFocus={autoFocus}
		/>
	)

	if (!useVariables) return input

	return (
		<div ref={wrapperRef}>
			{input}
			<VariableSuggestionPopup
				open={isPickerOpen}
				anchorRef={wrapperRef}
				items={filteredItems}
				focusedIndex={focusedIndex}
				onSelect={onVariableSelect}
			/>
		</div>
	)
}

export const TextInputField = observer(function TextInputField({
	useVariables,
	localVariables,
	...rest
}: TextInputFieldProps) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const baseVariableDefinitions = useVariables ? variablesStore.allVariableDefinitions.get() : EMPTY_VARIABLE_DEFS
	const variableOptions = useMemo((): DropdownChoice[] | undefined => {
		if (!useVariables) return undefined
		const suggestions: DropdownChoice[] = []
		for (const variable of baseVariableDefinitions) {
			suggestions.push({
				id: `${variable.connectionLabel}:${variable.name}`,
				label: variable.description,
			})
		}
		if (localVariables) {
			for (const v of localVariables) {
				suggestions.push({ id: v.value, label: v.label })
			}
		}
		return suggestions
	}, [useVariables, baseVariableDefinitions, localVariables])

	return <TextInputFieldSimple {...rest} variableOptions={variableOptions} />
})

function useIsPickerOpen(showValue: string, cursorPosition: number | null) {
	const [isForceHidden, setIsForceHidden] = useState(false)

	let isPickerOpen = false
	let searchValue = ' '

	if (cursorPosition != null) {
		const lastOpenSequence = FindVariableStartIndexFromCursor(showValue, cursorPosition)
		isPickerOpen = lastOpenSequence !== -1

		searchValue = showValue.slice(isPickerOpen ? lastOpenSequence + 2 : 0, cursorPosition)

		// If it has no length, then the input field swallows the 'space' character as 'select the focussed option'
		if (searchValue.length === 0) searchValue = ' '
	}

	useEffect(() => {
		// Clear the force hidden after a short delay (it doesn't work to call it directly)
		const id = setTimeout(() => setIsForceHidden(false), 1)
		return () => clearTimeout(id)
	}, [isPickerOpen])

	return {
		searchValue,
		isPickerOpen: !isForceHidden && isPickerOpen,
		setIsForceHidden,
	}
}

function FindVariableStartIndexFromCursor(text: string, cursor: number): number {
	const previousOpen = cursor >= 2 ? text.lastIndexOf('$(', cursor - 2) : -1
	const previousClose = cursor >= 1 ? text.lastIndexOf(')', cursor - 1) : -1

	// Already closed
	if (previousOpen < previousClose) return -1
	// Not open
	if (previousOpen === -1) return -1

	// TODO - ensure contents is valid

	return previousOpen
}
