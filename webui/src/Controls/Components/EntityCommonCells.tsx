import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import React, { useCallback, useContext } from 'react'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'
import { OptionButtonPreview } from '../OptionButtonPreview.js'
import { CAlert, CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { OptionsInputField } from '../OptionsInputField.js'
import { useOptionsVisibility } from '~/Hooks/useOptionsAndIsVisible.js'
import { EntityChangeConnection } from './EntityChangeConnection.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { FeedbackManageStyles, FeedbackStyles } from './FeedbackStylesCells.js'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'
import { TextInputField } from '../../Components/TextInputField.js'
import { observer } from 'mobx-react-lite'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay.js'
import { LoadingBar } from '~/Resources/Loading.js'

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
	const { location, localVariablePrefix, controlId, readonly, localVariablesStore } = useEntityEditorContext()
	const { connections } = useContext(RootAppStoreContext)

	const isConnectionEnabled =
		entity.connectionId === 'internal' || !!connections.connections.get(entity.connectionId)?.enabled

	const showButtonPreview = entity?.connectionId === 'internal' && entityDefinition?.showButtonPreview

	const optionVisibility = useOptionsVisibility(entityDefinition?.options, entity?.options)

	return (
		<>
			<div className="entity-cells-wrapper">
				{showButtonPreview && (
					<div className="cell-button-preview">
						<OptionButtonPreview controlId={controlId} options={entity.options} />
					</div>
				)}

				<CForm className="row g-sm-2 grow" onSubmit={PreventDefaultHandler}>
					{!!entity && localVariablePrefix && (
						<>
							<MyErrorBoundary>
								<CFormLabel htmlFor="colFormVariableName" className="col-sm-4 col-form-label col-form-label-sm">
									<InlineHelp help={`The name to give this value as a ${localVariablePrefix} variable`}>
										Variable name
									</InlineHelp>
								</CFormLabel>
								<CCol sm={8}>
									<TextInputField
										// regex?: string TODO - validate value syntax
										value={(entity as FeedbackEntityModel).variableName ?? ''}
										setValue={service.setVariableName}
										// setValid?: (valid: boolean) => void
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
								<CFormLabel htmlFor="colFormInvert" className="col-sm-4 col-form-label col-form-label-sm">
									<InlineHelp help="If checked, the behaviour of this feedback is inverted">Invert</InlineHelp>
								</CFormLabel>
								<CCol sm={8}>
									<CFormSwitch
										name="colFormInvert"
										color="success"
										checked={!!('isInverted' in entity && entity.isInverted)}
										size="xl"
										onChange={(e) => service.setInverted(e.currentTarget.checked)}
										disabled={readonly}
									/>
								</CCol>
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
								connectionId={entity.connectionId}
								option={opt}
								value={(entity.options || {})[opt.id]}
								setValue={service.setValue}
								visibility={optionVisibility[opt.id] ?? true}
								readonly={readonly}
								localVariablesStore={localVariablesStore}
							/>
						</MyErrorBoundary>
					))}

					{!!entity && entity.type === EntityModelType.Feedback && feedbackListType === null && (
						<>
							<FeedbackManageStyles
								feedbackSpec={entityDefinition}
								feedback={entity}
								setSelectedStyleProps={service.setSelectedStyleProps}
							/>
							<FeedbackStyles
								feedbackSpec={entityDefinition}
								feedback={entity}
								setStylePropsValue={service.setStylePropsValue}
								localVariablesStore={localVariablesStore}
							/>
						</>
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
		return <CAlert color="danger">Error: {sub.data.error}</CAlert>
	}

	return <VariableValueDisplay value={sub.data.value} onCopied={onCopied} />
}
