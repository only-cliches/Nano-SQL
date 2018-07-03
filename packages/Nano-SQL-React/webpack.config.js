module.exports = {
    entry: './index.js',
    output: {
      filename: 'nano-sql-react.min.js',
      libraryTarget: 'umd',
      umdNamedDefine: true
    },
    externals: ["react", "nano-sql"],
  };