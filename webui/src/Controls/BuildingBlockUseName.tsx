import { Link } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { assertNever } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { describeUseControl, type UseControlLink } from './BuildingBlockUses.js'

/** What kind of control uses a custom action or feedback, and its name, linking to roughly where it is */
export const BuildingBlockUseName = observer(function BuildingBlockUseName({
	controlId,
}: {
	controlId: SomeControlId
}): React.JSX.Element {
	const stores = useContext(RootAppStoreContext)
	const description = describeUseControl(controlId, stores)

	return (
		<div className="building-block-use-name">
			<span className="building-block-use-kind">{description.kind}</span>
			<UseControlName name={description.name} link={description.link} />
		</div>
	)
})

/** The name of a control which uses a custom action or feedback, linking to roughly where it is */
function UseControlName({ name, link }: { name: string; link: UseControlLink | null }): React.JSX.Element {
	if (!link) return <>{name}</>

	switch (link.type) {
		case 'buttons-page':
			return (
				<Link to="/buttons/$page" params={{ page: String(link.pageNumber) }} title="Show its page of buttons">
					{name}
				</Link>
			)
		case 'trigger':
			return (
				<Link to="/triggers/$controlId" params={{ controlId: link.triggerId }} title="Edit the trigger">
					{name}
				</Link>
			)
		case 'custom-action':
			return (
				<Link
					to="/custom-actions/$controlId"
					params={{ controlId: link.customActionId }}
					title="Edit the custom action"
				>
					{name}
				</Link>
			)
		case 'custom-feedback':
			return (
				<Link
					to="/custom-feedbacks/$controlId"
					params={{ controlId: link.customFeedbackId }}
					title="Edit the custom feedback"
				>
					{name}
				</Link>
			)
		default:
			assertNever(link)
			return <>{name}</>
	}
}
