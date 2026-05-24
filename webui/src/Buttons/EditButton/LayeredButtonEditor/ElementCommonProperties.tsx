import { CCol } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import {
	type ButtonGraphicsElementBase,
	type SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { FormLabel } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

export const ElementCommonProperties = observer(function ElementCommonProperties({
	elementProps,
	simpleMode,
}: {
	elementProps: Readonly<SomeButtonGraphicsElement>
	simpleMode: boolean
}) {
	const nameFieldId = useId()
	const usageFieldId = useId()

	return (
		<>
			<FormLabel htmlFor={nameFieldId} className="col-sm-4 col-form-label col-form-label-sm">
				Element Name
			</FormLabel>
			<CCol sm={8}>
				<FieldElementNameInput elementProps={elementProps} inputId={nameFieldId} />
			</CCol>

			{elementProps.type !== 'canvas' && elementProps.type !== 'group' && !simpleMode && (
				<>
					<FormLabel htmlFor={usageFieldId} className="col-sm-4 col-form-label col-form-label-sm">
						External Usage
						<InlineHelpIcon className="ms-1">
							Some surfaces do not have full rgb displays and require specific elements for providing feedback in
							alternate ways.
							<br />
							You can override the automatic selection of elements for these purposes by selecting the appropriate usage
							for this element
						</InlineHelpIcon>
					</FormLabel>
					<CCol sm={8}>
						<FieldElementUsageInput elementProps={elementProps} inputId={usageFieldId} />
					</CCol>
				</>
			)}
		</>
	)
})

const FieldElementNameInput = observer(function FieldElementNameInput({
	inputId,
	elementProps,
}: {
	inputId: string
	elementProps: SomeButtonGraphicsElement
}) {
	const { controlId } = useElementPropertiesContext()
	const setElementNameMutation = useMutationExt(trpc.controls.styles.setElementName.mutationOptions())

	const setName = useCallback(
		(value: string) => {
			setElementNameMutation
				.mutateAsync({ controlId, elementId: elementProps.id, name: value })
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[setElementNameMutation, controlId, elementProps.id]
	)

	return <TextInputField id={inputId} setValue={setName} value={elementProps.name ?? ''} />
})

const FieldElementUsageInput = observer(function FieldElementUsageInput({
	inputId,
	elementProps,
}: {
	inputId: string
	elementProps: ButtonGraphicsElementBase
}) {
	const { controlId } = useElementPropertiesContext()
	const setElementUsageMutation = useMutationExt(trpc.controls.styles.setElementUsage.mutationOptions())

	const setUsage = useCallback(
		(value: DropdownChoiceId) => {
			setElementUsageMutation
				.mutateAsync({
					controlId,
					elementId: elementProps.id,
					usage: value as ButtonGraphicsElementUsage,
				})
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[setElementUsageMutation, controlId, elementProps.id]
	)

	// TODO: Should the choices be dynamic based on the element type?
	return (
		<SimpleDropdownInputField
			id={inputId}
			setValue={setUsage}
			value={elementProps.usage}
			choices={elementUsageChoices}
		/>
	)
})

const elementUsageChoices: DropdownChoice[] = [
	{ id: ButtonGraphicsElementUsage.Automatic, label: 'Automatic' },
	{ id: ButtonGraphicsElementUsage.Text, label: 'Text' },
	{ id: ButtonGraphicsElementUsage.Color, label: 'Color' },
	{ id: ButtonGraphicsElementUsage.Image, label: 'Image' },
]
