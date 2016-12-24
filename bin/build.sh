#!/bin/bash

rm -rf index.js
./node_modules/.bin/tsc --stripInternal -d --declarationDir "." -t "ES5" --rootDir "src"
mv src/index.js index.js
export NODE_ENV=production && ./node_modules/.bin/webpack
echo "$(cat dist/some-sql.min.js)" | gzip -9f | wc -c;