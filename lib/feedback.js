var system;
var io;
var debug = require('debug')('lib/feedback');
var _ = require('lodash');

function feedback(system) {
	var self = this;

	self.system = system;
	self.feedback_definitions = {};
	self.feedbacks = {
		'1': {
			'9': [{ id: 'input_bg', instance_id: 'BJSU3dbz7', input: 3, output: 19 }],
			'10': [{ id: 'input_bg', instance_id: 'BJSU3dbz7', input: 4, output: 19 }]
		}
	};

	self.feedback_styles = {};

	system.on('feedback_instance_definitions_set', function (instance, feedbacks) {
		self.feedback_definitions[instance.id] = feedbacks;
	});

	system.on('feedback_instance_check', function (instance) {
		debug('Instance ' + instance.label + ' wants us to check banks');
		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {

				// Iterate through feedbacks on this bank
				if (self.feedbacks[page][bank] !== undefined) {
					for (var i in self.feedbacks[page][bank]) {
						var feedback = self.feedbacks[page][bank][i];

						if (feedback.instance_id == instance.id) {
							system.emit('get_bank', page, bank, function (bank_obj) {

								// Ask instance to check bank for custom styling
								if (typeof instance.feedback == 'function') {
									var result = instance.feedback(feedback, bank_obj);
									self.setStyle(page, bank, result);
								} else {
									debug('ERROR: instance ' + instance.label + ' does not have a feedback() function');
								}

							});
						}
					}
				}

			}
		}
	});

	system.on('feedback_get_style', function (page, bank, cb) {
		if (self.feedback_styles[page] === undefined) {
			return cb(undefined);
		}
		return cb(self.feedback_styles[page][bank]);
	});

}

feedback.prototype.setStyle = function(page, bank, style) {
	var self = this;

	if (self.feedback_styles[page] === undefined) {
		self.feedback_styles[page] = {};
	}

	if (!_.isEqual(style, self.feedback_styles[page][bank])) {
		debug('Feedback changed style of bank ' + page + '.' + bank);
		self.feedback_styles[page][bank] = style;
		self.system.emit('graphics_invalidate_bank', page, bank);
	}
};

exports = module.exports = function (system) {
	return new feedback(system);
};
