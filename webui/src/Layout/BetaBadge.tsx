import { StatusBadge } from '~/Components/StatusBadge.js'

/** Marks a page as for something whose behaviour is not yet settled */
export function BetaBadge(): React.JSX.Element {
	return (
		<StatusBadge
			tone="warning"
			title="This is still being worked on, so how it behaves may change in a future version"
			className="ms-2"
		>
			Beta
		</StatusBadge>
	)
}
