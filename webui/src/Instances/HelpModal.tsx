import { Marked } from 'marked'
import { baseUrl } from 'marked-base-url'
import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import sanitizeHtml from 'sanitize-html'
import semver from 'semver'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { Modal } from '~/Components/Modal'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export interface HelpModalRef {
	showFromUrl(moduleType: ModuleInstanceType, moduleId: string, versionDisplayName: string, url: string): void
}

interface HelpDisplayInfo {
	moduleType: ModuleInstanceType
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

		useImperativeHandle(
			ref,
			() => ({
				showFromUrl(moduleType, moduleId, versionId, url) {
					let versionDisplayName = versionId
					if (versionId) {
						const parsed = semver.parse(versionId)
						if (parsed) versionDisplayName = `v${parsed.toString()}`
					}

					const fixedUrl = url.startsWith('http') ? url : makeAbsolutePath(url)

					fetch(fixedUrl)
						.then(async (response) => {
							const text = await response.text()

							setContent({
								moduleType,
								moduleId,
								versionDisplayName: versionDisplayName,
								markdown: text,
								baseUrl: fixedUrl,
							})
							setShow(true)
						})
						.catch((e) => {
							setContent({
								moduleType,
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

		const onOpenChangeComplete = useCallback((open: boolean) => {
			if (!open) {
				setContent(null)
			}
		}, [])

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
						transformTags: {
							a: (tagName, attribs) => {
								return { tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }
							},
						},
					}),
				}
			: undefined

		const moduleInfo = content && modules.getModuleInfo(content.moduleType, content.moduleId)

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup size="lg" scrollable>
							<Modal.Header closeButton>
								<Modal.Title>
									Help for {moduleInfo?.display?.name || content?.moduleId} {content?.versionDisplayName ?? ''}
								</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<div dangerouslySetInnerHTML={html} />
							</Modal.Body>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	})
)
