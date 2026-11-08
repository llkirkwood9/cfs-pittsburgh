const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const path = require("path");

const config = getDefaultConfig(__dirname);

// ../shared is the code the app shares with the dashboard, imported as @shared; @host is what that
// code needs from the app. tsconfig.json has the same two aliases for the type checker (and maps
// react and axios there for files under ../shared, which is why Expo's own tsconfig-paths support
// is off in app.json). Metro watches ../shared, and the packages it imports come from the app's
// own node_modules.
const shared = path.resolve(__dirname, "../shared");
const host = path.resolve(__dirname, "src/Lib/Host.ts");
config.watchFolders = [...(config.watchFolders ?? []), shared];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "@host") return { type: "sourceFile", filePath: host };
    if (moduleName.startsWith("@shared/"))
        return context.resolveRequest(context, path.join(shared, moduleName.slice(8)), platform);
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
