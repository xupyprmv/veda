// Veda application Model

"use strict";

var veda = new (function AppModel() {
	var self = $.observable(this);
	self._id = "veda";
	self._name = "veda";
	self._path = undefined;
	self._parent = null;
	self._register = function(new_module) { 
		veda[new_module._name] = new_module;
	};

	var user_uri, ticket, end_time;
	Object.defineProperty(self, "user_uri", {
		get: function() { return user_uri; },
		set: function(value) { if (compare(user_uri, value)) return; user_uri = value; self.trigger("set", "user_uri", value); }
    });
	Object.defineProperty(self, "ticket", {
		get: function() { return ticket; },
		set: function(value) { if (compare(ticket, value)) return; ticket = value; self.trigger("set", "ticket", value); }
    });
	Object.defineProperty(self, "end_time", {
		get: function() { return end_time; },
		set: function(value) { if (compare(end_time, value)) return; end_time = value; self.trigger("set", "end_time", value); }
    });
	if (typeof console != undefined) self.on("set", function(property, value){ console.log("property set:", property, "=", value) });
	
	self.login = function (username, password) {
		var res = authenticate(username, password);
		self.ticket = res.id;
		self.user_uri = res.user_uri;
		self.end_time = res.end_time;
		self.trigger("login");
	};
	self.logout = function() {
		self.ticket = "";
	};
	self.on("login", function() { 
		veda.RegisterModule( new veda.DocumentModel(self.user_uri), self, "user");
	});
	return self;
})();