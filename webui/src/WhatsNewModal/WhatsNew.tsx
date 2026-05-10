import { CModalBody, CModalHeader } from '@coreui/react'
import { useQuery } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import semver from 'semver'
import { useLocalStorage } from 'usehooks-ts'
import { StaticAlert } from '~/Components/Alert.js'
import { CModalExt } from '~/Components/CModalExt.js'
import { TabArea } from '~/Components/TabArea.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { MyErrorBoundary } from '../Resources/Error.js'
import { DocsContent } from './DocsContent.js'

interface WhatsNewPage {
	version: string
	label: string
	file: string
}

export interface WhatsNewModalRef {
	show(): void
}

export const WhatsNewModal = observer(
	forwardRef<WhatsNewModalRef>(function HelpModal(_props, ref) {
		const [show, setShow] = useState(false)
		const [selectedVersion, setSelectedVersion] = useState<string | undefined>(undefined)
		const [storedLatest, setStoredLatest] = useLocalStorage<string | undefined>('whatsnew', undefined)

		// Load pages manifest using proper React Query
		const {
			data: pages,
			error,
			isPending,
		} = useQuery<WhatsNewPage[]>({
			queryKey: ['whatsnew_manifest'],
			queryFn: async () => {
				const response = await fetch(makeAbsolutePath('/whatsnew/manifest.json'))
				if (!response.ok) {
					throw new Error(`Failed to load manifest: ${response.statusText}`)
				}
				return response.json()
			},
			retry: 2,
			staleTime: Infinity, // Manifest doesn't change during session
		})

		const latestPage = pages?.[0]

		// Check if we should auto-show the modal for new versions
		useEffect(() => {
			if (latestPage && (!storedLatest || semver.lt(storedLatest, latestPage.version))) {
				setShow(true)
				console.log('New version detected, showing WhatsNewModal')
			}
		}, [latestPage, storedLatest])

		// Set initial selected version when pages load
		useEffect(() => {
			if (pages && pages.length > 0 && !selectedVersion) {
				setSelectedVersion(pages[0].file)
			}
		}, [pages, selectedVersion])

		const selectedPage = selectedVersion && pages?.find((page) => page.file === selectedVersion)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			if (latestPage) {
				setStoredLatest(latestPage.version)
			}
		}, [setStoredLatest, latestPage])

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setShow(true)
				},
			}),
			[]
		)

		return (
			<CModalExt scrollable visible={show} onClose={doClose} onClosed={onClosed} size="lg" className="modal-whatsnew">
				<CModalHeader closeButton>
					<h5>What's New in Companion</h5>
				</CModalHeader>
				<CModalBody>
					{isPending && <div className="p-3">Loading...</div>}
					{error && (
						<StaticAlert color="danger">
							Failed to load What's New content: {error instanceof Error ? error.message : 'Unknown error'}
						</StaticAlert>
					)}
					{pages && pages.length > 0 && (
						<TabArea.Root value={selectedVersion} onValueChange={setSelectedVersion}>
							<TabArea.List>
								{pages.map((page) => (
									<TabArea.Tab key={page.version} value={page.file}>
										{page.label}
									</TabArea.Tab>
								))}
							</TabArea.List>
							{selectedPage && (
								<TabArea.Panel value={selectedPage.file}>
									<MyErrorBoundary>
										<DocsContent file={selectedPage.file} />
									</MyErrorBoundary>
								</TabArea.Panel>
							)}
						</TabArea.Root>
					)}
				</CModalBody>
			</CModalExt>
		)
	})
)
