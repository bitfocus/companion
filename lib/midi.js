var debug   = require('debug')('lib/midi');
var easymidi = require('easymidi');
var util    = require('util');

function midi(system) {
	var self = this;
	self.system = system;

	self.input_list = [];
	self.input_connected = {};

	self.output_list = [];
	self.output_connected = {};

	self.input_virtual = new easymidi.Input('Companion', true);
	self.output_virtual = new easymidi.Output('Companion', true);

	self.input_object = {};
	self.output_object = {};

	system.emit('io_get', function (_io) {
		io = _io;
		self.system.on('midi_msg',function(input, name, cmd, msg) {
			io.emit('midi_msg', name, cmd, msg);
		});
	});

	io.on('connect', function (socket) {
		debug("client connected");

		socket.emit('midi_devices_list', {
			config: self.config,
			outputs: self.output_list,
			inputs: self.input_list
		});

		socket.on('midi_disconnect', function(direction, name) {
			debug("midi_disconnect", direction, name);
			if (direction == 'input') {
				self.disconnectInput(name);
			}
			else {
				self.disconnectOutput(name);
			}
			socket.emit('midi_devices_list', {
				config: self.config,
				outputs: self.output_list,
				inputs: self.input_list
			});
		});

		socket.on('midi_connect', function(direction, name) {
			debug("midi_connect", direction, name);
			if (direction == 'input') {
				self.connectInput(name);
			}
			else {
				self.connectOutput(name);
			}
			socket.emit('midi_devices_list', {
				config: self.config,
				outputs: self.output_list,
				inputs: self.input_list
			});
		});


		socket.on('midi_reenumerate', function() {
			self.scanDevices();
			socket.emit('midi_devices_list', {
				config: self.config,
				outputs: self.output_list,
				inputs: self.input_list
			});
		});
	});

	// add a listener to keep the device open
	self.input_virtual.on('noteon', function (params) {});

	self.system.on('midi_device_update', function() {
		self.scanDevices();
	});

	self.system.emit('db_get', 'midi', function(val) {
		if (val === undefined) {
			debug('initializing midi config');
			val = { inputs: {}, outputs: {} };
			self.system.emit('db_set', 'midi', val);
		}
		else {
			debug('loaded config', val);
		}
		self.config = val;

		self.initDevices();
	});
	return self;
}

midi.prototype.initDevices = function() {
	var self = this;
	self.scanDevices();

	for (var name in self.config.inputs) {
		debug("initDevices connectInput", name);
		if (self.config.inputs[name] !== undefined && self.config.inputs[name].connected === true) {
			self.connectInput(name);
		}
	}

	for (var name in self.config.outputs) {
		debug("initDevices connectOutput", name);
		if (self.config.outputs[name] !== undefined && self.config.outputs[name].connected === true) {
			self.connectOutput(name);
		}
	}

};

midi.prototype.scanDevices = function() {
	var self = this;

	debug("scanDevices()");

	self.input_list = easymidi.getInputs();
	self.system.emit('midi_device_inputs', self.input_list);
	console.log("inputs", self.input_list);

	self.output_list = easymidi.getOutputs();
	self.system.emit('midi_device_outputs', self.output_list);
	console.log("outputs", self.output_list);

}

midi.prototype.connectInput = function(name) {
	debug('connectInput()', name);
	var self = this;
	var found = false;

	for (var i in self.input_list) {
		if (name === self.input_list[i]) {
			found = true;
		}
	}

	if (found) {
		debug('connecting input', name);

		if (self.config.inputs[name] === undefined) {
			debug("writing config for", name);
			self.config.inputs[name] = {connected:true};
			self.save();
		}
		else {
			self.config.inputs[name].connected = true;
			self.save();
		}

		var input = new easymidi.Input(name);
		self.input_object[name] = input;

		(function(self, input, name) {
			input.on('noteon',             function (msg) { self.system.emit('midi_msg', input, name, 'noteon', msg); });
			input.on('noteoff',            function (msg) { self.system.emit('midi_msg', input, name, 'noteoff', msg); });
			input.on('poly aftertouch',    function (msg) { self.system.emit('midi_msg', input, name, 'poly aftertouch', msg); });
			input.on('cc',                 function (msg) { self.system.emit('midi_msg', input, name, 'cc', msg); });
			input.on('program',            function (msg) { self.system.emit('midi_msg', input, name, 'program', msg); });
			input.on('channel aftertouch', function (msg) { self.system.emit('midi_msg', input, name, 'channel aftertouch', msg); });
			input.on('pitch',              function (msg) { self.system.emit('midi_msg', input, name, 'pitch', msg); });
			input.on('position',           function (msg) { self.system.emit('midi_msg', input, name, 'position', msg); });
			input.on('mtc',                function (msg) { self.system.emit('midi_msg', input, name, 'mtc', msg); });
			input.on('select',             function (msg) { self.system.emit('midi_msg', input, name, 'select', msg); });
			input.on('clock',              function (msg) { self.system.emit('midi_msg', input, name, 'clock', msg); });
			input.on('start',              function (msg) { self.system.emit('midi_msg', input, name, 'start', msg); });
			input.on('continue',           function (msg) { self.system.emit('midi_msg', input, name, 'continue', msg); });
			input.on('stop',               function (msg) { self.system.emit('midi_msg', input, name, 'stop', msg); });
			input.on('reset',              function (msg) { self.system.emit('midi_msg', input, name, 'reset', msg); });
			input.on('sysex',              function (msg) { self.system.emit('midi_msg', input, name, 'sysex', msg); });
		})(self, input, name);
	}

	else {
		debug('input not found');
	}

};

midi.prototype.connectOutput = function(name) {
	var self = this;

};

midi.prototype.disconnectInput = function(name) {
	var self = this;

	if (self.input_object[name] !== undefined && self.input_object[name].removeAllListeners !== undefined) {
		debug("A disconnectInput()",name,self.input_object)
		self.input_object[name].removeAllListeners();
		delete self.input_object[name];
	}

	if (self.input_object[name] !== undefined && self.input_object[name].closePort !== undefined) {
		debug("B disconnectInput()",name,self.input_object)

		self.input_object[name].closePort();
		delete self.input_object[name];
	}
	console.log("input objects", self.input_object);
	if (self.config.inputs[name] !== undefined) {
		self.config.inputs[name].connected = false;
	}
	self.save();

};

midi.prototype.disconnectOutput = function(name) {
	var self = this;

};

midi.prototype.save = function() {
	var self = this;
	debug('------- save midi config ------- ', self.config);
	self.system.emit('db_set', 'midi', self.config);
	self.system.emit('db_save');
};

exports = module.exports = function (system) {
	return new midi(system);
};
