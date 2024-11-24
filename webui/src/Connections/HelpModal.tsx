import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import { CModalBody, CModalHeader, CModalFooter, CButton } from '@coreui/react'
import sanitizeHtml from 'sanitize-html'
import { Marked } from 'marked'
import { baseUrl } from 'marked-base-url'
import { HelpDescription } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { CModalExt } from '../Components/CModalExt.js'
import { socketEmitPromise } from '../util.js'
import { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'

interface HelpModalProps {
	// Nothing
}

export interface HelpModalRef {
	show(name: string, moduleVersion: ClientModuleVersionInfo): void
}

export const HelpModal = observer(
	forwardRef<HelpModalRef, HelpModalProps>(function HelpModal(_props, ref) {
		const { socket, notifier, modules } = useContext(RootAppStoreContext)

		const [content, setContent] = useState<[name: string, description: HelpDescription] | null>(null)
		const [showVersion, setShowVersion] = useState<ClientModuleVersionInfo | null>(null)

		const doClose = useCallback(() => setShowVersion(null), [])
		const onClosed = useCallback(() => setContent(null), [])

		useImperativeHandle(
			ref,
			() => ({
				show(name, moduleVersion) {
					socketEmitPromise(socket, 'connections:get-help', [name, moduleVersion.versionId]).then(([err, result]) => {
						if (err) {
							notifier.current?.show('Connection help', `Failed to get help text: ${err}`)
							return
						}
						if (result) {
							setContent([name, result])
							setShowVersion(moduleVersion)
						}
					})
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
			<CModalExt visible={!!showVersion} onClose={doClose} onClosed={onClosed} size="lg">
				<CModalHeader closeButton>
					<h5>
						Help for {moduleInfo?.display?.name || content?.[0]} {showVersion?.displayName}
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
