import React, { memo, useContext, useState } from 'react'
import { CAlert, CButton, CInput, CInputGroup, CInputGroupAppend } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { CompanionContext, socketEmit } from '../util'

export function AddInstancesPanel({ showHelp, doConfigureInstance }) {
	return (
		<>
			<AddInstancesInner showHelp={showHelp} configureInstance={doConfigureInstance} />
		</>
	)
}

const AddInstancesInner = memo(function AddInstancesInner({ showHelp, configureInstance }) {
	const context = useContext(CompanionContext)
	const [filter, setFilter] = useState('')

	const addInstance = (type, product) => {
		socketEmit(context.socket, 'instance_add', [{ type: type, product: product }])
			.then(([id]) => {
				setFilter('')
				console.log('NEW INSTANCE', id)
				configureInstance(id)
			})
			.catch((e) => {
				context.notifier.current.show(`Failed to create connection`, `Failed: ${e}`)
				console.error('Failed to create connection:', e)
			})
	}

	let candidates = []
	try {
		const regexp = new RegExp(filter, 'i')

		const candidatesObj = {}
		for (const [id, module] of Object.entries(context.modules)) {
			if (id === 'bitfocus-companion') continue

			const products = new Set(Array.isArray(module.product) ? module.product : [module.product])
			for (const subprod of products) {
				const name = `${module.manufacturer} ${subprod}`
				const keywords = module.keywords || []

				if (name.replace(';', ' ').match(regexp) || keywords.find((kw) => kw.match(regexp))) {
					candidatesObj[name] = (
						<div key={name + id}>
							<CButton color="primary" onClick={() => addInstance(id, subprod)}>
								Add
							</CButton>
							&nbsp;
							{name}
							{module.help ? (
								<div className="instance_help" onClick={() => showHelp(id)}>
									<FontAwesomeIcon icon={faQuestionCircle} />
								</div>
							) : (
								''
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
				{e}
			</CAlert>
		)
	}

	return (
		<div style={{ clear: 'both' }}>
			<h4>Add connection</h4>
			<p>
				Companion currently supports {Object.keys(context.modules).length} different things, and the list grows every
				day. If you can't find the device you're looking for, please{' '}
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
			<div id="instance_add_search_results">{candidates}</div>
		</div>
	)
})
