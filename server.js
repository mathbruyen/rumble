var app = require('express').createServer();
var io = require('socket.io').listen(app);
var plugins = require('./plugins');

/**
 * ---CONFIGURATION
 */

var config = {
  grid: {
    size: 100,
    timeToChoose: 13000,
    timeBeforeResult: 2000
  },
  username: {
    maxlength: 20
  },
  express: {
    port: 8525
  }
}

/**
 * ---PLAYERMANAGEMENT
 */

var serverState = {
  players: {},
  grid: new Array(config.grid.size),
  state: 'init',
  plugins: []
}

var playersForUI = function() {
  var players = new Array();
  for (var name in serverState.players) {
    players.push(serverState.players[name]);
  }
  return players;
};

/**
 * ---PLUGINS
 */

(function() {
  var plugin = new plugins.Plugin('First blood', 'Try for the first time', 'firsttry');
  plugin.on('choose', function(data, plugins) {
    plugins.emit('apply', plugin);
  });
  serverState.plugins.push(plugin);
})();

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

app.get('/user/:name', function(req, res, next){
  var player = serverState.players[req.params.name];
  if (player) {
    res.send(JSON.stringify(player));
  } else {
    next('User does not exists');
  }
});

app.get('/rumble.js', function(req, res) {
  res.sendfile(__dirname + '/rumble.js');
});
app.get('/rumble.css', function(req, res) {
  res.sendfile(__dirname + '/rumble.css');
});

/**
 * ---WEBSOCKETS
 */

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 1);

var bindEvent = function(socket, event, state, callback) {
  var setState = function(newState) {
    if (newState) {
      socket.state = newState;
    }
  }
  socket.on(event, function(data) {
    if ((state == '*') || (socket.state == state)) {
      // TODO Pass setState as an additional argument so that the state could
      // be changed both synchronously and asynchronously but then concurrent
      // actions on the workflow could be tricky or need something like
      // Connect's next method that locks during the mean time
      setState(callback.call(socket, data));
    }
  });
}

io.sockets.on('connection', function(socket) {
  socket.state = 'init';
  bindEvent(socket, 'disconnect', '*', function(data) {
    if (this.player) {
      delete serverState.players[this.plaplayersForUIyer.id];
    }
  });
  bindEvent(socket, 'chooseusername', 'init', function(data) {
    if ((!data.name) || (data.name == 'N/A') || (data.name.length > 20)) {
      this.emit('wrongusername', { reason: 'Username is incorrect' });
    } else if (serverState.players[data.name]) {
      this.emit('wrongusername', { reason: 'Username already in use' });
    } else {
      serverState.players[data.name] = {
        id: data.name,
        score: 0
      };
      this.player = serverState.players[data.name];
      
      this.plugins = new plugins.Plugins(serverState.plugins);
      this.plugins.on('apply', function(plugin) {
        socket.emit('newbadge', plugin.toJson());
      });
      
      this.emit('entergame', {
        players: playersForUI(),
        gridsize: config.grid.size,
        timeToChoose: config.grid.timeToChoose
      });
      this.broadcast.emit('newplayer', this.player);
      return 'ingame';
    }
  });
  bindEvent(socket, 'choosenumber', 'ingame', function(data) {
    if (serverState.state == 'choosenumber') {
      if ((data.chosen < 0) || (data.chosen >= config.grid.size)) {
        //TODO wrong number
      } else if (serverState.grid[data.chosen]) {
        //TODO already chosen
      } else {
        serverState.grid[data.chosen] = socket.player.id;
        io.sockets.emit('playerchosenumber', { player: socket.player.id, value: data.chosen });
        this.plugins.apply('choose', { value: data.chosen });
      }
    } else {
      //TODO too late
    }
  });
});

/**
 * ---SERVERSIDE
 */

var enterChooseNumber = function() {
  serverState.state = 'choosenumber';
  setTimeout(function() {
    enterClosedBeforeResult();
    io.sockets.emit('closedbeforeresult');
  }, config.grid.timeToChoose);
}
var enterClosedBeforeResult = function() {
  serverState.state = 'closedbeforeresult';
  setTimeout(function() {
    announceResult();
    enterChooseNumber();
  }, config.grid.timeBeforeResult);
}
var announceResult = function() {
  var result = Math.floor(Math.random() * config.grid.size);
  var user = serverState.grid[result];
  if (user) {
    serverState.players[user].score++;
  }
  for (var i = 0; i < config.grid.size; i++) {
    serverState.grid[i] = null;
  }
  io.sockets.emit('terminateround', { winner: result });
}

enterChooseNumber();

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
// * no longer 0
// each round should be identified by a unique ID to prevent conflicts/lag
// use a datalist to suggest values to enter in the input
// add spinners
// adapt grid size to number of players
// add readme
// players with avatars
// about page on the login
// show badges of other players