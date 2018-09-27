const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};

var options = {
    entry: {
        'parser': [path.join(__dirname, 'parser.js')],
    },
    output: {
        path: __dirname,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.js']
    },
    plugins: [],
};

module.exports = options;