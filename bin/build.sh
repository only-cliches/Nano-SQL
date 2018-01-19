#!/bin/bash

#clean up
rm -rf dist/*.*
rm -rf *.d.ts
rm -rf docs
rm -rf lib
# mkdir docs

echo "Clean Completed..."

#compile web worker
./node_modules/.bin/tsc --removeComments -t "es5" --out "./src/database/adapter-indexedDB-worker.txt" ./src/database/adapter-indexedDB-worker.ts

#type declerations & node build
./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "es5" --rootDir  "./src" --module "commonjs" --outDir "./lib"

echo "Node Build & Type Declarations Completed..."


# compress and move web worker where it's needed
cp src/database/adapter-indexedDB-worker.txt lib/database/adapter-indexedDB-worker.txt
./node_modules/.bin/uglifyjs --compress --mangle toplevel --output lib/database/adapter-indexedDB-worker.txt  -- lib/database/adapter-indexedDB-worker.txt

# Move the web worker TXT file into the JS file to prevent folks from having to setup a custom build environment for the TXT file.
file=$(cat lib/database/adapter-indexedDB-worker.txt);
sed -i "s#require(\"./adapter-indexedDB-worker.txt\")#'${file//&/\\&}'#" lib/database/adapter-indexedDB.js
rm -rf lib/database/*.txt;

echo "Worker Build Completed..."



#browser build
export NODE_ENV=production && ./node_modules/.bin/webpack --display-modules

echo "Browser Build Completed..."

#docs 
#./node_modules/.bin/typedoc --out docs . --target ES5 --exclude node_modules --excludeExternals --excludePrivate
#touch docs/.nojekyll
#echo "Docs Completed..."

#copy from examples into dist folder
yes | cp -rf examples/nano-sql.min.js dist/nano-sql.min.js

echo "Cleaning up..."

rm -rf src/*.js

echo "Build Completed. Size Info:"
echo " "

function size {
    echo $(cat dist/nano-sql.min.js) | gzip -9f | wc -c;
}
echo $(size) bytes;
#echo $(size) Kb, $(($(size) / 50))%;