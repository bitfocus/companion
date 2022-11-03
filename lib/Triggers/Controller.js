import { nanoid } from 'nanoid'
import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Plugins from './Plugin/index.js'
import jsonPatch from 'fast-json-patch'
import { CreateTriggerControlId } from '../Resources/Util.js'

class TriggersController extends CoreBase {
	test_actions(socket, title, actions, relative_delays) {
		this.logger.info(`Testing execution for ${title}`)

		this.controls.actions.runMultipleActions(
			actions,
			CreateTriggerControlId(`test:${nanoid()}`),
			relative_delays ?? false,
			null
		)
	}
}

export default TriggersController
