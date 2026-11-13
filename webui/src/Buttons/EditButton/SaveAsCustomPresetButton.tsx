import { faSwatchbook } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { formatLocation, ParseControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface SaveAsCustomPresetButtonProps {
	location: ControlLocation
}

/** Make a custom preset from a copy of the button, and open it */
export function SaveAsCustomPresetButton({ location }: SaveAsCustomPresetButtonProps): React.JSX.Element {
	const navigate = useNavigate()
	const createMutation = useMutationExt(trpc.controls.customPresets.createFromButton.mutationOptions())

	const doSave = useCallback(() => {
		createMutation
			.mutateAsync({ location, name: `Button ${formatLocation(location)}` })
			.then(async (controlId) => {
				const parsedId = controlId ? ParseControlId(controlId) : undefined
				if (parsedId?.type !== 'custom-preset') return

				await navigate({ to: '/custom-presets/$controlId', params: { controlId: parsedId.customPresetId } })
			})
			.catch((e) => {
				console.error(`Save as custom preset failed: ${stringifyError(e)}`)
			})
	}, [createMutation, navigate, location])

	return (
		<Button
			className="edit-button-toolbar-action"
			color="secondary"
			size="sm"
			onClick={doSave}
			title="Save a copy of this button as a custom preset"
		>
			<FontAwesomeIcon icon={faSwatchbook} />
			Save as preset
		</Button>
	)
}
