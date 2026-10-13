const webpack = require("webpack");

module.exports = {
  webpack: {
    plugins: {
      add: [
        new webpack.ProvidePlugin({
          process: "process/browser",
          Buffer: ["buffer", "Buffer"],
        }),
      ],
    },
    configure: (config) => {
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:process": require.resolve("process/browser"),
        "node:buffer": require.resolve("buffer/"),
        "node:util": require.resolve("util/"),
        "node:stream": require.resolve("stream-browserify"),
        "node:crypto": require.resolve("crypto-browserify"),
        "node:path": require.resolve("path-browserify"),
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        process: require.resolve("process/browser"),
        buffer: require.resolve("buffer/"),
        stream: require.resolve("stream-browserify"),
        util: require.resolve("util/"),
        crypto: require.resolve("crypto-browserify"),
        path: require.resolve("path-browserify"),
      };
      return config;
    },
  },
};



