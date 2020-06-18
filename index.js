var Noble = require('./lib/noble');

function isSlaveProcess() {

  return (!!process.argv.find((arg) => {
    return arg === "out-of-proc";
  }));
}

var bindings;
if(isSlaveProcess() || process.argv[1].includes("ws-slave")) {
    bindings = require('./lib/resolve-bindings')();
    module.exports = new Noble(bindings);
} else {
    module.exports = null;
}
