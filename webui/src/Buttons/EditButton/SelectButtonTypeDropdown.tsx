import { useCallback, useRef } from 'react'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Popover } from '~/Components/Popover.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export function SelectButtonTypeDropdown({
	location,
	resetModalRef,
	configRef,
}: {
	location: ControlLocation
	resetModalRef: React.MutableRefObject<GenericConfirmModalRef | null>
	configRef: React.MutableRefObject<SomeButtonModel | undefined> | undefined
}): React.JSX.Element {
	const resetControlMutation = useMutationExt(trpc.controls.resetControl.mutationOptions())

	const setButtonType = useCallback(
		(newType: string) => {
			let show_warning = false

			const currentType = configRef?.current?.type
			if (currentType === newType) {
				// No point changing style to itself
				return
			}

			if (currentType && currentType !== 'pageup' && currentType !== 'pagedown' && currentType !== 'pagenum') {
				if (newType === 'pageup' || newType === 'pagedown' || newType === 'pagenum') {
					show_warning = true
				}
			}

			const doChange = () => {
				resetControlMutation.mutateAsync({ location, newType }).catch((e) => {
					console.error(`Set type failed: ${e}`)
				})
			}

			if (show_warning) {
				resetModalRef.current?.show(
					`Change style`,
					`Changing to this button style will erase actions and feedbacks configured for this button - continue?`,
					'OK',
					() => {
						doChange()
					}
				)
			} else {
				doChange()
			}
		},
		[resetControlMutation, location, configRef, resetModalRef]
	)

	const btnGroupRef = useRef<HTMLDivElement>(null)

	return (
		<Popover.Root>
			<div className="btn-group" ref={btnGroupRef}>
				<Button color="primary" onClick={() => setButtonType('button-layered')} title="Create regular button.">
					Create button
				</Button>
				<Popover.Trigger
					color="primary"
					caret
					style={{ opacity: 0.7, padding: '0 0.75em' }}
					aria-label="Toggle Button-Type Dropdown"
					title="Toggle Button-Type Dropdown"
				/>
			</div>
			<Popover.Popup anchor={btnGroupRef}>
				<Popover.Item onClick={() => setButtonType('button-layered')}>Regular button</Popover.Item>
				<Popover.Item onClick={() => setButtonType('pageup')}>Page up</Popover.Item>
				<Popover.Item onClick={() => setButtonType('pagenum')}>Page number</Popover.Item>
				<Popover.Item onClick={() => setButtonType('pagedown')}>Page down</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	)
}
