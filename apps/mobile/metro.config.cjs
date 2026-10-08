const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
// Gradle supplies index.ts relative to this app. Shared workspace packages
// remain watched by Expo's default monorepo configuration.
config.server.unstable_serverRoot=__dirname;
config.maxWorkers=2;
module.exports=config;
