import React from 'react'
// import Select from 'react-select'
import { CButton, CInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { CompanionContext } from './util'

export class AddModule extends React.Component {
    static contextType = CompanionContext

    state = {
        filter: ''
    }

    addInstance(type, product) {
        this.setState({ filter: '' })

        // TODO
        // socket.emit('instance_add', { type: instance_type, product: product });
        // socket.once('instance_add:result', function(id,db) {
        //     socket.emit('instance_edit', id);
        // });
    }

    getFilteredResults() {
        if (!this.state.filter) return []

        const regexp = new RegExp(this.state.filter, "i")

        const result = []

        for (const [id, module] of Object.entries(this.props.modules)) {
            const products = Array.isArray(module.product) ? module.product : [module.product]
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
        // const moduleNames = Object.entries(this.props.modulesByName).map(([id, name]) => ({ value: id, label: name}))
        // return (
        //     <Select
        //         getOptionLabel={getCustomOptionLabel}
        //         placeholder="Add by search.."
        //         value={null}
        //         options={moduleNames}
                
        //     />
        // );
    }
}