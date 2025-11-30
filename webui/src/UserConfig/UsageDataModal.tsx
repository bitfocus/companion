import React from 'react'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { trpc } from '~/Resources/TRPC.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useQuery } from '@tanstack/react-query'

interface UsageDataModalProps {
	show: boolean
	onHide: () => void
}

export function UsageDataModal({ show, onHide }: UsageDataModalProps): JSX.Element {
	const { data, isLoading, error } = useQuery({
		...trpc.usageStatistics.getCurrentPayload.queryOptions(),
		enabled: show,
		refetchInterval: 30_000, // Poll every 30 seconds
	})

	const jsonData = data ? JSON.stringify(data, null, 2) : ''
	const errorMessage = error ? (error instanceof Error ? error.message : 'Failed to load usage data') : null

	return (
		<CModal visible={show} onClose={onHide} size="xl">
			<CModalHeader closeButton>
				<h5>Usage Statistics Data</h5>
			</CModalHeader>
			<CModalBody>
				<p className="mb-3">
					This is a live preview of the data transmitted for the usage statistics.
					<br />
					The id field is a randomly generated identifier for your Companion instance when you first launched it. It
					helps us distinguish between different users while ensuring your anonymity.
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
					<>
						<pre
							style={{
								maxHeight: '60vh',
								overflow: 'auto',
								backgroundColor: '#f5f5f5',
								padding: '1rem',
								borderRadius: '4px',
								fontSize: '0.875rem',
							}}
						>
							<code>{jsonData}</code>
						</pre>
					</>
				)}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={onHide}>
					Close
				</CButton>
			</CModalFooter>
		</CModal>
	)
}
