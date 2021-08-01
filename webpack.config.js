const path = require('path');

const mainConfig = {
    mode: 'production',
    entry: {
        'drm': './src/drm.js',
        'main': './src/main.js',
  //      'renderer': './src/renderer.js'
    },
    target: 'electron-main',
    externalsPresets:{
        electron: true,
        node: true,
    },
    externals:{
        './drm.js':'commonjs ./drm.js',
  //      'keytar':'commonjs keytar'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'commonjs2',
   },
   module: {
    rules: [
      {
        test: /\.node$/,
        loader: "node-loader",
      },
    ],
  }
};
const rendererConfig = {
    mode: 'production',
    entry: {
        'renderer': './src/renderer.js'
    },
    target: 'electron-renderer',
    externalsPresets:{
        electron: true,
        node: true,
    },
    externals:{
        './drm.js':'commonjs ./drm.js',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'commonjs2',
   },
};

module.exports = [mainConfig,rendererConfig];
