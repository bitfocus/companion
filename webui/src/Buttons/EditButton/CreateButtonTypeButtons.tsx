import { faFileArrowDown, faFileArrowUp, faFileLines, faSquarePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export function CreateButtonTypeButtons({ location }: { location: ControlLocation }): React.JSX.Element {
	const resetControlMutation = useMutationExt(trpc.controls.resetControl.mutationOptions())

	const setButtonType = useCallback(
		(newType: string) => {
			// On an empty slot there is no existing type to convert from, so no warning is needed
			resetControlMutation.mutateAsync({ location, newType }).catch((e) => {
				console.error(`Set type failed: ${e}`)
			})
		},
		[resetControlMutation, location]
	)

	return (
		<div className="empty-button-type-picker">
			<div className="empty-button-type-grid">
				<Button
					color="primary"
					className="empty-button-type-tile empty-button-type-tile-primary"
					onClick={() => setButtonType('button-layered')}
					title="Create a regular button."
				>
					<FontAwesomeIcon icon={faSquarePlus} />
					<span>Regular button</span>
				</Button>

				<Button
					variant="outline"
					className="empty-button-type-tile"
					onClick={() => setButtonType('pageup')}
					title="Create a page up button."
				>
					<FontAwesomeIcon icon={faFileArrowUp} />
					<span>Page up</span>
				</Button>
				<Button
					variant="outline"
					className="empty-button-type-tile"
					onClick={() => setButtonType('pagenum')}
					title="Create a page number button."
				>
					<FontAwesomeIcon icon={faFileLines} />
					<span>Page number</span>
				</Button>
				<Button
					variant="outline"
					className="empty-button-type-tile"
					onClick={() => setButtonType('pagedown')}
					title="Create a page down button."
				>
					<FontAwesomeIcon icon={faFileArrowDown} />
					<span>Page down</span>
				</Button>
			</div>
		</div>
	)
}
