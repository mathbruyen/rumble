
function bindEventer(instance, eventer) {
  for (var event in instance.workflow.nodes[instance.state]) {
    function callback(data) {
      var newState = instance.workflow.nodes[instance.state][event](data, instance.local, instance.workflow.global);
      if (newState) {
        clearEvents(instance);
        instance.state = newState;
        bindEvents(instance);
      } else {
        eventer.once(event, callback);
      }
    };
    eventer.once(event, callback);
    instance.listeners[eventer].push(callback);
  }
}

function clearEvents(instance) {
  for (var eventer in instance.listeners) {
    var events = instance.listeners[eventer];
    for (var i = 0; i < events.length; i++) {
      eventer.removeListener(events[i]);
    }
    instance.listeners[eventer] = [];
  }
}

function bindEvents(instance) {
  for (var eventer in instance.listeners) {
    bindEventer(instance, eventer);
  }
}

function Workflow() {
  this.global = {};
  this.nodes = {};
}

function WorkflowInstance(workflow, state) {
  this.workflow = workflow;
  this.state = state;
  this.local = {};
  this.listeners = {};
}

Workflow.prototype.instance = function(state) {
  return new WorkflowInstance(this, state);
}

Workflow.prototype.setNode = function(state, event, callback) {
  var events = this.nodes[state];
  if (!events) {
    events = {};
    this.nodes[state] = events;
  }
  events[event] = callback;
}

WorkflowInstance.prototype.listen = function(eventer) {
  this.listeners[eventer] = [];
  bindEventer(this, eventer);
}

module.exports = Workflow;