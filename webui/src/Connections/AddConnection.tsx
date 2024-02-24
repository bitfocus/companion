import React, { useContext, useState, useCallback, useRef } from 'react'
import { CAlert, CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { socketEmitPromise } from '../util.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SearchBox } from '../Components/SearchBox.js'
import { ModuleProductInfo, useFilteredProducts } from '../Hooks/useFilteredProducts.js'

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
			socketEmitPromise(socket, 'connections:add', [{ type: type, product: product }])
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
		(module: ModuleProductInfo) => {
			if (module.isLegacy) {
				confirmRef.current?.show(
					`${module.manufacturer} ${module.product} is outdated`,
					null, // Passed as param to the thing
					'Add anyway',
					() => {
						addConnectionInner(module.id, module.product)
					}
				)
			} else {
				addConnectionInner(module.id, module.product)
			}
		},
		[addConnectionInner]
	)

	let candidates: JSX.Element[] = []
	try {
		const searchResults = useFilteredProducts(filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const module of searchResults) {
			candidatesObj[module.name] = (
				<AddConnectionEntry key={module.name} module={module} addConnection={addConnection} showHelp={showHelp} />
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

				<SearchBox filter={filter} setFilter={setFilter} />
				<br />
			</div>
			<div id="connection_add_search_results">{candidates}</div>
		</>
	)
})

interface AddConnectionEntryProps {
	module: ModuleProductInfo
	addConnection(module: ModuleProductInfo): void
	showHelp(moduleId: string): void
}

function AddConnectionEntry({ module, addConnection, showHelp }: AddConnectionEntryProps) {
	const addConnectionClick = useCallback(() => addConnection(module), [addConnection, module])
	const showHelpClick = useCallback(() => showHelp(module.id), [showHelp, module.id])

	return (
		<div key={module.name + module.id}>
			<CButton color="primary" onClick={addConnectionClick}>
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
				<div className="float_right" onClick={showHelpClick}>
					<FontAwesomeIcon icon={faQuestionCircle} />
				</div>
			)}
		</div>
	)
}
