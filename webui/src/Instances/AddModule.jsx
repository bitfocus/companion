import React, { useContext, useState } from 'react'
import { CAlert, CButton, CInput, CInputGroup, CInputGroupAppend } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { CompanionContext, socketEmit } from '../util'

export function AddInstancesPanel({ showHelp, doConfigureInstance }) {
	const context = useContext(CompanionContext)

	return <>
		<AddModule showHelp={showHelp} modules={context.modules} configureInstance={doConfigureInstance} />
	</>
}

function AddModule({ showHelp, configureInstance }) {
	const context = useContext(CompanionContext)
	const [filter, setFilter] = useState('')

	const addInstance = (type, product) => {
		socketEmit(context.socket, 'instance_add', [{ type: type, product: product }]).then(([id]) => {
			setFilter('')
			console.log('NEW INSTANCE', id)
			configureInstance(id)
		}).catch((e) => {
			context.notifier.current.show(`Failed to create instance`, e)
			console.error('Failed to create instance:', e)
		})
	}

	const candidates = []
	if (filter) {
		try {
			const regexp = new RegExp(filter, "i")

			for (const [id, module] of Object.entries(context.modules)) {
				const products = new Set(Array.isArray(module.product) ? module.product : [module.product])
				for (const subprod of products) {
					const name = `${module.manufacturer} ${subprod}`

					if (name.replace(';', ' ').match(regexp)) {
						candidates.push(
							<div key={name + id}>
								<CButton color="primary" onClick={() => addInstance(id, subprod)} >Add</CButton>
								&nbsp;
								{name}
								{module.help ? <div className="instance_help" onClick={() => showHelp(id)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : ''}
							</div>
						)
					}
				}
			}
		} catch (e) {
			console.error('Failed to compile candidates list:', e)

			candidates.splice(0, candidates.length)
			candidates.push(<CAlert color='warning' role='alert'>Failed to build list of modules:<br/>{e}</CAlert>)
		}
	}

	return (
		<div style={{ clear: 'both' }}>
			<CInputGroup>
				<CInput type="text" placeholder="Add by search.." onChange={(e) => setFilter(e.currentTarget.value)} value={filter} />
				<CInputGroupAppend>
					<CButton color='danger' onClick={() => setFilter('')}><FontAwesomeIcon icon={faTimes} /></CButton>
				</CInputGroupAppend>
			</CInputGroup>
			<div id='instance_add_search_results'>
				{candidates}
			</div>
		</div>
	)
}
