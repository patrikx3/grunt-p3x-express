/*
 * grunt-p3x-express
 * https://github.com/ericclemmons/grunt-express-server
 *
 * Copyright (c) 2013 Eric Clemmons
 * Copyright (c) 2017 Patrik Laszlo <alabard@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';
const spawn = require('child_process').spawn;
const process = require('process');
const path = require('path');
const _ = require('lodash');

module.exports = function (grunt, target) {
    if (!process._servers) {
        process._servers = {};
    }

    let backup = null;
    let done = null;
    let server = process._servers[target]; // Store server between live reloads to close/restart express

    let finished = function () {
        if (done) {
            done();
            done = null;
        }
    };
    return {
        start: function start(options) {
            if (server) {
                this.stop(options);

                if (grunt.task.current.flags.stop) {
                    finished();

                    return;
                }
            }

            backup = JSON.parse(JSON.stringify(process.env)); // Clone process.env

            // For some weird reason, on Windows the process.env stringify produces a "Path"
            // member instead of a "PATH" member, and grunt chokes when it can't find PATH.
            if (!backup.PATH) {
                if (backup.Path) {
                    backup.PATH = backup.Path;
                    delete backup.Path;
                }
            }

            grunt.log.writeln('Starting '.cyan + (options.background ? 'background' : 'foreground') + ' Express server');

            done = grunt.task.current.async();

            // Set PORT for new processes
            process.env.PORT = options.port;

            // Set NODE_ENV for new processes
            if (options.node_env) {
                process.env.NODE_ENV = options.node_env;
            }
            if (options.env) {
                process.env = _.merge(process.env, options.env)
            }

            if (options.cmd === 'coffee') {
                grunt.log.writeln('You are using cmd: coffee'.red);
                grunt.log.writeln('coffee does not allow a restart of the server'.red);
                grunt.log.writeln('use opts: ["path/to/your/coffee"] instead'.red);
            }

            // Set debug mode for node-inspector
            // Based on https://github.com/joyent/node/blob/master/src/node.cc#L2903

            let debugFlag = 'debug';
            if (parseInt(process.versions.node.split('.')[0]) > 7) {
                debugFlag = 'inspect';
            }

            if (options.debug === true) {
                options.opts.unshift('--' + debugFlag);
            } else if (!isNaN(parseInt(options.debug, 10))) {
                options.opts.unshift('--' + debugFlag + '=0.0.0.0:' + options.debug);
            } else if (options.breakOnFirstLine === true) {
                options.opts.unshift('--' + debugFlag + '-brk');
            } else if (!isNaN(parseInt(options.breakOnFirstLine, 10))) {
                options.opts.unshift('--' + debugFlag + '-brk=' + options.breakOnFirstLine);
            }

            if ((options.debug || options.breakOnFirstLine) && options.cmd === 'coffee') {
                options.opts.unshift('--nodejs');
            }

            if (options.background) {
                let errtype = process.stderr;

                let spawnOptions = {
                    env: _.merge(process.env, {
                        FORCE_COLOR: true
                    }),
                    stdio: ['inherit'],
//          shell: true,
                    customFds: [0, 1, 2]
                };

                if (options.logs && options.logs.err) {
                    errtype = 'pipe';

                    spawnOptions = {
                        env: process.env,
                        stdio: ['ignore', 'pipe', errtype]
                    }
                }
                const args = options.opts.concat(options.args);

//        console.log(process.argv0)
//        console.log(args)
//        console.log(spawnOptions)
//        process.exit()

                server = process._servers[target] = spawn(process.argv0, args, spawnOptions);

                if (options.debug !== undefined && options.debug !== false) {
                    //server
                }

                if (options.delay) {
                    setTimeout(finished, options.delay);
                }

                if (options.output) {
                    server.stdout.on('data', function (data) {
                        let message = "" + data;
                        let regex = new RegExp(options.output, "gi");
                        if (message.match(regex)) {
                            finished();
                        }
                    });
                    server.stderr.on('data', function (data) {
                        console.error(data.toString());
                    });
                }
                let out = process.stdout;
                if (options.logs) {
                    const fs = require('fs');
                    if (options.logs.out) {
                        out = fs.createWriteStream(path.resolve(options.logs.out), {flags: 'a'});
                    }
                    if (options.logs.err && errtype === 'pipe') {
                        server.stderr.pipe(fs.createWriteStream(path.resolve(options.logs.err), {flags: 'a'}));
                    }
                }
                server.stdout.pipe(out);
                server.on('close', this.stop);
            } else {
                // Server is ran in current process
                server = process._servers[target] = require(options.script);
            }
            process.on('exit', this.stop);
        },

        stop: function stop(options) {
            if (server && server.kill) {
                grunt.log.writeln('Stopping'.red + ' Express server');
                server.removeAllListeners('close');
                if (options.hardStop) {
                    grunt.log.writeln('Using ' + 'SIGKILL'.red);
                    server.kill('SIGKILL');
                } else {
                    server.kill('SIGTERM');
                }
                process.removeListener('exit', finished);
                process.removeListener('exit', stop);
                server = process._servers[target] = null;
            }

            // Restore original process.env
            if (backup) {
                process.env = JSON.parse(JSON.stringify(backup));
            }

            finished();
        }
    };
};
