#!/bin/bash

./node_modules/.bin/tsc --stripInternal -d --declarationDir "." -t "ES5" --rootDir "src"
rm src/index.js
export NODE_ENV=production && ./node_modules/.bin/webpack
cp ./dist/some-sql.min.js ./index.js
echo "$(cat index.js)" | gzip -9f | wc -c;