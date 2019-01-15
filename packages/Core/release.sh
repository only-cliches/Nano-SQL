#!/bin/bash

function run() {
    bold=$(tput bold)
    normal=$(tput sgr0)

    #clean up
    rm -rf dist/*.js
    rm -rf *.d.ts
    rm -rf api
    rm -rf lib
    mkdir api

    echo "${bold}(1/6) Clean Completed...${normal}"

    #type declerations & node build
    ./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "es5" --rootDir  "./src" --module "commonjs" --outDir "./lib"

    echo "${bold}(2/6) Node Build & Type Declarations Completed...${normal}"

    #browser build
    npm run bundle

    echo "${bold}(3/6) Browser Build Completed...${normal}"

    # Test rollup
    npm run rollup-test
    if [ $? -eq 0 ]; then
        rm nano-sql-rollup.min.js
        echo "${bold}(4/6) Rollup Bundle OK${normal}"
    else
        rm nano-sql-rollup.min.js
        echo "${bold}Rollup Bundle Failed!${normal}"
        return;
    fi

    #api docs
    ./node_modules/.bin/typedoc --out api --includes src --target ES6 --exclude node_modules --excludeExternals --excludePrivate
    touch api/.nojekyll
    echo "${bold}(5/6) API Docs Completed...${normal}"

    #copy from examples into dist folder
    #yes | cp -rf examples/nano-sql.min.js dist/nano-sql.min.js
    rm -rf src/*.js
    find ../../ -name ".DS_Store" -delete

    echo "${bold}(6/6) Cleaning up...${normal}"

    echo "${bold}Ready For Release. Size Info:${normal}"

    function size {
        echo $(cat dist/nano-sql.min.js) | gzip -9f | wc -c;
    }
    echo $(($(size)/1000)) Kb;
}
run