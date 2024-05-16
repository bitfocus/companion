import React, { useEffect, useMemo, useState, useCallback, useContext, useRef } from 'react'
import { CInput } from '@coreui/react'
import { VariableDefinitionsContext } from '../util.js'
import Select, {
	ControlProps,
	OptionProps,
	components as SelectComponents,
	ValueContainerProps,
	createFilter,
} from 'react-select'
import { MenuPortalContext } from './DropdownInputField.js'
import { DropdownChoiceId } from '@companion-module/base'
import { observer } from 'mobx-react-lite'
import { WindowedMenuList } from 'react-windowed-select'

interface TextInputFieldProps {
	regex?: string
	required?: boolean
	tooltip?: string
	placeholder?: string
	value: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	setValid?: (valid: boolean) => void
	disabled?: boolean
	useVariables?: boolean
	useLocalVariables?: boolean
}

export const TextInputField = observer(function TextInputField({
	regex,
	required,
	tooltip,
	placeholder,
	value,
	style,
	setValue,
	setValid,
	disabled,
	useVariables,
	useLocalVariables,
}: TextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)

	// Compile the regex (and cache)
	const compiledRegex = useMemo(() => {
		if (regex) {
			// Compile the regex string
			const match = /^\/(.*)\/(.*)$/.exec(regex)
			if (match) {
				return new RegExp(match[1], match[2])
			}
		}
		return null
	}, [regex])

	// Check if the value is valid
	const isValueValid = useCallback(
		(val: string) => {
			// We need a string here, but sometimes get a number...
			if (typeof val === 'number') {
				val = `${val}`
			}

			// Must match the regex, if required or has a value
			if (required || val !== '') {
				if (compiledRegex && (typeof val !== 'string' || !compiledRegex.exec(val))) {
					return false
				}
			}

			// if required, must not be empty
			if (required && val === '') {
				return false
			}

			return true
		},
		[compiledRegex, required]
	)

	// If the value is undefined, populate with the default. Also inform the parent about the validity
	useEffect(() => {
		setValid?.(isValueValid(value))
	}, [isValueValid, value, setValid])

	const storeValue = useCallback(
		(value: string) => {
			setTmpValue(value)
			setValue(value)
			setValid?.(isValueValid(value))
		},
		[setValue, setValid, isValueValid]
	)
	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => storeValue(e.currentTarget.value),
		[storeValue]
	)

	const currentValueRef = useRef<string>()
	currentValueRef.current = value ?? ''
	const focusStoreValue = useCallback(() => setTmpValue(currentValueRef.current ?? ''), [])
	const blurClearValue = useCallback(() => setTmpValue(null), [])

	const showValue = (tmpValue ?? value ?? '').toString()

	const extraStyle = useMemo(
		() => ({ color: !isValueValid(showValue) ? 'red' : undefined, ...style }),
		[isValueValid, showValue, style]
	)

	// Render the input
	return (
		<>
			{useVariables ? (
				<VariablesSelect
					showValue={showValue}
					style={extraStyle}
					useLocalVariables={!!useLocalVariables}
					storeValue={storeValue}
					focusStoreValue={focusStoreValue}
					blurClearValue={blurClearValue}
					placeholder={placeholder}
					title={tooltip}
					disabled={disabled}
				/>
			) : (
				<CInput
					type="text"
					disabled={disabled}
					value={showValue}
					style={extraStyle}
					title={tooltip}
					onChange={doOnChange}
					onFocus={focusStoreValue}
					onBlur={blurClearValue}
					placeholder={placeholder}
				/>
			)}
		</>
	)
})

function useIsPickerOpen(showValue: string, cursorPosition: number | null) {
	const [isForceHidden, setIsForceHidden] = useState(false)

	let isPickerOpen = false
	let searchValue = ''

	if (cursorPosition != null) {
		const lastOpenSequence = FindVariableStartIndexFromCursor(showValue, cursorPosition)
		isPickerOpen = lastOpenSequence !== -1

		searchValue = showValue.slice(lastOpenSequence + 2, cursorPosition)
	}

	const previousIsPickerOpen = useRef(false)
	if (isPickerOpen !== previousIsPickerOpen.current) {
		// Clear the force hidden after a short delay (it doesn't work to call it directly)
		setTimeout(() => setIsForceHidden(false), 1)
	}
	previousIsPickerOpen.current = isPickerOpen

	return {
		searchValue,
		isPickerOpen: !isForceHidden && isPickerOpen,
		setIsForceHidden,
	}
}

interface DropdownChoiceInt {
	value: string
	label: DropdownChoiceId
}

interface VariablesSelectProps {
	showValue: string
	style: React.CSSProperties
	useLocalVariables: boolean
	storeValue: (value: string) => void
	focusStoreValue: () => void
	blurClearValue: () => void
	placeholder: string | undefined
	title: string | undefined
	disabled: boolean | undefined
}

function VariablesSelect({
	showValue,
	style,
	useLocalVariables,
	storeValue,
	focusStoreValue,
	blurClearValue,
	placeholder,
	title,
	disabled,
}: Readonly<VariablesSelectProps>) {
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)
	const menuPortal = useContext(MenuPortalContext)

	const options = useMemo(() => {
		// Update the suggestions list in tribute whenever anything changes
		const suggestions: DropdownChoiceInt[] = []
		for (const [connectionLabel, variables] of Object.entries(variableDefinitionsContext)) {
			for (const [name, va] of Object.entries(variables || {})) {
				if (!va) continue
				suggestions.push({
					value: `${connectionLabel}:${name}`,
					label: va.label,
				})
			}
		}

		if (useLocalVariables) {
			suggestions.push(
				{
					value: 'this:page',
					label: 'This page',
				},
				{
					value: 'this:column',
					label: 'This column',
				},
				{
					value: 'this:row',
					label: 'This row',
				},
				{
					value: 'this:step',
					label: 'The current step of this button',
				},
				{
					value: 'this:page_name',
					label: 'This page name',
				}
			)
		}

		return suggestions
	}, [variableDefinitionsContext, useLocalVariables])

	const [cursorPosition, setCursorPosition] = useState<number | null>(null)
	const { isPickerOpen, searchValue, setIsForceHidden } = useIsPickerOpen(showValue, cursorPosition)

	const valueRef = useRef<string>()
	valueRef.current = showValue

	const cursorPositionRef = useRef<number | null>()
	cursorPositionRef.current = cursorPosition

	const inputRef = useRef<HTMLInputElement | null>(null)

	const onVariableSelect = useCallback((variable: DropdownChoiceInt | null) => {
		const oldValue = valueRef.current
		if (!variable || !oldValue) return

		if (cursorPositionRef.current == null) return // Nothing selected

		const openIndex = FindVariableStartIndexFromCursor(oldValue, cursorPositionRef.current)
		if (openIndex === -1) return

		// Propogate the new value
		storeValue(oldValue.slice(0, openIndex) + `$(${variable.value})` + oldValue.slice(cursorPositionRef.current))

		// This doesn't work properly, it causes the cursor to get a bit confused on where it is but avoids the glitch of setSelectionRange
		// if (inputRef.current)
		// 	inputRef.current.setRangeText(`$(${variable.value})`, openIndex, cursorPositionRef.current, 'end')

		// Update the selection after mutating the value. This needs to be defered, although this causes a 'glitch' in the drawing
		// It needs to be delayed, so that react can re-render first
		const newSelection = openIndex + variable.value.length + 3
		setTimeout(() => {
			if (inputRef.current) inputRef.current.setSelectionRange(newSelection, newSelection)
		}, 0)
	}, [])

	const selectContext = useMemo(
		() => ({
			value: showValue,
			setValue: storeValue,
			setCursorPosition: setCursorPosition,
			extraStyle: style,
			forceHideSuggestions: setIsForceHidden,
			focusStoreValue,
			blurClearValue,
			title,
			placeholder,
			inputRef,
		}),
		[
			showValue,
			storeValue,
			setCursorPosition,
			style,
			setIsForceHidden,
			focusStoreValue,
			blurClearValue,
			title,
			placeholder,
			inputRef,
		]
	)

	return (
		<VariablesSelectContext.Provider value={selectContext}>
			<Select
				className="variable-select-root"
				menuPortalTarget={menuPortal || document.body}
				menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
				menuPosition="fixed"
				menuPlacement="auto"
				isSearchable
				isMulti={false}
				isDisabled={disabled}
				options={options}
				value={null}
				inputValue={searchValue}
				onChange={onVariableSelect}
				menuIsOpen={isPickerOpen}
				components={CustomSelectComponents}
				backspaceRemovesValue={false}
				filterOption={createFilter({ ignoreAccents: false })}
			/>
		</VariablesSelectContext.Provider>
	)
}

const VariablesSelectContext = React.createContext({
	value: '',
	setValue: (_value: string) => {},
	setCursorPosition: (_pos: number | null) => {},
	extraStyle: {} as React.CSSProperties,
	forceHideSuggestions: (_hidden: boolean) => {},
	focusStoreValue: () => {},
	blurClearValue: () => {},
	title: undefined as string | undefined,
	placeholder: undefined as string | undefined,
	inputRef: { current: null } as React.MutableRefObject<HTMLInputElement | null>,
})

const CustomOption = React.memo((props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-suggestion-option'}>
			<span className="var-name">{data.value}</span>
			<span className="var-label">{data.label}</span>
		</SelectComponents.Option>
	)
})

const EmptyComponent = () => null

const CustomControl = React.memo((props: ControlProps<DropdownChoiceInt>) => {
	return (
		<SelectComponents.Control {...props} className={(props.className ?? '') + ' variables-text-input'}>
			{props.children}
		</SelectComponents.Control>
	)
})

const CustomValueContainer = React.memo((props: ValueContainerProps<DropdownChoiceInt>) => {
	const context = useContext(VariablesSelectContext)

	const checkCursor = useCallback(
		(
			e:
				| React.KeyboardEvent<HTMLInputElement>
				| React.MouseEvent<HTMLInputElement>
				| React.TouchEvent<HTMLInputElement>
				| React.ClipboardEvent<HTMLInputElement>
				| React.FocusEvent<HTMLInputElement>
		) => {
			const target = e.currentTarget

			if (document.activeElement !== target) {
				context.setCursorPosition(null)
			} else {
				context.setCursorPosition(target.selectionStart)
			}
		},
		[context.setCursorPosition]
	)

	const onFocus = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			context.focusStoreValue()

			checkCursor(e)
		},
		[context.focusStoreValue, checkCursor]
	)
	const onBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			context.blurClearValue()

			checkCursor(e)
			context.forceHideSuggestions(false)
		},
		[context.blurClearValue, context.forceHideSuggestions, checkCursor]
	)
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.code === 'Escape') {
				context.forceHideSuggestions(true)
			} else {
				checkCursor(e)
			}
		},
		[context, checkCursor]
	)

	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) =>
			context.setValue(e.currentTarget.value),
		[context.setValue]
	)

	return (
		<SelectComponents.ValueContainer {...props} isDisabled>
			<CInput
				innerRef={context.inputRef}
				type="text"
				style={context.extraStyle}
				title={context.title}
				value={context.value}
				onChange={doOnChange}
				onFocus={onFocus}
				onBlur={onBlur}
				placeholder={context.placeholder}
				onKeyUp={checkCursor}
				onKeyDown={onKeyDown}
				onMouseDown={checkCursor}
				onTouchStart={checkCursor}
				onInput={checkCursor}
				onPaste={checkCursor}
				onCut={checkCursor}
				onSelect={checkCursor}
			/>
		</SelectComponents.ValueContainer>
	)
})

const CustomSelectComponents = {
	Option: CustomOption,
	ValueContainer: CustomValueContainer,
	Control: CustomControl,
	IndicatorsContainer: EmptyComponent,
	MenuList: WindowedMenuList,
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
