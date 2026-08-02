import { faArrowUpRightFromSquare, faClone } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import type { JsonValue } from 'type-fest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ExpressionStreamResult } from '@companion-app/shared/ExpressionResult.js'
import type { ButtonReferenceButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { Button } from '~/Components/Button'
import { Callout } from '~/Components/Callout.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { TextInputField } from '~/Components/TextInputField.js'
import { useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'

interface ButtonReferenceEditorProps {
	config: ButtonReferenceButtonModel
	controlId: string
	navigateToControl: ((location: ControlLocation) => void) | undefined
}

/**
 * Editor for a button-reference (mirror) control: the grid `location` to mirror (plain text or expression), with a
 * live resolved-location preview and a shortcut to open the mirrored button's editor.
 */
export const ButtonReferenceEditor = observer(function ButtonReferenceEditor({
	config,
	controlId,
	navigateToControl,
}: ButtonReferenceEditorProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setLocation = useCallback(
		(value: ExpressionOrValue<JsonValue | undefined>) => {
			setOptionsFieldMutation
				.mutateAsync({ controlId, key: 'location', value })
				.catch((e) => console.error(`Failed to set reference location: ${e}`))
		},
		[setOptionsFieldMutation, controlId]
	)

	const localVariablesStore = useLocalVariablesStore(controlId, null)
	const localVariables = localVariablesStore.getOptions(null, true, true)

	const location = config.options.location
	const fieldId = useId()

	return (
		<>
			<Callout color="info" className="my-2">
				<div className="d-flex gap-2">
					<FontAwesomeIcon icon={faClone} className="mt-1" />
					<div>
						This button <strong>mirrors</strong> another button. It shows that button's appearance and forwards presses
						to it.
						<br />
						Use <strong>Edit</strong> above to turn it into a normal, fully editable copy.
					</div>
				</div>
			</Callout>

			<Form className="row g-2" onSubmit={PreventDefaultHandler}>
				<FormLabel htmlFor={fieldId} className="col-sm-4 col-form-label col-form-label-sm">
					Mirrored location
				</FormLabel>
				<Grid.Col sm={8}>
					<FieldOrExpression
						inputId={fieldId}
						localVariablesStore={localVariablesStore}
						value={location}
						setValue={setLocation}
						disabled={false}
						entityType={null}
						isLocatedInGrid={true}
					>
						<TextInputField
							id={fieldId}
							value={String(location.value ?? '')}
							setValue={(value) => setLocation({ isExpression: false, value })}
							useVariables
							localVariables={localVariables}
							placeholder="page/row/column, e.g. 1/0/0"
						/>
					</FieldOrExpression>

					<ResolvedLocationRow controlId={controlId} location={location} navigateToControl={navigateToControl} />
				</Grid.Col>
			</Form>
		</>
	)
})

interface ResolvedLocationRowProps {
	controlId: string
	location: ExpressionOrValue<string>
	navigateToControl: ((location: ControlLocation) => void) | undefined
}

/**
 * Shows the live resolved value of the location field (after variable/expression interpolation), with a shortcut
 * to open that button's editor.
 */
function ResolvedLocationRow({ controlId, location, navigateToControl }: ResolvedLocationRowProps) {
	const rawValue = String(location.value ?? '')

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId,
				expression: rawValue,
				isVariableString: !location.isExpression,
				contextResolution: undefined,
			},
			{ enabled: rawValue.trim().length > 0 }
		)
	)

	if (!rawValue.trim()) return null

	const data = sub.data as ExpressionStreamResult | undefined
	const resolved = data?.ok ? (stringifyVariableValue(data.value) ?? '') : undefined
	const error = data && !data.ok ? data.error : undefined
	const targetLocation = resolved ? tryParseLocation(resolved) : null

	return (
		<div className="d-flex align-items-end gap-2 mt-2">
			<div className="flex-grow-1">
				<div className="form-text mb-1 mt-0">Resolves to</div>
				<input
					className="form-control form-control-sm"
					readOnly
					value={error !== undefined ? `Error: ${error}` : (resolved ?? '')}
					title={error !== undefined ? error : undefined}
				/>
			</div>
			<Button
				color="secondary"
				variant="outline"
				disabled={!targetLocation || !navigateToControl}
				onClick={() => targetLocation && navigateToControl?.(targetLocation)}
				title={
					targetLocation
						? `Open the editor for ${formatLocation(targetLocation)}`
						: 'The mirrored location is not a plain button location'
				}
			>
				<FontAwesomeIcon icon={faArrowUpRightFromSquare} /> Go to source
			</Button>
		</div>
	)
}

/** Parse a resolved `page/row/column` string into a location. Returns null for relative/invalid forms. */
function tryParseLocation(str: string): ControlLocation | null {
	const parts = str.trim().split('/')
	if (parts.length !== 3 || parts.some((part) => part.trim() === '')) return null

	const pageNumber = Number(parts[0])
	const row = Number(parts[1])
	const column = Number(parts[2])
	if (![pageNumber, row, column].every((n) => Number.isInteger(n))) return null

	return { pageNumber, row, column }
}
