import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import { CModalBody, CModalHeader, CModalFooter, CButton } from '@coreui/react'
import sanitizeHtml from 'sanitize-html'
import { Marked } from 'marked'
import { baseUrl } from 'marked-base-url'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CModalExt } from '~/Components/CModalExt.js'
import semver from 'semver'

export interface HelpModalRef {
	showFromUrl(moduleId: string, versionDisplayName: string, url: string): void
}

interface HelpDisplayInfo {
	moduleId: string
	versionDisplayName: string
	markdown: string
	baseUrl: string
}

export const HelpModal = observer(
	forwardRef<HelpModalRef>(function HelpModal(_props, ref) {
		const { modules } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [content, setContent] = useState<HelpDisplayInfo | null>(null)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setContent(null), [])

		useImperativeHandle(
			ref,
			() => ({
				showFromUrl(moduleId, versionId, url) {
					let versionDisplayName = versionId
					if (versionId) {
						const parsed = semver.parse(versionId)
						if (parsed) versionDisplayName = `v${parsed.toString()}`
					}

					fetch(url)
						.then(async (response) => {
							const text = await response.text()

							setContent({
								moduleId,
								versionDisplayName: versionDisplayName,
								markdown: text,
								baseUrl: url,
							})
							setShow(true)
						})
						.catch((e) => {
							setContent({
								moduleId,
								versionDisplayName: versionDisplayName,
								markdown: `Failed to load help text: ${e}`,
								baseUrl: '/null',
							})
							setShow(true)
						})
				},
			}),
			[]
		)

		const contentBaseUrl = content?.baseUrl
		const marked = useMemo(() => {
			const marked = new Marked()
			if (contentBaseUrl) marked.use(baseUrl(contentBaseUrl))
			return marked
		}, [contentBaseUrl])

		const html = content
			? {
					__html: sanitizeHtml(marked.parse(content.markdown) as string, {
						allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
						disallowedTagsMode: 'escape',
					}),
				}
			: undefined

		const moduleInfo = content && modules.modules.get(content.moduleId)

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg">
				<CModalHeader closeButton>
					<h5>
						Help for {moduleInfo?.display?.name || content?.moduleId} {content?.versionDisplayName ?? ''}
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
			</CModalExt>
		)
	})
)
