import React, { useState, useCallback, useContext, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import type { DropdownChoiceInt } from '~/DropDownInputFancy.js'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { COMPANION_EXPRESSION_LANGUAGE_ID } from '~/Resources/Expression.monarch'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import classNames from 'classnames'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

interface ExpressionInputFieldProps {
	value: string
	setValue: (value: string) => void
	disabled?: boolean
	localVariables?: DropdownChoiceInt[]
}

export const ExpressionInputField = observer(function ExpressionInputField({
	value,
	setValue,
	disabled,
	localVariables,
}: ExpressionInputFieldProps) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const [editor, setEditor] = useState<editor.IStandaloneCodeEditor | null>(null)
	const [tmpValue, setTmpValue] = useState<string | null>(null)
	const [isValid, setValid] = useState(true)

	const showValue = stringifyVariableValue(tmpValue ?? value ?? '') ?? ''

	// Update validation when value changes
	useEffect(() => {
		setValid(isExpressionValid(showValue))
	}, [showValue])

	const baseVariableDefinitions = variablesStore.allVariableDefinitions.get()
	useEffect(() => {
		if (!editor) return

		// Update the suggestions list in tribute whenever anything changes
		const suggestions: DropdownChoiceInt[] = []
		for (const variable of baseVariableDefinitions) {
			suggestions.push({
				value: `${variable.connectionLabel}:${variable.name}`,
				label: variable.description,
			})
		}

		if (localVariables) suggestions.push(...localVariables)

		// Set companion variables metadata on the model (typed via augmentation)
		const model = editor.getModel()
		if (model) {
			model._companionVariables = suggestions
		}
	}, [editor, baseVariableDefinitions, localVariables])

	const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
		setEditor(editor)

		editor.onDidFocusEditorText(() => {
			setTmpValue(editor.getValue())
		})
		editor.onDidBlurEditorText(() => {
			setTmpValue(null)
		})
	}, [])

	const storeValue2 = useCallback(
		(value: string | undefined, _ev: editor.IModelContentChangedEvent) => {
			const newValue = value ?? ''
			setTmpValue(newValue)
			setValue(newValue)

			setValid(isExpressionValid(newValue))
		},
		[setValue]
	)

	// Render the input
	return (
		<div
			className={classNames('expression-editor-container', {
				'syntax-error': !isValid,
			})}
		>
			<Editor
				height="100%"
				value={showValue}
				onChange={storeValue2}
				defaultLanguage={COMPANION_EXPRESSION_LANGUAGE_ID}
				onMount={handleEditorDidMount}
				theme="companion-expression-light"
				options={{
					readOnly: disabled,
					minimap: { enabled: false },
					wordWrap: 'on',
					// Prevent wrapping inside Companion variables like $(foo:bar)
					// Only allow wrapping at whitespace to avoid breaking between '$' and '('
					wordWrapBreakBeforeCharacters: '',
					wordWrapBreakAfterCharacters: ' \t',
					scrollBeyondLastLine: false,
					automaticLayout: true,
					lineNumbers: 'off',
					folding: false,
					fixedOverflowWidgets: true,
					fontSize: 15,
					// set suggestFontSize to 16 to make menu font and row height more like the other variable suggestion menus.
					suggestFontSize: 14,
					// Make suggest widget rows tall enough for two lines (name + description)
					suggestLineHeight: 53,
				}}
			/>
		</div>
	)
})

function isExpressionValid(value: string): boolean {
	try {
		ParseExpression(value)
		return true
	} catch (_e) {
		return false
	}
}
