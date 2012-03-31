$(function() {
  var config = {
    heat: {
      max: 10,
      reduceFactor: 0.8
    }
  };
  
  _.mixin({
    // Split a large collection in smaller ones of predefined size
    split: function(col, size) {
      var arr = col.toArray();
      var tokens = Math.ceil(col.size() / size);
      var res = new Array(tokens);
      for (var i = 0; i < tokens; i++) {
        res[i] = _(arr.slice(i * size, (i + 1) * size));
      }
      return _(res);
    }
  });
  
  var Cell = Backbone.Model.extend({
    initialize: function() {
      this.set('heat', config.heat.max / 2);
    },
    clean: function() {
      this.set('heat', this.get('heat') * config.heat.reduceFactor);
      this.unset('reservedBy');
    },
    reserve: function(by) {
      this.set('heat', Math.max(config.heat.max, this.get('heat') + 1));
      this.set('reservedBy', by);
    }
  });
  
  var CellView = Backbone.View.extend({
    tagName: 'td',
    initialize: function() {
      this.model.bind('change', this.render, this);
    },
    render: function() {
      if (this.model.has('reservedBy')) {
        this.$el.text(this.model.get('reservedBy'));
      } else {
        //TODO use built-in id instead of value
        this.$el.text(this.model.get('value'));
      }
      var heat = Math.floor(this.model.get('heat') * 255 / config.heat.max);
      this.$el.css('background-color', 'rgb(' + heat + ',' + (255 - heat) + ', 0)');
      return this;
    }
  });
  
  var Grid = Backbone.Collection.extend({
    model: Cell,
    clean: function() {
      this.each(function(cell) { cell.clean(); });
    }
  });
  
  var GridView = Backbone.View.extend({
    tagName: 'table',
    initialize: function() {
      this.model.bind('add', this.render, this);
      this.model.bind('remove', this.render, this);
      this.model.bind('reset', this.render, this);
    },
    render: function() {
      this.$el.empty();
      var c = Math.ceil(Math.sqrt(this.model.size()));
      if (c > 0) {
        _.split(this.model, c).each(function(row) {
          var r = $('<tr>');
          row.each(function(cell) {
            r.append(new CellView({ model: cell }).render().el);
          });
          this.$el.append(r);
        }, this);
      }
      return this;
    }
  });
  
  var Player = Backbone.Model.extend({
  });
  
  var PlayerMiniView = Backbone.View.extend({
    tagName: 'li',
    initialize: function() {
      this.model.bind('change', this.render, this);
    },
    render: function() {
      this.$el.text(this.model.get('name') + ': ' + this.model.get('score'));
      return this;
    }
  });
  
  var PlayerList = Backbone.Collection.extend({
    model: Player,
    comparator: function(player) {
      return (- player.get('score'));
    }
  });
  
  var PlayerListView = Backbone.View.extend({
    tagName: 'ul',
    initialize: function() {
      this.model.bind('add', this.render, this);
      this.model.bind('remove', this.render, this);
      this.model.bind('reset', this.render, this);
    },
    render: function() {
      this.model.each(function(player) {
        this.$el.append(new PlayerMiniView({ model: player }).render().el);
      }, this);
      return this;
    }
  });
  
  var App = Backbone.Model.extend({
    initialize: function() {
      this.set('cells', new Grid());
    },
    setSize: function(size) {
      var c = this.get('cells');
      c.reset();
      for (var i = 0; i < size; i++) {
        c.add(new Cell({ value: i + 1 }));
      }
    }
  });
  
  var AppView = Backbone.View.extend({
    render: function() {
      this.$el.empty();
      this.$el.append(new GridView({ model: this.model.get('cells') }).render().el);
      this.$el.append(new PlayerListView({ model: this.model.get('players') }).render().el);
      return this;
    }
  });
  
  var socket = io.connect();
  $('#enterbutton').click(function() {
    socket.emit('chooseusername', { name: $('#username').val() });
  });
  socket.on('wrongusername', function(data) {
    alert(data.reason);
  });
  socket.on('entergame', function(data) {
    var a = new App({
      players: new PlayerList(data.players)
    });
    a.setSize(data.gridsize);
    var v = new AppView({ model: a, el: $('#game') });
    v.render();
  });
})