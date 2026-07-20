import type { TRPCClientErrorLike } from '@trpc/client'
import { useEffect, useState } from 'react'
import { PuffLoader } from 'react-spinners'
import { Button } from '~/Components/Button.js'
import { PRIMARY_COLOR } from '~/Resources/Constants.js'

interface StandalonePageErrorProps {
	error?: string | TRPCClientErrorLike<any> | null
	dataReady: boolean
	doRetry?: () => void
	retryLabel?: string
	/** Heading shown above the spinner when there is an error. */
	title?: string
	/** Secondary line shown under the heading. */
	message?: string
	/** Number of seconds to wait before automatically retrying. When set, a countdown is shown and doRetry() is called when it reaches 0. */
	autoRetryAfter?: number | null
}

/**
 * Full-screen loading / error display for the standalone dark pages (emulator, tablet).
 * A prettier, on-theme replacement for LoadingRetryOrError's `pulse-xl` usage. The spinner
 * is always shown (these pages keep retrying in the background); on failure a friendly
 * "unable to reach Companion" message and a Refresh button appear beneath it.
 */
export function StandalonePageError({
	error,
	dataReady,
	doRetry,
	retryLabel = 'Refresh',
	title = 'Unable to reach Companion',
	message = 'Trying to reconnect…',
	autoRetryAfter = null,
}: StandalonePageErrorProps): React.JSX.Element {
	// Track the countdown timer for automatic retry
	const [countdown, setCountdown] = useState(autoRetryAfter)

	// Decrement every second while data is not ready and autoRetryAfter is set
	useEffect(() => {
		if (!dataReady && autoRetryAfter) {
			const interval = setInterval(() => {
				setCountdown((c) => {
					if (!c || c <= 0) {
						return autoRetryAfter - 1
					} else {
						return c - 1
					}
				})
			}, 1000)
			return () => clearInterval(interval)
		} else {
			setCountdown(null)
			return
		}
	}, [dataReady, autoRetryAfter])

	// Trigger the retry callback when countdown reaches 0
	useEffect(() => {
		if (countdown === 0 && doRetry) {
			doRetry()
		}
	}, [countdown, doRetry])

	return (
		<div className="standalone-overlay">
			<div className="standalone-overlay-content">
				<PuffLoader size={160} color={PRIMARY_COLOR} loading />
				{error && (
					<>
						<h2>{title}</h2>
						{message && <p>{message}</p>}
						{!dataReady && !!doRetry && (
							<Button color="primary" onClick={doRetry}>
								{retryLabel} {countdown ? `(${countdown})` : ''}
							</Button>
						)}
					</>
				)}
			</div>
		</div>
	)
}
