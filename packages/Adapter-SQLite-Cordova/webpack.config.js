const path = require('path');

var options = {
    entry: {
        plugin: [path.join(__dirname, 'src', 'sqlite-adapter.ts')],
    },
    output: {
        path: path.join(__dirname),
        filename: '[name].js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.js', '.ts', '.tsx', '.scss', ".css", ".jsx"]
    },
    plugins: [

    ],
    module: {
        rules: [
            {
                test: /\.ts$|\.tsx$/,
                loader: 'ts-loader',
                options: {
                    configFile: "tsconfig.wp.json"
                }
            }
        ]
    }
};

module.exports = options;