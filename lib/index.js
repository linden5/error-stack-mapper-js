const {URL} = require('url');
const os = require('os');
const path = require('path');
const fs = require('fs');

const stackMapper = require('stack-mapper');
const download = require('download');

const fileContentCache = {}

function getErrorInfo(infoStr) {
    const errors = infoStr.split(/\r?\n/);
    const inframes = [];
    let srcUrl = '';

    errors.forEach(errorLine => {
        if (!errorLine.trim()) {
            return
        }

        const errorDetail = errorLine.match(/(http.+):(\d+):(\d+)/);
        if (errorDetail) {
            // 只取第一个的src
            if (!srcUrl) {
                srcUrl = new URL(errorDetail[1])
            }

            const line = errorDetail[2];
            const column = errorDetail[3];
            const filename = srcUrl.pathname;

            inframes.push({
                filename,
                line,
                column
            })
        }
    })

    return {
        srcUrl,
        inframes
    }
}

function extractSourceMapURLFromFileContent (fileContent) {
    const lastLine = fileContent.split(/\r?\n/).pop();

    if (lastLine.includes('sourceMappingURL')) {
        let sourceMapFileMatch = lastLine.match(/sourceMappingURL=([^\r\n]+)/);
        if (sourceMapFileMatch) {
            return sourceMapFileMatch[1]
        }
    }
}

function downloadFileAndReadContent (href, filename) {
    if (fileContentCache[href]) {
        return fileContentCache[href]
    }

    const downloadDist = os.tmpdir();
    const distFile = path.resolve(downloadDist, filename);

    if (fs.existsSync(distFile)) {
        const fileContent = fs.readFileSync(distFile, 'utf-8');
        fileContentCache[href] = fileContent;
        return Promise.resolve(fileContent)
    } else {
        return download(href, downloadDist).then(data => {
            const fileContent = data.toString('utf-8');
            fileContentCache[href] = fileContent;
            return fileContent
        })
    }
}

function extractSourceMapURL (srcUrl) {
    const filename = path.basename(srcUrl.pathname);
    return downloadFileAndReadContent(srcUrl.href, filename).then(fileContent => {
        const mapFileName = extractSourceMapURLFromFileContent(fileContent);
        const dirname = path.dirname(srcUrl.pathname);
        const mapFile = path.resolve(dirname, mapFileName)
        const mapFileHref = srcUrl.origin + mapFile

        if (mapFileHref) {
            return Promise.resolve({
                href: mapFileHref,
                filename: mapFileName
            })
        } else {
            const errorNoSourceMap = new Error('No source map file');
            return Promise.reject(errorNoSourceMap)
        }
    })
}

function mapSource(inframes, mapContent) {
    const map = JSON.parse(mapContent);
    const sm = stackMapper(map);
    return sm.map(inframes);
}

function mapErrorToSrc(errorStr) {
    const errorInfo = getErrorInfo(errorStr);
    return extractSourceMapURL(errorInfo.srcUrl)
    .then(mapFile => {
        return downloadFileAndReadContent(mapFile.href, mapFile.filename);
    }).then(data => {
        return mapSource(errorInfo.inframes, data.toString('utf-8'));
    })
}

module.exports = mapErrorToSrc;
