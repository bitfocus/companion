import { observer } from 'mobx-react-lite'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { Badge } from '~/Components/Badge.js'
import { Spinner } from '~/Components/Spinner.js'
import { instanceStatusTone } from './InstanceStatusHelpers.js'

interface InstanceTableStatusCellProps {
	isEnabled: boolean
	status: InstanceStatusEntry | undefined
}
export const InstanceTableStatusCell = observer(function InstanceTableStatusCell({
	isEnabled,
	status,
}: InstanceTableStatusCellProps) {
	if (!isEnabled) {
		return <Badge tone="disabled">Disabled</Badge>
	}

	// The module's own status message is the only explanation of *why* a connection is failing, and it
	// is too long for the badge, so it is surfaced as hover text.
	const messageStr =
		typeof status?.message === 'string' || typeof status?.message === 'number'
			? String(status.message)
			: status?.message
				? JSON.stringify(status.message)
				: ''

	const tone = instanceStatusTone(status)
	let label: string
	let indicator: React.ReactNode = undefined
	if (tone === 'neutral' || tone === 'info') {
		label = 'Connecting'
		// No explicit colour: the spinner draws in currentColor, so it matches the badge's tone text.
		indicator = <Spinner size="sm" className="status-badge-spinner" />
	} else if (tone === 'good') {
		label = 'OK'
	} else {
		label = status?.level || (tone === 'warning' ? 'Warning' : 'Error')
	}

	return (
		<Badge tone={tone} indicator={indicator} title={messageStr ? `${label}: ${messageStr}` : label}>
			<span>{label}</span>
		</Badge>
	)
})
