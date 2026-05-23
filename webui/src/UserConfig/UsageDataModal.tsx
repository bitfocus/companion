import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Modal } from '~/Components/Modal'
import { trpc } from '~/Resources/TRPC.js'

export function UsageDataModal(): JSX.Element {
	const [show, setShow] = useState(false)
	const { data, isLoading, error } = useQuery({
		...trpc.usageStatistics.getCurrentPayload.queryOptions(),
		enabled: show,
		refetchInterval: 30_000, // Poll every 30 seconds
	})

	const jsonData = data ? JSON.stringify(data, null, 2) : ''
	const errorMessage = error ? (error instanceof Error ? error.message : 'Failed to load usage data') : null

	return (
		<Modal.Root open={show} onOpenChange={setShow}>
			<Modal.Trigger color="primary" size="sm" className="uc-button">
				View Data
			</Modal.Trigger>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="xl" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>Usage Statistics Data</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<p className="mb-3">
								This is a live preview of the data transmitted for the usage statistics.
								<br />
								The id field is a randomly generated identifier for your Companion instance when you first launched it.
								It helps us distinguish between different users while ensuring your anonymity.
							</p>
							{isLoading && (
								<div className="text-center py-5">
									<FontAwesomeIcon icon={faSpinner} spin size="2x" />
								</div>
							)}
							{errorMessage && (
								<div className="alert alert-danger" role="alert">
									{errorMessage}
								</div>
							)}
							{!isLoading && !error && data && (
								<pre
									style={{
										backgroundColor: '#f5f5f5',
										padding: '1rem',
										borderRadius: '4px',
										fontSize: '0.875rem',
									}}
								>
									<code>{jsonData}</code>
								</pre>
							)}
						</Modal.Body>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
