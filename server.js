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
  var plugin = new plugins.Plugin('First blood', 'Try for the first time', 'blood');
  plugin.on('choose', function(data, plugins) {
    plugins.emit('apply', plugin);
  });
  serverState.plugins.push(plugin);
})();

(function() {
  var plugin = new plugins.Plugin('Too late', 'Choice has been made too late', 'clock');
  plugin.on('toolate', function(data, plugins) {
    plugins.emit('apply', plugin);
  });
  serverState.plugins.push(plugin);
})();

(function() {
  var plugin = new plugins.Plugin('Already chosen', 'Choice is already reserved', 'turtle');
  plugin.on('alreadychosen', function(data, plugins) {
    plugins.emit('apply', plugin);
  });
  serverState.plugins.push(plugin);
})();

(function() {
  var plugin = new plugins.Plugin('Invalid choice', 'Choice is incorrect', 'cheat');
  plugin.on('invalidchoice', function(data, plugins) {
    plugins.emit('apply', plugin);
  });
  serverState.plugins.push(plugin);
})();

(function() {
  var plugin = new plugins.Plugin('Repeat', '3 times the same choice in a row', 'keyboard');
  plugin.on('choose', function(data, plugins) {
    if (!plugins.repeatLastChoice) {
      plugin.repeatNumber = 0;
    }
    if (plugins.repeatLastChoice === data.value) {
      plugin.repeatNumber++;
      if (plugin.repeatNumber === 3) {
        plugins.emit('apply', plugin);
      }
    } else {
      plugins.repeatLastChoice = data.value;
      plugins.repeatNumber = 1;
    }
  });
  serverState.plugins.push(plugin);
})();

(function() {
  var plugin = new plugins.Plugin('Spectator', '3 times without playing in a row', 'spectator');
  plugin.on('choose', function(data, plugins) {
    plugins.repeatNumber = 0;
  });
  plugin.on('terminateround', function(data, plugins) {
    if (!plugins.repeatNumber) {
      plugins.repeatNumber = 0;
    }
    plugins.repeatNumber++;
    if (plugins.repeatNumber == 3) {
      plugins.emit('apply', plugin);
    }
  });
  serverState.plugins.push(plugin);
})();

(function() {
  var plugin = new plugins.Plugin('Winner', 'Win for the first time', 'winner');
  plugin.on('choose', function(data, plugins) {
    plugins.winnerChosen = data.value;
  });
  plugin.on('terminateround', function(data, plugins) {
    if (plugins.winnerChosen === data.winner) {
      plugins.emit('apply', plugin);
    }
  });
  serverState.plugins.push(plugin);
})();

/**
 * ---EXPRESS
 */

app.listen(process.env.PORT || config.express.port);
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

io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});
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
      console.log("Player " + this.player.id + " leaves");
      io.sockets.emit('playerleave', { player: this.player.id });
      delete serverState.players[this.player.id];
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
        console.log("Player " + serverState.players[data.name].id + " receives badge " + plugin.name);
        socket.emit('newbadge', plugin.toJson());
      });
      
      this.emit('entergame', {
        players: playersForUI(),
        gridsize: config.grid.size,
        timeToChoose: config.grid.timeToChoose
      });
      this.broadcast.emit('newplayer', this.player);
      console.log("Player " + this.player.id + " enters");
      return 'ingame';
    }
  });
  bindEvent(socket, 'choosenumber', 'ingame', function(data) {
    if (serverState.state == 'choosenumber') {
      if ((data.chosen < 0) || (data.chosen >= config.grid.size)) {
        this.plugins.apply('invalidchoice', { value: data.chosen });
      } else if (serverState.grid[data.chosen]) {
        this.plugins.apply('alreadychosen', { value: data.chosen, by: serverState.grid[data.chosen] });
      } else {
        serverState.grid[data.chosen] = socket.player.id;
        io.sockets.emit('playerchosenumber', { player: socket.player.id, value: data.chosen });
        this.plugins.apply('choose', { value: data.chosen });
        console.log("Player " + this.player.id + " chooses " + data.chosen);
      }
    } else {
        this.plugins.apply('toolate', { value: data.chosen });
    }
  });
});

var toAllPlugins = function(event, data) {
  io.sockets.clients().forEach(function(socket) {
    if (socket.plugins) {
      socket.plugins.apply(event, data);
    }
  });
}

/**
 * ---SERVERSIDE
 */

var enterChooseNumber = function() {
  serverState.state = 'choosenumber';
  setTimeout(function() {
    enterClosedBeforeResult();
    io.sockets.emit('closedbeforeresult');
  }, config.grid.timeToChoose);
  console.log("Choices opened");
}
var enterClosedBeforeResult = function() {
  serverState.state = 'closedbeforeresult';
  setTimeout(function() {
    announceResult();
    enterChooseNumber();
  }, config.grid.timeBeforeResult);
  console.log("Choices closed");
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
  console.log("Announce result: " + result);
  io.sockets.emit('terminateround', { winner: result });
  toAllPlugins('terminateround', { winner: result });
}

enterChooseNumber();

console.log("Application started");