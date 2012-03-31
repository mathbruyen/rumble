function Workflow() {
  this.nodes = [];
}

function WorkflowInstance(workflow, state) {
  this.workflow = workflow;
  this.state = state;
}

Workflow.prototype.instance = function(state) {
  return new WorkflowInstance(this, state);
}

Workflow.prototype.setNode = function(state, event, callback) {
  this.nodes.push({
    state: state,
    event: event,
    callback: callback
  });
}

WorkflowInstance.prototype.listen = function(eventer) {
  var scope = this;
  var setState = function(newState) {
    if (newState) {
      scope.state = newState;
    }
  }
  this.workflow.nodes.forEach(function (node) {
    eventer.on(node.event, function(data) {
      if ((node.state == '*') || (scope.state == node.state)) {
        // The original idea was to pass setState as an additional argument so
        // that the state can be changed asynchronously but then concurrent
        // actions on the workflow could be tricky
        setState(node.callback.call(scope, data, eventer));
      }
    });
  });
}

module.exports = function () {
  return new Workflow();
}
