$(function() {
  _.mixin({
    groupN: function(array, size) {
      var res = new Array(Math.ceil(_(array).size() / size));
      //TODO
      return _(res);
    }
  });
  var Cell = Backbone.Model.extend({
    // reserved by - heat
    clean: function() {
      //TODO
    }
  });
  
  var CellView = Backbone.View.extend({
    tagName: 'td',
    render: function() {
      this.$el.text('o');
      return this;
    }
  });
  
  var Grid = Backbone.Collection.extend({
    model: Cell,
    initialize: function(options) {
      for (var i = 0; i < options.size * options.size; i++) {
        this.add(new Cell());
      }
      this.byRow = _.groupN(this, options.size);
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
      });
    }
  });
  
  var g = new Grid({
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