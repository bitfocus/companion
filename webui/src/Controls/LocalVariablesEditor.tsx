import { faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { LocalVariableOutputs } from './Components/EntityEditorContext.js'
import { ControlEntitiesEditor } from './EntitiesEditor.js'
import type { LocalVariablesStore } from './LocalVariablesStore.js'

interface LocalVariablesEditorProps {
	className?: string
	controlId: SomeControlId
	location: ControlLocation | undefined
	variables: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
	heading?: React.JSX.Element | string | null
	/** What the local variables are for, shown below the heading */
	description: React.ReactNode
	localVariablePrefix?: string
	/** When set, its user values can be outputs, as in a custom action */
	outputs?: LocalVariableOutputs
}
export function LocalVariablesEditor({
	className,
	controlId,
	location,
	variables,
	localVariablesStore,
	heading = 'Local Variables',
	description,
	localVariablePrefix = 'local',
	outputs,
}: LocalVariablesEditorProps): React.JSX.Element {
	return (
		<>
			<ControlEntitiesEditor
				className={className}
				heading={heading}
				subheading={
					<>
						{description && <p className="text-sm text-muted mb-1">{description}</p>}
						<span className="text-xs text-muted">
							Local variables are supported on fields featuring the{' '}
							<FontAwesomeIcon icon={faGlobe} className="mx-0.5" /> icon.
						</span>
					</>
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
				localVariableOutputs={outputs}
			/>
		</>
	)
}
