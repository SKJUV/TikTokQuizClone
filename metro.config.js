const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Liste des répertoires à ignorer (OS-agnostique avec [\/\\\\])
    blockList: [
      /[/\\]android[/\\]\.cxx[/\\].*/,
      /[/\\]android[/\\]build[/\\].*/,
      /[/\\]\.gradle[/\\].*/,
    ]
  }
};

module.exports = mergeConfig(defaultConfig, config);
