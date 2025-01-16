import React, { useContext, useState, useCallback, useRef } from 'react'
import { CAlert, CButton, CFormInput, CInputGroup } from '@coreui/react'
import { go as fuzzySearch } from 'fuzzysort'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { useComputed } from '../util.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

interface AddConnectionsPanelProps {
	showHelp: (moduleId: string) => void
	doConfigureConnection: (connectionId: string) => void
}

export const AddConnectionsPanel = observer(function AddConnectionsPanel({
	showHelp,
	doConfigureConnection,
}: AddConnectionsPanelProps) {
	const { socket, notifier, modules } = useContext(RootAppStoreContext)
	const [filter, setFilter] = useState('')

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const addConnectionInner = useCallback(
		(type: string, product: string | undefined) => {
			socket
				.emitPromise('connections:add', [{ type: type, product: product }])
				.then((id) => {
					setFilter('')
					console.log('NEW CONNECTION', id)
					doConfigureConnection(id)
				})
				.catch((e) => {
					notifier.current?.show(`Failed to create connection`, `Failed: ${e}`)
					console.error('Failed to create connection:', e)
				})
		},
		[socket, notifier, doConfigureConnection]
	)

	const addConnection = useCallback(
		(type: string, product: string | undefined, module: Omit<ModuleDisplayInfo, 'keywords'>) => {
			if (module.isLegacy) {
				confirmRef.current?.show(
					`${module.manufacturer} ${product} is outdated`,
					null, // Passed as param to the thing
					'Add anyway',
					() => {
						addConnectionInner(type, product)
					}
				)
			} else {
				addConnectionInner(type, product)
			}
		},
		[addConnectionInner]
	)

	const allProducts = useComputed(
		() =>
			Array.from(modules.modules.values()).flatMap((module) =>
				module.products.map((product) => ({
					product,
					...module,
					// fuzzySearch can't handle arrays, so flatten the array to a string first
					keywords: module.keywords?.join(';') ?? '',
				}))
			),
		[modules]
	)

	let candidates: JSX.Element[] = []
	try {
		const candidatesObj: Record<string, JSX.Element> = {}

		const searchResults = filter
			? fuzzySearch(filter, allProducts, {
					keys: ['product', 'name', 'manufacturer', 'keywords'],
					threshold: -10_000,
				}).map((x) => x.obj)
			: allProducts

		for (const module of searchResults) {
			candidatesObj[module.name] = (
				<div key={module.name + module.id}>
					<CButton color="primary" onClick={() => addConnection(module.id, module.product, module)}>
						Add
					</CButton>
					&nbsp;
					{module.isLegacy && (
						<>
							<FontAwesomeIcon
								icon={faExclamationTriangle}
								color="#ff6600"
								size={'xl'}
								title="This module has not been updated for Companion 3.0, and may not work fully"
							/>
							&nbsp;
						</>
					)}
					{module.name}
					{module.hasHelp && (
						<div className="float_right" onClick={() => showHelp(module.id)}>
							<FontAwesomeIcon icon={faQuestionCircle} />
						</div>
					)}
				</div>
			)
		}

		if (!filter) {
			candidates = Object.entries(candidatesObj)
				.sort((a, b) => {
					const aName = a[0].toLocaleLowerCase()
					const bName = b[0].toLocaleLowerCase()
					if (aName < bName) return -1
					if (aName > bName) return 1
					return 0
				})
				.map((c) => c[1])
		} else {
			candidates = Object.entries(candidatesObj).map((c) => c[1])
		}
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
				This module has not been verified to be compatible with this version of companion. It may be buggy or broken.
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
					Companion currently supports {modules.count} different things, and the list grows every day. If you can't find
					the device you're looking for, please{' '}
					<a target="_new" href="https://github.com/bitfocus/companion-module-requests">
						add a request
					</a>{' '}
					on GitHub
				</p>
				<CInputGroup>
					<CFormInput
						type="text"
						placeholder="Search ..."
						onChange={(e) => setFilter(e.currentTarget.value)}
						value={filter}
						style={{ fontSize: '1.2em' }}
					/>
					<CButton color="danger" onClick={() => setFilter('')}>
						<FontAwesomeIcon icon={faTimes} />
					</CButton>
				</CInputGroup>
				<br />
			</div>
			<div id="connection_add_search_results">{candidates}</div>
		</>
	)
})
