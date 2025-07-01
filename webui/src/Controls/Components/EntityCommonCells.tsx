import {
	EntityModelType,
	FeedbackEntityModel,
	FeedbackEntitySubType,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import React from 'react'
import { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService.js'
import { OptionButtonPreview } from '../OptionButtonPreview.js'
import { LearnButton } from '~/Components/LearnButton.js'
import { CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { PreventDefaultHandler, MyErrorBoundary } from '~/util.js'
import { OptionsInputField } from '../OptionsInputField.js'
import { useOptionsAndIsVisible } from '~/Hooks/useOptionsAndIsVisible.js'
import { EntityChangeConnection } from './EntityChangeConnection.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { FeedbackManageStyles, FeedbackStyles } from './FeedbackStylesCells.js'
import { LocalVariablesStore } from '../LocalVariablesStore.js'
import { TextInputField } from '../../Components/TextInputField.js'
import { observer } from 'mobx-react-lite'
import { useEntityEditorContext } from './EntityEditorContext.js'

interface EntityCommonCellsProps {
	entity: SomeEntityModel
	feedbackListType: FeedbackEntitySubType | null
	entityDefinition: ClientEntityDefinition | undefined
	service: IEntityEditorActionService
	headlineExpanded: boolean
	definitionName: string
}

export function EntityCommonCells({
	entity,
	feedbackListType,
	entityDefinition,
	service,
	headlineExpanded,
	definitionName,
}: EntityCommonCellsProps): React.JSX.Element {
	const { location, localVariablePrefix, controlId, readonly, localVariablesStore } = useEntityEditorContext()

	const showButtonPreview = entity?.connectionId === 'internal' && entityDefinition?.showButtonPreview

	const [optionFields, optionVisibility] = useOptionsAndIsVisible(entityDefinition?.options, entity?.options)

	return (
		<>
			<div className="cell-description">
				<div className="grow">
					{headlineExpanded && <div className="name">{definitionName}</div>}
					{entityDefinition?.description && <div className="description">{entityDefinition.description || ''}</div>}
				</div>
				{entityDefinition?.hasLearn && !!service.performLearn && (
					<div>
						<LearnButton id={entity.id} doLearn={service.performLearn} disabled={readonly} />
					</div>
				)}
			</div>

			<div className="entity-cells-wrapper">
				{showButtonPreview && (
					<div className="cell-button-preview">
						<OptionButtonPreview controlId={controlId} options={entity.options} />
					</div>
				)}

				<CForm className="row g-2 grow" onSubmit={PreventDefaultHandler}>
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

					{optionFields.map((opt, i) => (
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

					<EntityLocalVariableValueField
						entity={entity}
						localVariablesStore={localVariablesStore}
						readonly={readonly}
						service={service}
					/>

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
}

const EntityLocalVariableValueField = observer(function EntityLocalVariableValueField({
	entity,
	localVariablesStore,
	readonly,
	service,
}: {
	entity: SomeEntityModel
	localVariablesStore: LocalVariablesStore | null
	readonly: boolean
	service: IEntityEditorActionService
}) {
	if (
		!localVariablesStore ||
		!entity ||
		entity.type !== EntityModelType.Feedback ||
		entity.connectionId !== 'internal' ||
		entity.definitionId !== 'user_value'
	)
		return null

	const value = entity.variableName ? localVariablesStore.getValue(entity.variableName) : undefined
	return (
		<MyErrorBoundary>
			<CFormLabel htmlFor="colFormInvert" className="col-sm-4 col-form-label col-form-label-sm">
				Current Value
			</CFormLabel>
			<CCol sm={8}>
				<TextInputField
					disabled={!entity.variableName || readonly}
					value={value === undefined ? '' : String(value)}
					setValue={service.setVariableValue}
					// setValid?: (valid: boolean) => void
				/>
			</CCol>
		</MyErrorBoundary>
	)
})
