#!/bin/bash

function run() {
    bold=$(tput bold)
    normal=$(tput sgr0)

    #clean up
    rm -rf dist/*.js
    rm -rf *.d.ts
    rm -rf lib

    echo "${bold}(1/5) Clean Completed...${normal}"

    #type declerations & node build
    ./node_modules/.bin/tsc --stripInternal -d --moduleResolution "node" -t "es5" --rootDir  "./src" --module "commonjs" --outDir "./lib"

    echo "${bold}(2/5) Node Build & Type Declarations Completed...${normal}"

    #browser build
    npm run bundle

    echo "${bold}(3/5) Browser Build Completed...${normal}"

    # Test rollup
    npm run rollup-test
    if [ $? -eq 0 ]; then
        rm nano-sql-rollup.min.js
        echo "${bold}(4/5) Rollup Bundle OK${normal}"
    else
        rm nano-sql-rollup.min.js
        echo "${bold}Rollup Bundle Failed!${normal}"
        return;
    fi


    rm -rf src/*.js
    find ../../ -name ".DS_Store" -delete
    rm lib/cli.d.ts lib/cli.js.map

    echo "${bold}(5/5) Cleaning up...${normal}"

    echo "${bold}Ready For Release. Size Info:${normal}"

    function size {
        echo $(cat dist/nano-sql.min.js) | gzip -9f | wc -c;
    }
    echo $(($(size)/1000)) Kb;
    echo "nano-sql.min.js Hash:";
    echo "sha256-$(cat dist/nano-sql.min.js | openssl dgst -sha256 -binary | openssl base64 -A)"
    echo "nano-sql.min.es5.js Hash:";
    echo "sha256-$(cat dist/nano-sql.min.es5.js | openssl dgst -sha256 -binary | openssl base64 -A)"
}
run