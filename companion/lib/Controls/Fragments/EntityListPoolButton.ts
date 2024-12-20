import { NormalButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { EntityModelType, type SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'
import { ControlEntityList } from './EntityList.js'
import { ControlEntityListPoolBase, ControlEntityListPoolProps } from './EntityListPoolBase.js'
import { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'
import { transformEntityToFeedbacks } from './Util.js'

export class ControlEntityListPoolButton extends ControlEntityListPoolBase {
	// TODO
	#feedbacks: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = new ControlEntityList(
			props.instanceDefinitions,
			props.internalModule,
			props.moduleHost,
			props.controlId,
			null,
			{
				type: EntityModelType.Feedback,
				groupId: 'feedbacks',
				label: 'Feedbacks',
			}
		)
	}

	loadStorage(storage: NormalButtonModel, skipSubscribe: boolean, isImport: boolean) {
		this.#feedbacks.loadStorage(storage.feedbacks || [], skipSubscribe, isImport)
	}

	/**
	 * Get all the feedback instances
	 */
	getFeedbackInstances(): FeedbackInstance[] {
		return transformEntityToFeedbacks(this.#feedbacks.getDirectEntities())
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		// TODO - expand
		if (listId === 'feedbacks') return this.#feedbacks
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		// TODO - expand
		return [this.#feedbacks]
	}

	/**
	 * Get the unparsed style for the feedbacks
	 * Note: Does not clone the style
	 */
	getUnparsedFeedbackStyle(): UnparsedButtonStyle {
		const styleBuilder = new FeedbackStyleBuilder(this.baseStyle)
		this.#feedbacks.buildFeedbackStyle(styleBuilder)
		return styleBuilder.style
	}
}
