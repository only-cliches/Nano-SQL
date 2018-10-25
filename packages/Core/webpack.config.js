const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};
const nodeExternals = require('webpack-node-externals');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const options = {
    entry: {
        'nano-sql': [path.join(__dirname, 'src', 'index.ts')],
    },
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    devServer: {
        historyApiFallback: true,
        inline: false,
        contentBase: "dist",
    },
    watchOptions: {
        aggregateTimeout: 500,
    },
    node: {
        global: false,
        process: false
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    plugins: process.env.NODE_ENV === "production" ? [
        new UglifyJSPlugin({
            uglifyOptions: {
                mangle: {
                    properties: { regex: new RegExp(/^_/) }
                }
            }
        })
    ] : [],
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            }
        ]
    }
};

module.exports = options;