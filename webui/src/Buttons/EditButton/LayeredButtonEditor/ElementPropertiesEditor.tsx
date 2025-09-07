import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { assertNever, PreventDefaultHandler } from '~/Resources/util.js'
import { TextElementPropertiesEditor } from './TextElementPropertiesEditor.js'
import { CanvasElementPropertiesEditor } from './CanvasElementPropertiesEditor.js'
import { ImageElementPropertiesEditor } from './ImageElementPropertiesEditor.js'
import { CForm } from '@coreui/react'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import { BoxElementPropertiesEditor } from './BoxElementPropertiesEditor.js'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { GroupElementPropertiesEditor } from './GroupElementPropertiesEditor.js'
import { LineElementPropertiesEditor } from './LineElementPropertiesEditor.js'
import { ElementPropertiesProvider } from './ElementPropertiesContext.js'

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
		<ElementPropertiesProvider controlId={controlId} localVariablesStore={localVariablesStore}>
			<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
				<ElementCommonProperties elementProps={elementProps} />

				<ElementPropertiesEditorInner elementProps={elementProps} />
			</CForm>
		</ElementPropertiesProvider>
	)
})

interface ElementPropertiesEditorInnerProps {
	elementProps: Readonly<SomeButtonGraphicsElement>
}

const ElementPropertiesEditorInner = observer(function ElementPropertiesEditorInner({
	elementProps,
}: ElementPropertiesEditorInnerProps) {
	switch (elementProps.type) {
		case 'image':
			return <ImageElementPropertiesEditor elementProps={elementProps} />
		case 'text':
			return <TextElementPropertiesEditor elementProps={elementProps} />
		case 'canvas':
			return <CanvasElementPropertiesEditor elementProps={elementProps} />
		case 'group':
			return <GroupElementPropertiesEditor elementProps={elementProps} />
		case 'box':
			return <BoxElementPropertiesEditor elementProps={elementProps} />
		case 'line':
			return <LineElementPropertiesEditor elementProps={elementProps} />
		default:
			assertNever(elementProps)
			return <div>Unsupported element type!</div>
	}
})
