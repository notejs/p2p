var imageutil = require("./imageutil");

var MINOR_PIXEL_NOISE_LIMIT = 20;
var BACKGROUND_COLOR = 255;
var COLOR_RANGE_OFFSET = 5;
var HOLLOW_PIXELS_MAX_NUM = 20;
var COLOR_ISLET_MAX_NUM = 20;

exports.config = config;
function config(cfg){
    if (undefined !== cfg['MINOR_PIXEL_NOISE_LIMIT']) MINOR_PIXEL_NOISE_LIMIT = cfg.MINOR_PIXEL_NOISE_LIMIT;
    if (undefined !== cfg['BACKGROUND_COLOR']) BACKGROUND_COLOR = cfg.BACKGROUND_COLOR;
    if (undefined !== cfg['COLOR_RANGE_OFFSET']) COLOR_RANGE_OFFSET = cfg.COLOR_RANGE_OFFSET;
    if (undefined !== cfg['HOLLOW_PIXELS_MAX_NUM']) HOLLOW_PIXELS_MAX_NUM = cfg.HOLLOW_PIXELS_MAX_NUM;
   if (undefined !== cfg['COLOR_ISLET_MAX_NUM']) COLOR_ISLET_MAX_NUM = cfg.COLOR_ISLET_MAX_NUM;

    return this;
}

exports.identifyCharactorColorRange = identifyCharactorColorRange;
function identifyCharactorColorRange(imageData, charCount) {
    var pixelsMap = {};
    var charMaps = {};
    var charWidth = imageData.width / charCount;
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var luma = imageData.data[i];
            if (undefined === pixelsMap[luma]) pixelsMap[luma] = 0;
            pixelsMap[luma]++;

            var charColumn = Math.floor(x / charWidth);
            if (x > (charColumn - 0.5) * charWidth && x < (charColumn + 1.5) * charWidth) {
                if (!charMaps[charColumn]) charMaps[charColumn] = {};
                if (!charMaps[charColumn][luma]) charMaps[charColumn][luma] = 0;
                charMaps[charColumn][luma]++;
            }
        }
    }

    // console.log(pixelsMap);
    for (var att in pixelsMap) {
        if (pixelsMap[att] > 50) console.log(att, pixelsMap[att])
    }

    for (var att in charMaps) {
        var charMap = charMaps[att];
        for (var clr in charMap) {
            if (charMap[clr] < MINOR_PIXEL_NOISE_LIMIT
                // || charMap[clr]*2<pixelsMap[clr]
            ) {
                delete charMap[clr];
            }
        }
        //console.log(att, charMap);
    }
    var noisePixels = [];
    for (var att in charMaps) {
        var charMap = charMaps[att];
        for (var clr in charMap) {
            var breakflag = false;
            for (var _att in charMaps) {
                if (_att === att) continue;

                if (!charMaps[_att][clr]) {
                    breakflag = true;
                    break;
                } else {
                    var r = charMaps[_att][clr] / charMap[clr];
                    if (r > 3 || r < 1 / 3) {
                        breakflag = true;
                        break;
                    }
                }
            }
            if (!breakflag) {
                for (var _att in charMaps) {
                    if (noisePixels.length === 0 || noisePixels[noisePixels.length - 1] !== clr) {
                        noisePixels.push(clr);
                    }
                    delete charMaps[_att][clr];
                }
            }
        }
        console.log(att, charMap);
    }

    console.log("nosiePixels:", noisePixels);
    /**
        Delete noisy colors
    */
    for (var i = 0; i < noisePixels.length; i++) {
        var noisePixel = noisePixels[i];
        for (var att in charMaps) {
            var cm = charMaps[att];
            for (var clr in cm) {
                if (Math.abs(clr - noisePixel) < 5) {
                    delete cm[clr];
                }
            }
        }
    }

    /**
    Find Char Color Range
    **/
    var charColorRangeMap = {};
    for (var att in charMaps) {
        var cm = charMaps[att];
        var sortArr = [];
        for (var clr in cm) {
            sortArr.push(Number(clr));
        }

        sortArr.sort(function(c1, c2) {
            if (cm[c1] > cm[c2]) return -1;
            else if (cm[c1] < cm[c2]) return 1;
            else return 0;
        });

        var mjclrs = {};
        for (var i = 0; i < sortArr.length && i < 5; i++) {
            var sortedclr = sortArr[i];
            for (var c in mjclrs) {
                if (Math.abs(sortedclr - c) < 5) {
                    mjclrs[c].push(sortedclr);
                    sortedclr = -1;
                }
            }
            if (sortedclr !== -1) {
                mjclrs[sortedclr] = [sortedclr];
            }
        }

        var mjcount = 0;
        var leadclr;
        for (var c in mjclrs) {
            if (mjclrs[c].length > mjcount) {
                mjcount = mjclrs[c].length;
                leadclr = c;
            }
        }
        mjclrs[leadclr].sort();
        var clr1 = Number(mjclrs[leadclr][0]);
        var clr2 = Number(mjclrs[leadclr][mjclrs[leadclr].length - 1]);
        var midclr = Math.round((clr1 + clr2) / 2);

        // console.log(att, clr1, clr2, midclr)
        charColorRangeMap[att] = [clr1 - COLOR_RANGE_OFFSET, clr2 + COLOR_RANGE_OFFSET, midclr];
    }

    for (var att in charColorRangeMap) {
        console.log(att, charColorRangeMap[att])
    }
 
    return charColorRangeMap;
}

exports.repairPixelsH = repairPixelsH;
function repairPixelsH(imageData) {
    var totalPixelNumber = imageutil.getColorPIxelNumber(imageData, BACKGROUND_COLOR);
    
    console.log("totalPixelNumber", totalPixelNumber);
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR) continue;

            var lclr = imageutil.getNeighbourPixelColor(imageData, i, -1, 0);
            var rclr1 = imageutil.getNeighbourPixelColor(imageData, i, 1, 0);
            var rclr2 = imageutil.getNeighbourPixelColor(imageData, i, 2, 0);
            if (lclr !== null && lclr !== BACKGROUND_COLOR && (lclr === rclr1 || lclr === rclr2)) {
                var _pixelsMap = {};
                var _pnum = detectIslet(imageData, x - 1, y, _pixelsMap)
                if (_pnum < 0.1 * totalPixelNumber) {
                    var _xoffset = rclr1 !== BACKGROUND_COLOR ? 1 : 2;
                    _pixelsMap = {};
                    _pnum = detectIslet(imageData, x + _xoffset, y, _pixelsMap)
                }

                if (_pnum > 0.1 * totalPixelNumber) {
                    imageutil.setPixelColor(imageData, x, y, 0, 0, 0)
                }

                if (rclr1 === BACKGROUND_COLOR) {
                    imageutil.setPixelColor(imageData, x + 1, y, 0, 0, 0)
                }

            }

        }
    }
}

exports.repairPixelsV = repairPixelsV;
function repairPixelsV(imageData) {
    var totalPixelNumber = imageutil.getColorPIxelNumber(imageData, BACKGROUND_COLOR);
    
    console.log("totalPixelNumber", totalPixelNumber);
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR) continue;

            var tclr = imageutil.getNeighbourPixelColor(imageData, i, 0, -1);
            var dclr1 = imageutil.getNeighbourPixelColor(imageData, i, 0, 1);
            var dclr2 = imageutil.getNeighbourPixelColor(imageData, i, 0, 2);
            if (tclr !== null && tclr !== BACKGROUND_COLOR && (tclr === dclr1 || tclr === dclr2)) {
                var _pixelsMap = {};
                var _pnum = detectIslet(imageData, x, y - 1, _pixelsMap)
                if (_pnum < 0.1 * totalPixelNumber) {
                    var _yoffset = dclr1 !== BACKGROUND_COLOR ? 1 : 2;
                    _pixelsMap = {};
                    _pnum = detectIslet(imageData, x, y + _yoffset, _pixelsMap)
                }

                if (_pnum > 0.1 * totalPixelNumber) {
                    imageutil.setPixelColor(imageData, x, y, 0, 0, 0)
                }

                if (dclr1 === BACKGROUND_COLOR) {
                    imageutil.setPixelColor(imageData, x, y + 1, 0, 0, 0)
                }

            }

        }
    }
}


exports.removeNoisePixels = removeNoisePixels;
function removeNoisePixels(imageData) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var left = undefined,
                right = undefined,
                up = undefined,
                down = undefined;

            if (x > 0) {
                left = (x - 1) * 4 + y * 4 * imageData.width;
            }

            if (x < imageData.width - 1) {
                right = (x + 1) * 4 + y * 4 * imageData.width;
            }

            if (y > 0) {
                up = x * 4 + (y - 1) * 4 * imageData.width;
            }

            if (y < imageData.height - 1) {
                down = x * 4 + (y + 1) * 4 * imageData.width;
            }
            var iclr = undefined;
            if (left === undefined && imageData.data[i] !== imageData.data[right] && imageData.data[i] !== BACKGROUND_COLOR) {
                iclr = imageData.data[right];
            } else if (right === undefined && imageData.data[i] !== imageData.data[left] && imageData.data[i] !== BACKGROUND_COLOR) {
                iclr = imageData.data[left];
            } else if (left !== undefined && right !== undefined && imageData.data[i] !== imageData.data[left] && imageData.data[i] !== imageData.data[right]) {
                iclr = imageData.data[right];
            } else if (up === undefined && imageData.data[i] !== imageData.data[down] && imageData.data[i] !== BACKGROUND_COLOR) {
                iclr = imageData.data[down];
            } else if (down === undefined && imageData.data[i] !== imageData.data[up] && imageData.data[i] !== BACKGROUND_COLOR) {
                iclr = imageData.data[up];
            } else if (up !== undefined && down !== undefined && imageData.data[i] !== imageData.data[up] && imageData.data[i] !== imageData.data[down]) {
                iclr = imageData.data[down];
            }

            if (iclr !== undefined) {
                imageData.data[i] = iclr;
                imageData.data[i + 1] = iclr;
                imageData.data[i + 2] = iclr;
            }
        }
    }
}

exports.removeColorIslets = removeColorIslets;
function removeColorIslets(imageData) {
    var detectedPixels = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;

            if (detectedPixels[i] !== undefined || imageData.data[i] === BACKGROUND_COLOR) continue;

            var nbrs = {};
            detectIslet(imageData, x, y, nbrs);

            var count = 0;
            for (var att in nbrs) {
                detectedPixels[att] = nbrs[att];
                count++;
            }

            if (count > COLOR_ISLET_MAX_NUM) {
                continue;
            }

            for (var att in nbrs) {
                var _i = nbrs[att];
                imageData.data[_i] = BACKGROUND_COLOR;
                imageData.data[_i + 1] = BACKGROUND_COLOR;
                imageData.data[_i + 2] = BACKGROUND_COLOR;
            }
        }
    }
}

exports.detectIslet = detectIslet;
function detectIslet(imageData, x, y, nbrsMap) {
    var p = x * 4 + y * 4 * imageData.width;
    if (undefined === nbrsMap[p] && imageData.data[p] !== BACKGROUND_COLOR) {
        nbrsMap[p] = p;
    } else {
        console.log("ERROR: detectIslet", p, nbrsMap[p], imageData.data[p])
        return;
    }

    var up = imageutil.getNeighbourPixelIndex(imageData, p, 0, -1);
    var down = imageutil.getNeighbourPixelIndex(imageData, p, 0, 1);
    var left = imageutil.getNeighbourPixelIndex(imageData, p, -1, 0);
    var right = imageutil.getNeighbourPixelIndex(imageData, p, 1, 0);
    var upleft = imageutil.getNeighbourPixelIndex(imageData, p, -1, -1);
    var upright = imageutil.getNeighbourPixelIndex(imageData, p, 1, -1);
    var downright = imageutil.getNeighbourPixelIndex(imageData, p, 1, 1);
    var downleft = imageutil.getNeighbourPixelIndex(imageData, p, -1, 1);

    if (up >= 0 && undefined === nbrsMap[up] && imageData.data[up] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x, y - 1, nbrsMap);
    }

    if (down >= 0 && undefined === nbrsMap[down] && imageData.data[down] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x, y + 1, nbrsMap);
    }

    if (left >= 0 && undefined === nbrsMap[left] && imageData.data[left] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x - 1, y, nbrsMap);
    }

    if (right >= 0 && undefined === nbrsMap[right] && imageData.data[right] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x + 1, y, nbrsMap);
    }

    if (upleft >= 0 && undefined === nbrsMap[upleft] && imageData.data[upleft] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x - 1, y - 1, nbrsMap);
    }

    if (upright >= 0 && undefined === nbrsMap[upright] && imageData.data[upright] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x + 1, y - 1, nbrsMap);
    }

    if (downright >= 0 && undefined === nbrsMap[downright] && imageData.data[downright] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x + 1, y + 1, nbrsMap);
    }

    if (downleft >= 0 && undefined === nbrsMap[downleft] && imageData.data[downleft] !== BACKGROUND_COLOR) {
        detectIslet(imageData, x - 1, y + 1, nbrsMap);
    }

    var count = 0;
    for (var att in nbrsMap) {
        count++;
    }

    return count;
}

exports.generateCharactorImageData = generateCharactorImageData;
function generateCharactorImageData(imageData, charColor, charCount, charNum) {
    var charWidth = imageData.width / charCount;
    var leftx = Math.max(0, Math.floor(charNum * charWidth - 0.5 * charWidth));
    var rightx = Math.min(imageData.width, Math.floor((charNum + 1.5) * charWidth));
    var pixelsMap = {};
    var leftPixels = [],
        rightPixels = [];
    for (var x = 0; x < imageData.width; x++) {
        if (x < leftx || x >= rightx) continue;
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var clr = imageData.data[i];

            if (clr === BACKGROUND_COLOR) {
                continue;
            }

            if (clr !== charColor) {
                continue;
            }
            pixelsMap[x + "_" + y] = [x, y];
            if (x > 0 && x === leftx) leftPixels.push(y);
            else if (x < imageData.width - 1 && x === rightx - 1) rightPixels.push(y);
        }
    }

    console.log("leftPixels", leftPixels)
    console.log("rightPixels", rightPixels)

    var left = Infinity,
        right = -1,
        top = Infinity,
        bottom = -1;
    for (var att in pixelsMap) {
        var xy = pixelsMap[att];
        var x = xy[0];
        var y = xy[1];
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
    }

    var imgData = {
        width: right - left + 1,
        height: bottom - top + 1,
        data: []
    }
    for (var y = 0; y < imgData.height; y++) {
        for (var x = 0; x < imgData.width; x++) {
            var key = (x + left) + "_" + (y + top);
            if (pixelsMap[key]) {
                imgData.data.push(0);
                imgData.data.push(0);
                imgData.data.push(0);
                imgData.data.push(255);
            } else {
                imgData.data.push(BACKGROUND_COLOR);
                imgData.data.push(BACKGROUND_COLOR);
                imgData.data.push(BACKGROUND_COLOR);
                imgData.data.push(255);
            }
        }
    }

    for (var i = 0; i < leftPixels.length; i++) {
        var y = leftPixels[i] - top;
        var lefti = y * 4 * imgData.width;
        if (imgData.data[lefti] !== BACKGROUND_COLOR) {
            // console.log("removeColorIslet====left", 0, y, lefti, imgData.data[lefti]);
            removeIslet(imgData, 0, y);
        }
    }

    // console.log("==",top, rightPixels.toString())
    for (var i = 0; i < rightPixels.length; i++) {
        var y = rightPixels[i] - top;
        var righti = (imgData.width-1)*4 + y * 4 * imgData.width;

        if (imgData.data[righti] !== BACKGROUND_COLOR) {
            // console.log("removeColorIslet====right", imgData.width-1, y, righti, imgData.data[righti]);
            removeIslet(imgData, imgData.width-1, y);
        }
    }

    return imgData;
}

exports.removeIslet = removeIslet;
function removeIslet(imgData, x, y){
    var pixels = {};
    detectIslet(imgData, x, y, pixels);
    for (var att in pixels) {
        var i = pixels[att];
        imgData.data[i] = BACKGROUND_COLOR;
        imgData.data[i+1] = BACKGROUND_COLOR;
        imgData.data[i+2] = BACKGROUND_COLOR;
    }

}

exports.verticallyRepairSimplifiedImage = verticallyRepairSimplifiedImage;
function verticallyRepairSimplifiedImage(imageData, topBackGroundColor) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var clr = imageData.data[i];
            if (clr !== BACKGROUND_COLOR) continue;

            var newclr = undefined,
                upclr = undefined,
                downclr = undefined;

            if (y > 0) {
                var up = x * 4 + (y - 1) * 4 * imageData.width;
                upclr = imageData.data[up];
            }

            for (var len = 1; len < 6; len++) {
                if (y < imageData.height - len) {
                    var down = x * 4 + (y + len) * 4 * imageData.width;
                    downclr = imageData.data[down];
                    if (downclr !== BACKGROUND_COLOR) break;
                }
            }

            if (upclr && downclr && upclr !== BACKGROUND_COLOR && downclr != BACKGROUND_COLOR) {
                // console.log("====", x, y, clr, upclr, downclr)
                newclr = upclr;
            }

            if (newclr !== undefined) {
                imageData.data[i] = upclr;
                imageData.data[i + 1] = upclr;
                imageData.data[i + 2] = upclr;
            }
        }
    }
}

exports.mergeEdgeColors = mergeEdgeColors;
function mergeEdgeColors(imageData, charCount) {
    var charWidth = imageData.width / charCount;
    var charDataMap = {};
    for (var c = 1; c < charCount; c++) {
        var x = c * charWidth;
        var lefti = [],
            righti = [];
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] === BACKGROUND_COLOR) continue;
            var clr = imageData.data[i];
            var lclr = imageData.data[i - 4];
            if (clr === lclr || Math.abs(clr - lclr) >= 2 * COLOR_RANGE_OFFSET) continue;
            var nbrs = {};
            detectIslet(imageData, x, y, nbrs);
            for (var att in nbrs) {
                var _x = (nbrs[att] % (4 * imageData.width)) / 4;
                if (_x < x) lefti.push(nbrs[att]);
                else righti.push(nbrs[att]);
            }
        }
        
        var smaller, bigger;
        if (lefti.length > righti.length) {
            smaller = righti;
            bigger = lefti;
        } else {
            smaller = lefti;
            bigger = righti;
        }
        var biggerclr = imageData.data[bigger[0]];
        for (var _i = 0; _i < smaller.length; _i++) {
            var li = smaller[_i];
            imageData.data[li] = biggerclr;
            imageData.data[li + 1] = biggerclr;
            imageData.data[li + 2] = biggerclr;
        }

        console.log("mergeEdgeColors", x, smaller.length, bigger.length)
    }
}

exports.simplifyCharColors = simplifyCharColors;
function simplifyCharColors(imageData, charCount, charColorRangeMap) {
    var charWidth = imageData.width / charCount;
    var charDataMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;

            var charColumn = Math.floor(x / charWidth);
            var midColumnX = (charColumn + 0.5) * charWidth;
            var clr = imageData.data[i];
            var newclr;

            if (clr >= charColorRangeMap[charColumn][0] && clr <= charColorRangeMap[charColumn][1]) {
                newclr = charColorRangeMap[charColumn][2];
            } else if (x < midColumnX && charColumn > 0 && clr >= charColorRangeMap[charColumn - 1][0] && clr <= charColorRangeMap[charColumn - 1][1]) {
                newclr = charColorRangeMap[charColumn - 1][2];
            } else if (x > midColumnX && charColumn < (charCount - 1) && clr >= charColorRangeMap[charColumn + 1][0] && clr <= charColorRangeMap[charColumn + 1][1]) {
                newclr = charColorRangeMap[charColumn + 1][2];
            } else {
                newclr = BACKGROUND_COLOR;
            }

            imageData.data[i] = newclr;
            imageData.data[i + 1] = newclr;
            imageData.data[i + 2] = newclr;
            imageData.data[i + 3] = 255;

        }
    }
}
