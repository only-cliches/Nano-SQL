#!/bin/bash
rm -rf dist/*.*
./node_modules/.bin/tsc --stripInternal -d --declarationDir "." -t "ES5" --rootDir "src"
export NODE_ENV=build && ./node_modules/.bin/webpack
cp dist/some-sql.min.js index.js
export NODE_ENV=production && ./node_modules/.bin/webpack
rm -rf src/*.js
mv dist/some-sql.min.js dist/some-sql.min.0.0.2.js
echo "$(cat dist/some-sql.min.0.0.2.js)" | gzip -9f | wc -c;