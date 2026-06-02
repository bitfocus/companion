import { faChartGantt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'

export function OpenInTimelineButton({ location }: { location: ControlLocation }): React.JSX.Element {
	const navigate = useNavigate()

	const openTimeline = useCallback(() => {
		void navigate({
			to: '/timeline',
			search: { page: location.pageNumber, row: location.row, column: location.column },
		})
	}, [navigate, location.pageNumber, location.row, location.column])

	return (
		<Button color="info" onClick={openTimeline} title="Open this button in the Timeline editor">
			<FontAwesomeIcon icon={faChartGantt} /> Timeline
		</Button>
	)
}
