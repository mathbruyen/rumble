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
        this.$el.text('N/A');
      }
      var heat = Math.floor(this.model.get('heat') * 255 / config.heat.max);
      this.$el.css('background-color', 'rgb(' + heat + ',' + (255 - heat) + ', 0)');
      return this;
    }
  });
  
  var Grid = Backbone.Collection.extend({
    model: Cell,
    initialize: function(models, options) {
      for (var i = 0; i < options.size * options.size; i++) {
        this.add(new Cell());
      }
      this.byRow = _.split(this, options.size);
    },
    getCell: function(row, col) {
      return this.at((row * this.options.size) + col);
    },
    getRows: function() {
      return this.byRow;
    },
    clean: function() {
      this.each(function(cell) { cell.clean(); });
    }
  });
  
  var GridView = Backbone.View.extend({
    tagName: 'table',
    render: function() {
      this.$el.empty();
      this.model.getRows().each(function(row) {
        var r = $('<tr>');
        row.each(function(cell) {
          r.append(new CellView({ model: cell }).render().el);
        });
        this.$el.append(r);
      }, this);
      return this;
    }
  });
  
  var g = new Grid(null, {
    size: $('#game').data('gridSize')
  });
  var v = new GridView({model: g});
  $('#game').append(v.render().el);
  
  var socket = io.connect('http://localhost');
  socket.on('news', function (data) {
    console.log(data);
    socket.emit('my other event', { my: 'data' });
  });
})