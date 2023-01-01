import React, { memo, useContext, useState } from 'react'
import { CAlert, CButton, CInput, CInputGroup, CInputGroupAppend } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { socketEmitPromise, SocketContext, NotifierContext, ModulesContext } from '../util'
import { useCallback } from 'react'
import { useRef } from 'react'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'

export function AddInstancesPanel({ showHelp, doConfigureInstance }) {
	return (
		<>
			<AddInstancesInner showHelp={showHelp} configureInstance={doConfigureInstance} />
		</>
	)
}

const AddInstancesInner = memo(function AddInstancesInner({ showHelp, configureInstance }) {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)
	const modules = useContext(ModulesContext)
	const [filter, setFilter] = useState('')

	const confirmRef = useRef(null)

	const addInstanceInner = useCallback(
		(type, product) => {
			socketEmitPromise(socket, 'instances:add', [{ type: type, product: product }])
				.then((id) => {
					setFilter('')
					console.log('NEW INSTANCE', id)
					configureInstance(id)
				})
				.catch((e) => {
					notifier.current.show(`Failed to create connection`, `Failed: ${e}`)
					console.error('Failed to create connection:', e)
				})
		},
		[socket, notifier, configureInstance]
	)

	const addInstance = useCallback(
		(type, product, module) => {
			if (module.isLegacy) {
				confirmRef.current.show(
					`${module.manufacturer} ${product} is outdated`,
					null, // Passed as param to the thing
					'Add anyway',
					() => {
						addInstanceInner(type, product)
					}
				)
			} else {
				addInstanceInner(type, product)
			}
		},
		[addInstanceInner]
	)

	let candidates = []
	try {
		const regexp = new RegExp(filter, 'i')

		const candidatesObj = {}
		for (const [id, module] of Object.entries(modules)) {
			const products = new Set(module.products)
			for (const subprod of products) {
				const name = `${module.manufacturer} ${subprod}`
				const keywords = module.keywords || []

				if (
					name.replace(';', ' ').match(regexp) ||
					name.replace(/[^\w]/g, '').toLowerCase().includes(filter.replace(/[^\w]/g, '').toLowerCase()) ||
					keywords.find((kw) => kw.match(regexp))
				) {
					candidatesObj[name] = (
						<div key={name + id}>
							<CButton color="primary" onClick={() => addInstance(id, subprod, module)}>
								Add
							</CButton>
							&nbsp;
							{module.isLegacy && (
								<>
									<FontAwesomeIcon
										icon={faExclamationTriangle}
										title="This module has not been updated for Companion 3.0, and may be broken as a result"
									/>
									&nbsp;
								</>
							)}
							{name}
							{module.hasHelp && (
								<div className="float_right" onClick={() => showHelp(id)}>
									<FontAwesomeIcon icon={faQuestionCircle} />
								</div>
							)}
						</div>
					)
				}
			}
		}

		candidates = Object.entries(candidatesObj)
			.sort((a, b) => {
				const aName = a[0].toLocaleLowerCase()
				const bName = b[0].toLocaleLowerCase()
				if (aName < bName) return -1
				if (aName > bName) return 1
				return 0
			})
			.map((c) => c[1])
	} catch (e) {
		console.error('Failed to compile candidates list:', e)

		candidates = []
		candidates.push(
			<CAlert color="warning" role="alert">
				Failed to build list of modules:
				<br />
				{e?.toString()}
			</CAlert>
		)
	}

	const confirmContent = (
		<>
			<p>
				This module has not been verified to be compatible with this version of companion. It may be buggy or completely
				broken.
			</p>
			<p>
				If this module is broken, please let us know in{' '}
				<a target="_blank" rel="noreferrer" href="https://github.com/bitfocus/companion/issues/2157">
					this github issue
				</a>
			</p>
		</>
	)

	return (
		<>
			<GenericConfirmModal ref={confirmRef} content={confirmContent} />
			<div style={{ clear: 'both' }} className="row-heading">
				<h4>Add connection</h4>
				<p>
					Companion currently supports {Object.keys(modules).length} different things, and the list grows every day. If
					you can't find the device you're looking for, please{' '}
					<a target="_new" href="https://github.com/bitfocus/companion-module-requests">
						add a request
					</a>{' '}
					on GitHub
				</p>
				<CInputGroup>
					<CInput
						type="text"
						placeholder="Search ..."
						onChange={(e) => setFilter(e.currentTarget.value)}
						value={filter}
						style={{ fontSize: '1.2em' }}
					/>
					<CInputGroupAppend>
						<CButton color="danger" onClick={() => setFilter('')}>
							<FontAwesomeIcon icon={faTimes} />
						</CButton>
					</CInputGroupAppend>
				</CInputGroup>
				<br />
			</div>
			<div id="instance_add_search_results">{candidates}</div>
		</>
	)
})
