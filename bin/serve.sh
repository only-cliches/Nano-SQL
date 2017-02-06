#!/bin/bash

export NODE_ENV=development && ./node_modules/.bin/webpack
yes | cp -rf dist/some-sql.min.js examples/some-sql.min.js
http-server examples

#export NODE_ENV=development && ./node_modules/.bin/webpack-dev-server