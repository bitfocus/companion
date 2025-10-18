import React, { useMemo, useState, useCallback, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import type { DropdownChoiceInt } from '~/LocalVariableDefinitions.js'
import Editor, { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { COMPANION_EXPRESSION_LANGUAGE_ID, registerCompanionExpressionLanguage } from '~/Resources/Expression.monarch'

interface ExpressionInputFieldProps {
	tooltip?: string
	placeholder?: string
	value: string
	style?: React.CSSProperties
	setValue: (value: string) => void
	checkValid?: (valid: string) => boolean
	disabled?: boolean
	localVariables?: DropdownChoiceInt[]
	autoFocus?: boolean
	onBlur?: () => void
}

export const ExpressionInputField = observer(function ExpressionInputField({
	tooltip,
	placeholder,
	value,
	style,
	setValue,
	checkValid,
	disabled,
	localVariables,
	autoFocus,
	onBlur,
}: ExpressionInputFieldProps) {
	const [tmpValue, setTmpValue] = useState<string | null>(null)

	const storeValue = useCallback(
		(value: string) => {
			setTmpValue(value)
			setValue(value)
		},
		[setValue]
	)

	const currentValueRef = useRef<string>()
	currentValueRef.current = value ?? ''
	const focusStoreValue = useCallback(() => setTmpValue(currentValueRef.current ?? ''), [])
	const blurClearValue = useCallback(() => {
		setTmpValue(null)
		onBlur?.()
	}, [onBlur])

	const showValue = (tmpValue ?? value ?? '').toString()
	const showValue2 = (value ?? '').toString()

	const extraStyle = useMemo(
		() => ({ color: !!checkValid && !checkValid(showValue) ? 'red' : undefined, ...style }),
		[checkValid, showValue, style]
	)

	const editorRef = useRef<editor.IStandaloneCodeEditor>()

	const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
		// here is the editor instance
		// you can store it in `useRef` for further usage
		editorRef.current = editor

		registerCompanionExpressionLanguage(monaco)
	}, [])

	const storeValue2 = useCallback(
		(value: string | undefined, _ev: editor.IModelContentChangedEvent) => {
			// setTmpValue(value)
			setValue(value ?? '')
		},
		[setValue]
	)

	// Render the input
	return (
		<Editor
			height="10vh" // TODO - properly
			value={showValue2}
			onChange={storeValue2}
			defaultLanguage={COMPANION_EXPRESSION_LANGUAGE_ID}
			onMount={handleEditorDidMount}
			options={{
				minimap: { enabled: false },
				wordWrap: 'on',
				scrollBeyondLastLine: false,
				automaticLayout: true,
				lineNumbers: 'off',
				folding: false,
			}}
		/>
	)
})
