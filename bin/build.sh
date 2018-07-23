#!/bin/bash

#clean up
rm -rf dist/*.*
rm -rf *.d.ts
rm -rf docs
rm -rf lib
mkdir docs

echo "(1/5) Clean Completed..."

#type declerations & node build
./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "es5" --rootDir  "./src" --module "commonjs" --outDir "./lib"

echo "(2/5) Node Build & Type Declarations Completed..."

#browser build
export NODE_ENV=production && ./node_modules/.bin/webpack --display-modules

echo "(3/5) Browser Build Completed..."

#docs 
./node_modules/.bin/typedoc --out docs --includes src --target ES6 --exclude node_modules --excludeExternals --excludePrivate
touch docs/.nojekyll
echo "(4/5) Docs Completed..."

#copy from examples into dist folder
yes | cp -rf examples/nano-sql.min.js dist/nano-sql.min.js
rm -rf src/*.js

echo "(5/5) Cleaning up..."

echo "Build Completed. Size Info:"

function size {
    echo $(cat dist/nano-sql.min.js) | gzip -9f | wc -c;
}
echo $(size) bytes;