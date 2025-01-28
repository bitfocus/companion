import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import {
	CModalBody,
	CModalHeader,
	CModalFooter,
	CButton,
	CNav,
	CNavItem,
	CNavLink,
	CTabContent,
	CTabPane,
} from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { CModalExt } from './Components/CModalExt.js'
import { useQuery } from '@tanstack/react-query'
import { DocsSection } from './GettingStarted/GettingStarted.js'
import { MyErrorBoundary } from './util.js'
import { DocsContent } from './GettingStarted/DocsContent.js'

interface WhatsNewModalProps {
	// Nothing
}

export interface WhatsNewModalRef {
	show(): void
}

export const WhatsNewModal = observer(
	forwardRef<WhatsNewModalRef, WhatsNewModalProps>(function HelpModal(_props, ref) {
		const [show, setShow] = useState(false)

		const { isPending, error, data } = useQuery<DocsSection[]>({
			queryKey: ['docsStructure'],
			queryFn: () => fetch('/docs/structure.json').then((res) => res.json()),
			retry: false,
		})

		const whatsNewPages = data?.find((section) => section.file?.endsWith('whatsnew.md'))?.children

		const [selectedVersion, setSelectedVersion] = useState('')

		useEffect(() => {
			if (whatsNewPages) {
				setSelectedVersion((latestVersion) => {
					if (whatsNewPages.find((p) => p.file === latestVersion)) return latestVersion
					return whatsNewPages[0]?.file ?? ''
				})
			}
		}, [whatsNewPages])

		const selectedPage = selectedVersion && whatsNewPages?.find((page) => page.file === selectedVersion)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {}, [])

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
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg">
				<CModalHeader closeButton>
					<h5>Whats New in Companion</h5>
				</CModalHeader>
				<CModalBody>
					{isPending && <div>Loading...</div>}
					{error && <div>Error: {error.message}</div>}

					<CNav variant="tabs">
						{whatsNewPages?.map((page) => (
							<CNavItem key={page.file}>
								<CNavLink active={selectedVersion === page.file} onClick={() => setSelectedVersion(page.file)}>
									{page.label}
								</CNavLink>
							</CNavItem>
						))}
					</CNav>
					<CTabContent className="default-scroll">
						{selectedPage && (
							<CTabPane className="" visible>
								<MyErrorBoundary>
									<DocsContent file={selectedPage.file} />
								</MyErrorBoundary>
							</CTabPane>
						)}
					</CTabContent>
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
