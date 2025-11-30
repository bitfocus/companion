import React, { useMemo, useState, useCallback, useContext, useRef } from 'react'
import { CFormInput, CFormTextarea } from '@coreui/react'
import Select, {
	components as SelectComponents,
	createFilter,
	type ControlProps,
	type OptionProps,
	type ValueContainerProps,
} from 'react-select'
import { MenuPortalContext } from './MenuPortalContext.js'
import { observer } from 'mobx-react-lite'
import { WindowedMenuList } from 'react-windowed-select'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { DropdownChoiceInt } from '~/LocalVariableDefinitions.js'

interface TextInputFieldProps {
	tooltip?: string
	placeholder?: string
	value: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	checkValid?: (valid: string) => boolean
	disabled?: boolean
	useVariables?: boolean
	localVariables?: DropdownChoiceInt[]
	multiline?: boolean
	autoFocus?: boolean
	onBlur?: () => void
}

export const TextInputField = observer(function TextInputField({
	tooltip,
	placeholder,
	value,
	style,
	setValue,
	checkValid,
	disabled,
	useVariables,
	localVariables,
	multiline,
	autoFocus,
	onBlur,
}: TextInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)

	const storeValue = useCallback(
		(value: string) => {
			setTmpValue(value)
			setValue(value)
		},
		[setValue]
	)
	const doOnChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.FormEvent<HTMLInputElement>) =>
			storeValue(e.currentTarget.value),
		[storeValue]
	)

	const currentValueRef = useRef<string>()
	currentValueRef.current = value ?? ''
	const focusStoreValue = useCallback(() => setTmpValue(currentValueRef.current ?? ''), [])
	const blurClearValue = useCallback(() => {
		setTmpValue(null)
		onBlur?.()
	}, [onBlur])

	const showValue = (tmpValue ?? value ?? '').toString()

	const extraStyle = useMemo(
		() => ({ color: !!checkValid && !checkValid(showValue) ? 'red' : undefined, ...style }),
		[checkValid, showValue, style]
	)

	// Render the input
	return (
		<>
			{useVariables ? (
				<>
					<VariablesSelect
						showValue={showValue}
						style={extraStyle}
						localVariables={localVariables}
						storeValue={storeValue}
						focusStoreValue={focusStoreValue}
						blurClearValue={blurClearValue}
						placeholder={placeholder}
						title={tooltip}
						disabled={disabled}
						multiline={multiline}
						autoFocus={autoFocus}
					/>
				</>
			) : multiline ? (
				<CFormTextarea
					disabled={disabled}
					value={showValue}
					style={extraStyle}
					title={tooltip}
					onChange={doOnChange}
					onFocus={focusStoreValue}
					onBlur={blurClearValue}
					placeholder={placeholder}
					autoFocus={autoFocus}
					rows={2}
				/>
			) : (
				<CFormInput
					type="text"
					disabled={disabled}
					value={showValue}
					style={extraStyle}
					title={tooltip}
					onChange={doOnChange}
					onFocus={focusStoreValue}
					onBlur={blurClearValue}
					placeholder={placeholder}
					autoFocus={autoFocus}
				/>
			)}
		</>
	)
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

interface VariablesSelectProps {
	showValue: string
	style: React.CSSProperties
	localVariables: DropdownChoiceInt[] | undefined
	storeValue: (value: string) => void
	focusStoreValue: () => void
	blurClearValue: () => void
	placeholder: string | undefined
	title: string | undefined
	disabled: boolean | undefined
	multiline: boolean | undefined
	autoFocus: boolean | undefined
}

const VariablesSelect = observer(function VariablesSelect({
	showValue,
	style,
	localVariables,
	storeValue,
	focusStoreValue,
	blurClearValue,
	placeholder,
	title,
	disabled,
	multiline,
	autoFocus,
}: Readonly<VariablesSelectProps>) {
	const { variablesStore } = useContext(RootAppStoreContext)
	const menuPortal = useContext(MenuPortalContext)

	const baseVariableDefinitions = variablesStore.allVariableDefinitions.get()
	const options = useMemo(() => {
		// Update the suggestions list in tribute whenever anything changes
		const suggestions: DropdownChoiceInt[] = []
		for (const variable of baseVariableDefinitions) {
			suggestions.push({
				value: `${variable.connectionLabel}:${variable.name}`,
				label: variable.label,
			})
		}

		if (localVariables) suggestions.push(...localVariables)

		return suggestions
	}, [baseVariableDefinitions, localVariables])

	const [cursorPosition, setCursorPosition] = useState<number | null>(null)
	const { isPickerOpen, searchValue, setIsForceHidden } = useIsPickerOpen(showValue, cursorPosition)

	const valueRef = useRef<string>()
	valueRef.current = showValue

	const cursorPositionRef = useRef<number | null>()
	cursorPositionRef.current = cursorPosition

	const inputRef = useRef<HTMLInputElement | null>(null)

	const onVariableSelect = useCallback(
		(variable: DropdownChoiceInt | null) => {
			const oldValue = valueRef.current
			if (!variable || !oldValue) return

			if (cursorPositionRef.current == null) return // Nothing selected

			const openIndex = FindVariableStartIndexFromCursor(oldValue, cursorPositionRef.current)
			if (openIndex === -1) return

			// Propagate the new value
			storeValue(oldValue.slice(0, openIndex) + `$(${variable.value})` + oldValue.slice(cursorPositionRef.current))

			// This doesn't work properly, it causes the cursor to get a bit confused on where it is but avoids the glitch of setSelectionRange
			// if (inputRef.current)
			// 	inputRef.current.setRangeText(`$(${variable.value})`, openIndex, cursorPositionRef.current, 'end')

			// Update the selection after mutating the value. This needs to be deferred, although this causes a 'glitch' in the drawing
			// It needs to be delayed, so that react can re-render first
			const newSelection = openIndex + String(variable.value).length + 3
			setTimeout(() => {
				if (inputRef.current) inputRef.current.setSelectionRange(newSelection, newSelection)
			}, 0)
		},
		[storeValue]
	)

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
				components={multiline ? CustomMultilineSelectComponents : CustomSelectComponents}
				backspaceRemovesValue={false}
				filterOption={createFilter({ ignoreAccents: false })}
				openMenuOnArrows={false}
				autoFocus={autoFocus}
			/>
		</VariablesSelectContext.Provider>
	)
})

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
	inputRef: { current: null } as React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>,
})

const CustomOption = React.memo((props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-dropdown-option'}>
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

function useValueContainerCallbacks() {
	const context = useContext(VariablesSelectContext)

	const checkCursor = useCallback(
		(
			e:
				| React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
				| React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>
				| React.TouchEvent<HTMLInputElement | HTMLTextAreaElement>
				| React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>
				| React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
				| React.FormEvent<HTMLInputElement | HTMLTextAreaElement>
		) => {
			const target = e.currentTarget

			if (document.activeElement !== target) {
				context.setCursorPosition(null)
			} else {
				context.setCursorPosition(target.selectionStart)
			}
		},
		[context]
	)

	const onFocus = useCallback(
		(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			context.focusStoreValue()

			checkCursor(e)
		},
		[context, checkCursor]
	)
	const onBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			context.blurClearValue()

			checkCursor(e)
			context.forceHideSuggestions(false)
		},
		[context, checkCursor]
	)
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			if (e.code === 'Escape') {
				context.forceHideSuggestions(true)
			} else {
				checkCursor(e)
			}
		},
		[context, checkCursor]
	)

	const doOnChange = useCallback(
		(
			e:
				| React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
				| React.FormEvent<HTMLInputElement | HTMLTextAreaElement>
		) => context.setValue(e.currentTarget.value),
		[context]
	)

	return {
		context,
		checkCursor,
		onFocus,
		onBlur,
		onKeyDown,
		doOnChange,
	}
}

const CustomValueContainerTextInput = React.memo((props: ValueContainerProps<DropdownChoiceInt>) => {
	const { context, checkCursor, onFocus, onBlur, onKeyDown, doOnChange } = useValueContainerCallbacks()

	return (
		<SelectComponents.ValueContainer {...props} isDisabled>
			<CFormInput
				ref={context.inputRef as React.RefObject<HTMLInputElement>}
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

const CustomValueContainerTextarea = React.memo((props: ValueContainerProps<DropdownChoiceInt>) => {
	const { context, checkCursor, onFocus, onBlur, onKeyDown, doOnChange } = useValueContainerCallbacks()

	return (
		<SelectComponents.ValueContainer {...props} isDisabled>
			<CFormTextarea
				ref={context.inputRef as React.RefObject<HTMLTextAreaElement>}
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
	ValueContainer: CustomValueContainerTextInput,
	Control: CustomControl,
	IndicatorsContainer: EmptyComponent,
	MenuList: WindowedMenuList,
}

const CustomMultilineSelectComponents = {
	...CustomSelectComponents,
	ValueContainer: CustomValueContainerTextarea,
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
