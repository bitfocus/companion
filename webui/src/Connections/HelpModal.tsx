import React, { forwardRef, memo, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton } from '@coreui/react'
import sanitizeHtml from 'sanitize-html'
import { Marked } from 'marked'
import { baseUrl } from 'marked-base-url'
import { ModulesContext } from '../util'

interface HelpModalProps {
	// Nothing
}

interface HelpDescription {
	markdown: string
	baseUrl: string
}

export interface HelpModalRef {
	show(name: string, description: HelpDescription): void
}

export const HelpModal = memo(
	forwardRef<HelpModalRef, HelpModalProps>(function HelpModal(_props, ref) {
		const modules = useContext(ModulesContext)

		const [content, setContent] = useState<[name: string, description: HelpDescription] | null>(null)
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

		const contentBaseUrl = content?.[1]?.baseUrl
		const marked = useMemo(() => {
			const marked = new Marked()
			if (contentBaseUrl) marked.use(baseUrl(contentBaseUrl))
			return marked
		}, [contentBaseUrl])

		const html = content
			? {
					__html: sanitizeHtml(marked.parse(content[1].markdown) as string, {
						allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
						disallowedTagsMode: 'escape',
					}),
			  }
			: undefined

		const moduleInfo = content && modules?.[content[0]]

		return (
			<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg">
				<CModalHeader closeButton>
					<h5>
						Help for {moduleInfo?.name || content?.[0]} {moduleInfo?.version ? `v${moduleInfo.version}` : ''}
					</h5>
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
