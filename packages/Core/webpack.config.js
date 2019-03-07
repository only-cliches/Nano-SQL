const path = require('path');
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const es5 = process.argv.indexOf("--es5") !== -1;

const options = {
    entry: {
        'nano-sql': [path.join(__dirname, 'src', 'index.ts')],
    },
    output: {
        path: PATHS.build,
        filename: es5 ? '[name].min.es5.js' : '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    externals: [
        // nodeExternals()
    ],
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
                loader: 'ts-loader',
                options: {
                    compilerOptions: es5 ? {} : {
                        target: "ES6"
                    }
                }
            }
        ]
    }
};

module.exports = options;