import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { assertNever, PreventDefaultHandler } from '../../../util.js'
import { TextElementPropertiesEditor } from './TextElementPropertiesEditor.js'
import { CanvasElementPropertiesEditor } from './CanvasElementPropertiesEditor.js'
import { ImageElementPropertiesEditor } from './ImageElementPropertiesEditor.js'
import { CForm } from '@coreui/react'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import { BoxElementPropertiesEditor } from './BoxElementPropertiesEditor.js'
import { LocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'

interface ElementPropertiesEditorProps {
	controlId: string
	elementProps: Readonly<SomeButtonGraphicsElement>
	localVariablesStore: LocalVariablesStore
}
export const ElementPropertiesEditor = observer(function ElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
}: ElementPropertiesEditorProps) {
	return (
		<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
			<ElementCommonProperties
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
			/>

			<ElementPropertiesEditorInner
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
			/>
		</CForm>
	)
})

const ElementPropertiesEditorInner = observer(function ElementPropertiesEditorInner({
	controlId,
	elementProps,
	localVariablesStore,
}: ElementPropertiesEditorProps) {
	switch (elementProps.type) {
		case 'image':
			return (
				<ImageElementPropertiesEditor
					controlId={controlId}
					elementProps={elementProps}
					localVariablesStore={localVariablesStore}
				/>
			)
		case 'text':
			return (
				<TextElementPropertiesEditor
					controlId={controlId}
					elementProps={elementProps}
					localVariablesStore={localVariablesStore}
				/>
			)
		case 'canvas':
			return (
				<CanvasElementPropertiesEditor
					controlId={controlId}
					elementProps={elementProps}
					localVariablesStore={localVariablesStore}
				/>
			)
		case 'box':
			return (
				<BoxElementPropertiesEditor
					controlId={controlId}
					elementProps={elementProps}
					localVariablesStore={localVariablesStore}
				/>
			)
		default:
			assertNever(elementProps)
			return <div>Unsupported element type!</div>
	}
})
