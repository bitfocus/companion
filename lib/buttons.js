var system;
var Image = require('./drawbuf');
var debug = require('debug')('buttons');

function buttons(system, panel) {
	var self = this;
	self.panel = panel;

	system.on('ready', function() {
		console.log("buttons ready");

		panel.buttonHandler(0, false, panel.buttonState);

		return self;

	});

	panel.setButtonHandler(function(key,state,all) {

		debug("draw","begin");

		//var img = new Image(72,72);
		//img.backgroundColor(img.rgb(0,0,0));
		//img.boxLine(2,2,69,69, img.rgb(255,0,0));
		//img.boxFilled(6,6,65,65, img.rgb(0,0,0));
		//img.horizontalLine(13,img.rgb(255,198,0));
		//img.verticalLine(30,img.rgb(255,0,255));
		//img.pixel(12,10, img.rgb(255,255,255));


		var img = new Image(72,72);
		img.drawFromPNG('./test/page_up.png',0,0);
		panel.draw(0, img.buffer());

		var img = new Image(72,72);
		img.drawFromPNG('./test/page_home.png',0,0);
		panel.draw(5, img.buffer());

		var img = new Image(72,72);
		img.drawFromPNG('./test/page_down.png',0,0);
		panel.draw(10, img.buffer());

		var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);

		for (var num in b) {
			var img = new Image(72,72);
			img.horizontalLine(13,img.rgb(255,198,0));
			img.drawText(3,3,"1."+num,img.rgb(255,198,0),0);

			panel.draw(b[num], img.buffer());
		}

		debug("draw","end");

	});

}

buttons.prototype.quit = function () {

};

exports = module.exports = function (system, panel) {
	return new buttons(system, panel);
};
