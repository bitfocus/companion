import Editor, { type Monaco } from '@monaco-editor/react'
import Bowser from 'bowser'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import type { editor } from 'monaco-editor'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ParseExpression } from '@companion-app/shared/Expressions.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { DropdownChoiceInt } from '~/Components/DropdownChoices.js'
import { COMPANION_EXPRESSION_LANGUAGE_ID } from '~/Resources/Expression.monarch'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

// WebKit (Safari, and all browsers on iOS) paints the native CSS `resize` grabber underneath child
// content, so the Monaco editor permanently covers it and the handle can't be dragged. Only there do
// we fall back to a custom drag handle; every other engine keeps the native resizer.
const isWebkit =
	typeof window !== 'undefined' && Bowser.getParser(window.navigator.userAgent).getEngineName() === 'WebKit'

interface ExpressionInputFieldProps {
	id: string | undefined
	value: string
	setValue: (value: string) => void
	disabled?: boolean
	localVariables?: DropdownChoiceInt[]
	immediateValue?: boolean
}

export const ExpressionInputField = observer(function ExpressionInputField({
	id,
	value,
	setValue,
	disabled,
	localVariables,
	immediateValue,
}: ExpressionInputFieldProps) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const containerRef = useRef<HTMLDivElement>(null)
	const [editor, setEditor] = useState<editor.IStandaloneCodeEditor | null>(null)
	const [tmpValue, setTmpValue] = useState<string | null>(null)
	const [isValid, setValid] = useState(true)

	const showValue = stringifyVariableValue((immediateValue ? null : tmpValue) ?? value ?? '') ?? ''

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

		editor.onDidBlurEditorText(() => {
			setTmpValue(null)
		})
	}, [])

	const storeValue2 = useCallback(
		(value: string | undefined, _ev: editor.IModelContentChangedEvent) => {
			const newValue = value ?? ''
			if (!immediateValue) setTmpValue(newValue)
			setValue(newValue)

			setValid(isExpressionValid(newValue))
		},
		[immediateValue, setValue]
	)

	// Render the input
	return (
		<div
			ref={containerRef}
			id={id}
			className={classNames('expression-editor-container', {
				'syntax-error': !isValid,
				'custom-resize': isWebkit,
			})}
		>
			<Editor
				// name={id}
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
			{isWebkit && <ExpressionEditorResizeHandle containerRef={containerRef} />}
		</div>
	)
})

/**
 * WebKit-only fallback resize handle. WebKit paints the native CSS `resize` grabber underneath the
 * Monaco editor, so it can't be dragged in Safari (see `isWebkit`). This renders a strip on top of
 * the editor and drives the container height manually. Kept as its own component so the pointer
 * handler is never created on engines that use the native resizer.
 */
function ExpressionEditorResizeHandle({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
	const handleResizePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const container = containerRef.current
			if (!container) return

			e.preventDefault()

			const handleEl = e.currentTarget
			const startY = e.clientY
			const startHeight = container.getBoundingClientRect().height
			const minHeight = parseFloat(getComputedStyle(container).minHeight) || 0

			const onMove = (ev: PointerEvent) => {
				container.style.height = `${Math.max(minHeight, startHeight + (ev.clientY - startY))}px`
			}
			const onUp = () => {
				handleEl.releasePointerCapture(e.pointerId)
				handleEl.removeEventListener('pointermove', onMove)
				handleEl.removeEventListener('pointerup', onUp)
			}

			handleEl.setPointerCapture(e.pointerId)
			handleEl.addEventListener('pointermove', onMove)
			handleEl.addEventListener('pointerup', onUp)
		},
		[containerRef]
	)

	return <div className="expression-editor-resize-handle" onPointerDown={handleResizePointerDown} aria-hidden="true" />
}

function isExpressionValid(value: string): boolean {
	try {
		ParseExpression(value)
		return true
	} catch (_e) {
		return false
	}
}
