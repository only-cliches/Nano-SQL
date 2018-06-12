#!/bin/bash

#clean up
rm -rf dist/*.*
rm -rf *.d.ts
rm -rf docs
rm -rf lib
mkdir docs

echo "(1/5) Clean Completed..."

#compile web worker
#./node_modules/.bin/tsc --removeComments -t "es5" --out "./src/database/adapter-indexedDB-worker.txt" ./src/database/adapter-indexedDB-worker.ts
#compress web worker
#./node_modules/.bin/uglifyjs --compress --mangle toplevel --output src/database/adapter-indexedDB-worker.txt  -- src/database/adapter-indexedDB-worker.txt

#echo "(2/6) Worker Build Completed..."

#type declerations & node build
./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "es5" --rootDir  "./src" --module "commonjs" --outDir "./lib"

echo "(2/5) Node Build & Type Declarations Completed..."

# Move the web worker TXT file into the JS file to prevent folks from having to setup a custom build environment for the TXT file.
#file=$(cat src/database/adapter-indexedDB-worker.txt);
#sed -i "s#require(\"./adapter-indexedDB-worker.txt\")#'${file//&/\\&}'#" lib/database/adapter-indexedDB.js
#rm -rf lib/database/*.txt;


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
#echo $(size) Kb, $(($(size) / 50))%;