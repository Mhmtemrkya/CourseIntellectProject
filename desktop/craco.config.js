// craco.config.js
const Module = require("module");
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

if (!isDevServer) {
  const originalLoad = Module._load;
  const NoopWebpackPlugin = class {
    apply() {}
  };
  const ESLintWebpackPlugin = class ESLintWebpackPlugin {
    apply() {}
  };
  const ReactRefreshWebpackPlugin = class ReactRefreshWebpackPlugin {
    apply() {}
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (
      request === "workbox-webpack-plugin" ||
      request === "eslint-webpack-plugin" ||
      request === "@pmmmwh/react-refresh-webpack-plugin" ||
      request === "react-dev-utils/ForkTsCheckerWebpackPlugin" ||
      request === "react-dev-utils/ForkTsCheckerWarningWebpackPlugin"
    ) {
      if (request === "eslint-webpack-plugin") {
        return ESLintWebpackPlugin;
      }
      if (request === "@pmmmwh/react-refresh-webpack-plugin") {
        return ReactRefreshWebpackPlugin;
      }
      if (request.startsWith("react-dev-utils/ForkTsChecker")) {
        return NoopWebpackPlugin;
      }
      return {
        GenerateSW: NoopWebpackPlugin,
        InjectManifest: NoopWebpackPlugin,
      };
    }
    return originalLoad.apply(this, arguments);
  };
}

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: isDevServer, // Only enable during dev server
};

// Conditionally load visual edits modules only in dev mode
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      if (!isDevServer) {
        webpackConfig.cache = false;
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          minimize: false,
        };
        if (process.env.COURSE_BUILD_PROGRESS === "true") {
          const webpack = require("webpack");
          webpackConfig.plugins.push(
            new webpack.ProgressPlugin((percentage, message, ...details) => {
              const pct = Math.round(percentage * 100);
              const detail = details.filter(Boolean).join(" ");
              console.log(`[webpack] ${pct}% ${message}${detail ? ` ${detail}` : ""}`);
            })
          );
        }
      }

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

// Only add babel metadata plugin during dev server
if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  devServerConfig.host = process.env.HOST || "0.0.0.0";
  devServerConfig.allowedHosts = ["127.0.0.1", "localhost"];
  // webpack-dev-server 5 dizi tabanlı proxy şeması ister (obje şeması kalktı).
  devServerConfig.proxy = [
    {
      context: ["/api"],
      target: "http://127.0.0.1:5199",
      changeOrigin: true,
      secure: false,
    },
  ];

  // webpack-dev-server 5 adaptörü: react-scripts 5 config'i wds4 şemasıyla
  // üretir; kaldırılan seçenekler v5 karşılıklarına çevrilir.
  const httpsConfig = devServerConfig.https;
  delete devServerConfig.https;
  if (httpsConfig) {
    devServerConfig.server = httpsConfig === true
      ? "https"
      : { type: "https", options: httpsConfig };
  }
  const onBefore = devServerConfig.onBeforeSetupMiddleware;
  const onAfter = devServerConfig.onAfterSetupMiddleware;
  delete devServerConfig.onBeforeSetupMiddleware;
  delete devServerConfig.onAfterSetupMiddleware;
  if (onBefore || onAfter) {
    const previousSetup = devServerConfig.setupMiddlewares;
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (onBefore) onBefore(devServer);
      if (previousSetup) middlewares = previousSetup(middlewares, devServer);
      if (onAfter) onAfter(devServer);
      return middlewares;
    };
  }

  // Apply visual edits dev server setup only if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
