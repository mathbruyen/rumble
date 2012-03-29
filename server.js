var app = require('express').createServer()
var io = require('socket.io').listen(app);

/**
 * ---CONFIGURATION
 */
var config = {
  grid: {
    size: 100
  },
  username: {
    maxlength: 20
  },
  express: {
    port: 8525
  }
}

/**
 * ---EXTENSIONS
 */
Array.prototype.contains = function(array, value) {
  var s = array.length;
  for (var i = 0; i < s; i++) {
    if (array[i] === value) {
      return true;
    }
  }
  return false;
}

/**
 * ---PLAYERMANAGEMENT
 */
var players = [];
var registerPlayer = function(name) {
  if ((!name) || (name == 'N/A') || (name.length > 20)) {
    return 'Username is incorrect';
  } else if (players.contains(name)) {
    return 'Username already in use';
  } else {
    players.push(name);
    return null;
  }
}
var listPlayers = function() {
  return players;
}

/**
 * ---EXPRESS
 */
app.listen(config.express.port);
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

/**
 * ---WEBSOCKETS
 */
io.sockets.on('connection', function(socket) {
  var name = null;
  socket.on('chooseusername', function(data) {
    if (name) {
      return;
    }
    error = registerPlayer(data.name);
    if (error) {
      socket.emit('wrongusername', { reason: error });
    } else {
      name = data.name;
      socket.emit('entergame', { players: listPlayers(), gridsize: config.grid.size });
      
      socket.on('disconnect', function() {
        players[name] = null;
      });
    }
  });
});

/**
 * ---TODOS
 */
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

// use a datalist to suggest values to enter in the input
// add spinners
// adapt grid size to number of players
// list players and their score