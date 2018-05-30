var system;
var debug = require('debug')('lib/graphics');
var Image = require('./drawbuf');
var rgb = Image.rgb;
var instance;

function graphics(_system) {
	var self = this;
	self.buffers = {};

	system = _system;

	system.on('graphics_invalidate_bank', self.invalidateBank.bind(self));

	self.drawControls();

	system.once('bank-update', function(config) {
		if (config !== undefined) {
			self.config = config;
		}

		debug("Generating buffers");
		self.generate();
		debug("Done");
	});
}

graphics.prototype.invalidateBank = function(page, bank) {
	var self = this;
	self.buffers[page + '_' + bank] = undefined;
	self.drawBank(page, bank);

	debug("Invalidated image for " + page + "." + bank);
	system.emit('graphics_bank_invalidated', page, bank);
};

graphics.prototype.generate = function() {
	var self = this;

	for (var p = 1; p <= 99; p++) {
		self.drawPage(p);
	}

	self.drawControls();
};

graphics.prototype.drawBank = function(page, bank) {
	var self = this;
	var img;

	page = parseInt(page);
	bank = parseInt(bank);

	if (self.buffers[page+'_'+bank] === undefined) {
		img = self.buffers[page+'_'+bank] = new Image(72,72);
	} else {
		img = self.buffers[page+'_'+bank];
		img.boxFilled(0, 0, 71, 14, rgb(0,0,0));
	}

	if (self.config[page] !== undefined && self.config[page][bank] !== undefined && self.config[page][bank].style !== undefined) {

		var c = self.config[page][bank];

		img.drawText(3,3,page+"."+bank,img.rgb(255,198,0),0);
		img.horizontalLine(13,img.rgb(255,198,0));

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
		img.drawText(2,3,page+"."+bank,img.rgb(50,50,50),0);
		img.horizontalLine(13,img.rgb(30,30,30));
	}

	return img;
};

graphics.prototype.drawPage = function(page) {
	var self = this;

	for (var bank = 1; bank <= 12; ++bank) {
		var img = self.drawBank(page, bank);
	}
};


graphics.prototype.drawControls = function() {
	var self = this;

	// page up
	var img = self.buffers['up'] = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawLetter(26,20,'arrow_up',img.rgb(255,255,255),'icon');
	img.drawText(8,40,"PAGE UP",img.rgb(255,198,0),0);

	// page down
	var img = self.buffers['down'] = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawLetter(26,40,'arrow_down',img.rgb(255,255,255),'icon');
	img.drawText(5,25,"PAGE DOWN",img.rgb(255,198,0),0);
}

graphics.prototype.getImagesForPage = function(page) {
	var self = this;
	var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
	var result = {};

	for (var i in b) {
		if (self.buffers[page + '_' + (parseInt(i)+1)] === undefined) {
			result[b[i]] = (new Image(72,72)).bufferAndTime();
		} else {
			result[b[i]] = self.buffers[page + '_' + (parseInt(i)+1)].bufferAndTime();
		}
	}

	result[0] = self.buffers.up.bufferAndTime();
	result[5] = self.getPageButton(page).bufferAndTime();
	result[10] = self.buffers.down.bufferAndTime();

	return result;
};

graphics.prototype.getBank = function(page, bank) {
	var self = this;
	var img = self.buffers[page + '_' + bank];

	return { buffer: img.buffer(), updated: img.lastUpdate };
};

graphics.prototype.getPageButton = function(page) {
	var self = this;
	var img = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawText(12,20,"PAGE",img.rgb(255,198,0),0);
	img.drawText(page > 9 ? 12 : 15,34,""+page,img.rgb(255,255,255),0,4,true);

	return img;
}

// Graphics is a singleton class
exports = module.exports = function (system) {
	if (instance === undefined) {
		return instance = new graphics(system);
	} else {
		return instance;
	}
};
