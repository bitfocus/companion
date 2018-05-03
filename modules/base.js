var util         = require('util');

function module_base(system, panel) {
	var self = this;
	self.system = system;
	self.panel = panel;
	self.icondata = {};

	self.system.on('update_icon', function(obj) {
		if (obj !== undefined && obj.module !== undefined) {
			if (obj.module == 'timer') {
				self.panel.setDesign(0, self.panel.fa.bind(self, { icon: "\uf017", text: obj.data } ));
				self.panel.buttonState[0].needsUpdate = true;
			}
		}
	});


	console.log("activating");

	return self;
}

module_base.prototype.buttonHandler = function(key,state) {

	if (key == 0) {
		this.system.emit('active_module', 'timer');
	}
/*
	if (key == 1) {
		this.system.emit('active_module', 'atem');
	}
	if (key == 2) {
		this.system.emit('active_module', 'qlab');
	}

	if (key == 3) {
		this.system.emit('active_module', 'playbackpro');
	}

	if (key == 4) {
		this.system.emit('active_module', 'hyperdeck');
	}

	if (key == 5) {
		this.system.emit('active_module', 'multihyperdeck');
	}

	if (key == 6) {
		this.system.emit('active_module', 'dmxpro');
	}
	if (key == 7) {
		this.system.emit('active_module', 'videohub');
	}
	if (key == 8) {
		this.system.emit('active_module', 'e2');
	}
	if (key == 14) {
		this.system.emit('active_module', 'pj_sub');
	}
*/
};

module_base.prototype.deactivate = function(key) {
	var self = this;
};

module_base.prototype.updateIcon = function() {
	var self = this;

	self.panel.clearDeck();
	self.panel.setDesign(0, self.panel.fa.bind(self, { icon: "\uf017", text: 'timer' } ));

	/*
	self.panel.setDesign(1, self.panel.icon.bind(self, { icon: 'atem',text: 'atem',textcolor: '#fff' } ));
	self.panel.setDesign(2, self.panel.icon.bind(self, { icon: 'qlab',text: 'qlab',textcolor: '#fff' } ));
	self.panel.setDesign(3, self.panel.icon.bind(self, { icon: 'playbackpro',text: 'pbpro',textcolor: '#fff' } ));
	self.panel.setDesign(4, self.panel.icon.bind(self, { icon: 'hyperdeck',text:'hyperdeck',textcolor: '#fff' } ));
	self.panel.setDesign(5, self.panel.icon.bind(self, { icon: 'hyperdeck', text: 'multi',textcolor: '#fff'} ));
	self.panel.setDesign(6, self.panel.fa.bind(self, { icon: "\uf1de", text: 'dmxpro'} ));
	self.panel.setDesign(7, self.panel.icon.bind(self, { icon: 'videohub', text: 'videohub',textcolor: '#fff'} ));
	self.panel.setDesign(8, self.panel.icon.bind(self, { icon: 'eventmaster', text: 'e2 s3',textcolor: '#fff'} ));
	self.panel.setDesign(14, self.panel.fa.bind(self, { icon: "\uf03d", text: 'projector' } ));
	*/

};

module_base.prototype.activate = function(key) {
	var self = this;

	self.updateIcon();
	return true;
}


exports = module.exports = module_base;
