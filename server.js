var app = require('express').createServer()
var io = require('socket.io').listen(app);

var config = {
  grid: {
    size: 10 //TODO should be 100
  },
  username: {
    maxlength: 20
  }
}

app.listen(8525);
app.set('view engine', 'jade');
app.set('view options', { layout: false });

app.get('/', function(req, res) {
  res.render('index', {
    config: config
  });
});
app.get('/rumble.js', function(req, res) {
  res.sendfile(__dirname + '/rumble.js');
});

var players = {};
io.sockets.on('connection', function(socket) {
  var name = null;
  socket.on('chooseusername', function(data) {
    if (name) {
      return;
    }
    if ((!data['name']) || (data['name'] == 'N/A') || (data['name'].length > 20)) {
      socket.emit('wrongusername', { reason: 'Username is incorrect' });
    } else if (players[data['name']]) {
      socket.emit('wrongusername', { reason: 'Username already in use' });
    } else {
      name = data['name'];
      players[name] = {};
      //TODO send validation
      socket.on('disconnect', function() {
        players[name] = null;
      });
    }
  });
});

// badges = plugins (listen to events) => sound, visual effect, cursor, ...
// * select a cell that has just be chosen by another
// * do not play for n rounds
// * win n rounds in arow
// * play n times the same number
// * send a request that arrives too late at the server
// * all cells filled before you
// * filled the last cell

// hight scores (+ average distance)
// heatmap
// when switching to a new grid, 3D cube effect

// each round should be identified by a unique ID to prevent conflicts/lag

// forbid username N/A
// use a datalist to suggest values to enter in the input
// add spinners
// adapt grid size to number of players