#!/bin/bash

function run() {
    bold=$(tput bold)
    normal=$(tput sgr0)

    npm run lint
    if [ $? -eq 0 ]; then
        echo "${bold}(1/8) Linting Passed${normal}"
    else
        echo "${bold}Lint failed!${normal}"
        return;
    fi

    npm run test
    if [ $? -eq 0 ]; then
        echo "${bold}(2/8) Tests Passed${normal}"
    else
        echo "${bold}Test Failed!${normal}"
        return;
    fi

    #clean up
    rm -rf dist/*.js
    rm -rf *.d.ts
    rm -rf docs
    rm -rf lib
    mkdir docs

    echo "${bold}(3/8) Clean Completed...${normal}"

    #type declerations & node build
    ./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "es5" --rootDir  "./src" --module "commonjs" --outDir "./lib"

    echo "${bold}(4/8) Node Build & Type Declarations Completed...${normal}"

    #browser build
    npm run bundle

    echo "${bold}(5/8) Browser Build Completed...${normal}"

    # Test rollup
    npm run rollup-test
    if [ $? -eq 0 ]; then
        rm nano-sql-rollup.min.js
        echo "${bold}(6/8) Rollup Bundle OK${normal}"
    else
        rm nano-sql-rollup.min.js
        echo "${bold}Rollup Bundle Failed!${normal}"
        return;
    fi

    #docs 
    ./node_modules/.bin/typedoc --out docs --includes src --target ES6 --exclude node_modules --excludeExternals --excludePrivate
    touch docs/.nojekyll
    echo "${bold}(7/8) Docs Completed...${normal}"

    #copy from examples into dist folder
    #yes | cp -rf examples/nano-sql.min.js dist/nano-sql.min.js
    rm -rf src/*.js

    echo "${bold}(8/8) Cleaning up...${normal}"

    echo "${bold}Ready For Release. Size Info:${normal}"

    function size {
        echo $(cat dist/nano-sql.min.js) | gzip -9f | wc -c;
    }
    echo $(($(size)/1000)) Kb;
}
run