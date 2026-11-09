import { skipToken } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { trpc } from '~/Resources/TRPC'

/**
 * Load and retrieve a button image for a specific control id.
 * @param controlId Control to load the image of, or null to load nothing
 */
export function useButtonImageForControlId(controlId: SomeControlId | null): string | null {
	const sub = useSubscription(
		trpc.preview.graphics.controlId.subscriptionOptions(controlId ? { controlId } : skipToken)
	)

	return sub.data ?? null
}
