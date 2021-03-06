// (KarpovR) Derived from riot-admin
// The ability to split single-page application (SPA) into loosely-coupled modules

var veda = {};

;(function (veda) { "use strict";
	veda.Module = riot.observable(function(arg) {
		
		// veda.Module(fn) --> add a new module
		if (typeof arg == 'function') {

			veda.Module.on("ready", arg);

		// veda.Module(conf) --> initialize the application
		} else {

			veda.AppModel.call(veda, arg);
			
			//veda.RegisterModule(veda, veda);
			
			veda.on("ready", function() {
				veda.Module.trigger("ready", veda);
			});

			veda.trigger("ready");

		}

	});
	
})(veda);
