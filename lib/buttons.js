var system;
var Image = require('./drawbuf');
var debug = require('debug')('buttons');
var i     = new Image(1,1); // TODO: export the .rgb function
var bank_map = {};
var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
for (var num in b) { bank_map[parseInt(b[num])] = parseInt(num)+1 }

function buttons(system, panel) {
	var self = this;

	self.panel = panel;
	self.page = 1;
	self.config = {};

	system.on('bank-update', function(config) {
		self.config = config;
		self.drawPage();
	});

	system.on('ready', function() {
		console.log("buttons ready");
		system.emit('request-bank-update');
		return self;
	});

	system.on('elgato_ready', function() {
		self.drawControls();
		self.drawPage();
	});

	system.on('elgato_click', function(key,state,obj) {

		if (state == true) {

			if (key == 0 && self.page < 99) {
				self.page++;
				self.updatePageButton();
				self.page_up_timer = setInterval(function() {
					if (self.page+5 < 100) {
						self.page += 5;
						self.updatePageButton();
					}
				}, 400);
			}

			if (key == 10 && self.page > 1) {
				self.page--;
				self.updatePageButton();
				self.page_down_timer = setInterval(function() {
					if (self.page-5 > 1) {
						self.page -= 5;
						self.updatePageButton();
					}
				}, 400);
			}

			if (bank_map[key] !== undefined) {
				self.system.emit('bank-pressed', self.page, bank_map[key]);
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
	});

}

buttons.prototype.drawPage = function() {
	var self = this;

	var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);

	for (var num in b) {
		var img = new Image(72,72);
		var bank = parseInt(num)+1;
		if (self.config[self.page] !== undefined && self.config[self.page][bank] !== undefined) {

			var c = self.config[self.page][bank];

			img.drawText(3,3,self.page+"."+num,img.rgb(255,198,0),0);
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
			img.drawText(2,3,self.page+"."+num,img.rgb(30,30,30),0);
			img.horizontalLine(13,img.rgb(20,20,20));
		}
		self.panel.draw(b[num], img.buffer());

	}


};


buttons.prototype.drawControls = function() {
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

	self.updatePageButton();

}

buttons.prototype.updatePageButton = function() {
	var self = this;
	var img = new Image(72,72);
	img.backgroundColor(img.rgb(15,15,15));
	img.drawText(12,20,"PAGE",img.rgb(255,198,0),0);
	img.drawText(self.page > 9 ? 12 : 15,34,""+self.page,img.rgb(255,255,255),0,4,true);
	self.panel.draw(5, img.buffer());
	self.drawPage();

}

buttons.prototype.quit = function () {

};

exports = module.exports = function (system, panel) {
	return new buttons(system, panel);
};
