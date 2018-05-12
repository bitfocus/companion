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
		img.pixel(20,20, img.rgb(255,255,255) );

		console.log("HAHAHAHA", key, state);
		var cnv =  img.buffer();
		console.log(cnv,cnv.length);
		panel.draw(key, cnv);

	});

	return self;

}

buttons.prototype.quit = function () {

};

exports = module.exports = function (system, panel) {
	return new buttons(system, panel);
};
