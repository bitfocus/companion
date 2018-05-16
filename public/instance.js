$(function() {
	var instance = {};

	socket.emit('instance_get');
	console.log('instance_get');

	socket.on('instance', function(i) {
		instance = i;

		$addInstance = $("#addInstanceContent");
		$addInstance.html("");

		if (instance.module !== undefined) {
			for (var n in instance.module) {
				var im = instance.module[n];
				var $instance = $('<a class="dropdown-item addInstance" data-style="smalltext" data-id="'+im.id+'">'+ im.label +'</a>');
				$instance.click(function() {
					socket.emit('instance_add', $(this).data('id') );
				});
				$addInstance.append($instance)
			}
		}



	});

});
