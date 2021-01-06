import React from 'react'
// import Select from 'react-select'
import { CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { CompanionContext, socketEmit } from './util'

export class AddModule extends React.Component {
    static contextType = CompanionContext

    state = {
        filter: ''
    }

    addInstance(type, product) {
        this.setState({ filter: '' })

        socketEmit(this.context.socket, 'instance_add', [{ type: type, product: product }]).then(([id]) => {
            console.log('NEW INSTANCE', id)
            this.props.configureInstance(id)
        }).catch((e) => {
            console.error('Failed to create instance:', e)
        })
    }

    getFilteredResults() {
        if (!this.state.filter) return []

        const regexp = new RegExp(this.state.filter, "i")

        const result = []

        for (const [id, module] of Object.entries(this.props.modules)) {
            const products = new Set(Array.isArray(module.product) ? module.product : [module.product])
            for (const subprod of products) {
                const name = `${module.manufacturer} ${subprod}`
                
                if (name.replace(';', ' ').match(regexp)) {
                    result.push(
                        <div key={name + id}>
                            <CButton color="primary" onClick={() => this.addInstance(id, subprod)} >Add</CButton>
                            &nbsp;
                            {name}
                            { module.help ? <div className="instance_help" onClick={() => this.props.showHelp(id)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : '' }
                        </div>
                    )
                }
            }
        }

        return result
    }

    render() {
        return <>
            <div style={{clear:'both'}}>
                <CInput type="text" placeholder="Add by search.." onChange={(e) => this.setState({ filter: e.currentTarget.value })} value={this.state.filter} />
                <div id='instance_add_search_results'>
                    {this.getFilteredResults()}
                </div>
            </div>
        </>
    }
}