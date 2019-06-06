var all_variables;
var all_variablesdata;

$(function() {

	var $variables = $('#variables');

	socket.emit('variable_get_definitions');
	socket.once('variable_get_definitions:result', variables);

	socket.on('variable_instance_definitions_set', variables_update);

	var main_variables = '<h4>Available instance dynamic variables</h4>';

	socket.on('variable_set', function (key, value) {
		var match = current_instance + ':';

		instance_variabledata[key] = value;

		$('#instanceConfigVariableList tr[data-id="' + key + '"] > td:nth-child(3)').text(value);
	});

	function get_instance(id) {
		for (var key in instance.module) {
			if (instance.module[key].name == id) {
				return instance.module[key];
			}
		}
	}

	function choose_instance() {
		$variables.prop('view', 'instance');
		$variables.html(main_variables);

		var count = 0;
		for (var key in all_variables) {
			if (instance.db[key] !== undefined) {
				var inst = get_instance(instance.db[key].instance_type);
				if (inst !== undefined) {
					count++;
					$variables.append('<input type="button" class="btn btn-primary choose_instance" data-key="' + key + '" value="' + inst.label + ' (' + instance.db[key].label + ')"><br /><br />');
				}
			}
		}

		if (!count) {
			$variables.append('You have no instances that support dynamic variables at the moment. More and more modules will support variables in the future.');
		}
	}

	function show_variables(id) {
		$variables.prop('view', 'variables');

		var inst = get_instance(instance.db[id].instance_type);
		$variables.html('<button type=button class="btn btn-primary pull-right back_main">Back</button>Back</button><h4>Dynamic variables for ' + inst.label + ' (' + instance.db[id].label + ')</h4>');
		$variables.append('<table class="table table-responsive-sm"><thead><tr><th>Variable</th><th>Description</th><th>Current value</th></tr></thead><tbody id="instanceConfigVariableList"></tbody></table>');

		var $icvl = $('#instanceConfigVariableList');

		for (var key in all_variables[id]) {
			var variable = all_variables[id][key];
			$icvl.append('<tr data-id="' + inst.label + ':' + variable.name + '"><td>$(' + inst.label + ':' + variable.name + ')</td><td>' + variable.label + '</td><td>' + all_variablesdata[inst.label + ':' + variable.name] + '</td></tr>');
		}

		$variables.append('<br style="clear: both;" />');
	}

	function variables(variables) {
		all_variables = variables;

		choose_instance();
	}

	function variables_update(id, variables) {
		all_variables[id] = variables;

		if ($variables.prop('view') == 'instance') {
			choose_instance();
		}
	}

	$('#variables_tab').click(function () {
		choose_instance();
	});

	$variables.on('click', '.back_main', function () {
		choose_instance();
	});

	$variables.on('click', '.choose_instance', function () {
		show_variables($(this).data('key'));
	});
});
