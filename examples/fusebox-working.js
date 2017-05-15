const { FuseBox, UglifyJSPlugin } = require("fuse-box");
const fuse = FuseBox.init({
    homeDir: "src",
    natives: {
        process: false,
        stream: false,
        Buffer: false,
        http: false
    },
    plugins: [UglifyJSPlugin({
        compress: {
            warnings: false,
            passes: 5
        },
        mangle: {
            props: { regex: new RegExp(/^_|Promise/) }
        }
    })],
    output: "dist/$name.js",
});
fuse.bundle("app")
    .instructions(`>index.ts`);

fuse.run();