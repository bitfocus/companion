import { faFileArrowDown, faFileArrowUp, faFileLines, type IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type {
	PageDownButtonModel,
	PageNumberButtonModel,
	PageUpButtonModel,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ConvertToNormalButton } from './ConvertToNormalButton.js'
import { EditButtonLayout } from './EditButtonLayout.js'

type PageButtonType = (PageUpButtonModel | PageDownButtonModel | PageNumberButtonModel)['type']

const PAGE_BUTTON_INFO: Record<PageButtonType, { label: string; icon: IconDefinition; description: string }> = {
	pageup: {
		label: 'Page up',
		icon: faFileArrowUp,
		description: 'Page up buttons automatically navigate to the previous page when pressed.',
	},
	pagenum: {
		label: 'Page number',
		icon: faFileLines,
		description: 'Page number buttons display the current active page number on your control surface.',
	},
	pagedown: {
		label: 'Page down',
		icon: faFileArrowDown,
		description: 'Page down buttons automatically navigate to the next page when pressed.',
	},
}

interface PageButtonPanelProps {
	controlId: SomeControlId
	location: ControlLocation
	type: PageButtonType
}

export function PageButtonPanel({ controlId, location, type }: PageButtonPanelProps): React.JSX.Element {
	const info = PAGE_BUTTON_INFO[type]

	return (
		<EditButtonLayout
			controlId={controlId}
			location={location}
			typeLabel={info.label}
			testControls={null}
			actions={<ConvertToNormalButton location={location} />}
			notesState={null}
			editorTabs={null}
		>
			<NonIdealState icon={info.icon}>
				<h4 className="my-1 font-semibold text-body">{info.label} button</h4>
				<p className="my-2 text-sm text-muted">{info.description}</p>
			</NonIdealState>
		</EditButtonLayout>
	)
}
