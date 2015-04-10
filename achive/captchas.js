var webdriver = require('selenium-webdriver');
var ajaxRequest = require('request');
var driver = new webdriver.Builder().
withCapabilities(webdriver.Capabilities.chrome()).
build();

var timeouts = (new webdriver.WebDriver.Timeouts(driver))
timeouts.setScriptTimeout(10000);

// driver.get('https://user.lufax.com/user/captcha/captcha.jpg?source=login&_=1426057499488');
//hby3 huu4 7ng8 7pec
driver.get('file:///D:/works/nodejs/selenium/images/huu4.jpg');
driver.sleep(1000);

var MINOR_PIXEL_NOISE_LIMIT = 20;
var CHAR_COUNT = 4;
var BACKGROUND_COLOR = 255;
var COLOR_RANGE_OFFSET = 5;
var HOLLOW_PIXELS_MAX_NUM = 20;
var COLOR_ISLET_MAX_NUM = 20;

function filterCharacters(imageData, charCount) {
    grayImageData(imageData);

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

        console.log(att, clr1, clr2, midclr)
        charColorRangeMap[att] = [clr1 - COLOR_RANGE_OFFSET, clr2 + COLOR_RANGE_OFFSET, midclr];
    }

    for (var att in charColorRangeMap) {
        console.log(att, charColorRangeMap[att])
    }

    simplifyCharColors(imageData, CHAR_COUNT, charColorRangeMap);
    mergeEdgeColors(imageData, CHAR_COUNT);

    verticallyRepairSimplifiedImage(imageData);
    
    imageData = generateCharImageData(imageData, charColorRangeMap[2][2], CHAR_COUNT, 2);
    fillHollow(imageData);
    
    removeNoisePixels(imageData);
    
    repairPixelsH(imageData);
    repairPixelsV(imageData);
    //shrinkImage(imageData, 2);

    removeNoisePixels(imageData);
    removeColorIslets(imageData);

     
    return imageData;
}
function getColorPIxelNumber(imageData){
    var totalPixelNumber = 0;
    for (var idx = 0; idx < imageData.data.length; idx += 4) {
        if (imageData.data[idx] !== BACKGROUND_COLOR) {
            totalPixelNumber++;
        }
    }
    return totalPixelNumber;
}
function repairPixelsH(imageData) {
    var totalPixelNumber = getColorPIxelNumber(imageData);
    
    console.log("totalPixelNumber", totalPixelNumber);
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR) continue;

            var lclr = getNeighbourPixelColor(imageData, i, -1, 0);
            var rclr1 = getNeighbourPixelColor(imageData, i, 1, 0);
            var rclr2 = getNeighbourPixelColor(imageData, i, 2, 0);
            if (lclr !== null && lclr !== BACKGROUND_COLOR && (lclr === rclr1 || lclr === rclr2)) {
                var _pixelsMap = {};
                var _pnum = detectIslet(imageData, x - 1, y, _pixelsMap)
                if (_pnum < 0.1 * totalPixelNumber) {
                    var _xoffset = rclr1 !== BACKGROUND_COLOR ? 1 : 2;
                    _pixelsMap = {};
                    _pnum = detectIslet(imageData, x + _xoffset, y, _pixelsMap)
                }

                if (_pnum > 0.1 * totalPixelNumber) {
                    setPixelColor(imageData, x, y, 0, 0, 0)
                }

                if (rclr1 === BACKGROUND_COLOR) {
                    setPixelColor(imageData, x + 1, y, 0, 0, 0)
                }

            }

        }
    }
}

function repairPixelsV(imageData) {
    var totalPixelNumber = getColorPIxelNumber(imageData);
    
    console.log("totalPixelNumber", totalPixelNumber);
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR) continue;

            var tclr = getNeighbourPixelColor(imageData, i, 0, -1);
            var dclr1 = getNeighbourPixelColor(imageData, i, 0, 1);
            var dclr2 = getNeighbourPixelColor(imageData, i, 0, 2);
            if (tclr !== null && tclr !== BACKGROUND_COLOR && (tclr === dclr1 || tclr === dclr2)) {
                var _pixelsMap = {};
                var _pnum = detectIslet(imageData, x, y - 1, _pixelsMap)
                if (_pnum < 0.1 * totalPixelNumber) {
                    var _yoffset = dclr1 !== BACKGROUND_COLOR ? 1 : 2;
                    _pixelsMap = {};
                    _pnum = detectIslet(imageData, x, y + _yoffset, _pixelsMap)
                }

                if (_pnum > 0.1 * totalPixelNumber) {
                    setPixelColor(imageData, x, y, 0, 0, 0)
                }

                if (dclr1 === BACKGROUND_COLOR) {
                    setPixelColor(imageData, x, y + 1, 0, 0, 0)
                }

            }



        }
    }
}

function setPixelColor(imageData, x, y, r, g, b) {
    var i = x * 4 + y * 4 * imageData.width;
    imageData.data[i] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
}

function fillHollow(imageData) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR) continue;
            var lclr = getNeighbourPixelColor(imageData, i, -1, 0);
            var rclr = getNeighbourPixelColor(imageData, i, 1, 0);
            var tclr = getNeighbourPixelColor(imageData, i, 0, -1);
            var bclr = getNeighbourPixelColor(imageData, i, 0, 1);
            if (lclr !== BACKGROUND_COLOR && lclr === tclr || lclr !== BACKGROUND_COLOR && lclr === bclr || rclr !== BACKGROUND_COLOR && rclr === tclr || rclr !== BACKGROUND_COLOR && rclr === bclr) {
                var pixels = {};
                if (detectHollow(imageData, i, pixels)) {
                    for (var att in pixels) {
                        var _i = pixels[att];
                        imageData.data[_i] = 0;
                        imageData.data[_i + 1] = 0;
                        imageData.data[_i + 2] = 0;
                    }
                }
            }
        }
    }
}

function detectHollow(imageData, p, pixels) {
    var count = 0;
    for (var att in pixels) {
        count++;
    }
    if (count > HOLLOW_PIXELS_MAX_NUM) return false;

    pixels[p] = p;
    var lp = getNeighbourPixelIndex(imageData, p, -1, 0);
    if (lp >= 0 && !pixels[lp] && imageData.data[lp] === BACKGROUND_COLOR) {
        var h = detectHollow(imageData, lp, pixels);
        if (h === false) return false;
    }

    var rp = getNeighbourPixelIndex(imageData, p, 1, 0);
    if (rp >= 0 && !pixels[rp] && imageData.data[rp] === BACKGROUND_COLOR) {
        var h = detectHollow(imageData, rp, pixels);
        if (h === false) return false;
    }
    var tp = getNeighbourPixelIndex(imageData, p, 0, -1);
    if (tp >= 0 && !pixels[tp] && imageData.data[tp] === BACKGROUND_COLOR) {
        var h = detectHollow(imageData, tp, pixels);
        if (h === false) return false;
    }
    var bp = getNeighbourPixelIndex(imageData, p, 0, 1);
    if (bp >= 0 && !pixels[bp] && imageData.data[bp] === BACKGROUND_COLOR) {
        var h = detectHollow(imageData, bp, pixels);
        if (h === false) return false;
    }

    return true;
}

function getNeighbourPixelColor(imageData, idx, hdirection, vdirection) {
    var nidx = getNeighbourPixelIndex(imageData, idx, hdirection, vdirection);
    return nidx >= 0 ? imageData.data[nidx] : null;
}

function getNeighbourPixelIndex(imageData, idx, hdirection, vdirection) {
    var x = (idx % (4 * imageData.width)) / 4;
    var y = Math.floor(idx / (4 * imageData.width));

    var newx = x + hdirection;
    var newy = y + vdirection;
    if (newx < 0 || newx >= imageData.width || newy < 0 || newy >= imageData.height) return -1;
    return newx * 4 + newy * 4 * imageData.width;
}

function shrinkImage(imageData, idx) {
    var newdata = [];
    for (var y = 0; y < imageData.height; y++) {
        if (y % idx === 0) continue;
        for (var x = 0; x < imageData.width; x++) {
            if (x % idx === 0) continue;
            var i = x * 4 + y * 4 * imageData.width;
            newdata.push(imageData.data[i]);
            newdata.push(imageData.data[i + 1]);
            newdata.push(imageData.data[i + 2]);
            newdata.push(imageData.data[i + 3]);
        }
    }
    imageData.width = Math.floor(imageData.width * (1 - 1 / idx));
    imageData.height = Math.floor(imageData.height * (1 - 1 / idx));
    imageData.data = newdata;
}

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

function detectIslet(imageData, x, y, nbrsMap) {
    var p = x * 4 + y * 4 * imageData.width;
    if (undefined === nbrsMap[p] && imageData.data[p] !== BACKGROUND_COLOR) {
        nbrsMap[p] = p;
    } else {
        console.log("ERROR: detectIslet", p, nbrsMap[p], imageData.data[p])
        return;
    }

    var up = getNeighbourPixelIndex(imageData, p, 0, -1);
    var down = getNeighbourPixelIndex(imageData, p, 0, 1);
    var left = getNeighbourPixelIndex(imageData, p, -1, 0);
    var right = getNeighbourPixelIndex(imageData, p, 1, 0);
    var upleft = getNeighbourPixelIndex(imageData, p, -1, -1);
    var upright = getNeighbourPixelIndex(imageData, p, 1, -1);
    var downright = getNeighbourPixelIndex(imageData, p, 1, 1);
    var downleft = getNeighbourPixelIndex(imageData, p, -1, 1);

    if (up >= 0 && undefined === nbrsMap[up] && imageData.data[up] !== BACKGROUND_COLOR) {
        // nbrsMap[up] = up;
        detectIslet(imageData, x, y - 1, nbrsMap);
    }

    if (down >= 0 && undefined === nbrsMap[down] && imageData.data[down] !== BACKGROUND_COLOR) {
        // nbrsMap[down] = down;
        detectIslet(imageData, x, y + 1, nbrsMap);
    }

    if (left >= 0 && undefined === nbrsMap[left] && imageData.data[left] !== BACKGROUND_COLOR) {
        // nbrsMap[left] = left;
        detectIslet(imageData, x - 1, y, nbrsMap);
    }

    if (right >= 0 && undefined === nbrsMap[right] && imageData.data[right] !== BACKGROUND_COLOR) {
        // nbrsMap[right] = right;
        detectIslet(imageData, x + 1, y, nbrsMap);
    }

    if (upleft >= 0 && undefined === nbrsMap[upleft] && imageData.data[upleft] !== BACKGROUND_COLOR) {
        // nbrsMap[upleft] = upleft;
        detectIslet(imageData, x - 1, y - 1, nbrsMap);
    }

    if (upright >= 0 && undefined === nbrsMap[upright] && imageData.data[upright] !== BACKGROUND_COLOR) {
        // nbrsMap[upright] = upright;
        detectIslet(imageData, x + 1, y - 1, nbrsMap);
    }

    if (downright >= 0 && undefined === nbrsMap[downright] && imageData.data[downright] !== BACKGROUND_COLOR) {
        // nbrsMap[downright] = downright;
        detectIslet(imageData, x + 1, y + 1, nbrsMap);
    }

    if (downleft >= 0 && undefined === nbrsMap[downleft] && imageData.data[downleft] !== BACKGROUND_COLOR) {
        // nbrsMap[downleft] = downleft;
        detectIslet(imageData, x - 1, y + 1, nbrsMap);
    }

    var count = 0;
    for (var att in nbrsMap) {
        count++;
    }

    return count;
}

function generateCharImageData(imageData, charColor, charCount, charNum) {
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
            console.log("removeColorIslet====left", 0, y, lefti, imgData.data[lefti]);
            removeIslet(imgData, 0, y);
        }
    }

    console.log("==",top, rightPixels.toString())
    for (var i = 0; i < rightPixels.length; i++) {
        var y = rightPixels[i] - top;
        var righti = (imgData.width-1)*4 + y * 4 * imgData.width;

        if (imgData.data[righti] !== BACKGROUND_COLOR) {
            console.log("removeColorIslet====right", imgData.width-1, y, righti, imgData.data[righti]);
            removeIslet(imgData, imgData.width-1, y);
        }
    }

    return imgData;
}

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


function grayImageData(imageData) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var luma = Math.floor(imageData.data[i] * 299 / 1000 +
                imageData.data[i + 1] * 587 / 1000 +
                imageData.data[i + 2] * 114 / 1000);

            imageData.data[i] = luma;
            imageData.data[i + 1] = luma;
            imageData.data[i + 2] = luma;
            imageData.data[i + 3] = 255;
        }
    }
}

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

driver.executeAsyncScript(function() {
    var validateImg = arguments[arguments.length - 2];
    var callback = arguments[arguments.length - 1];
    var img = document.getElementsByTagName("img")[0];
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    var mydata = context.getImageData(0, 0, img.width, img.height);
    //console.log("mydata", mydata.data.length, mydata.data[0]);
    callback(mydata)
}, "validateImg").then(function(mydata) {
    var _s = new Date();
    console.log("mydata:", mydata.data.length);
    var img = filterCharacters(mydata, CHAR_COUNT);
    console.log("duration:", new Date() - _s);
    outputImageData(img);
    return true;
});

function outputImageData(mydata) {
    driver.executeAsyncScript(function() {
        var imgData = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];

        //var img = document.getElementsByTagName("img")[0];
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        //context.drawImage(img, 0, 0);
        var img = context.createImageData(imgData.width, imgData.height);
        img.data.set(imgData.data);
        context.putImageData(img, 0, 0);
        var body = document.getElementsByTagName("body")[0];
        body.appendChild(canvas);
        callback();
    }, mydata).then(function() {
        console.log("imgData===:");
        return true;
    });
}
