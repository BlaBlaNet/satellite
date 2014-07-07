//Runs a bunch of overlapping zmap scans.
var fs = require('fs');
var Q = require('q');
var spawn = require('child_process').spawn;
var pkt = require('./mkpkt');

var threads = fs.readdirSync('hosts');

var run = function(run, host, domain) {
  var deferred = Q.defer();
  var probe = domain + '.pkt';
  pkt.make(domain, probe);
  var zmap = spawn('zmap', [
      '-p', '53',
      '-o', 'runs/' + run + '/' + domain + '.csv',
      '-b', 'blacklist.conf',
      '-w', host,
      '-c', 300,
      '-r', 50000,
      '--output-module=csv',
      '-f', 'saddr,timestamp-str,data',
      '--output-filter="success = 1 && repeat = 0"',
      '-M', 'udp',
      '--probe-args=file:' + probe
    ], {
      stdio: ['ignore', 'pipe', process.stderr]
    });

  zmap.stdout.on('data', function (data) {
    if (data.indexOf("zmap: completed") >= 0) {
      deferred.resolve();
    }
    console.log(data);
  });
  zmap.on('close', function() {
    deferred.resolve();
  });

  // Clean up.
  deferred.promise.then(function() {
    fs.unlinkSync(probe);
  });
  return deferred.promise;
}

var hosts = fs.readFileSync('domains.txt').toString().split('\n');
var thread = 0;
var doNext = function() {
  if (!hosts.length) {
    process.exit(0);
  }
  var host = hosts.shift();
  run(process.argv[2], 'hosts/' + threads[thread], host).then(doNext);
  thread = thread++;
  if (thread == threads.length) {
    thread = 0;
  }
};

doNext();
