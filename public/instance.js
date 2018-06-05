var instance = {};
var instance_status = {};

$(function() {
	var iconfig = {};

	var debug = console.log;
	$("#instanceConfigTab").hide();

	socket.emit('instance_get');
	console.log('instance_get');
	socket.emit('instance_status_get');

	function updateInstanceStatus() {
		for (var x in instance_status) {
			var s = instance_status[x];

			// ok
			if (s[0] === 0) {
				$("#instance_status_"+x).html('OK').removeClass('instance-status-error').removeClass('instance-status-warn').addClass('instance-status-ok')
			}

			// warning
			else if (s[0] === 1) {
				$("#instance_status_"+x).html(""+s[1]).removeClass('instance-status-ok').removeClass('instance-status-error').addClass('instance-status-warn')
			}

			// error
			else if (s[0] === 2) {
				$("#instance_status_"+x).html(""+s[2]).removeClass('instance-status-ok').removeClass('instance-status-warn').addClass('instance-status-error')
			}

		}
		console.log("updstat<<<<", instance_status);
	}

	socket.on('instance_status', function(obj) {
		instance_status = obj;
		updateInstanceStatus();
	});

	function updateInstanceList(list, dontclear) {
		var $il = $("#instanceList");
		if (!dontclear) $il.html("");

		for (var n in list) {
			var i = list[n];

			var $tr = $("<tr></tr>");

			var $td_id = $("<td></td>");
			var $td_label = $("<td id='label_"+n+"'>label</td>");
			var $td_status = $("<td id='instance_status_"+n+"'>no status</td>");
			var $td_actions = $("<td></td>");

			var $button_edit = $("<button type='button' data-id='"+n+"' class='instance-edit btn btn-primary'>edit</button>");
			var $button_delete = $("<button type='button' data-id='"+n+"' class='instance-delete btn btn-sm btn-ghost-danger'>delete</button>");

			$td_actions.append($button_delete)
			$td_actions.append($("<span>&nbsp;</span>"));
			$td_actions.append($button_edit);

			$button_delete.click(function() {
				if (confirm('Delete instance?')) {
					var id = $(this).data('id');
					$("#instanceConfigTab").hide();
					console.log("instance-delete:",id);
					socket.emit('instance_delete', id);
					$(this).parent().parent().remove();
				}
			});

			$button_edit.click(function() {
				var id = $(this).data('id');
				console.log("instance-edit:",id);
				socket.emit('instance_edit', id);
			});

			for (var x in instance.module) {
				if (instance.module[x].id == list[n].instance_type) {
					$td_id.text(instance.module[x].label);
				}
			}


			if (list[n].label !== undefined) {
				$td_label.text(list[n].label);
			}

			$tr.append($td_id);
			$tr.append($td_label);
			$tr.append($td_status);
			$tr.append($td_actions);

			$il.append($tr);

		}
		updateInstanceStatus();
	};

	socket.on('instance', function(i) {
		instance = i;

		updateInstanceList(i.db);
		console.log('instance', i);

		$addInstance = $("#addInstanceContent");
		$addInstance.html("");

		if (instance.module !== undefined) {
			for (var n in instance.module) {
				var im = instance.module[n];
				var $instance = $('<a class="dropdown-item addInstance" data-style="smalltext" data-id="'+im.id+'">'+ im.label +'</a>');

				$instance.click(function() {
					socket.emit('instance_add', $(this).data('id') );
					console.log('instance_add()');
					socket.once('instance_add:result', function(id,db) {
						instance.db = db;
						console.log("instance_add:result()", id,db);
						socket.emit('instance_edit', id);
					});
				});

				$addInstance.append($instance)
			}
		}
	});

	socket.on('instance_db_update', function(db) {
		instance.db = db;
	});

	socket.on('instance_edit:result', function(id, store, res, config ) {
		$('#instanceConfigTab').show();
		$('#instanceConfigTab a[href="#instanceConfig"]').tab('show');

		for (var n in store.module) {
			if (store.module[n].id === store.db[id].instance_type) {
				$('#instanceConfig h4').text( store.module[n].label + ' configuration');
			}
		}
		console.log(store,res,config);

		iconfig = config;

		var $icf = $("#instanceConfigFields");
		$icf.html("");

		for (var n in res) {
			var field = res[n];
			if (field.regex){
				var flags = field.regex.replace(/.*\/([gimy]*)$/, '$1');
				var pattern = field.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
				var regex = new RegExp(pattern, flags);
			}
			var $sm = $('<div class="col-sm-'+field.width+'"><label>'+field.label+'</label></div>')
			if (field.type == 'textinput') {
				var $inp = $("<input type='text' class='form-control instanceConfigField' data-type='"+field.type+"' data-id='"+field.id+"'>");
				(function(f1,f2,inp,reg) {
					inp.keyup(function(){
						if (f2 == 'label') {
							$("#label_"+ f1).text(inp.val());
						}
							console.log("edited:", field.label, " f1 ", f1, " f2 ", f2, " reg ", reg);
							if (inp.val().match(reg) != null) {
								this.style.color = "black";
							} else {
								this.style.color = "red";
							}

						socket.emit('instance_config_set', f1, f2, inp.val() );
					});
				})(id,field.id,$inp,regex);
				$sm.append($inp);
			}
			else {
				console.log("FIELD:" ,field);
			}
			$icf.append($sm);
		}

		$(".instanceConfigField").each(function() {

			var key = $(this).data('id');

			if (config[key] !== undefined) {
				$(this).val(config[key]);
			}

		});


		updateInstanceList(store.db);
	});

	socket.on('instance_get:result', function(instance_list) {
		console.log('instance_get:result:', instance_list);

		for (var n in instance_list.db) {
			var instance = instance_list.db[n];
			console.log("Xinstance", instance);
		}


	});

	socket.on('config_fields:result', function(id, fields, config) {
		socket.emit('instance_get');
		console.log("config_fields:result", id, fields, config);
	});

	$(".addInstance").click(function() {
		socket.emit('instance_add', $(this).data('id'));
		$("#elgbuttons").click();
	});

});
