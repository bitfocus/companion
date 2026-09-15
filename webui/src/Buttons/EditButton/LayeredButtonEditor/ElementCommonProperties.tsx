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
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

export const ElementCommonProperties = observer(function ElementCommonProperties({
	elementProps,
}: {
	elementProps: Readonly<SomeButtonGraphicsElement>
}) {
	const nameFieldId = useId()
	const usageFieldId = useId()

	// The canvas is the button's own settings rather than a layer to be told apart from others, and it is
	// always presented as "Canvas", so naming it only invites confusion. The stored name is left alone.
	const canBeNamed = elementProps.type !== 'canvas'

	return (
		<>
			{canBeNamed && (
				<>
					<FormLabel htmlFor={nameFieldId} sm={4} column="sm">
						Element Name
					</FormLabel>
					<Grid.Col sm={8}>
						<FieldElementNameInput elementProps={elementProps} inputId={nameFieldId} />
					</Grid.Col>
				</>
			)}

			{elementProps.type !== 'canvas' && elementProps.type !== 'group' && (
				<>
					<FormLabel htmlFor={usageFieldId} sm={4} column="sm">
						External Usage
						<InlineHelpIcon className="ms-1">
							Some surfaces do not have full rgb displays and require specific elements for providing feedback in
							alternate ways.
							<br />
							You can override the automatic selection of elements for these purposes by selecting the appropriate usage
							for this element
						</InlineHelpIcon>
					</FormLabel>
					<Grid.Col sm={8}>
						<FieldElementUsageInput elementProps={elementProps} inputId={usageFieldId} />
					</Grid.Col>
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

	return <TextInputFieldSimple id={inputId} setValue={setName} value={elementProps.name ?? ''} />
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
	// Internally the `leds` usage; shown as "Gauge" for now since only gauges drive LEDs.
	{ id: ButtonGraphicsElementUsage.Leds, label: 'Gauge' },
]
