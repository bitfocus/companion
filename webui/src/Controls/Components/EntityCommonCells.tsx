import { ClientActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import classNames from 'classnames'
import React from 'react'
import { IEntityEditorActionService } from '../../Services/Controls/ControlEntitiesService.js'
import { OptionButtonPreview } from '../OptionButtonPreview.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { LearnButton } from '../../Components/LearnButton.js'
import { CForm } from '@coreui/react'
import { PreventDefaultHandler, MyErrorBoundary } from '../../util.js'
import { OptionsInputField } from '../OptionsInputField.js'
import { useOptionsAndIsVisible } from '../../Hooks/useOptionsAndIsVisible.js'

interface EntityCommonCellsProps {
	entity: SomeEntityModel
	entityType: EntityModelType
	entityDefinition:
		| Pick<ClientActionDefinition, 'hasLearn' | 'description' | 'showButtonPreview' | 'options'>
		| undefined
	service: IEntityEditorActionService
	headlineExpanded: boolean
	definitionName: string
	location: ControlLocation | undefined
}

export function EntityCommonCells({
	entity,
	entityType,
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
		</>
	)
}
