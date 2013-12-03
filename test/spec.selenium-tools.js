/*jshint expr:true */
require('./helper.setup');
var debug = require('debug')('test:selenium-tools');
var tools = require('../index');
var shell = require('shelljs');
var wd = require('wd');
var async = require('async');

var tmpDir = __dirname + '/../tmp';
var browser;
var server;
var deathEvents = ['SIGTERM', 'SIGINT', 'SIGHUP'];

describe('Selenium Tools', function() {
  it('should exist', function() {
    expect(tools).to.exist;
  });

  before(cleanup);

  after(cleanup);

  describe('Install', function() {
    this.timeout(1000 * 60);

    before(tools.install);
    after(cleanup);

    it('should download selenium jar to tmp directory', function(done) {
      expect(shell.test('-f', tmpDir + '/selenium.jar')).to.be.true;
      done();
    });

    it('should download and unzip Chrome Driver', function(done) {
      expect(shell.test('-f', tmpDir + '/chromedriver')).to.be.true;
      expect(shell.test('-f', tmpDir + '/chrome_driver.zip')).to.be.false;
      done();
    });
  });

  describe('Check', function() {
    before(cleanup);
    after(cleanup);

    it('should exist', function() {
      expect(tools).to.respondTo('check');
    });

    it('should return false if Selenium and Chrome are not installed', function() {
      expect(tools.check()).to.be.false;
    });

    it('should be true if Selenium and Chrome Driver are installed', function(done) {
      tools.install(function() {
        expect(tools.check()).to.be.true;
        done();
      });
    });
  });

  describe('Server', function() {
    before(function () {
      browser = wd.remote();
      deathEvents.forEach(function(signal) {
        process.on(signal, stopServer);
      });
    });

    after(stopServer);

    it('should exist', function() {
      expect(tools).to.have.property('server');
    });

    describe('start', function() {
      it('should exist', function() {
        expect(tools.server).to.respondTo('start');
      });

      it('should error if selenium server is not installed', function(done) {
        tools.server.start(function(err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err).to.have.property('message', 'Please install Selenium server and Chrome driver first');
          done();
        });
      });

      it('should start selenium with chromeDriver', function(done) {
        this.timeout(1000 * 10);
        async.series([
          tools.install,
          function(callback) {
            server = tools.server.start();
            server.once('ready', callback);
          },
          function(callback) {
            var options = {
              browserName: 'chrome',
              chromeOptions: {
                binary: '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary'
              }
            };

            browser.init(options, callback);
          },
          function(callback) {
            browser.get('http://google.com', callback);
          },
          function(callback) {
            browser.quit(callback);
            browser = undefined;
          }
        ], done);
      });

      it('should error if already running', function(done) {
        otherServer = tools.server.start();
        otherServer.once('error', function(err) {
          expect(err).to.exist;
          expect(err).to.be.an.instanceOf(Error);
          expect(err).to.have.property('message', 'Selenium is already running');
          done();
        });
      });
    });

    describe('Stop', function () {
      it('should exist', function() {
        expect(tools.server).to.respondTo('stop');
      });

      it('should stop selenium server', function(done) {
        var cmd = 'ps aux | grep -v grep | grep selenium.jar';
        var running = shell.exec(cmd, {silent:true}).output;
        expect(running.indexOf('selenium.jar') > -1).to.be.true;
        tools.server.stop(function() {
          running = shell.exec(cmd, {silent:true}).output;
          debug('should be stopped', running);
          expect(running.indexOf('selenium.jar') > -1).to.be.false;
          done();
        });
      });
    });
  });

});

function cleanup(cb) {
  shell.rm('-Rf', [tmpDir]);
  if (cb) {
    cb();
  }
}

function stopServer(cb) {
  server && server.kill();
  browser && browser.quit();
  deathEvents.forEach(function(signal) {
    process.removeListener(signal, stopServer);
  });

  if (cb) {
    cb();
  }
}
