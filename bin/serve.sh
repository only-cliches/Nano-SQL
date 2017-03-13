#!/bin/bash

export NODE_ENV=development && ./node_modules/.bin/webpack
yes | cp -rf dist/nano-sql.min.js examples/nano-sql.min.js
http-server examples

#export NODE_ENV=development && ./node_modules/.bin/webpack-dev-server