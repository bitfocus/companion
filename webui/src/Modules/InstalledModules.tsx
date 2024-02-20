import React, { useState } from 'react'
import { SearchBox } from '../Components/SearchBox.js'
import { observer } from 'mobx-react-lite'
import { ModuleProductInfo, useFilteredProducts } from '../Hooks/useFilteredProducts.js'
import { CAlert } from '@coreui/react'

export const InstalledModules = observer(function InstalledModules() {
	const [filter, setFilter] = useState('')

	let components: JSX.Element[] = []
	try {
		const searchResults = useFilteredProducts(filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const module of searchResults) {
			candidatesObj[module.name] = <ModuleEntry module={module} />
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

			<table className="table table-responsive-sm module-manager-list">{components}</table>
		</>
	)
})

interface ModuleEntryProps {
	module: ModuleProductInfo
}

function ModuleEntry({ module }: ModuleEntryProps) {
	return (
		<tr>
			<td className="module-list-entry">
				<p>{JSON.stringify(module)}</p>
			</td>
		</tr>
	)
}
