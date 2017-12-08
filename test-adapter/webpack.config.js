const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname)
};

var options = {
    entry: {
        'test': [path.join(__dirname, 'test.ts')]
    },
    watch: false,
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    plugins: [],
    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            },
            {
                test: /\.txt$/,
                use: [
                    {
                        loader: 'raw-loader'
                    },
                    {
                        loader: 'uglify-loader',
                        options: {
                            compress: {
                                warnings: false,
                                passes: 2
                            },
                            mangle: {
                                toplevel: true
                            }
                        }
                    }
                ]
            },
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