#!/bin/bash

./node_modules/.bin/tsc
cp dist/index.js index.js
./node_modules/.bin/webpack --output-library-target 'commonjs2' index.js index.js
cd dist
./../node_modules/.bin/webpack -p --output-library-target 'umd' index.js some-sql.min.js
rm index.js
./../node_modules/.bin/uglifyjs -o some-sql.min.js some-sql.min.js
echo "$(cat some-sql.min.js)" | gzip -9f | wc -c;