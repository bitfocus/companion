import { CCol, CForm, CFormLabel } from '@coreui/react'
import { faCopy, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import type { JsonValue } from 'type-fest'
import { isLabelValid } from '@companion-app/shared/Label.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionInputFieldCheckboxExtended, ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay.js'
import { useOptionsVisibility } from '~/Hooks/useOptionsAndIsVisible.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingBar } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { TextInputField } from '../../Components/TextInputField.js'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'
import { OptionButtonPreview } from '../OptionButtonPreview.js'
import { OptionsInputField } from '../OptionsInputField.js'
import { EntityChangeConnection } from './EntityChangeConnection.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { LayeredStylesOverrides } from './LayeredStylesOverrides.js'

interface EntityCommonCellsProps {
	entity: SomeEntityModel
	entityTypeLabel: string
	feedbackListType: FeedbackEntitySubType | null
	entityDefinition: ClientEntityDefinition | undefined
	service: IEntityEditorActionService
}

export const EntityCommonCells = observer(function EntityCommonCells({
	entity,
	entityTypeLabel,
	feedbackListType,
	entityDefinition,
	service,
}: EntityCommonCellsProps): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)
	const { location, localVariablePrefix, controlId, readonly, localVariablesStore } = useEntityEditorContext()
	const { connections } = useContext(RootAppStoreContext)

	const isConnectionEnabled =
		entity.connectionId === 'internal' || !!connections.connections.get(entity.connectionId)?.enabled

	const showButtonPreview = entity?.connectionId === 'internal' && entityDefinition?.showButtonPreview

	const optionVisibility = useOptionsVisibility(
		entityDefinition?.options,
		!!entityDefinition?.optionsSupportExpressions,
		entity?.options
	)

	const setInverted = useCallback(
		(_k: string, inverted: ExpressionOrValue<JsonValue | undefined>) => {
			service.setInverted(inverted.isExpression ? inverted : { isExpression: false, value: !!inverted.value })
		},
		[service]
	)

	const onCopied = useCallback(() => {
		notifier.show(`Copied`, 'Copied to clipboard', 3000)
	}, [notifier])

	return (
		<>
			<div className="entity-cells-wrapper">
				{showButtonPreview && (
					<div className="cell-button-preview">
						<OptionButtonPreview controlId={controlId} options={entity.options} />
					</div>
				)}

				<CForm className="row g-sm-2 grow" onSubmit={PreventDefaultHandler}>
					{entity.type === EntityModelType.Feedback && localVariablePrefix && (
						<>
							<MyErrorBoundary>
								<CFormLabel htmlFor="colFormVariableName" className="col-sm-4 col-form-label col-form-label-sm">
									Variable name
									<InlineHelpIcon className="ms-1">
										The name to give this value as a {localVariablePrefix} variable
									</InlineHelpIcon>
									<CopyToClipboard text={`$(${localVariablePrefix}:${entity.variableName ?? ''})`} onCopy={onCopied}>
										<Button size="sm" title="Copy variable name" className="ps-0">
											<FontAwesomeIcon icon={faCopy} color="#d50215" />
										</Button>
									</CopyToClipboard>
								</CFormLabel>
								<CCol sm={8}>
									<TextInputField
										value={entity.variableName ?? ''}
										setValue={service.setVariableName}
										checkValid={(str) => str === '' || isLabelValid(str)}
										disabled={readonly}
									/>
								</CCol>
							</MyErrorBoundary>

							<MyErrorBoundary>
								<EntityLocalVariableValueField
									controlId={controlId}
									entity={entity}
									localVariablesStore={localVariablesStore}
									readonly={readonly}
									service={service}
								/>
							</MyErrorBoundary>
						</>
					)}

					<EntityChangeConnection entityConnectionId={entity.connectionId} setConnectionId={service.setConnection} />

					{!!entityDefinition &&
						entityDefinition.entityType === EntityModelType.Feedback &&
						entityDefinition.feedbackType === FeedbackEntitySubType.Boolean &&
						entityDefinition.showInvert !== false && (
							<MyErrorBoundary>
								<OptionsInputField
									isLocatedInGrid={!!location}
									entityType={entity.type}
									allowInternalFields={entity.connectionId === 'internal'}
									controlId={controlId}
									option={FeedbackInvertOption}
									value={'isInverted' in entity ? entity.isInverted : undefined}
									setValue={setInverted}
									visibility={true}
									readonly={readonly}
									localVariablesStore={localVariablesStore}
									fieldSupportsExpression={entityDefinition.optionsSupportExpressions}
								/>
							</MyErrorBoundary>
						)}

					{!entityDefinition && (
						<NonIdealState
							className="pt-2 pb-0"
							icon={faQuestionCircle}
							text={
								!isConnectionEnabled
									? `This ${entityTypeLabel} is not editable while the connection is disabled`
									: `This is not a known ${entityTypeLabel}`
							}
						/>
					)}

					{entityDefinition?.options.map((opt, i) => (
						<MyErrorBoundary key={i}>
							<OptionsInputField
								key={i}
								isLocatedInGrid={!!location}
								entityType={entity.type}
								allowInternalFields={entity.connectionId === 'internal'}
								controlId={controlId}
								option={opt}
								value={(entity.options || {})[opt.id]}
								setValue={service.setValue}
								visibility={optionVisibility.get(opt.id) ?? true}
								readonly={readonly}
								localVariablesStore={localVariablesStore}
								fieldSupportsExpression={entityDefinition.optionsSupportExpressions && !opt.disableAutoExpression}
							/>
						</MyErrorBoundary>
					))}

					{!!entity &&
						entity.type === EntityModelType.Feedback &&
						feedbackListType === FeedbackEntitySubType.StyleOverride && (
							<LayeredStylesOverrides
								feedback={entity}
								feedbackType={entityDefinition?.feedbackType}
								service={service}
								localVariablesStore={localVariablesStore}
							/>
						)}
				</CForm>
			</div>
		</>
	)
})

const EntityLocalVariableValueField = observer(function EntityLocalVariableValueField({
	controlId,
	entity,
	localVariablesStore,
	readonly,
	service,
}: {
	controlId: string
	entity: SomeEntityModel
	localVariablesStore: LocalVariablesStore | null
	readonly: boolean
	service: IEntityEditorActionService
}) {
	if (!localVariablesStore || entity.type !== EntityModelType.Feedback) return null

	return (
		<MyErrorBoundary>
			<CFormLabel htmlFor="colFormInvert" className="col-sm-4 col-form-label col-form-label-sm">
				Current Value
			</CFormLabel>
			<CCol sm={8}>
				{entity.connectionId === 'internal' && entity.definitionId === 'user_value' ? (
					<TextInputField
						disabled={!entity.variableName || readonly}
						value={
							stringifyVariableValue(
								entity.variableName ? localVariablesStore.getValue(entity.variableName) : undefined
							) ?? ''
						}
						setValue={service.setVariableValue}
						// setValid?: (valid: boolean) => void
					/>
				) : entity.variableName ? (
					<LocalVariableCurrentValue controlId={controlId} name={entity.variableName} />
				) : (
					<small>Variable is not active (the name is empty)</small>
				)}
			</CCol>
		</MyErrorBoundary>
	)
})

function LocalVariableCurrentValue({ controlId, name }: { controlId: string; name: string }) {
	const { notifier } = useContext(RootAppStoreContext)

	const onCopied = useCallback(() => notifier.show(`Copied`, 'Copied to clipboard', 3000), [notifier])

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: controlId,
				expression: `$(local:${name})`,
				isVariableString: false,
			},
			{}
		)
	)

	if (!sub.data) {
		return <LoadingBar />
	}

	if (!sub.data.ok) {
		return <StaticAlert color="danger">Error: {sub.data.error}</StaticAlert>
	}

	return <VariableValueDisplay value={sub.data.value} onCopied={onCopied} />
}

const FeedbackInvertOption: CompanionInputFieldCheckboxExtended = {
	id: 'isInverted',
	type: 'checkbox',
	default: false,
	label: 'Invert',
	tooltip: 'If checked, the behaviour of this feedback is inverted',
	displayToggle: true,
}
