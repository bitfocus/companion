import { faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntitiesEditor } from './EntitiesEditor.js'
import type { LocalVariablesStore } from './LocalVariablesStore.js'

interface LocalVariablesEditorProps {
	className?: string
	controlId: string
	location: ControlLocation | undefined
	variables: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
	heading?: React.JSX.Element | string | null
	localVariablePrefix?: string
}
export function LocalVariablesEditor({
	className,
	controlId,
	location,
	variables,
	localVariablesStore,
	heading = 'Local Variables',
	localVariablePrefix = 'local',
}: LocalVariablesEditorProps): React.JSX.Element {
	return (
		<>
			<ControlEntitiesEditor
				className={className}
				heading={heading}
				subheading={
					<span className="text-xs text-muted">
						Local variables are supported on fields featuring the <FontAwesomeIcon icon={faGlobe} className="mx-0.5" />{' '}
						icon.
					</span>
				}
				controlId={controlId}
				entities={variables}
				location={location}
				listId="local-variables"
				entityType={EntityModelType.Feedback}
				entityTypeLabel="variable"
				feedbackListType={FeedbackEntitySubType.Value}
				localVariablesStore={localVariablesStore}
				localVariablePrefix={localVariablePrefix}
			/>
		</>
	)
}
