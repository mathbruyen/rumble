var util = require('util');
var events = require('events');
var fs = require('fs');

function Plugins(plugins) {
  events.EventEmitter.call(this);
  this.plugins = plugins.slice(0);
  var copy = this.plugins;
  this.on('apply', function(plugin) {
    var idx = copy.indexOf(plugin);
    if (idx >= 0) {
      copy.splice(idx, 1);
    }
  });
}
util.inherits(Plugins, events.EventEmitter);
Plugins.prototype.apply = function(event, data) {
  var list = this;
  this.plugins.forEach(function(plugin) {
    plugin.emit(event, data, list);
  });
}

function Plugin(name, comment, image) {
  events.EventEmitter.call(this);
  this.name = name;
  this.comment = comment;
  this.image = fs.readFileSync('./plugindata/' + image + '.png').toString('base64');
}
util.inherits(Plugin, events.EventEmitter);
Plugin.prototype.toJson = function() {
  return {
    name: this.name,
    comment: this.comment,
    image: this.image
  };
}

module.exports = {
  Plugins: Plugins,
  Plugin: Plugin
};
