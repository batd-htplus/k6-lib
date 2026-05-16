const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

function findTestFiles(dir, entryPrefix = '') {
    const entries = {};
    if (!fs.existsSync(dir)) {
        return entries;
    }

    function scan(currentDir, relativePath = '') {
        try {
            const files = fs.readdirSync(currentDir);
            files.forEach((file) => {
                const fullPath = path.join(currentDir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        scan(fullPath, path.join(relativePath, file));
                    } else if (file.endsWith('.test.ts')) {
                        const key = path.join(entryPrefix, relativePath, file.replace(/\.ts$/, '')).replace(/\\/g, '/');
                        entries[key] = fullPath;
                    }
                } catch (err) {
                    console.warn(`Warning: Could not process ${fullPath}: ${err.message}`);
                }
            });
        } catch (err) {
            console.warn(`Warning: Could not read directory ${currentDir}: ${err.message}`);
        }
    }

    scan(dir);
    return entries;
}

const scenariosDir = path.resolve(__dirname, 'src/scenarios');
const workspacesDir = path.resolve(__dirname, 'workspaces');

const entries = {
    ...findTestFiles(scenariosDir, 'scenarios'),
    ...findTestFiles(workspacesDir, 'scenarios'),
};

module.exports = {
    mode: 'development',
    devtool: false,    // k6 (goja) không hỗ trợ eval
    entry: entries,
    target: 'node',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs',
        globalObject: 'this',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: { node: 'current' } }],
                            '@babel/preset-typescript',
                        ],
                    },
                },
            },
            {
                test: /\.json$/,
                type: 'json',
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            '@helper': path.resolve(__dirname, 'src/helper'),
            '@config': path.resolve(__dirname, 'src/config'),
            '@types': path.resolve(__dirname, 'src/types'),
            '@reporter': path.resolve(__dirname, 'src/reporter/index.ts'),
            '@client': path.resolve(__dirname, 'src/client'),
            '@auth': path.resolve(__dirname, 'src/auth'),
            '@data': path.resolve(__dirname, 'src/data'),
            '@scenarios': path.resolve(__dirname, 'src/scenarios'),
            '@openapi': path.resolve(__dirname, 'src/openapi'),
            '@htplus/k6-lib': path.resolve(__dirname, 'src/index.ts'),
            '@htplus/k6-lib/reporter': path.resolve(__dirname, 'src/reporter/index.ts'),
        },
        fallback: {
            fs: false,
            path: false,
            os: false,
            util: false,
            stream: false,
            buffer: false,
            process: false,
        },
    },
    externals: [
        /^k6(\/.*)?/,
        'fs',
        'path',
        'os',
        'crypto',
        'stream',
        'buffer',
        'util',
    ],
    plugins: [
        new webpack.EnvironmentPlugin({
            NODE_ENV: 'development',
            K6_CLOUD: false,
        }),
        new webpack.DefinePlugin({
            'process.env': JSON.stringify(process.env),
        }),
    ],
};
