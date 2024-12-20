import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { Complete } from '@companion-module/base/dist/util.js'
import type { ControlEntityInstance } from './EntityInstance.js'

export function transformEntityToFeedbacks(entities: ControlEntityInstance[]): FeedbackInstance[] {
	return entities.map((entity) => {
		const entityModel = entity.asEntityModel(false)

		return {
			id: entityModel.id,
			type: entityModel.definitionId,
			instance_id: entityModel.connectionId,
			style: entityModel.type === EntityModelType.Feedback ? entityModel.style : undefined,
			options: entityModel.options,
			isInverted: entityModel.type === EntityModelType.Feedback ? entityModel.isInverted : false,
			headline: entityModel.headline,
			upgradeIndex: entityModel.upgradeIndex,
			disabled: entityModel.disabled,
			children: undefined, // Not needed from this
			advancedChildren: undefined, // Not needed from this
		} satisfies Complete<FeedbackInstance>
	})
}
