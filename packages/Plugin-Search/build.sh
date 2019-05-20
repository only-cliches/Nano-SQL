#!/bin/bash

tsc;
webpack -p;

function size {
    echo $(cat dist/plugin-fuzzy-search.min.js) | gzip -9f | wc -c;
}
echo $(($(size)/1000)) Kb;
echo "plugin-fuzzy-search.min.js Hash:";
echo "sha256-$(cat dist/plugin-fuzzy-search.min.js | openssl dgst -sha256 -binary | openssl base64 -A)"