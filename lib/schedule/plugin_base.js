class plugin_base {
	constructor(scheduler) {
		this.scheduler = scheduler;
		this.watch = [];
		this.setup();
	}

	add(id, data) {
		this.watch.push({
			id: id,
			config: data.config
		});
	}

	remove(id) {
		const idx = this.watch.findIndex(x => x.id === id);
		if (idx !== -1) {
			this.watch.splice(idx, 1);
		}
	}

	setup() {}
}

module.exports = plugin_base;
