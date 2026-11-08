const path = require("path");
const nodeResolver = require("eslint-import-resolver-node");

/**
 * Lets eslint-plugin-import follow the two aliases Metro and tsconfig.json know about: @shared/*
 * (../shared, the code shared with the dashboard) and @host (src/Lib/Host.ts).
 */
const shared = path.resolve(__dirname, "../shared");
const host = path.resolve(__dirname, "src/Lib/Host.ts");
const options = { extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts", ".web.ts", ".web.tsx", ".json"] };

module.exports = {
    interfaceVersion: 2,
    resolve(source, file) {
        if (source === "@host") return { found: true, path: host };
        if (source.startsWith("@shared/"))
            return nodeResolver.resolve(path.join(shared, source.slice(8)), file, options);
        // Files under ../shared import packages from the app's node_modules, as Metro does.
        const found = nodeResolver.resolve(source, file, options);
        if (found.found || !file.startsWith(shared)) return found;
        return nodeResolver.resolve(source, path.join(__dirname, "index.js"), options);
    },
};
