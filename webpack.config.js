const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};

var options = {
    entry: {
        'nano-sql': [path.join(__dirname, 'src', 'index.ts')]
    },
    watch: false,
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    devServer: {
        contentBase: "./examples"
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    node: {
        console: false,
        global: false,
        process: false,
        Buffer: false,
        setImmediate: false
    },
    plugins: [

    ],
    module: {
        loaders: [{
                test: /\.ts$/,
                loader: 'ts-loader'
            },
            {
                test: /\.ts$/,
                loader: "webpack-strip-block?start=NODE-START&end=NODE-END"
            }
        ]
    }
};

switch (process.env.NODE_ENV) {
    case "production":
        options['plugins'].push(new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
                passes: 5
            },
            mangle: {
                props: { regex: new RegExp(/^_|Promise/) }
            }
        }));
        break;
}

module.exports = options;