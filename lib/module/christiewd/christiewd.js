var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var TelnetSocket = require("telnet-stream").TelnetSocket;
var debug;
var log;


function instance(system, id, config) {
	var self = this;

	// Request id counter
	self.request_id = 0;
	// super-constructor
	instance_skel.apply(this, arguments);
	self.status(1,'Initializing');
	self.actions(); // export actions

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
	self.init_tcp();
};

instance.prototype.incomingData = function(data) {
	var self = this;
	debug(data);

};

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;
	var receivebuffer = '';

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port || 1234);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			debug("Connected");
			self.login = false;
		});

		self.telnet = new TelnetSocket(self.socket.socket);

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		// if we get any data, display it to stdout
		self.telnet.on("data", function(buffer) {
			var indata = buffer.toString("utf8");
			self.incomingData(indata);
		});

		// tell remote we WONT do anything we're asked to DO
		self.telnet.on("do", function(option) {
			return self.telnet.writeWont(option);
		});

		// tell the remote DONT do whatever they WILL offer
		self.telnet.on("will", function(option) {
			return self.telnet.writeDont(option);
		});

	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type:  'text',
			id:    'info',
			width: 12,
			label: 'Information',
			value: 'Remember to activate Remoting under Connections -> Remoting -> TCP Server. Use Multi Client if you want to be able to send Commands from multiple Devices'
		},
		{
			type:    'textinput',
			id:      'host',
			label:   'Widget Designer IP',
			width:   12,
			default: '192.168.0.1',
			regex:   self.REGEX_IP
		},
		{
			type:    'textinput',
			id:      'port',
			label:   'TCP Port',
			width:   6,
			default: '123',
			regex:   self.REGEX_PORT
		},
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	debug("destroy", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {

		'command': {
			label:'WD Command',
			options: [
				{
					 type:    'textinput',
					 label:   'Command',
					 id:      'command',
					 default: '',
				}
			]
		},
		'customscriptclick': {
			label:'CustomScript Click',
			options: [
				{
					 type:    'textinput',
					 label:   'CustomScript ID',
					 id:      'csid',
					 default: '',
					 regex:   self.REGEX_NUMBER
				}
			]
		},
		'fadetovalue': {
			label:'Fade to Value in Secounds',
			options: [
				{
					 type:    'textinput',
					 label:   'Fader ID',
					 id:      'faderid',
					 default: '',
					 regex:   self.REGEX_NUMBER
				},
				{
					 type:    'textinput',
					 label:   'Time (sec)',
					 id:      'fadetime',
					 default: '2.0',
				},
				{
					 type:    'textinput',
					 label:   'Value',
					 id:      'value',
					 default: '1.0',
				}
			]
		}

	});
}

instance.prototype.action = function(action) {
	var self = this;
	console.log("Sending some action", action);
	var cmd;
	var opt = action.options

		switch (action.action) {

			case 'command':
				cmd = opt.command;
				break;

			case 'customscriptclick':
				cmd = 'WDCustomScriptClick('+ opt.csid + ')';
				break;
				
			case 'fadetovalue':
				cmd = 'WDFadeToValue('+ opt.faderid +','+ opt.fadetime +','+ opt.value +')';
				break;
	};

	if (cmd !== undefined) {

		if (self.socket !== undefined && self.socket.connected) {
			self.telnet.write("{"+cmd+"}\r\n");
		} else {
			debug('Socket not connected :(');
		}

	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
