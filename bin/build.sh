#!/bin/bash

#clean up
rm -rf dist/*.*
rm -rf *.d.ts
rm -rf docs
rm -rf node
mkdir docs

echo "Clean Completed..."

#type declerations & node build
./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "ES5" --rootDir  "./src" -module "commonjs" --outDir "./node" src/index.ts

echo "Node Build & Type Declarations Completed..."

#browser build
export NODE_ENV=production && ./node_modules/.bin/webpack

echo "Browser Build Completed..."

#docs 
./node_modules/.bin/typedoc --out docs . --target ES5 --exclude memory-db.ts --excludeExternals --excludePrivate
touch docs/.nojekyll

echo "Docs Completed..."

#examples
yes | cp -rf dist/some-sql.min.js examples/some-sql.min.js

echo "Cleaning up..."

rm -rf src/*.js

echo "Build Completed. Size Info:"
echo " "

function size {
    echo $(cat dist/some-sql.min.js) | gzip -9f | wc -c;
}
echo $(size) Kb;
#echo $(size) Kb, $(($(size) / 50))%;