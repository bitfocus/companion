var feedbacklist = {};

$(function() {
	console.log("feedback_get_definitions");
	socket.emit('feedback_get_definitions', page, bank);

	var $aba = $("#addBankFeedback");
	$aba.change(function() {
		socket.emit('bank_addFeedback', page, bank, $(this).val() );
		$("#addBankFeedback").val($("#addBankFeedback option:first").val());
	});

	$('#bankFeedbacks').on('keyup', '.feedback-option-keyup', function() {
		var regex = $(this).data('option-regex');

		if (regex === undefined || $(this).val().match(regex) != null) {
			this.style.color = "black";
			socket.emit('bank_update_feedback_option', page, bank,  $(this).data('feedback-id'), $(this).data('option-id'), $(this).val() );
		} else {
			this.style.color = "red";
		}
	});

	$('#bankFeedbacks').on('change', '.feedback-option-change', function() {
		socket.emit('bank_update_feedback_option', page, bank,  $(this).data('feedback-id'), $(this).data('option-id'), $(this).val() );
	});

	socket.on('bank_get_feedbacks:result', function(page, bank, feedbacks) {
		console.log("bank_get_feedbacks:result", page, bank, feedbacks);

		$ba = $("#bankFeedbacks");
		$ba.html("");

		var $table = $("<table class='table feedback-table'></table>");
		var $trth = $("<thead><tr><th colspan=2>Feedback</th><th>Options</th></tr></thead>");
		var $tbody = $("<tbody></tbody>");
		$table.append($trth);

		for (var n in feedbacks) {
			var feedback = feedbacks[n];
			if (feedback !== null && instance.db[feedback.instance_id] !== undefined && instance.db[feedback.instance_id].label !== undefined) {
				console.log("XXXXXXXXXXXX", feedback);
				console.log("YYYYY", instance.db);
				var idb = instance.db[feedback.instance_id];
				var it = instance.db[feedback.instance_id].instance_type;
				var inst = feedback;

				var $tr = $("<tr></tr>");
				$tr.data("id", feedback.id);

				var $name_td = $("<td class='feedbacklist-td-label'>" + instance.db[feedback.instance_id].label + ": " + feedbacklist[feedback.instance_id][feedback.type].label + "</td>");
				var $del_td = $("<td class='feedbacklist-td-delete'><button type='button' class='btn btn-danger btn-sm'>delete</button><span>&nbsp;</span></td>");
				var $options = $("<td class='feedbacklist-td-options'></td>");

				$tr.append($del_td);
				$tr.append($name_td);

				var iopt = feedbacklist[feedback.instance_id][feedback.type];

				if (iopt !== undefined && iopt.options !== undefined) {
					var options = iopt.options;

					for (var n in options) {
						var option = options[n];


						var $opt_label = $("<label>"+option.label+"</label>");
						$options.append($opt_label);

						if (option.type == 'textinput') {
							var $opt_input = $("<input type='text' class='feedback-option-keyup form-control'>");
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}
							$opt_input.data('feedback-id', feedback.id);
							$opt_input.data('option-id', option.id);

							var regex = undefined;
							if (option.regex){
								var flags = option.regex.replace(/.*\/([gimy]*)$/, '$1');
								var pattern = option.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
								regex = new RegExp(pattern, flags);

								$opt_input.data('option-regex', regex);
							}

							// if options never been stored on this feedback
							if (feedback.options === undefined) {
								feedback.options = {};
							}

							// if this option never has been saved, set default
							if (feedback.options[option.id] === undefined) {
								socket.emit('bank_update_feedback_option', page, bank, feedback.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( feedback.options[option.id] );
							}

							$options.append($opt_input);

						}


						else if (option.type == 'dropdown') {

							var $opt_input = $("<select class='feedback-option-change form-control'></select>");
							$opt_input.data('feedback-id', feedback.id);
							$opt_input.data('option-id', option.id);
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}

							for (var x in option.choices) {
								var str = new String(option.choices[x].label);
								var $opt_choice = $("<option value='"+ option.choices[x].id + "'>" + str + "</option>");
								$opt_choice.data('id', option.choices[x].id);
								$opt_input.append($opt_choice);
							}


							// if options never been stored on this feedback
							if (feedback.options === undefined) {
								feedback.options = {};
							}

							// if this option never has been saved, set default
							if (feedback.options[option.id] === undefined) {
								socket.emit('bank_update_feedback_option', page, bank, feedback.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( feedback.options[option.id] );
							}

							$options.append($opt_input);

						}

						else if (option.type == 'colorpicker') {

							console.log("Option", option, "value", feedback);
							var $input = $("<input type='text' id='auto_"+option.id+"'>");
							$input.addClass('active_field');
							$input.data('special','color');
							$input.data('feedback-id', feedback.id);
							$input.data('option-id', option.id);

							// william, fix? ;P
							$options.append("<br />");
							$options.append($input);
							$options.append("<br />");

							// if this option never has been saved, set default
							if (feedback.options === undefined || (feedback.options[option.id] === undefined && option.default !== undefined)) {
								socket.emit('bank_update_feedback_option', page, bank, feedback.id, option.id, option.default);
							}

							var val = option.default;
							if (feedback.options !== undefined && feedback.options[option.id] !== undefined) {
								val = feedback.options[option.id];
							}

							(function(fval, fid, oid) {
								$input.spectrum({
									color: fval,
									preferredFormat: "rgb",
									showInput: true,
									showPalette: true,
									palette: picker_colors,
									showButtons: false,
									change: function(color) {
										socket.emit('bank_update_feedback_option', page, bank, fid, oid, hex2int( color.toHexString() ) );
									},

									move: function(color) {
										socket.emit('bank_update_feedback_option', page, bank, fid, oid, hex2int( color.toHexString() ) );
									}
								});
							})(int2hex(val), feedback.id, option.id);

						}

					}

				}

				$tr.append($options);

				$del_td.click(function() {
					if (confirm('Delete feedback?')) {
						console.log("delete feedback", page, bank, $(this).parent().data('id'))
						socket.emit('bank_delFeedback', page, bank, $(this).parent().data('id'));
					}
				})
				$tbody.append($tr);

			}
		}
		if (feedbacks.length > 0) {
			$table.append($tbody);
		}
		$ba.append($table);
	});

	socket.on('feedback_get_definitions:result', function(feedbacks) {

		feedbacklist = feedbacks;
		$aba.html("");

		/*var $ali = $("#feedbacksList");
		$ali.html("");*/

		console.log("feedbacks",feedbacks);

		var $option = $("<option> + Add feedback</option>")
		$aba.append($option);

		for (var inst in feedbacks) {
			for (var action in feedbacks[inst]) {
				var object = feedbacks[inst][action];
				if (instance !== undefined && instance.db !== undefined && instance.db[inst] !== undefined) {
					var $option = $("<option value='"+inst+":"+action+"'>"+ instance.db[inst].label + ": "+object.label+"</option>")
					$aba.append($option);

					/*
						var $li = $("<tr></tr>");
						var $td_id = $("<td></td>");
						var $td_label = $("<td></td>");
						$td_id.text(instance.db[inst].label);
						$td_label.text(feedbacks[n].label);
						$li.append($td_id);
						$li.append($td_label);
						$ali.append($li);
					*/

				}
			}
		}


	})
});
