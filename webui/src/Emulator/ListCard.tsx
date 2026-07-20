import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import type { EmulatorListItem } from '@companion-app/shared/Model/Emulator.js'
import { Button } from '~/Components/Button.js'

interface EmulatorListCardProps {
	surface: EmulatorListItem
}

export function EmulatorListCard({ surface }: EmulatorListCardProps): React.JSX.Element {
	const navigate = useNavigate({ from: '/emulator' })

	return (
		<Button
			color="dark"
			className="emulator-button"
			onClick={() =>
				void navigate({
					to: '/emulator/$emulatorId',
					params: { emulatorId: surface.id },
				})
			}
		>
			<span className="emulator-card-grid" aria-hidden="true" />
			<span className="emulator-card-body">
				<span className="emulator-card-name">{surface.name || 'Emulator'}</span>
			</span>
			<FontAwesomeIcon icon={faChevronRight} className="emulator-card-chevron" />
		</Button>
	)
}
