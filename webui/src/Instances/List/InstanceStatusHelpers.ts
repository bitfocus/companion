import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { BadgeTone } from '~/Components/Badge.js'

/**
 * Whether a status should be presented as "still connecting" rather than as a failure. Modules report
 * this as an `error` at level `Connecting`, and a status with no category yet means the same thing.
 */
export function isInstanceStatusConnecting(status: InstanceStatusEntry | undefined): boolean {
	return !status?.category || (status.category === 'error' && status.level === 'Connecting')
}

/** The badge tone for an enabled instance's status, shared by the status pill and the message under the name. */
export function instanceStatusTone(status: InstanceStatusEntry | undefined): BadgeTone {
	if (isInstanceStatusConnecting(status)) return status?.category === 'error' ? 'info' : 'neutral'
	if (status?.category === 'good') return 'good'
	if (status?.category === 'warning') return 'warning'
	return 'error'
}
