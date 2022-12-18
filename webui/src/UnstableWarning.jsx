import React, { memo, useCallback, useState } from 'react'
import { CButton, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'

export const UnstableWarningModal = memo(function UnstableWarningModal() {
	const [show, setShow] = useState(window.localStorage.getItem('dismiss_3.0_unstable_warning') !== '1')

	const doClose = useCallback(() => {
		setShow(false)

		setTimeout(() => {
			setShow(null)
		}, 5000)
	}, [])

	return show !== null ? (
		<CModal show={show} onClose={doClose} className={'wizard'} size="lg" closeOnBackdrop={false}>
			<CModalHeader>
				<h2>
					<img src="/img/icons/48x48.png" height="30" alt="logo" />
					Thank you for testing Companion 3.0
				</h2>
			</CModalHeader>
			<CModalBody>
				<p>
					These beta versions of Companion are <span style={{ fontWeight: 'bold' }}>not</span> yet stable enough for
					production use. Many of the modules are known to be broken or missing.
				</p>
				<p>
					If you need a production ready version, uninstall this and install the latest stable release from{' '}
					<a href="https://user.bitfocus.io/download" target="_blank" rel="noreferrer">
						the website
					</a>
					.
				</p>
				<p>
					If you are running a non-criticial environment, feel free to give this a test, but be prepared for bugs and
					some modules to be unusable. Let us know if you encounter anything that doesn't work, we need user feedback to
					figure out what needs fixing.
				</p>
				<p>
					Please report any broken modules you encounter{' '}
					<a href="https://github.com/bitfocus/companion/issues/2157" target="_blank" rel="noreferrer">
						on this issue
					</a>{' '}
					or any other bugs you find on{' '}
					<a
						href="https://github.com/bitfocus/companion/issues?q=is%3Aissue+is%3Aopen+v3"
						target="_blank"
						rel="noreferrer"
					>
						Github
					</a>
				</p>
				<p>
					If you are a module author and don't want to be constantly reminded of this, you can disable this warning in
					the Settings.
				</p>
			</CModalBody>
			<CModalFooter>
				<CButton color="primary" onClick={doClose}>
					Dismiss
				</CButton>
			</CModalFooter>
		</CModal>
	) : (
		''
	)
})
