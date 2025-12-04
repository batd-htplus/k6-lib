const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

const scenariosDir = path.resolve(__dirname, 'src/scenarios');

function findTestFiles(dir, basePath = '') {
    const entries = {};
    if (!fs.existsSync(dir)) {
        return entries;
    }
    
    try {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            try {
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    const subEntries = findTestFiles(fullPath, path.join(basePath, file));
                    Object.assign(entries, subEntries);
                } else if (file.endsWith('.test.ts')) {
                    const relativePath = basePath ? path.join(basePath, file) : file;
                    const entryKey = relativePath.replace(/\.ts$/, '').replace(/\\/g, '/');
                    entries[`scenarios/${entryKey}`] = `./src/scenarios/${relativePath.replace(/\\/g, '/')}`;
                }
            } catch (err) {
                console.warn(`Warning: Could not process ${fullPath}: ${err.message}`);
            }
        });
    } catch (err) {
        console.warn(`Warning: Could not read directory ${dir}: ${err.message}`);
    }
    
    return entries;
}

const entries = findTestFiles(scenariosDir);

module.exports = {
    mode: 'development',
    entry: entries,
    target: 'node', 
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs',
        globalObject: 'this'
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
                            '@babel/preset-typescript'
                        ]
                    }
                }
            },
            {
                test: /\.json$/,
                type: 'json'
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            '@libs': path.resolve(__dirname, 'src/libs'),
            '@helper': path.resolve(__dirname, 'src/helper'),
            '@config': path.resolve(__dirname, 'src/config'),
            '@types': path.resolve(__dirname, 'src/types'),
            '@reporter': path.resolve(__dirname, 'src/reporter.ts')
        },
        fallback: {
            fs: false,
            path: false,
            os: false,
            util: false,
            stream: false,
            buffer: false,
            process: false
        }
    },
    externals: [
        /^k6(\/.*)?/,
        'fs',
        'path',
        'os',
        'crypto',
        'stream',
        'buffer',
        'util'
    ],
    plugins: [
        new webpack.EnvironmentPlugin({
            NODE_ENV: 'development',
            K6_CLOUD: false
        }),
        new webpack.DefinePlugin({
            'process.env': JSON.stringify(process.env)
        })
    ]
};
