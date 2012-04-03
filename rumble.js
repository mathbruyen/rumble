$(function() {
  var config = {
    heat: {
      max: 10,
      reduceFactor: 0.91
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
  
  // id(value[0..size[), heat, reservedBy
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
        this.$el.text(this.model.get('reservedBy').id);
      } else {
        this.$el.text(this.model.id + 1);
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
    id: 'cells',
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
  
  // id(name), score
  var Player = Backbone.Model.extend({
    urlRoot: '/players',
    winRound: function() {
      this.set('score', this.get('score') + 1);
    }
  });
  
  var PlayerMiniView = Backbone.View.extend({
    tagName: 'li',
    initialize: function() {
      this.model.bind('change', this.render, this);
    },
    render: function() {
      this.$el.text(this.model.id + ': ' + this.model.get('score'));
      return this;
    }
  });
  
  var PlayerList = Backbone.Collection.extend({
    model: Player,
    comparator: function(player) {
      return (- player.get('score'));
    },
    onName: function(name, callback) {
      var player = this.get(name);
      if (player) {
        callback(player);
      } else {
        player = new Player({ id: name });
        player.fetch({ success: _.bind(function(model) {
          this.add(model);
          callback(model);
        }, this) });
      }
    }
  });
  
  var PlayerListView = Backbone.View.extend({
    tagName: 'ul',
    id: 'players',
    initialize: function() {
      this.model.bind('add', this.render, this);
      this.model.bind('remove', this.render, this);
      this.model.bind('reset', this.render, this);
    },
    render: function() {
      this.$el.empty();
      this.model.each(function(player) {
        this.$el.append(new PlayerMiniView({ model: player }).render().el);
      }, this);
      return this;
    }
  });
  
  // cells, players, playing
  var App = Backbone.Model.extend({
    defaults: {
      playing: false
    },
    initialize: function() {
      this.set('cells', new Grid());
    },
    setSize: function(size) {
      var c = this.get('cells');
      c.reset();
      for (var i = 0; i < size; i++) {
        c.add(new Cell({ id: i }));
      }
    },
    listen: function(socket) {
      this.socket = socket;
      this.socket.on('playerchosenumber', _.bind(function(data) {
        //TODO mesure ping
        this.get('players').onName(data.player, _.bind(function(player) {
          this.get('cells').get(data.value).reserve(player);
        }, this));
      }, this));
      this.socket.on('newplayer', _.bind(function(player) {
        this.get('players').add(player);
      }, this));
      this.socket.on('closedbeforeresult', _.bind(function() {
        this.set('playing', false);
      }, this));
      this.socket.on('terminateround', _.bind(function(data) {
        var cells = this.get('cells');
        var winner = cells.get(data.winner);
        if (winner.has('reservedBy')) {
          winner.get('reservedBy').winRound();
        }
        this.get('cells').clean();
        this.set('playing', true);
        this.get('chronometer').start();
      }, this));
    },
    select: function(value) {
      this.socket.emit('choosenumber', { chosen: value });
      this.set('playing', false);
    }
  });
  
  var Chronometer = Backbone.Model.extend({
    start: function() {
      this.set('end', (new Date((new Date()).getTime() + this.get('duration'))).getTime());
      window.setTimeout(_.bind(function() { this.unset('end'); this.trigger('finish'); }, this), this.get('duration'));
      this.trigger('start');
    },
    running: function() {
      return this.has('end');
    },
    remaining: function() {
      if (this.has('end')) {
        return (this.get('end') - new Date().getTime());
      } else {
        return this.get('duration');
      }
    }
  });
  
  var ChronometerView = Backbone.View.extend({
    id: 'chronometer',
    initialize: function() {
      this.model.on('start', this.startRendering, this);
      this.model.on('finish', this.stopRendering, this);
    },
    render: function() {
      if (this.model.running()) {
        this.$el.text('Time left: ' + this.model.remaining());
      } else {
        this.$el.text('Waiting...');
      }
      return this;
    },
    startRendering: function() {
      var callback = _.bind(this.render, this);
      var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame;
      if (raf) {
        var call = _.bind(function() {
          callback();
          this.rafId = raf(call);
        }, this);
        call();
      } else {
        // Fallback at 30fps
        this.rafId = window.setInterval(callback, 1000 / 30);
      }
    },
    stopRendering: function() {
      if (this.rafId) {
        var caf = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
        if (caf) {
          caf(this.rafId);
        } else {
          window.clearInterval(this.rafId);
        }
        this.rafId = null;
      }
      this.render();
    }
  });
  
  var AppView = Backbone.View.extend({
    initialize: function() {
      this.model.on('change:playing', this.updateButton, this);
    },
    updateButton: function() {
      if (this.button) {
        this.button.prop('disabled', !this.model.get('playing'));
      }
    },
    render: function() {
      this.$el.empty();
      var choosevalue = $('<div />').attr('id', 'choosevalue');
      this.$el.append(choosevalue);
      var input = $('<input />').attr({
        placeholder: 'Enter your choice...',
        required: true
      });
      choosevalue.append(input);
      this.button = $('<button />').text('Select').on('click', _.bind(function() { this.select(input.val() - 1); }, this.model));
      choosevalue.append(this.button);
      this.$el.append(new GridView({ model: this.model.get('cells') }).render().el);
      this.$el.append(new PlayerListView({ model: this.model.get('players') }).render().el);
      this.$el.append(new ChronometerView({ model: this.model.get('chronometer') }).render().el);
      this.updateButton();
      return this;
    }
  });
  
  // The browser keeps the disabled state when refreshing
  $('#enterbutton').prop('disabled', false);
  
  if (window.localStorage) {
    var savedname = window.localStorage.getItem('rumble-username');
    if (savedname) {
      $('#username').val(savedname);
    }
  }
  
  var socket = io.connect();
  $('#enterbutton').click(function() {
    var name = $('#username').val();
    socket.emit('chooseusername', { name: name });
    if (window.localStorage) {
      window.localStorage.setItem('rumble-username', name);
    }
  });
  socket.on('wrongusername', function(data) {
    alert(data.reason);
  });
  socket.on('entergame', function(data) {
    var a = new App({
      players: new PlayerList(data.players),
      chronometer: new Chronometer({ duration: data.timeToChoose })
    });
    a.setSize(data.gridsize);
    a.listen(socket);
    new AppView({ model: a, el: $('#game') }).render();
  });
})