// scanner: this guy continuously scans for new bluetooth things to connect to.
//          why? near as I can tell, a single process can't use bluetooth-hci-socket to scan AND communicate at the same time
//          but I can make another process that just scans continuously, and sends the intel over to the ws-slave process.
//          then when a connected context asks ws-slave to scan, ws-slave will just start forwarding all the stuff that this
//          process is digging up.


var noble = require('./index');
var WebSocket = require('ws');

var g_scanSocket;
let g_fMoreScanningRequested = true;

let recentlySeen = {};


noble.on('discover', function (peripheral) {

  if(!peripheral || 
     !peripheral.advertisement ||
     !peripheral.advertisement.localName) {
    return;
  }
  const myCopy = Object.assign({}, peripheral);
  delete myCopy._noble;
  const key = peripheral.advertisement.localName;
  const tmNow = new Date().getTime();
  recentlySeen[key] = {
    tmNow,
    peripheral: myCopy,
  }
  

  const keysToKill = [];
  for(var keyToCheck in recentlySeen) {
    if(recentlySeen[keyToCheck].tmNow < tmNow - 20000) {
      keysToKill.push(keyToCheck);
    }
  }
  keysToKill.forEach((keyToKill) => delete recentlySeen[keyToKill]);

  //console.log("scanproc: discovered");
  if(g_scanSocket) {
    console.log("sending info about ", Object.keys(recentlySeen));

    for(var keyToSend in recentlySeen) {
      g_scanSocket.send(JSON.stringify({
        evt: 'discover',
        data: recentlySeen[keyToSend].peripheral,
      }));
    }
  }
});

function doScanCycle() {
  noble.startScanning(undefined, true, (err) => {
    setTimeout(() => {
      noble.stopScanning();
      if(g_fMoreScanningRequested) {
        doScanCycle();
      }
    }, 10000);
  });
}

noble.on('stateChange', (state) => {
  console.log("scanproc: statechange: ", state);
  if(state === 'poweredOn') {

    // start our websocket connection to the ws-slave process
    const scanPort = 0xb1d;
    const scanSocket = new WebSocket(`ws://localhost:${scanPort}`);
    scanSocket.on('open', () => {
      g_scanSocket = scanSocket;
    });
    scanSocket.on('close', () => {
      // oh uh, we lost our host process
      console.log("Scanner: host process lost");
      process.exit(0);
    })
    scanSocket.on('error', (err) => {
      console.log("Scanner: err: ", err);
      process.exit(0);
    });

    scanSocket.on('message', (msg) => {
      switch(msg) {
        case 'stop':
          g_fMoreScanningRequested = false;
          break;
        case 'start':
          if(!g_fMoreScanningRequested) {
            g_fMoreScanningRequested = true;
            doScanCycle();
          }
          break;
      }
    })

    doScanCycle();
      
  }
})