const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};

module.exports = {
    entry: {
        'some-sql': path.join(__dirname, 'src', 'index.ts')
    },
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    devServer: {
        contentBase: "./",
        outputPath: path.join(__dirname, './dist')
    },
    plugins: [
       new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            }
        })
    ],
    module: {
        loaders: [{
            test: /\.ts$/,
            loader: 'ts-loader'
        }]
    },
    watch: true
};