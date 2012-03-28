var app = require('express').createServer()
var io = require('socket.io').listen(app);

var gridSize = 10;

app.listen(8525);
app.set('view engine', 'jade');
app.set('view options', { layout: false });

app.get('/', function (req, res) {
  res.render('index', {
    size: gridSize
  });
});
app.get('/rumble.js', function (req, res) {
  res.sendfile(__dirname + '/rumble.js');
});

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});

// badges = plugins (listen to events) => sound, visual effect, cursor, ...
// * select a cell that has just be chosen by another
// * do not play for n rounds
// * win n rounds in arow
// * play n times the same number
// * send a request that arrives too late at the server

// hight scores (+ average distance)
// heatmap
// when switching to a new grid, 3D cube effect

// each round should be identified by a unique ID to prevent conflicts/lag