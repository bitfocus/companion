import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton } from '@coreui/react'
import sanitizeHtml from 'sanitize-html'
import marked from 'marked'

export const HelpModal = memo(
	forwardRef(function HelpModal(_props, ref) {
		const [content, setContent] = useState(null)
		const [show, setShow] = useState(false)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setContent(null), [])

		useImperativeHandle(
			ref,
			() => ({
				show(name, description) {
					setContent([name, description])
					setShow(true)
				},
			}),
			[]
		)

		const html = content
			? {
					__html: sanitizeHtml(
						marked(content[1].markdown, {
							baseUrl: content[1].baseUrl,
						}),
						{
							allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
							disallowedTagsMode: 'escape',
						}
					),
			  }
			: undefined

		return (
			<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg">
				<CModalHeader closeButton>
					<h5>Help for {content?.[0]}</h5>
				</CModalHeader>
				<CModalBody>
					<div dangerouslySetInnerHTML={html} />
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Close
					</CButton>
				</CModalFooter>
			</CModal>
		)
	})
)
