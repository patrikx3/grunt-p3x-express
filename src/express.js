/*
 * grunt-p3x-express
 * https://github.com/ericclemmons/grunt-express-server
 *
 * Copyright (c) 2013 Eric Clemmons
 * Copyright (c) 2017 Patrik Laszlo <alabard@gmail.com>
 * Licensed under the MIT license.
 */
const path = require('path');

module.exports = function(grunt) {

  const servers = {};

  grunt.registerMultiTask('express', 'Start an express web server', function() {
    if (!servers[this.target]) {
      servers[this.target] = require('./lib/server')(grunt, this.target);
    }

    const server  = servers[this.target];
    const action  = this.args.shift() || 'start';
    const options = this.options({
      cmd:              process.argv[0],
      opts:             [ ],
      args:             [ ],
      node_env:         undefined,
      harmony:          false,
      background:       true,
      fallback:         function() { /* Prevent EADDRINUSE from breaking Grunt */ },
      port:             process.env.PORT || 3000,
      delay:            0,
      output:           ".+",
      debug:            false,
      breakOnFirstLine: false,
      logs:             undefined,
      hardStop:         false
    });

    if (options.harmony) {
      options.args.unshift('--harmony');
    }

    options.script = path.resolve(options.script);

    options.args.push(options.script);


    if (!grunt.file.exists(options.script)) {
      grunt.log.error('Could not find server script: ' + options.script);
      return false;
    }

    server[action](options);
  });
};
