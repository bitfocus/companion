import {
	EntityModelType,
	FeedbackEntityModel,
	FeedbackEntitySubType,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import React from 'react'
import { IEntityEditorActionService } from '../../Services/Controls/ControlEntitiesService.js'
import { OptionButtonPreview } from '../OptionButtonPreview.js'
import { LearnButton } from '../../Components/LearnButton.js'
import { CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { PreventDefaultHandler, MyErrorBoundary } from '../../util.js'
import { OptionsInputField } from '../OptionsInputField.js'
import { useOptionsAndIsVisible } from '../../Hooks/useOptionsAndIsVisible.js'
import { EntityChangeConnection } from './EntityChangeConnection.js'
import { InlineHelp } from '../../Components/InlineHelp.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { FeedbackManageStyles, FeedbackStyles } from './FeedbackStylesCells.js'
import { LocalVariablesStore } from '../LocalVariablesStore.js'
import { TextInputField } from '../../Components/TextInputField.js'

interface EntityCommonCellsProps {
	entity: SomeEntityModel
	entityType: EntityModelType
	feedbackListType: FeedbackEntitySubType | null
	entityDefinition: ClientEntityDefinition | undefined
	service: IEntityEditorActionService
	headlineExpanded: boolean
	definitionName: string
	isLocatedInGrid: boolean
	isLocalVariablesList: boolean
	controlId: string
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

export function EntityCommonCells({
	entity,
	entityType,
	feedbackListType,
	entityDefinition,
	service,
	headlineExpanded,
	definitionName,
	isLocatedInGrid,
	isLocalVariablesList,
	controlId,
	readonly,
	localVariablesStore,
}: EntityCommonCellsProps) {
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
					{!!entity && isLocalVariablesList && (
						<>
							<MyErrorBoundary>
								<CFormLabel htmlFor="colFormVariableName" className="col-sm-4 col-form-label col-form-label-sm">
									<InlineHelp help="The name to give this value as a local variable">Variable name</InlineHelp>
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
								isLocatedInGrid={isLocatedInGrid}
								entityType={entityType}
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

					{!!entity && entityType === EntityModelType.Feedback && feedbackListType === null && (
						<>
							<FeedbackManageStyles
								feedbackSpec={entityDefinition}
								feedback={entity as FeedbackEntityModel}
								setSelectedStyleProps={service.setSelectedStyleProps}
							/>
							<FeedbackStyles
								feedbackSpec={entityDefinition}
								feedback={entity as FeedbackEntityModel}
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
