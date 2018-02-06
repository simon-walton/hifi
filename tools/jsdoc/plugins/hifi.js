function endsWith(path, exts) {
    var result = false;
    exts.forEach(function(ext) {
        if (path.endsWith(ext)) {
            result = true;
        }
    });
    return result;
}

exports.handlers = {
    beforeParse: function(e) {
        const pathTools = require('path');
        var rootFolder = pathTools.dirname(e.filename);
        console.log("Scanning hifi source for jsdoc comments...");

        // directories to scan for jsdoc comments
        var dirList = [
            '../../interface/src',
            '../../interface/src/avatar',
            '../../interface/src/scripting',
            '../../interface/src/ui/overlays',
            '../../interface/src/raypick',
            '../../libraries/animation/src',
            '../../libraries/avatars/src',
            '../../libraries/controllers/src/controllers/',
            '../../libraries/entities/src',
            '../../libraries/networking/src',
            '../../libraries/pointers/src',
            '../../libraries/render-utils/src',
            '../../libraries/shared/src',
            '../../libraries/shared/src/shared',
            '../../libraries/script-engine/src',
        ];
        var exts = ['.h', '.cpp'];

        const fs = require('fs');
        dirList.forEach(function (dir) {
            var joinedDir = pathTools.join(rootFolder, dir);
            var files = fs.readdirSync(joinedDir)
            files.forEach(function (file) {
                var path = pathTools.join(joinedDir, file);
                if (fs.lstatSync(path).isFile() && endsWith(path, exts)) {
                    var data = fs.readFileSync(path, "utf8");
                    var reg = /(\/\*\*jsdoc(.|[\r\n])*?\*\/)/gm;
                    var matches = data.match(reg);
                    if (matches) {
                        e.source += matches.map(function (s) { return s.replace('/**jsdoc', '/**'); }).join('\n');
                    }
                }
            });
        });
    }
};
