import { EntityModelType, FeedbackEntityModel, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import classNames from 'classnames'
import React from 'react'
import { IEntityEditorActionService } from '../../Services/Controls/ControlEntitiesService.js'
import { OptionButtonPreview } from '../OptionButtonPreview.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { LearnButton } from '../../Components/LearnButton.js'
import { CForm, CFormSwitch } from '@coreui/react'
import { PreventDefaultHandler, MyErrorBoundary } from '../../util.js'
import { OptionsInputField } from '../OptionsInputField.js'
import { useOptionsAndIsVisible } from '../../Hooks/useOptionsAndIsVisible.js'
import { EntityCellLeftMain } from './EntityCellLeftMain.js'
import { InlineHelp } from '../../Components/InlineHelp.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { FeedbackManageStyles, FeedbackStyles } from './FeedbackStylesCells.js'

interface EntityCommonCellsProps {
	entity: SomeEntityModel
	entityType: EntityModelType
	onlyFeedbackType: 'boolean' | 'advanced' | null
	entityDefinition: ClientEntityDefinition | undefined
	service: IEntityEditorActionService
	headlineExpanded: boolean
	definitionName: string
	location: ControlLocation | undefined
}

export function EntityCommonCells({
	entity,
	entityType,
	onlyFeedbackType,
	entityDefinition,
	service,
	headlineExpanded,
	definitionName,
	location,
}: EntityCommonCellsProps) {
	const showButtonPreview = entity?.connectionId === 'internal' && entityDefinition?.showButtonPreview

	const [optionFields, optionVisibility] = useOptionsAndIsVisible(entityDefinition?.options, entity?.options)

	return (
		<>
			<div
				className={classNames('cell-description', {
					'no-options': optionFields.length === 0,
				})}
			>
				{headlineExpanded && <div className="name">{definitionName}</div>}
				{entityDefinition?.description && <div className="description">{entityDefinition.description || ''}</div>}
			</div>

			{showButtonPreview && (
				<div className="cell-button-preview">
					<OptionButtonPreview location={location} options={entity.options} />
				</div>
			)}

			<div className="cell-actions">
				{entityDefinition?.hasLearn && !!service.performLearn && (
					<div style={{ marginTop: 10 }}>
						<LearnButton id={entity.id} doLearn={service.performLearn} />
					</div>
				)}
			</div>

			<div className="cell-option">
				<CForm onSubmit={PreventDefaultHandler}>
					{optionFields.map((opt, i) => (
						<MyErrorBoundary key={i}>
							<OptionsInputField
								key={i}
								isLocatedInGrid={!!location}
								entityType={entityType}
								connectionId={entity.connectionId}
								option={opt}
								value={(entity.options || {})[opt.id]}
								setValue={service.setValue}
								visibility={optionVisibility[opt.id] ?? true}
							/>
						</MyErrorBoundary>
					))}
				</CForm>
			</div>

			<EntityCellLeftMain entityConnectionId={entity.connectionId} setConnectionId={service.setConnection}>
				{!!entityDefinition &&
					entityDefinition.entityType === EntityModelType.Feedback &&
					entityDefinition.feedbackType === 'boolean' &&
					entityDefinition.showInvert !== false && (
						<MyErrorBoundary>
							<CForm onSubmit={PreventDefaultHandler}>
								<div style={{ paddingLeft: 20 }}>
									<CFormSwitch
										label={
											<InlineHelp help="If checked, the behaviour of this feedback is inverted">Invert</InlineHelp>
										}
										color="success"
										checked={!!('isInverted' in entity && entity.isInverted)}
										size="xl"
										onChange={(e) => service.setInverted(e.currentTarget.checked)}
									/>
								</div>
							</CForm>
						</MyErrorBoundary>
					)}
			</EntityCellLeftMain>

			{!!entity && entityType === EntityModelType.Feedback && onlyFeedbackType === null && (
				<>
					<FeedbackStyles
						feedbackSpec={entityDefinition}
						feedback={entity as FeedbackEntityModel}
						setStylePropsValue={service.setStylePropsValue}
					/>
					<FeedbackManageStyles
						feedbackSpec={entityDefinition}
						feedback={entity as FeedbackEntityModel}
						setSelectedStyleProps={service.setSelectedStyleProps}
					/>
				</>
			)}
		</>
	)
}
