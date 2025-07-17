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
import { CModalExt } from '~/Components/CModalExt.js'
import { MyErrorBoundary } from './Resources/Error.js'
import { DocsContent } from './GettingStarted/DocsContent.js'
import { useLocalStorage } from 'usehooks-ts'
import semver from 'semver'

import docsStructure from '@docs/structure.json'
import { DocsSection } from './GettingStarted/GettingStarted.js'

interface WhatsNewPage extends DocsSection {
	_version?: string
	file: string
}

const whatsNewPages: WhatsNewPage[] =
	(docsStructure.find((section) => section._whatsnew)?.children as WhatsNewPage[]).filter((f) => !!f._version) ?? []
const latestPage: WhatsNewPage | undefined = whatsNewPages[0]

export interface WhatsNewModalRef {
	show(): void
}

export const WhatsNewModal = observer(
	forwardRef<WhatsNewModalRef>(function HelpModal(_props, ref) {
		const [show, setShow] = useState(false)

		const [storedLatest, setStoredLatest] = useLocalStorage<string | undefined>('whatsnew', undefined)
		useEffect(() => {
			if (!storedLatest || (latestPage._version && semver.lt(storedLatest, latestPage._version))) {
				setTimeout(() => {
					setShow(true)
				}, 10)
				console.log('New version detected, showing WhatsNewModal')
			}
		}, [storedLatest])

		const [selectedVersion, setSelectedVersion] = useState(latestPage.file)

		const selectedPage = selectedVersion && whatsNewPages?.find((page) => page.file === selectedVersion)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setStoredLatest(latestPage._version), [setStoredLatest])

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
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg" className="modal-whatsnew">
				<CModalHeader closeButton>
					<h5>What's New in Companion</h5>
				</CModalHeader>
				<CModalBody>
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
