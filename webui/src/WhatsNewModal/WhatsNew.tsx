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
import { MyErrorBoundary } from '../Resources/Error.js'
import { DocsContent } from './DocsContent.js'
import { useLocalStorage } from 'usehooks-ts'
import semver from 'semver'
import { Pages, type WhatsNewPage } from './content.js'

const latestPage: WhatsNewPage | undefined = Pages?.[0]

export interface WhatsNewModalRef {
	show(): void
}

export const WhatsNewModal = observer(
	forwardRef<WhatsNewModalRef>(function HelpModal(_props, ref) {
		const [show, setShow] = useState(false)

		const [storedLatest, setStoredLatest] = useLocalStorage<string | undefined>('whatsnew', undefined)
		useEffect(() => {
			if (!storedLatest || (latestPage.version && semver.lt(storedLatest, latestPage.version))) {
				setTimeout(() => {
					setShow(true)
				}, 10)
				console.log('New version detected, showing WhatsNewModal')
			}
		}, [storedLatest])

		const [selectedVersion, setSelectedVersion] = useState(latestPage.file)

		const selectedPage = selectedVersion && Pages.find((page) => page.file === selectedVersion)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setStoredLatest(latestPage.version), [setStoredLatest])

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
						{Pages.map((page) => (
							<CNavItem key={page.version}>
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
