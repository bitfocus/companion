import React from 'react'
import {} from '@coreui/react'
import { socketEmit, CompanionContext } from './util'

export class Instances extends React.Component {
    static contextType = CompanionContext

    constructor(props) {
        super(props)

        this.state = {
            name: {},
            category: {},
            manufacturer: {},
        }
    }

    componentDidMount() {
        socketEmit(this.context.socket, 'modules_get', []).then((res) => {
            console.log(res)
        }).catch((e) => {
            console.error('Failed to load modules list', e)
        })
    }

    render() {
        return (
            <div>
                <h4>Connections / Instances</h4>
                <p>Instances are the connections companion makes to other devices and software in order to control them.</p>

                <table className="table table-responsive-sm">
                    <thead>
                        <tr>
                            <th>Module</th>
                            <th>Label</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>

                {/* <div class="dropdown" style="float:left">
                    <a id="dLabel" role="button" data-toggle="dropdown" class="btn btn-primary add-instance-button" data-target="#">
                            Add by category</span>
                    </a>
                    <ul class="dropdown-menu multi-level add-instance-ul" id="addInstance" role="menu" aria-labelledby="dropdownMenu">
                    </ul>
                </div>

                <div class="dropdown" style="float:left">&nbsp;
                    <a id="dLabelByManufacturer" role="button" data-toggle="dropdown" class="btn btn-primary add-instance-button" data-target="#">
                            Add by manufacturer</span>
                    </a>
                    <ul class="dropdown-menu multi-level add-instance-ul" id="addInstanceByManufacturer" role="menu" aria-labelledby="dropdownMenu">
                    </ul>
                </div>

                    <p></p>
                <div style='clear:both'>
                    <br>
                    <input type="text" class="form-control" placeholder="Add by search.." id='instance_add_search_field'>
                    <div id='instance_add_search_results'>
                    </div>
                </div> */}
            </div>
        )
    }
}