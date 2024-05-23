import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton } from '@coreui/react'
import sanitizeHtml from 'sanitize-html'
import { Marked } from 'marked'
import { baseUrl } from 'marked-base-url'
import { HelpDescription } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'

interface HelpModalProps {
	// Nothing
}

export interface HelpModalRef {
	show(name: string, description: HelpDescription): void
}

export const HelpModal = observer(
	forwardRef<HelpModalRef, HelpModalProps>(function HelpModal(_props, ref) {
		const { modules } = useContext(RootAppStoreContext)

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

		const moduleInfo = content && modules.modules.get(content[0])

		return (
			<CModal visible={show} onClose={doClose} onClosed={onClosed} size="lg">
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
