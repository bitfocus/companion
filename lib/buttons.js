var system;
var Image = require('./drawbuf');

function buttons(system, panel) {
	var self = this;
	self.panel = panel;

	system.on('ready', function() {
		console.log("buttons ready");
	});

	panel.setButtonHandler(function(key,state,all) {

		var img = new Image(72,72);

		img.boxLine(0,0,71,71, img.rgb(255,0,0));

		//img.hl(30,img.rgb(255,255,0));

		img.pixel(10,12, img.rgb(255,0,0));
		img.pixel(10,10, img.rgb(255,0,0));
		img.pixel(12,12, img.rgb(255,0,0));
		img.pixel(12,10, img.rgb(255,0,0));



		panel.draw(key, img.buffer());


	});

	return self;

}

buttons.prototype.quit = function () {

};

exports = module.exports = function (system, panel) {
	return new buttons(system, panel);
};
