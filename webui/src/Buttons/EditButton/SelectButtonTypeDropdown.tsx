import { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CDropdown, CButtonGroup, CButton, CDropdownToggle, CDropdownMenu, CDropdownItem } from '@coreui/react'
import React, { useCallback } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
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

	return (
		<CDropdown className="" style={{ display: 'inline-block', marginRight: -4, position: 'inherit' }}>
			<CButtonGroup>
				{/* This could be simplified to use the split property on CDropdownToggle, but then onClick doesnt work https://github.com/coreui/coreui-react/issues/179 */}
				<CButton color="danger" onClick={() => setButtonType('button')}>
					Create button
				</CButton>
				<CDropdownToggle
					caret
					color="danger"
					style={{ opacity: 0.7, paddingLeft: 14, paddingRight: 16 }}
					className="dropdown-toggle dropdown-toggle-split"
				>
					<span className="sr-only">Toggle Dropdown</span>
				</CDropdownToggle>
			</CButtonGroup>
			<CDropdownMenu>
				<CDropdownItem onClick={() => setButtonType('button')}>Regular button</CDropdownItem>
				<CDropdownItem onClick={() => setButtonType('pageup')}>Page up</CDropdownItem>
				<CDropdownItem onClick={() => setButtonType('pagenum')}>Page number</CDropdownItem>
				<CDropdownItem onClick={() => setButtonType('pagedown')}>Page down</CDropdownItem>
				<CDropdownItem onClick={() => setButtonType('button-layered')}>Layered button (Experimental)</CDropdownItem>
			</CDropdownMenu>
		</CDropdown>
	)
}
