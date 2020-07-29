class scheduler {
	constructor(_system, plugins) {
		this.system = _system;
		this.config = [];
		this.plugins = plugins;

//this.system.emit('log', 'scheduler', 'debug', 'Listening on port ');

		this.system.emit('db_get', 'scheduler', this.init_config.bind(this));
		this.system.emit('io_get', io => {
			this.system.on('io_connect', socket => {
				console.log(socket);
				socket.on('schedule_get', this.get_schedule.bind(this, socket));
				socket.on('schedule_save_item', this.save_schedule.bind(this, socket));
				socket.on('schedule_update_item', this.update_schedule.bind(this, socket));
			});
		});
	}

	init_config(res) {
		if (res === undefined || res === null) {
			res = [];
			this.system.emit('db_set', 'scheduler', res);
		}

		this.config = res;

		this.start_schedule();
	}

	start_schedule() {
		this.config.forEach(i => this.event_watch(i));
	}

	get_plugin(type) {
		let plugin = this.plugins.find(p => p.type() === type);
		if (!plugin) {
			this.system.emit('log', 'scheduler', 'error', 'Plugin not loaded.');
			return null;
		}
		return plugin;
	}

	event_watch(config, add = true) {
		let plugin = this.get_plugin(config.type);
		if (!plugin) {
			return;
		}

		if (add) {
			this.system.emit('log', 'scheduler', 'info', 'Adding scheduled event.');
			plugin.add(config.id, config);
		} else {
			this.system.emit('log', 'scheduler', 'info', 'Removing scheduled event.');
			plugin.remove(config.id);
		}
	}

	clean_config(config) {
		config = Object.assign({
			title: '',
			type: 'tod',
			config: {},
			button: 1.1,
			last_run: null,
			disabled: false
		}, config);

		if (!('id' in config) || config.id === null) {
			config.id = this.get_next_id();
		}
		return config;
	}

	get_next_id() {
		if (this.config.length === 0) {
			return 1;
		}

		return Math.max.apply(Math, this.config.map(i => i.id)) + 1;
	}

	get_schedule(socket, cb) {
		cb(this.config);
	}

	find_event_idx(id) {
		return this.config.findIndex(x => x.id === id);
	}

	/**
	 * Merges events together
	 * @param {Object} new_data
	 * @param {Callback} cb
	 */
	update_schedule(socket, id, new_data, cb) {
		const idx = this.find_event_idx(id);
		if (idx === -1) {
			this.system.emit('log', 'scheduler', 'error', 'Scheduled event could not be found.');
			return;
		}

		this.event_watch(this.config[idx], false);

		if ('deleted' in new_data) {
			this.config.splice(idx, 1);
			cb(null);
		} else {
			this.config[idx] = {...this.config[idx], ...new_data};
			cb(this.config[idx]);
		}

		this.save_to_db();
		this.event_watch(this.config[idx]);
		socket.broadcast.emit('schedule_refresh', this.config);
	}

	/**
	 * Replaced a full configuration
	 * @param {Object} new_data
	 * @param {Callback} cb
	 */
	save_schedule(socket, new_data, cb) {
		const clean_data = this.clean_config(new_data);

		const idx = this.find_event_idx(clean_data.id);
		if (idx === -1) {
			this.config.push(clean_data);
		} else {
			this.event_watch(this.config[idx], false);
			this.config[idx] = clean_data;
		}

		this.save_to_db()
		this.event_watch(this.config[idx]);
		cb(clean_data);

		socket.broadcast.emit('schedule_refresh', this.config);
	}

	save_to_db() {
		this.system.emit('db_set', 'scheduler', this.config);
		this.system.emit('db_save');
	}
}

class schedule_plugin {
	constructor(system) {
		this.system = system;
		this.watch = [];
		this.setup();
	}

	add(id, data) {
		this.watch.push({
			id: id,
			data: data
		});
	}

	remove(id) {
		const idx = this.watch.findIndex(x => x.id === id);
		if (idx !== -1) {
			this.watch.splice(idx, 1);
		}
	}
}

class schedule_plugin_instance extends schedule_plugin {
	constructor(system) {
		super(system);
	}

	setup() {}

	type() {
		return 'instance';
	}
}

class schedule_plugin_tod extends schedule_plugin {
	setup() {
		this.scheduler = setInterval(() => {
			const now = new Date();
			const hms = now.getHours().toString().padStart(2, '0') + ':' +
				now.getMinutes().toString().padStart(2, '0') + ':' +
				now.getSeconds().toString().padStart(2, '0');
			this.matches(now.getDay().toString(), hms);
		}, 1000);
	}

	matches(day, hms) {
		this.watch.filter(x => x.data.config.days.includes(day) && x.data.config.time === hms).forEach(x => {
			//console.log(x);
			this.system.emit('log', 'scheduler-tod', 'info', `Push button ${bank}.${button}`);
			this.system.emit('bank_pressed', bank, button, true);

			setTimeout(() => {
				this.system.emit('bank_pressed', bank, button, false);
				this.system.emit('log', 'rosstalk', 'info', `Release button ${bank}.${button}`);
			}, this.release_time);
		});
	}

	type() {
		return 'tod';
	}
}

module.exports = system => {
	let plugins = [new schedule_plugin_tod(system), new schedule_plugin_instance(system)];
	new scheduler(system, plugins);
}
