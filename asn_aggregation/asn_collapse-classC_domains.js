'use strict';

/*
 * Collapse. From:
 * {domain -> {asn -> {ip -> #resolutions}}}
 *
 * To:
 * <outprefix>.classC-domain.json :  {classC -> {domain -> #resolutions}}
 * <outprefix>.domain-classC.json :  {domain -> {classC -> #resolutions}}
 */

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');
var progress = require('progressbar-stream');
var getClassC = require('../util/ip_utils.js').getClassC;

if (!process.argv[3]) {
  console.error(chalk.red('Usage: asn_collapse-classC_domains.js <asn-aggregation> <outprefix>'));
  process.exit(1);
}

var inFile = process.argv[2];
var outPrefix = process.argv[3];


function doDomain(into, line) {
  var asn_ip,
    domain;

  try {
    asn_ip = JSON.parse(line);
  } catch (e) {
    return;
  }
  domain = asn_ip.name;

  Object.keys(asn_ip).filter(function (asn) {
    return typeof asn_ip[asn] === 'object' && asn !== 'unknown';
  }).forEach(function (asn) {
    Object.keys(asn_ip[asn]).filter(function (ip) {
      return ip !== 'empty' && ip !== 'undefined';
    }).filter(function (ip) {
      return ip.indexOf(':') < 0;
    }).forEach(function (ip) {
      var classC = getClassC(ip);

      into[classC] = into[classC] || {};
      into[classC][domain] = into[classC][domain] || 0;
      into[classC][domain] += asn_ip[asn][ip];
    });
  });
}

function doAll() {
  var total = fs.statSync(inFile).size || 0,
    into = {};

  console.log(chalk.blue('Starting'));
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(progress({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(doDomain.bind({}, into)))
      .on('end', function () {
        resolve(into);
      })
      .on('error', reject);
  });
}

function flipMap(table) {
  var result = {};

  Object.keys(table).forEach(function (classC) {
    Object.keys(table[classC]).forEach(function (domain) {
      result[domain] = result[domain] || {};
      result[domain][classC] = result[domain][classC] || 0;
      result[domain][classC] += table[classC][domain];
    });
  });

  return result;
}

doAll().then(function (result) {
  fs.writeFileSync(outPrefix + '.classC-domain.json', JSON.stringify(result));
  fs.writeFileSync(outPrefix + '.domain-classC.json', JSON.stringify(flipMap(result)));
});
