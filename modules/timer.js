var util         = require('util');

function prenull(n) {
	return (n >= 10 ? "" : "0") + n;
};

function module_timer(system, panel) {
	var self = this;

	self.system = system;
	self.panel = panel;

	self.current = {
		hours: 0,
		minutes: 0,
		seconds: 0,
		desth: 0,
		destm: 0,
		dests: 0,
		negative: false,
		rate: 100,
		lastrate: 0,
		remaining: 0,
		state: 0
	};

	self.setTimer(1000);
	return self;
}

module_timer.prototype.tick = function() {
	var self = this;

	if (self.current.state == 1) {
		self.current.remaining--;
	}

	if (self.active) {
		self.updateDigits();
	} else {
		if (self.active_module == 'base') {
			if (self.current.state == 1) {
				self.calculateRemaining();
				if (self.current.remaining >= 0) {
					self.system.emit('update_icon', {
						module: 'timer',
						data: prenull(self.current.hours) + ":" + prenull(self.current.minutes) + ":" + prenull(self.current.seconds)
					});
				} else {
					self.system.emit('update_icon', {
						module: 'timer',
						data: "OVER"
					});
				}
			}
		}

	}

	if (self.current.state) {
		if (self.current.negative) {
			self.system.emit('timer_www', 'overtime');
		} else {
			self.system.emit('timer_www', (self.current.hours > 0 ? prenull(self.current.hours) + ":" : "") + prenull(self.current.minutes) + ":" + prenull(self.current.seconds));
		}
	}
	else {
		self.system.emit('timer_www', '--:--:--');
	}


};


module_timer.prototype.getRate = function() {
	var self = this;
	return self.current.rate + "%";
};


module_timer.prototype.setTimer = function(ticksize) {
	var self = this;
	if (self.intervaltimer !== undefined) {
		clearTimeout(self.intervaltimer);
	}
	self.intervaltimer = setInterval(self.tick.bind(self), ticksize);
};


module_timer.prototype.buttonHandler = function(key,state) {
	var self = this;

	if (key == 0 && state) {
		self.togglePlayPause();
	}

	if (key == 11 && state) { self.current.remaining -= 3600; }
	if (key == 12 && state) { self.current.remaining -= 60; }
	if (key == 13 && state) { self.current.remaining -= 1; }
	if (key == 1 && state)  { self.current.remaining += 3600; }
	if (key == 2 && state)  { self.current.remaining += 60; }
	if (key == 3 && state)  { self.current.remaining += 1; }

	if (key == 6 && state)  { self.current.remaining += (60*30); }
	if (key == 7 && state)  { self.current.remaining += 600; }
	if (key == 8 && state)  { self.current.remaining += 300; }

	// rewind
	if (key == 5 && state) {
		self.current.remaining = 0;
		self.current.rate = 100;
	}

	// rate up/down
	if (key == 4 && state)  {
		self.current.rate += 1;
		self.setTimer(1 / (self.current.rate/100) * 1000 );
	}

	if (key == 14 && state) {
		self.current.rate -= 1;
		self.setTimer(1 / (self.current.rate/100) * 1000 );
	}

	self.updateDigits();

};


module_timer.prototype.timer = function(sign) {

	var self = this;
	var canvas = self.panel.newCanvas();
	var ctx = canvas.getContext('2d');

	ctx.translate(0.5, 0.5);
	ctx.textAlign="center";

	if (sign == 'b') {
		ctx.fillStyle='white';
		ctx.font="25px Helvetica";
		ctx.fillText(self.getRate(), 36, 36 );
		ctx.font="14px Helvetica";
		ctx.fillText("SPEED", 36, 54 );
	}
	else {
		ctx.font="30px Helvetica";

		if (self.current.negative) {
			ctx.fillStyle='red';
		}
		else {
			ctx.fillStyle='#0f0';
		}

		if (sign == 'h') {
			if (self.current.negative) {
				ctx.fillStyle='red';
				ctx.fillRect(0,0,72,72);
				ctx.fillStyle='white';
			}
			else {
				if (!self.current.state) ctx.fillStyle='white';
			}
			ctx.fillText(prenull(self.current.hours), 36, 25 );
			ctx.font="20px Helvetica";
			ctx.fillStyle=self.current.negative ? 'red' : 'white';
			ctx.fillText(prenull(self.current.desth), 36, 45 );

			ctx.font="15px Helvetica";
			ctx.fillStyle='#444';
			ctx.fillText("+30min", 34, 63 );

		}

		if (sign == 'm') {
			if (self.current.negative) {
				ctx.fillStyle='red';
				ctx.fillRect(0,0,72,72);
				ctx.fillStyle='white';
			}
			else {
				if (!self.current.state) ctx.fillStyle='white';
			}

			ctx.fillText(prenull(self.current.minutes), 36, 25 );
			ctx.font="20px Helvetica";
			ctx.fillStyle=self.current.negative ? 'red' : 'white';
			ctx.fillText(prenull(self.current.destm), 36, 45 );

			ctx.font="15px Helvetica";
			ctx.fillStyle='#444';
			ctx.fillText("+10min", 34, 63 );

		}

		if (sign == 's') {
			if (self.current.negative) {
				ctx.fillStyle='red';
				ctx.fillRect(0,0,72,72);
				ctx.fillStyle='white';
			}
			else {
				if (!self.current.state) ctx.fillStyle='white';
			}

			ctx.fillText(prenull(self.current.seconds), 36, 25 );
			ctx.font="20px Helvetica";
			ctx.fillStyle=self.current.negative ? 'red' : 'white';
			ctx.fillText(prenull(self.current.dests), 36, 45 );

			ctx.font="15px Helvetica";
			ctx.fillStyle='#444';
			ctx.fillText("+5min", 34, 63 );
		}

	}
	return canvas;
};


module_timer.prototype.togglePlayPause = function() {
	var self = this;
	if (self.current.state == 1) {
		self.current.state = 0;
	}
	else {
		self.current.state = 1;
	}
	self.updatePlayPause();
	return;
};


module_timer.prototype.updateDigits = function() {

	var self = this;
	var time = self.current.remaining;

	if (time < 0) {
		time = Math.abs(time);
		if (self.current.negative == false) {
			self.panel.buttonState[6].needsUpdate = true;
			self.panel.buttonState[7].needsUpdate = true;
			self.panel.buttonState[8].needsUpdate = true;
		}
		self.current.negative = true;
	}

	else {
		if (self.current.negative == true) {
			self.panel.buttonState[6].needsUpdate = true;
			self.panel.buttonState[7].needsUpdate = true;
			self.panel.buttonState[8].needsUpdate = true;
		}
		self.current.negative = false;
	}

	if (self.current.lastrate != self.current.rate) {
		self.panel.buttonState[9].needsUpdate = true;
		self.current.lastrate = self.current.rate;
	}
	self.calculateRemaining();
	self.calculateTimeOfDay();

}

module_timer.prototype.calculateRemaining = function() {
	var self = this;

	var time = Math.abs(self.current.remaining);
	var hours = Math.floor(time / 3600);
	var minutes = Math.floor( (time - (hours * 3600) ) / 60);
	var seconds = time % 60;

	if (hours != self.current.hours) {
		self.current.hours = hours;
		if (self.active) self.panel.buttonState[6].needsUpdate = true;
	}

	if (minutes != self.current.minutes) {
		self.current.minutes = minutes;
		if (self.active) self.panel.buttonState[7].needsUpdate = true;
	}

	if (seconds != self.current.seconds) {
		self.current.seconds = seconds;
		if (self.active) self.panel.buttonState[8].needsUpdate = true;
	}

};


module_timer.prototype.calculateTimeOfDay = function() {
	var self = this;
	var time = Math.abs(self.current.remaining);

	if (!self.current.negative) {

		var then = new Date(Date.now() + (time * (1 / (self.current.rate/100) * 1000 ) ) );

		if (then.getHours() != self.current.desth) {
			self.panel.buttonState[6].needsUpdate = true;
			self.current.desth = then.getHours();
		}

		if (then.getMinutes() != self.current.destm) {
			self.panel.buttonState[7].needsUpdate = true;
			self.current.destm = then.getMinutes();
		}
		if (then.getSeconds() != self.current.dests) {
			self.panel.buttonState[8].needsUpdate = true;
			self.current.dests = then.getSeconds();
		}

	}

	else {
		self.panel.buttonState[6].needsUpdate = true;
		self.current.desth = ""
		self.panel.buttonState[7].needsUpdate = true;
		self.current.destm = ""
		self.panel.buttonState[8].needsUpdate = true;
		self.current.dests = ""
	}

}

module_timer.prototype.updatePlayPause = function() {
	var self = this;

	if (self.current.state == 1) {
		self.panel.setDesign(0, self.panel.fa.bind(self, { icon: "\uf04c", color: "#ff0", textcolor: "#444", text: "pause" } ));
		self.panel.setDesign(5, self.panel.fa.bind(self, { icon: "\uf0e2", color: "#f22", textcolor: "#444", text: "reset" } ));
	}
	else {
		self.panel.setDesign(0, self.panel.fa.bind(self, { icon: "\uf04b", color: "#2f2", textcolor: "#444", text: "start" } ));
		self.panel.setDesign(5, self.panel.fa.bind(self, { icon: "\uf0e2", color: "#ff2", textcolor: "#444", text: "reset" } ));
	}

	self.panel.buttonState[0].needsUpdate = true;
	self.panel.buttonState[5].needsUpdate = true;

	self.panel.buttonState[6].needsUpdate = true;
	self.panel.buttonState[7].needsUpdate = true;
	self.panel.buttonState[8].needsUpdate = true;

	return;
};

module_timer.prototype.deactivate = function() {
	var self = this;
	self.active = false;
};

module_timer.prototype.activate = function(key) {
	var self = this;
	self.active = true;

	self.panel.clearDeck();

	self.panel.setDesign(10, self.panel.fa.bind(self, { icon: "\uf112", color: "#222", textcolor: "#444", text: "menu"  } ));

	// arrow up
	self.panel.setDesign(1, self.panel.fa.bind(self, { icon: "\uf062", color: "#ccc", textcolor: "#444", text: "+1hour" } ));
	self.panel.setDesign(2, self.panel.fa.bind(self, { icon: "\uf062", color: "#ccc", textcolor: "#444", text: "+1min"  } ));
	self.panel.setDesign(3, self.panel.fa.bind(self, { icon: "\uf062", color: "#ccc", textcolor: "#444", text: "+1sec"  } ));

	// arrow down
	self.panel.setDesign(11, self.panel.fa.bind(self, { icon: "\uf063", color: "#ccc", textcolor: "#444", text: "-1hour" } ));
	self.panel.setDesign(12, self.panel.fa.bind(self, { icon: "\uf063", color: "#ccc", textcolor: "#444", text: "-1min"  } ));
	self.panel.setDesign(13, self.panel.fa.bind(self, { icon: "\uf063", color: "#ccc", textcolor: "#444", text: "-1sec"  } ));

	// bend up and down
	self.panel.setDesign(4, self.panel.fa.bind(self, { icon: "\uf0aa", color: "#33f", textcolor: "#444", text: "faster"  } ));
	self.panel.setDesign(14, self.panel.fa.bind(self, { icon: "\uf0ab", color: "#33f", textcolor: "#444", text: "slower" } ));

	// pauseplay
	self.updatePlayPause();

	// text handler
	self.panel.setDesign(6, self.timer.bind(self, 'h' ));
	self.panel.setDesign(7, self.timer.bind(self, 'm' ));
	self.panel.setDesign(8, self.timer.bind(self, 's' ));
	self.panel.setDesign(9, self.timer.bind(self, 'b' ));


	/*
	f062 up
	f063 down
	f04c pause
	f04b play
	f049 fastforward
	f0aa bend up
	f0ab bend down
	*/

	return true;
}

exports = module.exports = module_timer;
