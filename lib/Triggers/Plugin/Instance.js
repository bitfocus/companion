import TriggersPluginBase from './Base.js'

class TriggersPluginInstance extends TriggersPluginBase {
	/**
	 * Indicate the system is ready for processing
	 * @access public
	 */
	onSystemReady() {
		setTimeout(() => {
			this._run('start')
		}, 10000)
	}

	config_desc(config) {
		const run_conf = this.options[0].choices.find((x) => x.id === config.run)
		let run_time = !run_conf ? 'unknown' : run_conf.label

		return run_time
	}
}

export default TriggersPluginInstance
