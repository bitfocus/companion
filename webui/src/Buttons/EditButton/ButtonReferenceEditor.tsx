import { faArrowUpRightFromSquare, faClone } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
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
import { InputValidityIcon, type InputValidity } from '~/Components/InputValidity.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { EntityListActionContext, useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
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
	const localVariables = localVariablesStore.getOptions({
		entityType: null,
		internalParser: true,
		isLocatedInGrid: true,
		actionContext: EntityListActionContext.NotActions,
	})

	const location = config.options.location
	const fieldId = useId()

	return (
		<>
			<Callout color="info" className="my-2">
				<div className="flex gap-2">
					<FontAwesomeIcon icon={faClone} className="mt-1" />
					<div>
						This button <strong>mirrors</strong> another button. It shows that button's appearance and forwards presses
						to it.
						<br />
						Use <strong>Edit</strong> above to turn it into a normal, fully editable copy.
					</div>
				</div>
			</Callout>

			<Form row className="gap-2" onSubmit={PreventDefaultHandler}>
				<FormLabel htmlFor={fieldId} sm={4} column="sm">
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
				</Grid.Col>

				<ResolvedLocationRow controlId={controlId} location={location} navigateToControl={navigateToControl} />
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
	const targetLocation = resolved !== undefined ? tryParseLocation(resolved) : null

	// Red when the expression errored or didn't resolve to a valid location; unknown (no icon) until the first result
	const validity: InputValidity = !data ? 'unknown' : error !== undefined || !targetLocation ? 'invalid' : 'valid'

	const displayValue = error !== undefined ? `Error: ${error}` : (resolved ?? '')

	return (
		<Grid.Col sm={{ span: 8, offset: 4 }}>
			<div className="flex items-center gap-2">
				<span className="form-text m-0 shrink-0">Resolves to</span>
				<div className="input-validity-wrapper">
					<input
						className={classNames('form-input text-input-field', {
							'invalid-value': validity === 'invalid',
							'has-validity-icon': validity !== 'unknown',
						})}
						readOnly
						value={displayValue}
						title={error !== undefined ? error : displayValue}
					/>
					<InputValidityIcon validity={validity} />
				</div>
				<Button
					className="shrink-0 whitespace-nowrap"
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
			{validity === 'invalid' && error === undefined && (
				<div className="text-danger mt-1 small">
					Not a valid button location — expected <code>page/row/column</code>
				</div>
			)}
		</Grid.Col>
	)
}

/** Parse a resolved `page/row/column` string into a location. Returns null for relative/invalid forms. */
function tryParseLocation(str: string): ControlLocation | null {
	const parts = str.trim().split('/')
	if (parts.length !== 3) return null
	const [page, row, column] = parts.map((part) => part.trim())

	// Page is absolute; row/column may be negative. Reject relative (`+1`) and exponent (`1e2`) forms Number() accepts.
	if (!/^\d+$/.test(page) || !/^-?\d+$/.test(row) || !/^-?\d+$/.test(column)) return null

	return { pageNumber: Number(page), row: Number(row), column: Number(column) }
}
