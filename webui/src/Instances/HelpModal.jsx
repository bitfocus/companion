import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton } from '@coreui/react'

export const HelpModal = forwardRef(function HelpModal(_props, ref) {
	const [content, setContent] = useState(null)

	const doClose = useCallback(() => setContent(null), [])

	useImperativeHandle(ref, () => ({
		show(name, description) {
			setContent([name, description])	
		}
	}), [])

	return (
		<CModal
			show={!!content}
			onClose={doClose}
			size="lg"
		>
			<CModalHeader closeButton>
				<h5>Help for {content?.[0]}</h5>
			</CModalHeader>
			<CModalBody>
				<div dangerouslySetInnerHTML={{ __html: content?.[1] }} />
			</CModalBody>
			<CModalFooter>
				<CButton
					color="secondary"
					onClick={doClose}
				>Close</CButton>
			</CModalFooter>
		</CModal>
	)
})
