var system;
var Image = require('./drawbuf');
var debug = require('debug')('device');
var i     = new Image(1,1); // TODO: export the .rgb function

var bank_map = {};
var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
for (var num in b) {
	bank_map[parseInt(b[num])] = parseInt(num)+1;
}

var debug   = require('debug')('lib/device');

function device(_system, panel) {
	var self = this;

	debug('loading for ' + panel.devicepath);

	system = _system;
	self.panel = panel;
	self.devicepath = panel.devicepath;
	self.page = 1;
	self.config = {};

	self.on_bank_update = function(config) {
		if (config !== undefined) {
			self.config = config;
		}

		self.drawPage();
	};
	system.on('bank-update', self.on_bank_update);

	self.on_ready = function() {
		self.on_bank_update();
	};
	system.on('ready', self.on_ready);

	self.on_elgato_ready = function(devicepath) {
		if (devicepath == self.devicepath) {
			self.drawControls();
			self.drawPage();
		}
	};
	system.on('elgato_ready',self.on_elgato_ready);

	self.on_elgato_click = function(devicepath, key, state, obj) {
		debug(devicepath + ' is ' + self.devicepath);
		if (devicepath != self.devicepath) {
			return;
		}

		if (state == true) {

			if (key == 0 && self.page < 99) {
				self.page++;
				self.updatePagedevice();
				self.page_up_timer = setInterval(function() {
					if (self.page+5 < 100) {
						self.page += 5;
						self.updatePagedevice();
					}
				}, 400);
			}

			if (key == 10 && self.page > 1) {
				self.page--;
				self.updatePagedevice();
				self.page_down_timer = setInterval(function() {
					if (self.page-5 > 1) {
						self.page -= 5;
						self.updatePagedevice();
					}
				}, 400);
			}

			if (bank_map[key] !== undefined) {
				system.emit('bank-pressed', self.page, bank_map[key]);
				system.emit('skeleton-log', 'Page '+self.page+' Bank ' + bank_map[key] + ' pressed');
			}

		}

		else {
			if (self.page_up_timer !== undefined) clearTimeout(self.page_up_timer);
			if (self.page_down_timer !== undefined) clearTimeout(self.page_down_timer);
		}



		//var img = new Image(72,72);
		//img.backgroundColor(img.rgb(0,0,0));
		//img.boxLine(2,2,69,69, img.rgb(255,0,0));
		//img.boxFilled(6,6,65,65, img.rgb(0,0,0));
		//img.horizontalLine(13,img.rgb(255,198,0));
		//img.verticalLine(30,img.rgb(255,0,255));
		//img.pixel(12,10, img.rgb(255,255,255));


		/*
		var img = new Image(72,72);
		self.panel.draw(5, img.buffer());

		var img = new Image(72,72);
		img.drawFromPNG('./test/page_down.png',0,0);
		self.panel.draw(10, img.buffer());


		debug("draw","end");

		*/
	};
	system.on('elgato_click', self.on_elgato_click);

	system.emit('request-bank-update');
}

device.prototype.unload = function () {
	var self = this;

	debug('unloading for ' +  self.devicepath);
	system.removeListener('bank-update', self.on_bank_update);
	system.removeListener('ready', self.on_ready);
	system.removeListener('elgato_ready',self.on_elgato_ready);
	system.removeListener('elgato_click', self.on_elgato_click);
};

device.prototype.drawPage = function() {
	var self = this;

	var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);

	for (var num in b) {
		var img = new Image(72,72);
		var bank = parseInt(num) + 1;

		if (self.config[self.page] !== undefined && self.config[self.page][bank] !== undefined && self.config[self.page][bank].style !== undefined) {

			var c = self.config[self.page][bank];

			img.drawText(3,3,self.page+"."+bank,img.rgb(255,198,0),0);
			img.horizontalLine(13,img.rgb(255,198,0));

			//img.boxFilled(57,3,68,10,img.rgb(255,0,0));

			if (c.style == 'smalltext') {
				img.boxFilled(0, 14, 71, 71, c.bgcolor);
				img.drawText(2, 18, c.text, c.color, 0, 2, false);
			}

			else if (c.style == 'bigtext') {
				img.boxFilled(0,14,71,71,c.bgcolor);
				img.drawText(2, 18, c.text, c.color, 0, 4, true);
			}

			else if (c.style == 'png') {
				img.drawFromPNG( __dirname + '/../icons/' + c.file, 0, 14);
			}

		}
		else {
			img.drawText(2,3,self.page+"."+bank,img.rgb(50,50,50),0);
			img.horizontalLine(13,img.rgb(30,30,30));
		}
		self.panel.draw(b[num], img.buffer());

	}

};


device.prototype.drawControls = function() {
	var self = this;

	// page up
	var img = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawLetter(26,20,'arrow_up',img.rgb(255,255,255),'icon');
	img.drawText(8,40,"PAGE UP",img.rgb(255,198,0),0);
	self.panel.draw(0, img.buffer());

	// page down
	var img = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawLetter(26,40,'arrow_down',img.rgb(255,255,255),'icon');
	img.drawText(5,25,"PAGE DOWN",img.rgb(255,198,0),0);
	self.panel.draw(10, img.buffer());

	self.updatePagedevice();
}

device.prototype.updatePagedevice = function() {
	var self = this;
	var img = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawText(12,20,"PAGE",img.rgb(255,198,0),0);
	img.drawText(self.page > 9 ? 12 : 15,34,""+self.page,img.rgb(255,255,255),0,4,true);
	self.panel.draw(5, img.buffer());
	self.drawPage();
}

device.prototype.quit = function () {
	this.unload();
};

exports = module.exports = function (system, panel) {
	return new device(system, panel);
};
