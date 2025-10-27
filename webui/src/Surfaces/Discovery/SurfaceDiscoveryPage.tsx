import React, { useCallback } from 'react'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable'
import { MyErrorBoundary } from '~/Resources/Error'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'

export function SurfaceDiscoveryPage(): React.JSX.Element {
	const navigate = useNavigate()
	const closeDiscover = useCallback(() => {
		void navigate({ to: '/surfaces/remote' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Discover Surfaces</h4>
				<div className="header-buttons">
					<div className="float_right ms-1 d-xl-none" onClick={closeDiscover} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>
			<div className="secondary-panel-simple-body">
				<div className="fixed-header">
					<p style={{ marginBottom: '0.5rem' }}>
						Discovered remote surfaces, such as Companion Satellite, Stream Deck Studio or Stream Deck Network Dock will
						be listed here. You can easily configure them to connect to Companion from here.
						<br />
						This requires Companion Satellite version 1.9.0 and later.
					</p>
				</div>

				<div className="scrollable-content mt-2">
					<MyErrorBoundary>
						<SurfaceDiscoveryTable />
					</MyErrorBoundary>
				</div>
			</div>
		</>
	)
}
