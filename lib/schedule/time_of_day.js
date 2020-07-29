const plugin_base = require('./plugin_base');

class time_of_day extends plugin_base {
	setup() {
		this.interval_watch = setInterval(() => {
			const now = new Date();
			const hms = now.getHours().toString().padStart(2, '0') + ':' +
				now.getMinutes().toString().padStart(2, '0') + ':' +
				now.getSeconds().toString().padStart(2, '0');
			this.matches(now.getDay().toString(), hms);
		}, 1000);
	}

	matches(day, hms) {
		this.watch.filter(x => x.config.days.includes(day) && x.config.time === hms)
			.forEach(x => this.scheduler.action(x.id));
	}

	type() {
		return 'tod';
	}
}

module.exports = time_of_day;
