var BACKGROUND_COLOR = 255;
var HOLLOW_PIXELS_MAX_NUM = 10;

function degradeColor(color, unit){
    return Math.round(color/unit)*unit;
}
exports.degradeColor = degradeColor;

function getColorPIxelNumber(imageData, backgroundcolor){
    var totalPixelNumber = 0;
    for (var idx = 0; idx < imageData.data.length; idx += 4) {
        if (imageData.data[idx] !== backgroundcolor) {
            totalPixelNumber++;
        }
    }
    return totalPixelNumber;
}
exports.getColorPIxelNumber = getColorPIxelNumber;

function setPixelColorByIndex(imageData, i, r, g, b) {
    imageData.data[i] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
}
exports.setPixelColorByIndex = setPixelColorByIndex;

function setPixelColor(imageData, x, y, r, g, b) {
    var i = x * 4 + y * 4 * imageData.width;
    imageData.data[i] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
}
exports.setPixelColor = setPixelColor;

function getFirstDiffColorIndex(imageData, idx, h, v) {
    var r = imageData.data[idx];
    var g = imageData.data[idx+1];
    var b = imageData.data[idx+2];
    for (var i=1; ; i++) {
        var x = (idx % (4 * imageData.width)) / 4 + i*h;
        var y = Math.floor(idx / (4 * imageData.width)) + i*v;
        if (x<0 || y<0 || x>= imageData.width || y>= imageData.height) break;

        var nextidx = x*4+y*4*imageData.width;
        var _r = imageData.data[nextidx];
        var _g = imageData.data[nextidx];
        var _b = imageData.data[nextidx];
        
        if (r!==_r || g!==_g || b!==_b) return nextidx;
    }

    return -1;
}
exports.getFirstDiffColorIndex = getFirstDiffColorIndex;

function getNeighbourPixelColor(imageData, idx, hdirection, vdirection) {
    var nidx = getNeighbourPixelIndex(imageData, idx, hdirection, vdirection);
    return nidx >= 0 ? imageData.data[nidx] : null;
}
exports.getNeighbourPixelColor = getNeighbourPixelColor;

function getNeighbourPixelIndex(imageData, idx, hdirection, vdirection) {
    var x = (idx % (4 * imageData.width)) / 4;
    var y = Math.floor(idx / (4 * imageData.width));

    var newx = x + hdirection;
    var newy = y + vdirection;
    if (newx < 0 || newx >= imageData.width || newy < 0 || newy >= imageData.height) return -1;
    return newx * 4 + newy * 4 * imageData.width;
}
exports.getNeighbourPixelIndex = getNeighbourPixelIndex;

function makeSingleColor(imageData, color) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== 255 || imageData.data[i+1] !== 255
                || imageData.data[i+2] !== 255) {
                imageData.data[i] = 0;
                imageData.data[i + 1] = 0;
                imageData.data[i + 2] = 0;
                imageData.data[i + 3] = 255;
            }

        }
    }
}
exports.makeSingleColor = makeSingleColor;

function getPixelAveX(imageData) {
    var count = 0, sumx = 0;
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR || imageData.data[i+1] !== BACKGROUND_COLOR
                || imageData.data[i+2] !== BACKGROUND_COLOR) {
                sumx+=x;
                count++;
            }

        }
    }

    return sumx/count;
}
exports.getPixelAveX = getPixelAveX;

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
exports.grayImageData = grayImageData;

function isPixelWhite(imageData, i) {
    var r = imageData.data[i];
    var g = imageData.data[i + 1];
    var b = imageData.data[i + 2];
    return (r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR);
}
exports.isPixelWhite = isPixelWhite;

function isPixelBlack(imageData, i) {
    var r = imageData.data[i];
    var g = imageData.data[i + 1];
    var b = imageData.data[i + 2];
    return (r === 0 && g === 0 && b === 0);
}
exports.isPixelBlack = isPixelBlack;

function getSubImage(imageData, pixelMap) {
    var newImage = {
        width: imageData.width,
        height: imageData.height,
        data: []
    };

    for (var y = 0; y < imageData.height; y++) {
        for (var x = 0; x < imageData.width; x++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (pixelMap[i] !== undefined) {
                newImage.data.push(imageData.data[i]);
                newImage.data.push(imageData.data[i + 1]);
                newImage.data.push(imageData.data[i + 2]);
                newImage.data.push(imageData.data[i + 3]);
            } else {
                newImage.data.push(255);
                newImage.data.push(255);
                newImage.data.push(255);
                newImage.data.push(255);
            }

        }
    }

    return newImage;
}
exports.getSubImage = getSubImage;


function detectIslet(imageData, x, y, nbrsMap) {
    
    var p = x * 4 + y * 4 * imageData.width;
    if (undefined === nbrsMap[p] && imageData.data[p] !== BACKGROUND_COLOR) {
        nbrsMap[p] = p;
    } else {
        console.log("ERROR: detectIslet", x, y, p, nbrsMap[p], imageData.data[p])
        return;
    }
    var up = getNeighbourPixelIndex(imageData, p, 0, -1);
    var down = getNeighbourPixelIndex(imageData, p, 0, 1);
    
    var left = getNeighbourPixelIndex(imageData, p, -1, 0);
    var right = getNeighbourPixelIndex(imageData, p, 1, 0);
    
    if((up<0 || down<0) && (left<0 || right<0)) return;
    // var upleft = getNeighbourPixelIndex(imageData, p, -1, -1);
    // var upright = getNeighbourPixelIndex(imageData, p, 1, -1);
    // var downright = getNeighbourPixelIndex(imageData, p, 1, 1);
    // var downleft = getNeighbourPixelIndex(imageData, p, -1, 1);

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

    // if (upleft >= 0 && undefined === nbrsMap[upleft] && imageData.data[upleft] !== BACKGROUND_COLOR) {
    //     detectIslet(imageData, x - 1, y - 1, nbrsMap);
    // }

    // if (upright >= 0 && undefined === nbrsMap[upright] && imageData.data[upright] !== BACKGROUND_COLOR) {
    //     detectIslet(imageData, x + 1, y - 1, nbrsMap);
    // }

    // if (downright >= 0 && undefined === nbrsMap[downright] && imageData.data[downright] !== BACKGROUND_COLOR) {
    //     detectIslet(imageData, x + 1, y + 1, nbrsMap);
    // }

    // if (downleft >= 0 && undefined === nbrsMap[downleft] && imageData.data[downleft] !== BACKGROUND_COLOR) {
    //     detectIslet(imageData, x - 1, y + 1, nbrsMap);
    // }

}
exports.detectIslet = detectIslet;

function pixelRange(imageData) {
    var left = Infinity,
        right = -1,
        top = Infinity,
        bottom = -1;
    for (var i=0; i<imageData.data.length; i+=4) {
        if (imageData.data[i] === BACKGROUND_COLOR 
            && imageData.data[i+1] === BACKGROUND_COLOR 
            && imageData.data[i+2] === BACKGROUND_COLOR) {
            continue;
        }

        var x = (i % (4 * imageData.width)) / 4;
        var y = Math.floor(i / (4 * imageData.width));
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
    }

    return {left:left, right:right, top:top, bottom:bottom};
}
exports.pixelRange = pixelRange;

function removeSubImage(imageData, sub, color) {
    if (color===undefined) color = BACKGROUND_COLOR;
    for (var y = 0; y < sub.height; y++) {
        for (var x = 0; x < sub.width; x++) {
            var i = x * 4 + y * 4 * sub.width;
            if (sub.data[i] !== BACKGROUND_COLOR || sub.data[i+1] !== BACKGROUND_COLOR || sub.data[i+2] !== BACKGROUND_COLOR) {
                    imageData.data[i] = color;
                    imageData.data[i+1] = color;
                    imageData.data[i+2] = color;
            }
        }
    }
}
exports.removeSubImage = removeSubImage;

function removePixelColor(imageData, pixelMap, alpha) {
    for (var y = 0; y < imageData.height; y++) {
        for (var x = 0; x < imageData.width; x++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (pixelMap[i] !== undefined) {
                if (alpha === true) {
                    imageData.data[i] = 0;
                    imageData.data[i+1] = 0;
                    imageData.data[i+2] = 0;
                    // imageData.data[i+3] = 0; 
                } else {
                    imageData.data[i] = BACKGROUND_COLOR;
                    imageData.data[i+1] = BACKGROUND_COLOR;
                    imageData.data[i+2] = BACKGROUND_COLOR;
                }
            }
        }
    }
}
exports.removePixelColor = removePixelColor;

function removePadding(imageData) {
    var range = pixelRange(imageData);
    var left = range.left;
    var right = range.right;
    var top = range.top;
    var bottom = range.bottom;

    var newImage = {width: right-left+1, height: bottom-top+1, data:[]};
    for (var y = 0; y < newImage.height; y++) {
        for (var x = 0; x < newImage.width; x++) {
            var i = (x+left) * 4 + (y+top) * 4 * imageData.width;
            if (imageData.data[i]!==BACKGROUND_COLOR
                || imageData.data[i+1]!==BACKGROUND_COLOR
                || imageData.data[i+2]!==BACKGROUND_COLOR) {
                newImage.data.push(imageData.data[i]);
                newImage.data.push(imageData.data[i+1]);
                newImage.data.push(imageData.data[i+2]);
                newImage.data.push(imageData.data[i+3]);
            } else {
                newImage.data.push(255);
                newImage.data.push(255);
                newImage.data.push(255);
                newImage.data.push(255);
            }
            
        }
    }
    // console.log("newImage", newImage.width, newImage.height);
    return newImage;
}
exports.removePadding = removePadding;

function scale(imageData, width, height) {
    var ratio;
    if (imageData.width/width > imageData.height/height) {
        ratio = imageData.width/width;
        height = Math.round(imageData.height/ratio);
    } else {
        ratio = imageData.height/height;
        width = Math.round(imageData.width/ratio);
    }
    var newImage = {width:width, height:height, data:[]};
    for (var y = 0; y < newImage.height; y++) {
        for (var x = 0; x < newImage.width; x++) {
            var si = Math.round(x * ratio) * 4 + Math.round(y * ratio) * 4 * imageData.width;
            newImage.data.push(imageData.data[si]);
            newImage.data.push(imageData.data[si+1]);
            newImage.data.push(imageData.data[si+2]);
            newImage.data.push(imageData.data[si+3]);
        }
    }
    return newImage;
}
exports.scale = scale;


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
exports.fillHollow = fillHollow;

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
exports.detectHollow = detectHollow;

function getIsletBorders(imageData, islet) {
    var borders = {left:Infinity, right:0, top:Infinity, bottom:0}
    for (var att in islet) {
        var i = islet[att];
        var x = (i % (4 * imageData.width)) / 4;
        var y = Math.floor(i / (4 * imageData.width));
        borders.left = Math.min(borders.left, x);
        borders.top = Math.min(borders.top, y);
        borders.right = Math.max(borders.right, x);
        borders.bottom = Math.max(borders.bottom, y);

    }
    return borders;
}
exports.getIsletBorders = getIsletBorders;

function isThinPixel(idx, imageData) {
    var left = getNeighbourPixelIndex(imageData, idx, -1, 0);
    var right = getNeighbourPixelIndex(imageData, idx, 1, 0);
    if (imageData.data[left] === BACKGROUND_COLOR && imageData.data[left+1] === BACKGROUND_COLOR && imageData.data[left+2] === BACKGROUND_COLOR
        &&imageData.data[right] === BACKGROUND_COLOR && imageData.data[right+1] === BACKGROUND_COLOR && imageData.data[right+2] === BACKGROUND_COLOR) {
        return true;
    }

    var up = getNeighbourPixelIndex(imageData, idx, 0, -1);
    var down = getNeighbourPixelIndex(imageData, idx, 0, 1);
    if (imageData.data[up] === BACKGROUND_COLOR && imageData.data[up+1] === BACKGROUND_COLOR && imageData.data[up+2] === BACKGROUND_COLOR
        &&imageData.data[down] === BACKGROUND_COLOR && imageData.data[down+1] === BACKGROUND_COLOR && imageData.data[down+2] === BACKGROUND_COLOR) {
        return true;
    }
       
    return false;
}
exports.isThinPixel = isThinPixel;

function clearIslet(islet, imageData) {
    for (var att in islet) {
        var i = islet[att];

        imageData.data[i] = BACKGROUND_COLOR;
        imageData.data[i + 1] = BACKGROUND_COLOR;
        imageData.data[i + 2] = BACKGROUND_COLOR;
        imageData.data[i + 3] = 255;

    }
}
exports.clearIslet = clearIslet;

function copyImage(imageData) {
    var newImage = {width: imageData.width, height:imageData.height, data:[]};
    for (var i=0; i<imageData.data.length; i++) {
        newImage.data.push(imageData.data[i]);
    }
    return newImage;
}
exports.copyImage = copyImage;