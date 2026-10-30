import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface CustomEntityDetailsProps {
	controlId: string
	name: string
	description: string
	/** Shown in the name field when it is empty */
	namePlaceholder: string
	/** Shown in the description field when it is empty */
	descriptionPlaceholder: string
}

/**
 * Edit the name and description of a custom action or feedback
 */
export function CustomEntityDetails({
	controlId,
	name,
	description,
	namePlaceholder,
	descriptionPlaceholder,
}: CustomEntityDetailsProps): React.JSX.Element {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())
	const nameId = useId()
	const descriptionId = useId()

	const setOption = useCallback(
		(key: string, value: JsonValue | undefined) => {
			setOptionsFieldMutation.mutateAsync({ controlId, key, value }).catch((e) => {
				console.error(`Set ${key} failed: ${e}`)
			})
		},
		[setOptionsFieldMutation, controlId]
	)

	return (
		<Grid.Row className="sm:gap-2">
			<FormLabel htmlFor={nameId} sm={4} column="sm">
				Name
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={nameId}
					value={name}
					setValue={(value) => setOption('name', value)}
					placeholder={namePlaceholder}
				/>
			</Grid.Col>

			<FormLabel htmlFor={descriptionId} sm={4} column="sm">
				Description
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={descriptionId}
					value={description}
					setValue={(value) => setOption('description', value)}
					placeholder={descriptionPlaceholder}
				/>
			</Grid.Col>
		</Grid.Row>
	)
}
