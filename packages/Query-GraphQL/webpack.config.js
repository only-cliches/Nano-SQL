const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};

var options = {
    entry: {
        'parser': [path.join(__dirname, "src", 'index.ts')],
    },
    output: {
        path: __dirname,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    externals: {
        // "@nano-sql/core": "nSQL"
    },
    resolve: {
        extensions: ['.js', ".ts"]
    },
    plugins: [],
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {

                }
            }
        ]
    }
};

module.exports = options;