import { CCol, CRow } from '@coreui/react'
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { Modal } from '~/Components/Modal'
import { VariablesTable } from '~/Components/VariablesTable.js'

export interface ConnectionVariablesModalRef {
	show(label: string): void
}

export const ConnectionVariablesModal = forwardRef<ConnectionVariablesModalRef>(
	function ConnectionVariablesModal(_props, ref) {
		const [connectionLabel, setConnectionLabel] = useState<string | null>(null)
		const [show, setShow] = useState(false)

		useImperativeHandle(
			ref,
			() => ({
				show(label) {
					setConnectionLabel(label)
					setShow(true)
				},
			}),
			[]
		)

		const onOpenChangeComplete = useCallback((open: boolean) => {
			if (!open) {
				setConnectionLabel(null)
			}
		}, [])

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup size="xl" scrollable>
							<Modal.Header closeButton>
								<Modal.Title>Variables for {connectionLabel}</Modal.Title>
							</Modal.Header>
							<Modal.Body className="variables-table-modal-body">
								<CRow>
									<CCol lg={12}>{connectionLabel && <VariablesTable label={connectionLabel} />}</CCol>
								</CRow>
							</Modal.Body>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	}
)
