var instance_skel = require('../../instance_skel');
var debug;
var log;

var MUTESTATE = [
	{ id: 'true', label: 'Mute'},
	{ id: 'false', label: 'Unmute'}
];

var LAYOUT = [
	{ id: 'allEqual', label: 'allEqual'},
	{ id: 'speakerOnly', label: 'speakerOnly'},
	{ id: 'telepresence', label: 'Prominent(Overlay)'},
	{ id: 'stacked', label: 'stacked'},
	{ id: 'allEqualQuarters', label: 'allEqualQuarters'},
	{ id: 'allEqualNinths', label: 'allEqualNinths'},
	{ id: 'allEqualSixteenths', label: 'allEqualSixteenths'},
	{ id: 'allEqualTwentyFifths', label: 'allEqualTwentyFifths'},
	{ id: 'onePlusFive', label: 'onePlusFive'},
	{ id: 'onePlusNine', label: 'onePlusNine'},
	{ id: 'automatic', label: 'automatic'},
	{ id: 'onePlusN', label: 'onePlusN'}
];

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.config = config;

	self.actions();
}

instance.prototype.init = function() {
	var self = this;

	self.status(self.STATE_OK);

	debug = self.debug;
	log = self.log;
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Server IP',
			width: 12
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Port',
			width: 12
		},
		/*{
			type: 'textinput',
			id: 'auth',
			label: 'Basic Auth',
			width: 12
		}*/
		{
			type: 'textinput',
			id: 'username',
			label: 'User',
			width: 12
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			width: 12
		}
	
	]
}

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	debug("destroy");
}

instance.prototype.actions = function(system) {
	var self = this;
	var urlLabel = 'URL';

	if ( self.config.host !== undefined ) {
		if ( self.config.host.length > 0 ) {
			urlLabel = 'URI';
		}
	}

	self.setActions({
		'audioMute': {
			label: 'Participant Audio',
			options: [
				{
					type: 'textinput',
					label: "callleg ID",
					id: 'callerID',
					default: ''
				},
				{
					type: 'dropdown',
					id: 'mute',
					label: 'State',
					width: 6,
					default: 'true',
					choices: MUTESTATE
				}
			]
		},
		'videoMute': {
			label: 'Participant Video',
			options: [
				{
					type: 'textinput',
					label: "callleg ID",
					id: 'callerID',
					default: ''
				},
				{
					type: 'dropdown',
					id: 'mute',
					label: 'State',
					width: 6,
					default: 'true',
					choices: MUTESTATE
				}
			]
		},
		'callLayout': {
			label: 'Call Layout for all participants',
			options: [
				{
					type: 'textinput',
					label: "callleg ID",
					id: 'callID',
					default: ''
				},
				{
					type: 'dropdown',
					id: 'layout',
					label: 'State',
					width: 12,
					default: 'automatic',
					choices: LAYOUT
				}
			]
		},
		'callerLayout': {
			label: 'Call Layout for a single participant',
			options: [
				{
					type: 'textinput',
					label: "callleg ID",
					id: 'callerID',
					default: ''
				},
				{
					type: 'dropdown',
					id: 'layout',
					label: 'State',
					width: 12,
					default: 'automatic',
					choices: LAYOUT
				}
			]
		},
		'addParticipant': {
			label: 'Add a participant (or room) to a call',
			options: [
				{
					type: 'textinput',
					label: "callID",
					id: 'callID',
					default: ''
				},
				{
					type: 'textinput',
					label: "URI",
					id: 'uri',
					default: ''
				}
			]
		},
		'dropParticipant': {
			label: 'Drop participant (or room) from a call',
			options: [
				{
					type: 'textinput',
					label: "callleg ID",
					id: 'callerID',
					default: ''
				}
			]
		},
		'dropCall': {
			label: 'Drop a call (End Meeting)',
			options: [
				{
					type: 'textinput',
					label: "callID",
					id: 'callID',
					default: ''
				}
			]
		},
	});
}

instance.prototype.action = function(action) {
	var self = this;
	authstring = new Buffer(self.config.username + ':' + self.config.password).toString('base64');
	var cmd;
		
	if (action.action == 'audioMute') {
			
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/callLegs/' + action.options.callerID;
			var request = require('request');
			var options = {
			  'method': 'PUT',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic ' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  },
			  form: {
			    'rxAudioMute': action.options.mute
			  },
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}

	else if (action.action == 'videoMute') {
		
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/callLegs/' + action.options.callerID;
			var request = require('request');
			var options = {
			  'method': 'PUT',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  },
			  form: {
			    'rxVideoMute': action.options.mute
			  }
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}

	else if (action.action == 'callLayout') {
			
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/calls/' + action.options.callID + '/participants/*';
			var request = require('request');
			var options = {
			  'method': 'PUT',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  },
			  form: {
			    'layout': action.options.layout
			  }
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}

	else if (action.action == 'addParticipant') {
			
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/calls/' + action.options.callID + '/participants';
			var request = require('request');
			var options = {
			  'method': 'POST',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  },
			  form: {
			    'remoteParty': action.options.uri
			  }
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}

	else if (action.action == 'callerLayout') {
			
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/callLegs/' + action.options.callerID;
			var request = require('request');
			var options = {
			  'method': 'PUT',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  },
			  form: {
			    'chosenLayout': action.options.layout
			  }
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}

	else if (action.action == 'dropParticipant') {
			
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/callLegs/' + action.options.callerID;
			var request = require('request');
			var options = {
			  'method': 'DELETE',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  }
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}

	else if (action.action == 'dropCall') {
			
		cmd = 'https://' + self.config.host + ':' + self.config.port + '/api/v1' + '/calls/' + action.options.callID;
			var request = require('request');
			var options = {
			  'method': 'DELETE',
			  'rejectUnauthorized': false,
			  'url': cmd,
			  'headers': {
 				   'Authorization': 'Basic' + authstring,
				    'Content-Type': 'application/x-www-form-urlencoded'
			  }
			};

			console.log(options);

			request(options, function (error, response) {
				if (error !== null) {
					self.log('error', 'HTTP Request failed (' + error + ')');
					self.status(self.STATUS_ERROR, error);
					console.log(error);
				}
				else {
					self.status(self.STATUS_OK);
				}
			});
		
	}



}

instance_skel.extendedBy(instance);
exports = module.exports = instance;
