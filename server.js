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
 * ---WORKFLOW
 */
var workflow = new require('./workflow')();

workflow.players = {};
workflow.grid = new Array(config.grid.size);

var playersForUI = function() {
  var players = new Array();
  for (var name in workflow.players) {
    players.push({
      name: name,
      score: workflow.players[name].score
    });
  }
  return players;
}

workflow.setNode('init', 'chooseusername', function(data) {
  if ((!data.name) || (data.name == 'N/A') || (data.name.length > 20)) {
    this.socket.emit('wrongusername', { reason: 'Username is incorrect' });
  } else if (workflow.players[data.name]) {
    this.socket.emit('wrongusername', { reason: 'Username already in use' });
  } else {
    this.workflow.players[data.name] = {
      score: 0
    };
    this.player = this.workflow.players[data.name];
    this.username = data.name;
    this.socket.emit('entergame', {
      players: playersForUI(),
      gridsize: config.grid.size
    });
    return 'choosenumber';
  }
});
workflow.setNode('*', 'disconnect', function(data, local, global) {
  if (this.username) {
    delete this.workflow.players[this.username];
  }
  delete this.socket;
  //TODO clean grid entry
  //TODO notify players
});

/**
 * ---EXPRESS
 */
var app = require('express').createServer()

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
var io = require('socket.io').listen(app);

io.sockets.on('connection', function(socket) {
  var f = workflow.instance('init');
  f.socket = socket;
  f.listen(socket);
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
// http://server/#username to prefil username and enter the game directly (+link to change it)

// add readme
// compress messages by giving an id to players and only sending it
