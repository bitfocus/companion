import React, { useCallback, useContext, useRef, useState } from 'react'
import { SearchBox } from '../Components/SearchBox.js'
import { observer } from 'mobx-react-lite'
import { ModuleProductInfo, useFilteredProducts } from '../Hooks/useFilteredProducts.js'
import { CAlert } from '@coreui/react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle, faRectangleList } from '@fortawesome/free-solid-svg-icons'
import { socketEmitPromise } from '../util.js'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'

export const InstalledModules = observer(function InstalledModules() {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [filter, setFilter] = useState('')

	const helpModalRef = useRef<HelpModalRef>(null)
	const showHelpClick = useCallback((e: React.MouseEvent) => {
		const moduleId = e.currentTarget.getAttribute('data-module-id')
		if (!moduleId) return

		socketEmitPromise(socket, 'connections:get-help', [moduleId]).then(([err, result]) => {
			if (err) {
				notifier.current?.show('Instance help', `Failed to get help text: ${err}`)
				return
			}
			if (result) {
				helpModalRef.current?.show(moduleId, result)
			}
		})
	}, [])

	let components: JSX.Element[] = []
	try {
		const searchResults = useFilteredProducts(filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const module of searchResults) {
			candidatesObj[module.name] = <ModuleEntry module={module} showHelpClick={showHelpClick} />
		}

		if (!filter) {
			components = Object.entries(candidatesObj)
				.sort((a, b) => {
					const aName = a[0].toLocaleLowerCase()
					const bName = b[0].toLocaleLowerCase()
					if (aName < bName) return -1
					if (aName > bName) return 1
					return 0
				})
				.map((c) => c[1])
		} else {
			components = Object.entries(candidatesObj).map((c) => c[1])
		}
	} catch (e) {
		console.error('Failed to compile candidates list:', e)

		components = []
		components.push(
			<CAlert color="warning" role="alert">
				Failed to build list of modules:
				<br />
				{e?.toString()}
			</CAlert>
		)
	}

	return (
		<>
			<SearchBox filter={filter} setFilter={setFilter} />
			<HelpModal ref={helpModalRef} />

			<table className="table table-responsive-sm module-manager-list">{components}</table>
		</>
	)
})

interface ModuleEntryProps {
	module: ModuleProductInfo
	showHelpClick: React.MouseEventHandler
}

const ModuleEntry = observer(function ModuleEntry({ module, showHelpClick }: ModuleEntryProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleFullInfo = modules.modules.get(module.id)

	return (
		<tr>
			<td className="module-list-entry">
				<h4>
					{module.name} - {module.version}
					{module.isLegacy && (
						<>
							&nbsp;
							<FontAwesomeIcon
								icon={faExclamationTriangle}
								color="#ff6600"
								title="The current version of this module has not been updated for Companion 3.0, and may not work fully"
							/>
							&nbsp;
						</>
					)}
					{moduleFullInfo && moduleFullInfo.allVersions.length > 1 && (
						<>
							&nbsp;
							<FontAwesomeIcon
								icon={faRectangleList}
								color="green"
								title="Multiple versions of this module are installed"
							/>
							&nbsp;
						</>
					)}
					{module.hasHelp && (
						<div className="float_right" onClick={showHelpClick} data-module-id={module.id}>
							<FontAwesomeIcon icon={faQuestionCircle} />
						</div>
					)}
				</h4>
				<p>{JSON.stringify(moduleFullInfo)}</p>
			</td>
		</tr>
	)
})
