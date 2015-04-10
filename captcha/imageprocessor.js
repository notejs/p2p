var imageUtil = require("./imageUtil");

var MINOR_PIXEL_NOISE_LIMIT = 20;
var BACKGROUND_COLOR = 255;
var COLOR_RANGE_OFFSET = 5;
var HOLLOW_PIXELS_MAX_NUM = 20;
var COLOR_ISLET_MAX_NUM = 20;
var DEGRADE_UNIT = 20;
var CHAR_COUNT = 4;
var MINIMUM_CHAR_PIXEL = 250;
var GROUP_COLOR_MIN_DISTANCE = 20;
var COLOR_GROUP_MIN = 100;
exports.config = config;

function config(cfg) {
    if (undefined !== cfg['MINOR_PIXEL_NOISE_LIMIT']) MINOR_PIXEL_NOISE_LIMIT = cfg.MINOR_PIXEL_NOISE_LIMIT;
    if (undefined !== cfg['BACKGROUND_COLOR']) BACKGROUND_COLOR = cfg.BACKGROUND_COLOR;
    if (undefined !== cfg['COLOR_RANGE_OFFSET']) COLOR_RANGE_OFFSET = cfg.COLOR_RANGE_OFFSET;
    if (undefined !== cfg['HOLLOW_PIXELS_MAX_NUM']) HOLLOW_PIXELS_MAX_NUM = cfg.HOLLOW_PIXELS_MAX_NUM;
    if (undefined !== cfg['COLOR_ISLET_MAX_NUM']) COLOR_ISLET_MAX_NUM = cfg.COLOR_ISLET_MAX_NUM;

    return this;
}


exports.getMainColorGroupImages = getMainColorGroupImages;
function getMainColorGroupImages(imageData) {
    degrade(imageData);
    removeBackground(imageData);
    var bgRemovedImage = imageUtil.copyImage(imageData);
    var noiselineimage = removeNoiseLine(imageData);

    // return [noiselineimage]
    var nlRemovedImage = imageUtil.copyImage(imageData);
    removeThinPixels(imageData);

    var mainColorGroups = getColorGroups(imageData, CHAR_COUNT, COLOR_GROUP_MIN, 20);
    var imgs = [];
    for (var i = 0; i < mainColorGroups.length; i++) {
        var img = imageUtil.getSubImage(imageData, mainColorGroups[i]);
        removeThinPixels(img);
        var subs = hScanForCharactorImages(img);

        for (var j=0; j<subs.length; j++) {
            var sub = subs[j];
            removeThinPixels(sub);
            vRemoveFarPixels(sub);
            hRemoveFarPixels(sub);

            removeColorNoiseIslets(sub, 5);
            
            //imageUtil.removeSubImage(imageData, sub);            
            imgs.push(sub);

        }
        // imgs.push(img);

        imgs.sort(function(img0, img1){
            var avex0 = imageUtil.getPixelAveX(img0);
            var avex1 = imageUtil.getPixelAveX(img1);
            if (avex0>avex1) return 1;
            else if (avex0<avex1) return -1;
            return 0;
        })
       
    }
    
    // return imgs;
    //return [imageData];

    var newimgs = [];
    for (var i=0; i<imgs.length; i++) {
        var leftimg = i>0?imgs[i-1]:null;
        var rightimg = i===imgs.length-1?null:imgs[i+1];
        var newimg = imageUtil.copyImage(imgs[i]);

        vRecoverColorsNearby(newimg, imageData, leftimg, rightimg);
        //hRecoverColorsNearby(newimg, imageData, leftimg, rightimg);
        // vRecoverColorsNearby(newimg, imageData, leftimg, rightimg);
        // hRecoverColorsNearby(newimg, imageData, leftimg, rightimg);
        // removeThinPixels(newimg);
        // removeColorNoiseIslets(newimg, 5);
        
        //recoverNoiseLineGap(newimg, bgRemovedImage);
        
        // removeThinPixels(newimg);

        newimgs.push(newimg);
    }

    // for (var i=0; i<newimgs.length; i++) {
    //     var img = newimgs[i];
    //     var leftimg = i>0?newimgs[i-1]:null;
    //     var rightimg = i===newimgs.length-1?null:newimgs[i+1];

    //     removeNeighbourPixels(img, leftimg, rightimg);
    // }


    return newimgs;
}

exports.degrade = degrade;
function degrade(imageData) {
    var pixelCountMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;

            imageData.data[i] = imageUtil.degradeColor(imageData.data[i], DEGRADE_UNIT);
            imageData.data[i + 1] = imageUtil.degradeColor(imageData.data[i + 1], DEGRADE_UNIT);
            imageData.data[i + 2] = imageUtil.degradeColor(imageData.data[i + 2], DEGRADE_UNIT);
            imageData.data[i + 3] = 255;
            // var key = r+"_"+g+"_"+b;
            // if (undefined === pixelCountMap[key]) pixelCountMap[key] = 0;
            // pixelCountMap[key] += 1;
        }
    }
    var pixels = [];
    for (var att in pixelCountMap) {
        if (pixelCountMap[att] > MINOR_PIXEL_NOISE_LIMIT) {
            pixels.push(att);
        }
    }
}

exports.removeNoiseLine1 = removeNoiseLine1;
function removeNoiseLine1(imageData) {
    var pixelCountMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (pixelCountMap[i] !== undefined) continue;
            var pixelMap = {};
            if (isNoiseLine(imageData, i)) {
                detectNoiseLine(imageData, x, y, pixelMap);
                var count = 0;
                for (var att in pixelMap) {
                    pixelCountMap[att] = pixelMap[att];
                    count++;
                }

                if (count >= 5) {
                    // console.log("removeNoiseLine", x, y, count)
                    for (var att in pixelMap) {
                        var pi = pixelMap[att];
                        
                        imageData.data[pi] = BACKGROUND_COLOR;
                        imageData.data[pi + 1] = BACKGROUND_COLOR;
                        imageData.data[pi + 2] = BACKGROUND_COLOR;
                    }
                    
                }
                
            } 
        }
    }

    //removeThinPixels(imageData);
}

exports.detectNoiseLine = detectNoiseLine;
function detectNoiseLine(imageData, x, y, nbrsMap) {
    var p = x * 4 + y * 4 * imageData.width;
    if (undefined === nbrsMap[p] && isNoiseLine(imageData, p)) {
        nbrsMap[p] = p;
    } else {
        return;
    }
    var up = imageUtil.getNeighbourPixelIndex(imageData, p, 0, -1);
    var down = imageUtil.getNeighbourPixelIndex(imageData, p, 0, 1);
    
    var left = imageUtil.getNeighbourPixelIndex(imageData, p, -1, 0);
    var right = imageUtil.getNeighbourPixelIndex(imageData, p, 1, 0);
    
    if((up<0 || down<0) && (left<0 || right<0)) return;

    if (up >= 0 && undefined === nbrsMap[up] && isNoiseLine(imageData, up)) {
        detectNoiseLine(imageData, x, y - 1, nbrsMap);
    }

    if (down >= 0 && undefined === nbrsMap[down] && isNoiseLine(imageData, down)) {
        detectNoiseLine(imageData, x, y + 1, nbrsMap);
    }

    if (left >= 0 && undefined === nbrsMap[left] && isNoiseLine(imageData, left)) {
        detectNoiseLine(imageData, x - 1, y, nbrsMap);
    }

    if (right >= 0 && undefined === nbrsMap[right] && isNoiseLine(imageData, right)) {
        detectNoiseLine(imageData, x + 1, y, nbrsMap);
    }

}


exports.removeBackground = removeBackground;

function removeBackground(imageData) {
    var pixelCountMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;

            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            var limit = 180;
            if (r >= limit && g >= limit || r >= limit &&b >= limit || g >= limit &&b >= limit) {
                imageData.data[i] = 255;
                imageData.data[i + 1] = 255;
                imageData.data[i + 2] = 255;
            } else if (
                Math.abs(r - g) <= 40 && Math.abs(r - b) <= 40 && Math.abs(g - b) <= 40 && Math.max(r, Math.max(g, b)) <= 120 || Math.abs(r - g) <= 20 && Math.abs(r - b) <= 20 && Math.abs(g - b) <= 20
                // Math.abs(r - g) <= 40 && Math.abs(r - b) <= 40 && Math.abs(g - b) <= 40 && Math.max(r, Math.max(g, b)) <= 100 
                // || Math.abs(r - g) <= 20 && Math.abs(r - b) <= 20 && Math.abs(g - b) <= 20
            ) {
                // imageData.data[i] = 0;
                // imageData.data[i + 1] = 0;
                // imageData.data[i + 2] = 0;

            }

            // var key = r+"_"+g+"_"+b;
            // if (undefined === pixelCountMap[key]) pixelCountMap[key] = 0;
            // pixelCountMap[key] += 1;
        }
    }

}

function removeNoiseLine(imageData) {
    var pixelCountMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (pixelCountMap[i] !== undefined) continue;
            var pixelMap = {};
            if (isNoiseLine(imageData, i)) {
                detectNoiseLine(imageData, x, y, pixelMap);
                for (var att in pixelMap) {
                    pixelCountMap[att] = pixelMap[att];
                }                
            } 
        }
    }
    var nlimg = imageUtil.getSubImage(imageData, pixelCountMap);
    removeColorNoiseIslets(nlimg, 3);

    for (var x = 0; x < nlimg.width; x++) {
        for (var y = 0; y < nlimg.height; y++) {
            var i = x * 4 + y * 4 * nlimg.width;
            if (imageUtil.isPixelWhite(nlimg, i)) continue;
            var downi = imageUtil.getNeighbourPixelIndex(nlimg, i, 0, 1);
            var downlefti = imageUtil.getNeighbourPixelIndex(nlimg, i, -1, 1);
            var downrighti = imageUtil.getNeighbourPixelIndex(nlimg, i, 1, 1);
            if (imageUtil.isPixelWhite(nlimg, downi) && !imageUtil.isPixelWhite(nlimg, downlefti) && !imageUtil.isPixelWhite(nlimg, downrighti)) {
                imageUtil.setPixelColorByIndex(nlimg, downi, 0, 0, 0);
                continue;
            }

            var upi = imageUtil.getNeighbourPixelIndex(nlimg, i, 0, -1);
            var uplefti = imageUtil.getNeighbourPixelIndex(nlimg, i, -1, -1);
            var uprighti = imageUtil.getNeighbourPixelIndex(nlimg, i, 1, -1);
            if (imageUtil.isPixelWhite(nlimg, upi) && !imageUtil.isPixelWhite(nlimg, uplefti) && !imageUtil.isPixelWhite(nlimg, uprighti)) {
                imageUtil.setPixelColorByIndex(nlimg, upi, 0, 0, 0);
                continue;
            }

            var righti = imageUtil.getNeighbourPixelIndex(nlimg, i, 1, 0);
            if (imageUtil.isPixelWhite(nlimg, righti) && !imageUtil.isPixelWhite(nlimg, uprighti) && !imageUtil.isPixelWhite(nlimg, downrighti)) {
                imageUtil.setPixelColorByIndex(nlimg, righti, 0, 0, 0);
                continue;
            }

            var lefti = imageUtil.getNeighbourPixelIndex(nlimg, i, -1, 0);
            if (imageUtil.isPixelWhite(nlimg, lefti) && !imageUtil.isPixelWhite(nlimg, uplefti) && !imageUtil.isPixelWhite(nlimg, downlefti)) {
                imageUtil.setPixelColorByIndex(nlimg, lefti, 0, 0, 0);
                continue;
            }

            var rri = imageUtil.getNeighbourPixelIndex(nlimg, i, 2, 0);
            var drri = imageUtil.getNeighbourPixelIndex(nlimg, i, 2, 1); 
            if (imageUtil.isPixelWhite(nlimg, righti) && !imageUtil.isPixelWhite(nlimg, upi) && imageUtil.isPixelWhite(nlimg, uprighti)
                && !imageUtil.isPixelWhite(nlimg, downrighti) && imageUtil.isPixelWhite(nlimg, rri) && !imageUtil.isPixelWhite(nlimg, drri)) {
                imageUtil.setPixelColorByIndex(nlimg, righti, 0, 0, 0);
                continue;
            }

            var lli = imageUtil.getNeighbourPixelIndex(nlimg, i, -2, 0);
            var ulli = imageUtil.getNeighbourPixelIndex(nlimg, i, -2, -1); 
            if (imageUtil.isPixelWhite(nlimg, lefti) && !imageUtil.isPixelWhite(nlimg, downi) && imageUtil.isPixelWhite(nlimg, downlefti)
                && !imageUtil.isPixelWhite(nlimg, uplefti) && imageUtil.isPixelWhite(nlimg, lli) && !imageUtil.isPixelWhite(nlimg, ulli)) {
                imageUtil.setPixelColorByIndex(nlimg, lefti, 0, 0, 0);
                continue;
            }

            var urri = imageUtil.getNeighbourPixelIndex(nlimg, i, 2, -1); 
            if (imageUtil.isPixelWhite(nlimg, righti) && !imageUtil.isPixelWhite(nlimg, downi) && imageUtil.isPixelWhite(nlimg, downrighti)
                && !imageUtil.isPixelWhite(nlimg, uprighti) && imageUtil.isPixelWhite(nlimg, rri) && !imageUtil.isPixelWhite(nlimg, urri)) {
                imageUtil.setPixelColorByIndex(nlimg, righti, 0, 0, 0);
                continue;
            }

            var dlli = imageUtil.getNeighbourPixelIndex(nlimg, i, -2, 1); 
            if (imageUtil.isPixelWhite(nlimg, lefti) && !imageUtil.isPixelWhite(nlimg, upi) && imageUtil.isPixelWhite(nlimg, uprighti)
                && !imageUtil.isPixelWhite(nlimg, downlefti) && imageUtil.isPixelWhite(nlimg, lli) && !imageUtil.isPixelWhite(nlimg, dlli)) {
                imageUtil.setPixelColorByIndex(nlimg, lefti, 0, 0, 0);
                continue;
            }


        }
    }

    imageUtil.removeSubImage(imageData, nlimg, 0);
    // return nlimg;
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (!imageUtil.isPixelBlack(imageData, i)) continue;
            var di = imageUtil.getNeighbourPixelIndex(nlimg, i, 0, 1);
            var ddi = imageUtil.getNeighbourPixelIndex(nlimg, i, 0, 2);
            if (!imageUtil.isPixelBlack(imageData, di) && !imageUtil.isPixelWhite(imageData, di) && imageUtil.isPixelWhite(imageData, ddi)) {
                var diffidx = imageUtil.getFirstDiffColorIndex(imageData, i, 0, -1);
                var diffidxup = imageUtil.getNeighbourPixelIndex(imageData, diffidx, 0, -1);
                if (diffidx < 0 || imageUtil.isPixelWhite(imageData, diffidx)
                    || diffidxup < 0 || imageUtil.isPixelWhite(imageData, diffidxup))  {
                    imageUtil.setPixelColorByIndex(imageData, di, 0, 0, 0);
                    if (!imageUtil.isPixelWhite(imageData, diffidx) && !imageUtil.isPixelBlack(imageData, diffidx)) {
                        imageUtil.setPixelColorByIndex(imageData, diffidx, 0, 0, 0);
                    }
                }
            }
            
            var ui = imageUtil.getNeighbourPixelIndex(nlimg, i, 0, -1);
            var uui = imageUtil.getNeighbourPixelIndex(nlimg, i, 0, -2);
            if (!imageUtil.isPixelBlack(imageData, ui) && !imageUtil.isPixelWhite(imageData, ui) && imageUtil.isPixelWhite(imageData, uui)) {
                var diffidx = imageUtil.getFirstDiffColorIndex(imageData, i, 0, 1);
                if (diffidx < 0 || imageUtil.isPixelWhite(imageData, diffidx)) {
                    imageUtil.setPixelColorByIndex(imageData, ui, 0, 0, 0);
                }
            }

            var li = imageUtil.getNeighbourPixelIndex(nlimg, i, -1, 0);
            var lli = imageUtil.getNeighbourPixelIndex(nlimg, i, -2, 0);
            if (!imageUtil.isPixelBlack(imageData, li) && !imageUtil.isPixelWhite(imageData, li) && imageUtil.isPixelWhite(imageData, lli)) {
                var diffidx = imageUtil.getFirstDiffColorIndex(imageData, i, 1, 0);
                var diffidxright = imageUtil.getNeighbourPixelIndex(imageData, diffidx, 1, 0);
                if (diffidx < 0 || imageUtil.isPixelWhite(imageData, diffidx)
                    || diffidxright < 0 || imageUtil.isPixelWhite(imageData, diffidxright))  {
                    imageUtil.setPixelColorByIndex(imageData, li, 0, 0, 0);
                    if (!imageUtil.isPixelWhite(imageData, diffidx) && !imageUtil.isPixelBlack(imageData, diffidx)) {
                        imageUtil.setPixelColorByIndex(imageData, diffidx, 0, 0, 0);
                    }
                }
            }
            
            var ri = imageUtil.getNeighbourPixelIndex(nlimg, i, 1, 0);
            var rri = imageUtil.getNeighbourPixelIndex(nlimg, i, 2, 0);
            if (!imageUtil.isPixelBlack(imageData, ri) && !imageUtil.isPixelWhite(imageData, ri) && imageUtil.isPixelWhite(imageData, rri)) {
                var diffidx = imageUtil.getFirstDiffColorIndex(imageData, i, -1, 0);
                if (diffidx < 0 || imageUtil.isPixelWhite(imageData, diffidx)) {
                    imageUtil.setPixelColorByIndex(imageData, ri, 0, 0, 0);
                }
            }
        }
    }

    return nlimg;
}

function getColorGroups(imageData, groupNum, groupMin, rgbMinDiff) {
    var colorGroups = {};
    var colorKeys = [];
    for (var i = 0; i < imageData.data.length; i += 4) {
        var r = imageData.data[i];
        var g = imageData.data[i + 1];
        var b = imageData.data[i + 2];

        if (r === g && r === b && r === BACKGROUND_COLOR) continue;
        else if (Math.abs(r - g) <= rgbMinDiff && Math.abs(r - b) <= rgbMinDiff && Math.abs(b - g) <= rgbMinDiff
            && r<=110 && g<=110 && b<=110
            || r<=0 && g <= 0 && b<=20) continue;
        var key = r + "_" + g + "_" + b;
        if (!colorGroups[key]) {
            colorKeys.push(key);
            colorGroups[key] = 0;
        }
        colorGroups[key]++;
    }

    colorKeys.sort(function(k1, k2) {
        if (colorGroups[k1] > colorGroups[k2]) return -1;
        else if (colorGroups[k1] < colorGroups[k2]) return 1;
        else return 0;
    })

    var distanceIdx = 1;
    var mainKeys;
    do {
        mainKeys = [colorKeys[0]];
        for (var i = 1; i < colorKeys.length; i++) {
            if (colorGroups[colorKeys[i]] < groupMin) break;
            var rgbarr = colorKeys[i].split("_");
            rgbarr = [Number(rgbarr[0]), Number(rgbarr[1]), Number(rgbarr[2])];

            var diffgroup = true;
            for (var j = 0; j < mainKeys.length; j++) {
                var rgbarrj = mainKeys[j].split("_");
                rgbarrj = [Number(rgbarrj[0]), Number(rgbarrj[1]), Number(rgbarrj[2])];
                if (distanceIn3D(rgbarrj, rgbarr) < distanceIdx * GROUP_COLOR_MIN_DISTANCE) {
                    diffgroup = false;
                    break;
                }
            }

            if (diffgroup) {
                mainKeys.push(colorKeys[i]);
                // console.log("add main group color", diffgroup, colorKeys[i], colorGroups[colorKeys[i]]);
            }
        }
        distanceIdx += 0.3;

        // console.log("length：", distanceIdx, 　mainKeys.length, mainKeys.toString(), colorGroups[mainKeys[0]])
    } while (mainKeys.length > groupNum);

    // for (var i = 0; i < mainKeys.length; i++) {
    //     console.log("mainKeys:", i, mainKeys[i], colorGroups[mainKeys[i]]);
    // }

    var mainColorGroups = [];
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];

            if (r === g && r === b && r === BACKGROUND_COLOR) continue;
            else if (Math.abs(r - g) < rgbMinDiff && Math.abs(r - b) < rgbMinDiff && Math.abs(b - g) < rgbMinDiff) continue;

            for (var m = 0; m < mainKeys.length; m++) {
                var rgbarr = mainKeys[m].split("_");
                rgbarr = [Number(rgbarr[0]), Number(rgbarr[1]), Number(rgbarr[2])];
                if (distanceIn3D(rgbarr, [r, g, b]) < distanceIdx * GROUP_COLOR_MIN_DISTANCE) {
                    if (mainColorGroups[m] === undefined) mainColorGroups[m] = {};
                    mainColorGroups[m][i] = i;
                    break;
                }
            }
        }
    }

    return mainColorGroups;
}


function setRecoverColor(_img, _orig, _rps) {
    if (_rps.length>0) {
        var last0 = _rps[_rps.length-1];
        var last1 = _rps.length>=2?_rps[_rps.length-2]:undefined;
        var isthin = imageUtil.isPixelBlack(_orig, last0) || last1 && imageUtil.isPixelBlack(_orig, last1);
        var nlstart;
        var len = _rps.length;
        for (var j=0; j<len; j++) {
            var ri = _rps[j];
            if(nlstart===undefined && imageUtil.isPixelBlack(_orig, ri)) {
                nlstart = j;                        
            }

            if (nlstart >=3 && imageUtil.isPixelBlack(_orig, ri) && imageUtil.isPixelBlack(_orig, last0)) {
                break;
            }
            _img.data[ri] = _orig.data[ri];
            _img.data[ri+1] = _orig.data[ri+1];
            _img.data[ri+2] = _orig.data[ri+2];

            // if (nlstart >=1 && imageUtil.isPixelBlack(_orig, ri) && imageUtil.isPixelBlack(_orig, last0)) {
            //     break;
            // }

            if (isthin && (j-nlstart>=Math.floor((len-nlstart)/2))) {
                    break;
                }    
        }
    }
}

function hRecoverColorsNearby(img, originImage, leftimg, rightimg) {
    var recoveredMap = {};
    for (var x = 0; x < img.width; x++) {
        for (var y = 0; y < img.height; y++) {
            var i = x * 4 + y * 4 * img.width;
            if (recoveredMap[i] !== undefined) continue;
            var r = img.data[i];
            var g = img.data[i + 1];
            var b = img.data[i + 2];
            if (r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR
                || r===0 && g===0 && b===0) continue;
            
            var lefti = imageUtil.getNeighbourPixelIndex(img, i, -1, 0);
            if (imageUtil.isPixelWhite(img, lefti) ) {
                var rpixels = checkRecoverColorInDirection(i, -1, 0, img, originImage, leftimg, rightimg);
                setRecoverColor(img, originImage, rpixels);
            } 
            
            var righti = imageUtil.getNeighbourPixelIndex(img, i, 1, 0);
            if (imageUtil.isPixelWhite(img, righti) ) {
                var rpixels = checkRecoverColorInDirection(i, 1, 0, img, originImage, leftimg, rightimg);
                setRecoverColor(img, originImage, rpixels);
            } 
            
        }
    }

}

function vRecoverColorsNearby(img, originImage, leftimg, rightimg) {
    var recoveredMap = {};
    for (var x = 0; x < img.width; x++) {
        for (var y = 0; y < img.height; y++) {
            var i = x * 4 + y * 4 * img.width;
            if (recoveredMap[i] !== undefined) continue;
            var r = img.data[i];
            var g = img.data[i + 1];
            var b = img.data[i + 2];
            if (r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR
                || r===0 && g===0 && b===0) continue;
            
                var _setRecoverColor = function (_img, _orig, _rps) {
                    if (_rps.length>0) {
                        var last0 = _rps[_rps.length-1];
                        var islast0black =  imageUtil.isPixelBlack(_orig, last0);

                        var last1 = _rps.length>=2?_rps[_rps.length-2]:undefined;
                        var islast1black = last1 && imageUtil.isPixelBlack(_orig, last1);
                        var nlstart;
                        var len = _rps.length;
                        for (var j=0; j<len; j++) {
                            var ri = _rps[j];
                            if(nlstart===undefined && imageUtil.isPixelBlack(_orig, ri)) {
                                nlstart = j;                        
                            }

                            var _x = (ri%(_orig.width*4));
                            if (imageUtil.isPixelBlack(_orig, ri)
                                && _x>0 && _x<_orig.width-1
                                && imageUtil.isPixelWhite(_img, ri-4)
                                && imageUtil.isPixelWhite(_img, ri+4)) {
                                break;
                            }

                            if (nlstart >=3 && imageUtil.isPixelBlack(_orig, ri) && islast0black) {
                                break;
                            }
                            _img.data[ri] = _orig.data[ri];
                            _img.data[ri+1] = _orig.data[ri+1];
                            _img.data[ri+2] = _orig.data[ri+2];

                            // if (nlstart >=1 && imageUtil.isPixelBlack(_orig, ri) && imageUtil.isPixelBlack(_orig, last0)) {
                            //     break;
                            // }

                            if ((islast0black || islast1black) && (j-nlstart>=Math.floor((len-nlstart)/2))) {
                                    break;
                                }    
                        }
                    }
                }


            var upi = imageUtil.getNeighbourPixelIndex(img, i, 0, -1);
            if (imageUtil.isPixelWhite(img, upi) ) {
                var rpixels = checkRecoverColorInDirection(i, 0, -1, img, originImage, leftimg, rightimg);
                _setRecoverColor(img, originImage, rpixels);
            } 
            
            var downi = imageUtil.getNeighbourPixelIndex(img, i, 0, 1);
            if (imageUtil.isPixelWhite(img, downi) ) {
                var rpixels = checkRecoverColorInDirection(i, 0, 1, img, originImage, leftimg, rightimg);                
                _setRecoverColor(img, originImage, rpixels);
            } 
            
        }
    }

}

function checkRecoverColorInDirection(idx, h, v, img, origImg, leftImg, rightImg) {
    //var tgtidx = imageUtil.getNeighbourPixelIndex(img, idx, h, v);
    //var tgtrgb = [origImg.data[tgtidx], origImg.data[tgtidx+1], origImg.data[tgtidx+2]];
    var srcrgb = [img.data[idx], img.data[idx+1], img.data[idx+2]];
    var recoverPixels = [];
    //if (imageUtil.isPixelWhite(origImg, tgtidx)) return recoverPixels;
    
    for(var i=1; i<30 ;i++) {
        var newidx = idx+h*i*4+v*i*4*img.width;
        var x = (newidx%(origImg.width*4))/4;
            var y = Math.floor(newidx/(origImg.width*4))
        if((imageUtil.isPixelWhite(img, newidx) || i>1) && !imageUtil.isPixelWhite(origImg, newidx)
            && (!leftImg || imageUtil.isPixelWhite(leftImg, newidx)) && (!rightImg || imageUtil.isPixelWhite(rightImg, newidx))) {
            //if (x===36) console.log(x, y, origImg.data[newidx])
            recoverPixels.push(newidx);
            if (imageUtil.isPixelWhite(img, newidx)) {
                continue;                
            }
        }
 
        if((!leftImg || imageUtil.isPixelWhite(leftImg, newidx)) && (!rightImg || imageUtil.isPixelWhite(rightImg, newidx))) {
// if (x===36) console.log("recoverPixels1", x, y, recoverPixels.length, !leftImg, !rightImg, imageUtil.isPixelWhite(rightImg, newidx))
            return recoverPixels;
        } else if (leftImg && !imageUtil.isPixelWhite(leftImg, newidx)) {
            for(var j=0; j<recoverPixels.length; j++) {
                var ridx = recoverPixels[j];
                var rrgb = [origImg.data[ridx], origImg.data[ridx+1], origImg.data[ridx+2]];
                var distance = distanceIn3D(rrgb, srcrgb);
                var distanceleft = distanceIn3D(rrgb, [leftImg.data[newidx], leftImg.data[newidx+1], leftImg.data[newidx+2]]);
                if (distance<distanceleft) continue;
                else {
                    recoverPixels = recoverPixels.slice(0, j);
                    break;
                }
            }
            return recoverPixels;        
        } else if (rightImg && !imageUtil.isPixelWhite(rightImg, newidx)) {
            for(var j=0; j<recoverPixels.length; j++) {
                var ridx = recoverPixels[j];
                var rrgb = [origImg.data[ridx], origImg.data[ridx+1], origImg.data[ridx+2]];
                var distance = distanceIn3D(rrgb, srcrgb);
                var distanceright = distanceIn3D(rrgb, [rightImg.data[newidx], rightImg.data[newidx+1], rightImg.data[newidx+2]]);
                if (distance<distanceright) continue;
                else {
                    recoverPixels = recoverPixels.slice(0, j);
                    break;
                }
            }
            return recoverPixels;
        }
    }


    if (i>20) {

        console.log("ERROR:**********************************************checkRecoverColorInDirection i>18", i, x, y, recoverPixels.length)
        //     Math.floor(newidx/(origImg.width*4)), (newidx%(origImg.width*4))/4, recoverPixels.length);
                // process.exit(1);
        
    }
    return recoverPixels;
}

exports.recoverColorInRange = recoverColorInRange;
function recoverColorInRange(img, leftimg, rightimg, originImage) {
    var range = imageUtil.pixelRange(img);
    var offset = 10;
    var recoverMap = {};
    for (var x = 0; x < img.width; x++) {
        for (var y = 0; y < img.height; y++) {
            var i = x * 4 + y * 4 * img.width;
            var r = img.data[i];
            var g = img.data[i + 1];
            var b = img.data[i + 2];
            if (r !== BACKGROUND_COLOR || g !== BACKGROUND_COLOR || b !== BACKGROUND_COLOR) continue;
            
            if (leftimg) {
                var lr = leftimg.data[i];
                var lg = leftimg.data[i+1];
                var lb = leftimg.data[i+2];
                if (lr !== BACKGROUND_COLOR || lg !== BACKGROUND_COLOR || lb !== BACKGROUND_COLOR) continue;
            }
            if (rightimg) {
                var rr = rightimg.data[i];
                var rg = rightimg.data[i+1];
                var rb = rightimg.data[i+2];
                if (rr !== BACKGROUND_COLOR || rg !== BACKGROUND_COLOR || rb !== BACKGROUND_COLOR) continue;
            }


            img.data[i] = originImage.data[i];
            img.data[i+1] = originImage.data[i+1];
            img.data[i+2] = originImage.data[i+2];
        }
    }

}

function isNoiseLine(img, i) {
    var r = img.data[i];
    var g = img.data[i + 1];
    var b = img.data[i + 2];

    return (Math.abs(r-g) <=40 && Math.abs(r-b) <=40 && Math.abs(b-g) <=40 
        && Math.max(r, Math.max(b,g))<=110);
        
}

function recoverNoiseLineGap(imageData, origImage) {
     for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            if (r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR) continue;
            var downi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, 1);
            if (imageUtil.isPixelWhite(imageData, downi) && imageUtil.isPixelBlack(origImage, downi)) {
                var gappixels = detectNoiseLineEdge(imageData, origImage, i, 0, 1);
                for (var gi=0; gi<gappixels.length; gi++) {
                    var gidx = gappixels[gi];
                    imageUtil.setPixelColorByIndex(imageData, gidx, origImage.data[gidx], origImage.data[gidx+1], origImage.data[gidx+2])
                }
            }

            var upi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, -1);
            if (imageUtil.isPixelWhite(imageData, upi) && imageUtil.isPixelBlack(origImage, upi)) {
                var gappixels = detectNoiseLineEdge(imageData, origImage, i, 0, -1);
                for (var gi=0; gi<gappixels.length; gi++) {
                    var gidx = gappixels[gi];
                    imageUtil.setPixelColorByIndex(imageData, gidx, origImage.data[gidx], origImage.data[gidx+1], origImage.data[gidx+2])
                }
            }

            // var righti = imageUtil.getNeighbourPixelIndex(imageData, i, 1, 0);            
            // if (imageUtil.isPixelWhite(imageData, righti) && isNoiseLine(origImage, righti)) {
            //     var gappixels = detectNoiseLineEdge(imageData, origImage, i, 1, 0);
            //     for (var gi=0; gi<gappixels.length; gi++) {
            //         imageUtil.setPixelColorByIndex(imageData, gappixels[gi], 0, 0, 0)
            //     }
            // }

        }
    }
}

function detectNoiseLineEdge(imageData, orignImage, idx, h, v) {
    var x = (idx % (4 * imageData.width)) / 4;
    var y = Math.floor(idx/(4*imageData.width));
    var idxs = [];
    for (var n=1; n<=9; n++) {
        tx = x +  h*n;
        ty = y + v*n;
        var i = tx * 4 + ty * 4 * imageData.width;

        if (imageUtil.isPixelWhite(orignImage, i)) {
            break;   
        } else if (isNoiseLine(orignImage, i)) {
                idxs.push(i);
        }
        if (!imageUtil.isPixelWhite(imageData, i)) {
            return idxs;
        }

    }

    return [];
}

exports.recoverImage = recoverImage;
function recoverImage(img, origImage){
    var range = imageUtil.pixelRange(img);
    var offset = 0;
    var recoverMap = {};
    for (var x = 0; x < img.width; x++) {
        if (x<range.left-offset || x>range.right+offset) continue;
        for (var y = 0; y < img.height; y++) {
            if (y<range.top-offset || y>range.bottom+offset) continue;
            var i = x * 4 + y * 4 * img.width;
            var r = img.data[i];
            var g = img.data[i + 1];
            var b = img.data[i + 2];
            if (r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR) continue;

            var lefti = imageUtil.getNeighbourPixelIndex(img, i, -1, 0);
            if (lefti>-1) {
                var leftr = img.data[lefti];
                var leftg = img.data[lefti + 1];
                var leftb = img.data[lefti + 2];
                var oleftr = origImage.data[lefti];
                var oleftg = origImage.data[lefti + 1];
                var oleftb = origImage.data[lefti + 2];
                if (leftr===BACKGROUND_COLOR && leftg===BACKGROUND_COLOR && leftb===BACKGROUND_COLOR
                    && (oleftr!==BACKGROUND_COLOR || oleftg!==BACKGROUND_COLOR || oleftb!==BACKGROUND_COLOR)) {
                    recoverMap[lefti] = lefti;
                }
            }

            var righti = imageUtil.getNeighbourPixelIndex(img, i, 1, 0);
            if (righti>-1) {
                var rightr = img.data[righti];
                var rightg = img.data[righti + 1];
                var rightb = img.data[righti + 2];
                var orightr = origImage.data[righti];
                var orightg = origImage.data[righti + 1];
                var orightb = origImage.data[righti + 2];
                if (rightr===BACKGROUND_COLOR && rightg===BACKGROUND_COLOR && rightb===BACKGROUND_COLOR
                    && (orightr!==BACKGROUND_COLOR || orightg!==BACKGROUND_COLOR || orightb!==BACKGROUND_COLOR)) {
                    recoverMap[righti] = righti;
                }
            }

            var upi = imageUtil.getNeighbourPixelIndex(img, i, 0, -1);
            if (upi>-1) {
                var upr = img.data[upi];
                var upg = img.data[upi + 1];
                var upb = img.data[upi + 2];
                var oupr = origImage.data[upi];
                var oupg = origImage.data[upi + 1];
                var oupb = origImage.data[upi + 2];
                if (upr===BACKGROUND_COLOR && upg===BACKGROUND_COLOR && upb===BACKGROUND_COLOR
                    && (oupr!==BACKGROUND_COLOR || oupg!==BACKGROUND_COLOR || oupb!==BACKGROUND_COLOR)) {
                    recoverMap[upi] = upi;
                }
            }
            
            var downi = imageUtil.getNeighbourPixelIndex(img, i, 0, 1);
            if (downi>-1) {
                var downr = img.data[downi];
                var downg = img.data[downi + 1];
                var downb = img.data[downi + 2];
                var odownr = origImage.data[downi];
                var odowng = origImage.data[downi + 1];
                var odownb = origImage.data[downi + 2];
                if (downr===BACKGROUND_COLOR && downg===BACKGROUND_COLOR && downb===BACKGROUND_COLOR
                    && (odownr!==BACKGROUND_COLOR || odowng!==BACKGROUND_COLOR || odownb!==BACKGROUND_COLOR)) {
                    recoverMap[downi] = downi;
                }
            }

        }
    }

    for (var att in recoverMap) {
        var idx = recoverMap[att];
        img.data[idx] = origImage.data[idx];
        img.data[idx+1] = origImage.data[idx+1];
        img.data[idx+2] = origImage.data[idx+2];
    }

}

exports.removeOnePixelColorOnNoise = removeOnePixelColorOnNoise;
function removeOnePixelColorOnNoise(imageData) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            if (r === 0 && g === 0 && b === 0 || r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR) continue;

            var upi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, -1);
            var upr = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi];
            var upg = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi + 1];
            var upb = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi + 2];
            if (upr !== upg || upr !== upb || upr !== 0 && upr !== BACKGROUND_COLOR) continue;

            var lefti = imageUtil.getNeighbourPixelIndex(imageData, i, -1, 0);
            var leftr = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti];
            var leftg = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti + 1];
            var leftb = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti + 2];
            if (leftr !== leftg || leftr !== leftb || leftr !== 0 && leftr !== BACKGROUND_COLOR) continue;

            var righti = imageUtil.getNeighbourPixelIndex(imageData, i, 1, 0);
            var rightr = righti === -1 ? BACKGROUND_COLOR : imageData.data[righti];
            var rightg = righti === -1 ? BACKGROUND_COLOR : imageData.data[righti + 1];
            var rightb = righti === -1 ? BACKGROUND_COLOR : imageData.data[righti + 2];
            if (rightr !== rightg || rightr !== rightb || rightr !== 0 && rightr !== BACKGROUND_COLOR) continue;

            var downi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, 1);
            var downr = downi === -1 ? BACKGROUND_COLOR : imageData.data[downi];
            var downg = downi === -1 ? BACKGROUND_COLOR : imageData.data[downi + 1];
            var downb = downi === -1 ? BACKGROUND_COLOR : imageData.data[downi + 2];
            if (downr !== downg || downr !== downb || downr !== 0 && downr !== BACKGROUND_COLOR) continue;

            imageData.data[i] = BACKGROUND_COLOR;
            imageData.data[i + 1] = BACKGROUND_COLOR;
            imageData.data[i + 2] = BACKGROUND_COLOR;
            imageData.data[i + 3] = BACKGROUND_COLOR;
        }
    }
}

exports.removeNoisePIxels = removeNoisePIxels;

function removeNoisePIxels(imageData) {
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            if (!(r === 0 && g === 0 && b === 0)) continue;

            var upi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, -1);
            var upr = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi];
            var upg = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi + 1];
            var upb = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi + 2];
            if (upr !== upg || upr !== upb || upr !== BACKGROUND_COLOR) continue;

            var fdi = imageUtil.getFirstDiffColorIndex(imageData, i, 0, 1);
            var fdr = fdi === -1 ? BACKGROUND_COLOR : imageData.data[fdi];
            var fdg = fdi === -1 ? BACKGROUND_COLOR : imageData.data[fdi + 1];
            var fdb = fdi === -1 ? BACKGROUND_COLOR : imageData.data[fdi + 2];
            if (fdr !== fdg || fdr !== fdb || fdr !== BACKGROUND_COLOR) continue;

            var lefti = imageUtil.getNeighbourPixelIndex(imageData, i, -1, 0);
            var leftr = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti];
            var leftg = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti + 1];
            var leftb = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti + 2];

            var righti = imageUtil.getNeighbourPixelIndex(imageData, i, 1, 0);
            var rightr = righti === -1 ? BACKGROUND_COLOR : imageData.data[righti];
            var rightg = righti === -1 ? BACKGROUND_COLOR : imageData.data[righti + 1];
            var rightb = righti === -1 ? BACKGROUND_COLOR : imageData.data[righti + 2];

            // var downi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, 1); 
            // var downr = downi===-1 ? BACKGROUND_COLOR : imageData.data[downi];
            // var downg = downi===-1 ? BACKGROUND_COLOR : imageData.data[downi+1];
            // var downb = downi===-1 ? BACKGROUND_COLOR : imageData.data[downi+2];

            if (upr === BACKGROUND_COLOR && upg === BACKGROUND_COLOR && upb === BACKGROUND_COLOR && leftr === BACKGROUND_COLOR && leftg === BACKGROUND_COLOR && leftb === BACKGROUND_COLOR
                // || leftr===BACKGROUND_COLOR && leftg===BACKGROUND_COLOR && leftb===BACKGROUND_COLOR
                // && downr===BACKGROUND_COLOR && downg===BACKGROUND_COLOR && downb===BACKGROUND_COLOR
                || upr === BACKGROUND_COLOR && upg === BACKGROUND_COLOR && upb === BACKGROUND_COLOR && rightr === BACKGROUND_COLOR && rightg === BACKGROUND_COLOR && rightb === BACKGROUND_COLOR
                // || rightr===BACKGROUND_COLOR && rightg===BACKGROUND_COLOR && rightb===BACKGROUND_COLOR
                // && downr===BACKGROUND_COLOR && downg===BACKGROUND_COLOR && downb===BACKGROUND_COLOR
            ) {
                imageData.data[i] = BACKGROUND_COLOR;
                imageData.data[i + 1] = BACKGROUND_COLOR;
                imageData.data[i + 2] = BACKGROUND_COLOR;
                imageData.data[i + 3] = BACKGROUND_COLOR;
                if (rightr === BACKGROUND_COLOR && rightg === BACKGROUND_COLOR && rightb === BACKGROUND_COLOR
                    // && downr===BACKGROUND_COLOR && downg===BACKGROUND_COLOR && downb===BACKGROUND_COLOR
                    // && upr===BACKGROUND_COLOR && upg===BACKGROUND_COLOR && upb===BACKGROUND_COLOR
                ) {
                    x = Math.max(0, x - 2);
                    y = -1;
                }
            }

        }
    }
}

exports.vRemoveNoisePIxels = vRemoveNoisePIxels;

function vRemoveNoisePIxels(imageData, noiseSize) {
    var noiseStart = false;
    var noiseIdxs = [];
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            var upi = imageUtil.getNeighbourPixelIndex(imageData, i, 0, -1);
            var upr = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi];
            var upg = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi + 1];
            var upb = upi === -1 ? BACKGROUND_COLOR : imageData.data[upi + 2];

            var lefti = imageUtil.getNeighbourPixelIndex(imageData, i, -1, 0);
            var leftr = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti];
            var leftg = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti + 1];
            var leftb = lefti === -1 ? BACKGROUND_COLOR : imageData.data[lefti + 2];

            if (r === 0 && g === 0 && b === 0 && upr === BACKGROUND_COLOR && upg === BACKGROUND_COLOR && upb === BACKGROUND_COLOR) {
                noiseStart = true;
                noiseIdxs = [i];
            } else if (noiseStart && r === 0 && g === 0 && b === 0 && upr === 0 && upg === 0 && upb === 0) {
                noiseIdxs.push(i);
            } else if (noiseStart && r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR && upr === 0 && upg === 0 && upb === 0) {
                if (noiseIdxs.length < noiseSize) {
                    for (var ni = 0; ni < noiseIdxs.length; ni++) {
                        var __i = noiseIdxs[ni];
                        imageData.data[__i] = 255;
                        imageData.data[__i + 1] = 255;
                        imageData.data[__i + 2] = 255;
                    }

                }
                noiseStart = false;
            } else {
                noiseStart = false;
                noiseIdxs = [];
            }

        }
    }
}

exports.hRemoveNoisePIxels = hRemoveNoisePIxels;

function hRemoveNoisePIxels(imageData, noiseSize) {
    var noiseStart = false;
    var noiseIdxs = [];
    for (var y = 0; y < imageData.height; y++) {
        for (var x = 0; x < imageData.width; x++) {
            var i = x * 4 + y * 4 * imageData.width;
            var r = imageData.data[i];
            var g = imageData.data[i + 1];
            var b = imageData.data[i + 2];
            var _i = imageUtil.getNeighbourPixelIndex(imageData, i, -1, 0);
            var _r = _i === null ? BACKGROUND_COLOR : imageData.data[_i];
            var _g = _i === null ? BACKGROUND_COLOR : imageData.data[_i + 1];
            var _b = _i === null ? BACKGROUND_COLOR : imageData.data[_i + 2];

            if (r === 0 && g === 0 && b === 0 && _r === BACKGROUND_COLOR && _g === BACKGROUND_COLOR && _b === BACKGROUND_COLOR) {
                noiseStart = true;
                noiseIdxs = [i];
            } else if (noiseStart && r === 0 && g === 0 && b === 0 && _r === 0 && _g === 0 && _b === 0) {
                noiseIdxs.push(i);
            } else if (noiseStart && r === BACKGROUND_COLOR && g === BACKGROUND_COLOR && b === BACKGROUND_COLOR && _r === 0 && _g === 0 && _b === 0) {
                for (var ni = 0; noiseIdxs.length < noiseSize && ni < noiseIdxs.length; ni++) {
                    var __i = noiseIdxs[ni];
                    imageData.data[__i] = 255;
                    imageData.data[__i + 1] = 255;
                    imageData.data[__i + 2] = 255;
                }
                noiseStart = false;
            } else {
                noiseStart = false;
                noiseIdxs = [];
            }

        }
    }
}

exports.identifyCharactorIslets = identifyCharactorIslets;

function identifyCharactorIslets(imageData) {
    var passedPixels = {};
    var charactors = [];
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] === BACKGROUND_COLOR) continue;
            if (passedPixels[i] !== undefined) {
                continue;
            }
            var pmap = {};
            imageUtil.detectIslet(imageData, x, y, pmap, BACKGROUND_COLOR);
            var count = 0;
            for (var att in pmap) {
                if (passedPixels[att] !== undefined) console.log("ERROR: identifyCharactors", att);
                passedPixels[att] = pmap[att];
                count++;
            }

            if (count > 400) {
                charactors.push(pmap);
            }
        }
    }

    // if (charactors.length>CHAR_COUNT) {
    //     for (var i=0; i<charactors.length-1; i++) {

    //         var joins = similarColorGroups(imageData, charactors[i], charactors[i+1]);
    //         if (joins.length === 1) {
    //             charactors.splice(i, 2, joins[0]);
    //             break;
    //         }
    //     }
    // }

    var newCharactors = [];
    // console.log("charactors.length", charactors.length)
    var split = true;
    if (charactors.length < CHAR_COUNT) {
        for (var i = 0; i < charactors.length; i++) {
            if (split) {
                var groups = groupColorsIn3D(imageData, charactors[i]);
                newCharactors = newCharactors.concat(groups);
                // split = false;
            } else {
                newCharactors.push(charactors[i]);
            }

        }
        charactors = newCharactors;
    }

    return charactors;
}

function similarColorGroups(imageData, pixelMap0, pixelMap1) {
    var joinMap = {};
    for (var att in pixelMap0) {
        joinMap[att] = pixelMap0[att];
    }
    for (var att in pixelMap1) {
        joinMap[att] = pixelMap1[att];
    }
    var imgs = groupColorsIn3D(imageData, joinMap);
    // console.log("compareColorGroups", imgs.length)
    return imgs;
}

function groupColorsIn3D(imageData, pixelMap) {
    var colorGroups = {};
    var colorKeys = [];
    for (var att in pixelMap) {
        var i = pixelMap[att];
        var r = imageData.data[i];
        var g = imageData.data[i + 1];
        var b = imageData.data[i + 2];

        if (r === g && r === b) continue;

        var key = r + "_" + g + "_" + b;
        if (!colorGroups[key]) {
            colorKeys.push(key);
            colorGroups[key] = 0;
        }
        colorGroups[key]++;
    }

    colorKeys.sort(function(k1, k2) {
        if (colorGroups[k1] > colorGroups[k2]) return -1;
        else if (colorGroups[k1] < colorGroups[k2]) return 1;
        else return 0;
    })

    // console.log("\nsorted groupKeys:", colorKeys.toString())
    // console.log(colorKeys[0], colorGroups[colorKeys[0]]
    //      , colorKeys[1]?(colorKeys[1]+" "+colorGroups[colorKeys[1]]):""
    //      , colorKeys[2]?(colorKeys[2]+" "+colorGroups[colorKeys[2]]):""
    //  , colorKeys[3]?(colorKeys[3]+" "+colorGroups[colorKeys[3]].length):""
    //  , colorKeys[4]?(colorKeys[4]+" "+colorGroups[colorKeys[4]].length):""
    // , colorKeys[5]?(colorKeys[5]+" "+colorGroups[colorKeys[5]].length):""
    // , colorKeys[6]?(colorKeys[6]+" "+colorGroups[colorKeys[6]].length):""
    // , colorKeys[7]?(colorKeys[7]+" "+colorGroups[colorKeys[7]].length):""
    // , colorKeys[8]?(colorKeys[8]+" "+colorGroups[colorKeys[8]].length):""
    // )

    var corekey0 = colorKeys[0];
    var rgbarr0 = corekey0.split("_");
    var corergb0 = [Number(rgbarr0[0]), Number(rgbarr0[1]), Number(rgbarr0[2])];
    var corekey1;
    for (var i = 1; i < colorKeys.length; i++) {
        var rgb = colorKeys[i].split('_');
        var rgbv = [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])]
        if (distanceIn3D(corergb0, rgbv) > GROUP_COLOR_MIN_DISTANCE) {
            corekey1 = colorKeys[i];
            // console.log(corekey0, corekey1, colorGroups[corekey1], GROUP_COLOR_MIN_DISTANCE, distanceIn3D(corergb0, rgbv))
            break;
        }
    }

    if (!corekey1 || colorGroups[corekey1] < COLOR_GROUP_MIN) return [pixelMap];

    var rgbarr1 = corekey1.split('_');
    var corergb1 = [Number(rgbarr1[0]), Number(rgbarr1[1]), Number(rgbarr1[2])];
    // console.log("core distance:****", corergb0, corergb1)
    var colorGroup0 = {},
        colorGroup1 = {};
    var groupLen0 = 0,
        groupLen1 = 0;
    var xsum0 = 0,
        xsum1 = 0;
    for (var att in pixelMap) {
        var i = pixelMap[att];
        var x = (i % (4 * imageData.width)) / 4;
        var r = imageData.data[i];
        var g = imageData.data[i + 1];
        var b = imageData.data[i + 2];
        var dist0 = distanceIn3D(corergb0, [r, g, b]);
        if (dist0 <= GROUP_COLOR_MIN_DISTANCE) {
            colorGroup0[i] = i;
            groupLen0++;
            xsum0 += x;
        }
        var dist1 = distanceIn3D(corergb1, [r, g, b]);
        if (dist1 <= GROUP_COLOR_MIN_DISTANCE) {
            colorGroup1[i] = i;
            groupLen1++;
            xsum1 += x;
        }
    }
    if (groupLen0 < MINIMUM_CHAR_PIXEL) return [pixelMap];
    else if (groupLen1 < MINIMUM_CHAR_PIXEL) return [pixelMap];
    else {
        var group0 = {},
            group1 = {};
        for (var att in pixelMap) {
            if (colorGroup0[att] === undefined) group1[att] = pixelMap[att];
            if (colorGroup1[att] === undefined) group0[att] = pixelMap[att];
        }

        var avex0 = xsum0 / groupLen0;
        var avex1 = xsum1 / groupLen1;
        return avex0 < avex1 ? [group0, group1] : [group1, group0];
    }
}

function distanceIn3D(p0, p1) {
    return Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2) + Math.pow(p0[2] - p1[2], 2));
}

function splitCharactors(imageData, pixelMap) {
    var colorGroups = {};
    var groupKeys = [];
    var group3Map = {};
    for (var att in pixelMap) {
        var i = pixelMap[att];
        var rgb = {};
        rgb.r = imageData.data[i];
        rgb.g = imageData.data[i + 1];
        rgb.b = imageData.data[i + 2];
        var arr = ['r', 'g', 'b'];
        arr.sort(function(c1, c2) {
            if (rgb[c1] > rgb[c2]) return -1;
            else if (rgb[c1] < rgb[c2]) return 1;
            else return 0;
        })

        var pushKey = function(key) {
            if (colorGroups[key] === undefined) {
                groupKeys.push(key);
                colorGroups[key] = [];
            }
            colorGroups[key].push(i);
        }
        var pushKey3 = function(key) {
            if (colorGroups[key] === undefined) {
                group3Map[key] = key;
                colorGroups[key] = [];
            }
            colorGroups[key].push(i);
        }

        var offset = 30;
        if (rgb[arr[0]] - rgb[arr[1]] >= offset) {
            var key = arr[0] + "_";
            pushKey(key);
        }

        if (rgb[arr[1]] - rgb[arr[2]] >= offset) {
            var key = "_" + arr[2];
            pushKey(key);
        }


        if (rgb[arr[0]] - rgb[arr[1]] >= offset && rgb[arr[1]] - rgb[arr[2]] < offset) {
            var key = arr[0] + "_" + arr[1] + arr[2];
            pushKey3(key);
        }

        if (rgb[arr[0]] - rgb[arr[1]] < offset && rgb[arr[1]] - rgb[arr[2]] >= offset) {
            var key = arr[0] + arr[1] + "_" + arr[2];
            pushKey3(key);
        }

        if (rgb[arr[0]] - rgb[arr[1]] >= offset && rgb[arr[1]] - rgb[arr[2]] >= offset) {
            var key = arr[0] + "_" + arr[1] + "_" + arr[2];
            pushKey3(key);
        }

        if (rgb[arr[0]] - rgb[arr[1]] < offset && rgb[arr[1]] - rgb[arr[2]] < offset) {
            var key = arr[0] + arr[1] + arr[2];
            pushKey3(key);
        }

    }

    groupKeys.sort(function(k1, k2) {
        if (colorGroups[k1].length > colorGroups[k2].length) return -1;
        else if (colorGroups[k1].length < colorGroups[k2].length) return 1;
        else return 0;
    })


    // console.log("\nsorted groupKeys:", groupKeys.toString())
    // console.log(groupKeys[0], colorGroups[groupKeys[0]].length, groupKeys[1] ? (groupKeys[1] + " " + colorGroups[groupKeys[1]].length) : "", groupKeys[2] ? (groupKeys[2] + " " + colorGroups[groupKeys[2]].length) : "", groupKeys[3] ? (groupKeys[3] + " " + colorGroups[groupKeys[3]].length) : "", groupKeys[4] ? (groupKeys[4] + " " + colorGroups[groupKeys[4]].length) : "", groupKeys[5] ? (groupKeys[5] + " " + colorGroups[groupKeys[5]].length) : "", groupKeys[6] ? (groupKeys[6] + " " + colorGroups[groupKeys[6]].length) : "", groupKeys[7] ? (groupKeys[7] + " " + colorGroups[groupKeys[7]].length) : "", groupKeys[8] ? (groupKeys[8] + " " + colorGroups[groupKeys[8]].length) : "")

    // for (var att in group3Map) {
    //     console.log("=====", att, colorGroups[att].length);
    // }

    var key0 = groupKeys[0];
    var key1;
    for (var i = 0; i < groupKeys.length; i++) {
        var keyi = groupKeys[i];
        if (colorGroups[keyi].length < MINIMUM_CHAR_PIXEL) break;
        for (var j = i - 1; j >= 0; j--) {
            var keyj = groupKeys[j];
            if (keyi.indexOf("_") === keyj.indexOf("_") || keyi.replace("_", "") === keyj.replace("_", "")) {
                key0 = keyi;
                key1 = keyj;
                break;
            } else {
                var combokey0 = "";
                var comboGroup0 = [];
                var combokey1 = "";
                var comboGroup1 = [];
                var combokey2 = "";
                var comboGroup2 = [];
                for (var att3 in group3Map) {
                    if ((att3.indexOf(keyi) === 0 || att3.indexOf(keyi) === att3.length - 2) && (att3.indexOf(keyj) === 0 || att3.indexOf(keyj) === att3.length - 2)) {
                        combokey2 += att3;
                        comboGroup2 = comboGroup2.concat(colorGroups[att3])
                        continue;
                    }

                    if (att3.indexOf(keyi) === 0 || att3.indexOf(keyi) === att3.length - 2) {
                        combokey0 += att3;
                        comboGroup0 = comboGroup0.concat(colorGroups[att3])
                    }

                    if (att3.indexOf(keyj) === 0 || att3.indexOf(keyj) === att3.length - 2) {
                        combokey1 += att3;
                        comboGroup1 = comboGroup1.concat(colorGroups[att3])
                    }

                }
                // console.log("----", combokey0, combokey1, combokey2)
                if (comboGroup0.length < MINIMUM_CHAR_PIXEL && comboGroup2.length > MINIMUM_CHAR_PIXEL) {
                    combokey0 = combokey2;
                    comboGroup0 = comboGroup2;
                } else if (comboGroup1.length < MINIMUM_CHAR_PIXEL && comboGroup2.length > MINIMUM_CHAR_PIXEL) {
                    combokey1 = combokey2;
                    comboGroup1 = comboGroup2;
                }

                // console.log("----", combokey0, comboGroup0.length, combokey1, comboGroup1.length)
                if (comboGroup0.length > MINIMUM_CHAR_PIXEL && comboGroup1.length > MINIMUM_CHAR_PIXEL) {
                    var distance = groupXDistance(imageData, comboGroup0, comboGroup1);
                    if (distance > 10) {
                        key0 = combokey0;
                        colorGroups[key0] = comboGroup0;
                        key1 = combokey1;
                        colorGroups[key1] = comboGroup1;

                        break;
                    }
                }

            }
        }
        if (key1 !== undefined) break;
    }

    // if (key1) console.log("=============", key0, colorGroups[key0].length, key1, colorGroups[key1].length)
    if (key1 === undefined) return [pixelMap];

    var _pixels0 = colorGroups[key0];
    var _pixelsMap0 = {};
    var sumx0 = 0;
    for (var i = 0; i < _pixels0.length; i++) {
        var idx = _pixels0[i];
        _pixelsMap0[idx] = idx;
        sumx0 += (idx % (4 * imageData.width)) / 4;
    }
    var avex0 = sumx0 / _pixels0.length;

    var _pixels1 = colorGroups[key1];
    var _pixelsMap1 = {};
    var sumx1 = 0;
    for (var i = 0; i < _pixels1.length; i++) {
        var idx = _pixels1[i];
        _pixelsMap1[idx] = idx;
        sumx1 += (idx % (4 * imageData.width)) / 4;
    }
    var avex1 = sumx1 / _pixels1.length;

    if (Math.abs(avex0 - avex1) < 10) {
        // console.log("00000000", avex0 - avex1)
        return [pixelMap];
    }

    var map0 = {},
        map1 = {};
    for (var att in pixelMap) {
        if (_pixelsMap1[att] === undefined) {
            map0[att] = pixelMap[att];
        }
        if (_pixelsMap0[att] === undefined) {
            map1[att] = pixelMap[att];
        }
    }

    var subPixelGroups = avex0 < avex1 ? [map0, map1] : [map1, map0];

    return subPixelGroups;
}

function groupXDistance(imageData, g0, g1) {
    var sumx0 = 0;
    for (var i = 0; i < g0.length; i++) {
        var idx = g0[i];
        sumx0 += (idx % (4 * imageData.width)) / 4;
    }
    var avex0 = sumx0 / g0.length;
    var sumx1 = 0;
    for (var i = 0; i < g1.length; i++) {
        var idx = g1[i];
        sumx1 += (idx % (4 * imageData.width)) / 4;
    }
    var avex1 = sumx1 / g1.length;
    return Math.abs(avex0 - avex1);
}

function generateCharactorImageWithNoPadding(imageData, pixelMap) {
    var left = Infinity,
        right = -1,
        top = Infinity,
        bottom = -1;
    for (var att in pixelMap) {
        var idx = pixelMap[att];
        var x = (idx % (4 * imageData.width)) / 4;
        var y = Math.floor(idx / (4 * imageData.width));
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
    }

    var newImage = {
        width: right - left + 1,
        height: bottom - top + 1,
        data: []
    };
    for (var y = 0; y < newImage.height; y++) {
        for (var x = 0; x < newImage.width; x++) {
            var i = (x + left) * 4 + (y + top) * 4 * imageData.width;
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
    // console.log("generateCharactorImage", newImage.width, newImage.height, newImage.data.length, newImage.data[newImage.data.length-1]);
    return newImage;
}


exports.removeThinPixels = removeThinPixels;

function removeThinPixels(imageData) {
    var detectedMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] === BACKGROUND_COLOR && imageData.data[i + 1] === BACKGROUND_COLOR && imageData.data[i + 2] === BACKGROUND_COLOR) {
                continue;
            }

            if (imageUtil.isThinPixel(i, imageData)) {
                detectedMap[i] = i;
                //imageUtil.setPixelColor(imageData, x, y, BACKGROUND_COLOR, BACKGROUND_COLOR, BACKGROUND_COLOR)
            }
            // if (detectedMap[i] !== undefined) continue;

            // var noiseMap = {};
            // var count = 0;
            // imageUtil.detectIslet(imageData, x, y, noiseMap, BACKGROUND_COLOR);
            // for (var att in noiseMap) {
            //     detectedMap[att] = noiseMap[att];
            //     count++;
            // }
            // if (count>5) continue;
            // for (var att in noiseMap) {
            //     attv = noiseMap[att];
            //     imageData.data[attv] = BACKGROUND_COLOR;
            //     imageData.data[attv + 1] = BACKGROUND_COLOR;
            //     imageData.data[attv + 2] = BACKGROUND_COLOR;
            // }
        }
    }

    for (var att in detectedMap) {
        var idx = detectedMap[att];
        imageData.data[idx] = BACKGROUND_COLOR;
        imageData.data[idx+1] = BACKGROUND_COLOR;
        imageData.data[idx+2] = BACKGROUND_COLOR;
    }
}

exports.vRemoveFarPixels = vRemoveFarPixels;

function vRemoveFarPixels(imageData) {
    var yMap = {};
    var ymaxPixels = 0,
        maxY;
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            if (yMap[y] === undefined) yMap[y] = 0;
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR || imageData.data[i + 1] !== BACKGROUND_COLOR || imageData.data[i + 2] !== BACKGROUND_COLOR) {
                yMap[y]++;
                if (yMap[y] > ymaxPixels) {
                    ymaxPixels = yMap[y];
                    maxY = y;
                }
            }
        }
    }

    var bottom = imageData.height - 1;
    var gapwidth = 0;
    for (var i = maxY; i < imageData.height; i++) {
        if (yMap[i] === 0) {
            gapwidth++;
        } else {
            gapwidth = 0;
        }
        if (gapwidth === 10) {
            bottom = i;
            break;
        }
    }
    gapwidth = 0;
    var top = 0;
    for (var i = maxY; i >= 0; i--) {
        if (yMap[i] === 0) {
            gapwidth++;
        } else {
            gapwidth = 0;
        }
        if (gapwidth === 10) {
            top = i;
            break;
        }
    }


    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            if (y >= top && y <= bottom) continue;
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR || imageData.data[i + 1] !== BACKGROUND_COLOR || imageData.data[i + 2] !== BACKGROUND_COLOR) {
                imageData.data[i] = BACKGROUND_COLOR;
                imageData.data[i + 1] = BACKGROUND_COLOR;
                imageData.data[i + 2] = BACKGROUND_COLOR;
            }
        }
    }

}

exports.hScanForCharactorImages = hScanForCharactorImages;
function hScanForCharactorImages(imageData) {

    var xgapwidth = 0;
    var charPassed = false;
    var seqPixelCount = 0;
    var x = 0;
    var pixelMap = {};
    var imgs = [];
    for (x = 0; x < imageData.width; x++) {
        var xcount = 0;
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR || imageData.data[i + 1] !== BACKGROUND_COLOR || imageData.data[i + 2] !== BACKGROUND_COLOR) {
                xcount++;
                pixelMap[i] = i;
            }
        }

        if (xcount>3) {
            seqPixelCount+=xcount;
            xgapwidth = 0;
        } else {
            if (xgapwidth>10) seqPixelCount = 0;
            xgapwidth++;
        }

        if (seqPixelCount>200) charPassed = true;

        if ((xgapwidth>10 || x === imageData.width-1) && charPassed) {
            var img = imageUtil.getSubImage(imageData, pixelMap);
            imgs.push(img);
            seqPixelCount = 0;
            charPassed = false;
            pixelMap = {};
        }

    }

    return imgs

}


exports.hRemoveFarPixels = hRemoveFarPixels;

function hRemoveFarPixels(imageData) {
    var xMap = {};
    var xmaxPixels = 0,
        maxX;

    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (xMap[x] === undefined) xMap[x] = 0;
            if (imageData.data[i] !== BACKGROUND_COLOR || imageData.data[i + 1] !== BACKGROUND_COLOR || imageData.data[i + 2] !== BACKGROUND_COLOR) {
                xMap[x]++;
                if (xMap[x] > xmaxPixels) {
                    xmaxPixels = xMap[x];
                    maxX = x;

                }

            }
        }
    }
    var left = 0;
    var gapwidth = 0;
    for (var i = maxX; i>=0; i--) {
        if (xMap[i] === 0) {
            gapwidth++;
        } else {
            gapwidth = 0;
        }
        if (gapwidth === 10) {
            left = i + 10;
            break;
        }
    }

    gapwidth = 0;
    var right = imageData.width-1;
    for (var i = maxX; i < imageData.width; i++) {
        if (xMap[i] === 0) {
            gapwidth++;
        } else {
            gapwidth = 0;
        }
        if (gapwidth === 10) {
            right = i - 10;
            break;
        }
    }

    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            if (x >= left && x <= right) continue;
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] !== BACKGROUND_COLOR || imageData.data[i + 1] !== BACKGROUND_COLOR || imageData.data[i + 2] !== BACKGROUND_COLOR) {
                imageData.data[i] = BACKGROUND_COLOR;
                imageData.data[i + 1] = BACKGROUND_COLOR;
                imageData.data[i + 2] = BACKGROUND_COLOR;
            }
        }
    }

}

exports.removeNoiseIslet = removeNoiseIslet;

function removeNoiseIslet(imageData) {
    var detectedMap = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (detectedMap[i] !== undefined) continue;

            if (imageData.data[i] === 0 && imageData.data[i + 1] === 0 && imageData.data[i + 2] === 0) {

                var noiseMap = {};
                imageUtil.detectIslet(imageData, x, y, noiseMap, BACKGROUND_COLOR);
                // var isNoise = true;
                for (var _ii in noiseMap) {
                    detectedMap[_ii] = noiseMap[_ii];
                }
                var colorPixels = 0;
                var noisePixels = 0;
                for (var _i in noiseMap) {
                    var _inum = noiseMap[_i];
                    if (imageData.data[_inum] !== 0 || imageData.data[_inum + 1] !== 0 || imageData.data[_inum + 2] !== 0) {
                        // isNoise = false;
                        // break;
                        colorPixels++;
                    } else {
                        noisePixels++;
                    }
                }

                // if (!isNoise) continue;
                if (colorPixels > COLOR_ISLET_MAX_NUM || noisePixels > COLOR_ISLET_MAX_NUM || colorPixels > noisePixels) continue;

                for (var _i in noiseMap) {
                    var _inum = noiseMap[_i];
                    imageData.data[_inum] = BACKGROUND_COLOR;
                    imageData.data[_inum + 1] = BACKGROUND_COLOR;
                    imageData.data[_inum + 2] = BACKGROUND_COLOR;
                }

            }
        }
    }

}


exports.removeColorNoiseIslets = removeColorNoiseIslets;

function removeColorNoiseIslets(imageData, pixelsNum) {
    if (!pixelsNum) pixelsNum = COLOR_ISLET_MAX_NUM
    var detectedPixels = {};
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;

            if (detectedPixels[i] !== undefined || imageData.data[i] === BACKGROUND_COLOR && imageData.data[i + 1] === BACKGROUND_COLOR && imageData.data[i + 2] === BACKGROUND_COLOR) continue;

            var nbrs = {};
            imageUtil.detectIslet(imageData, x, y, nbrs, BACKGROUND_COLOR);

            var count = 0;
            for (var att in nbrs) {
                detectedPixels[att] = nbrs[att];
                count++;
            }

            if (count > pixelsNum) {
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


exports.removeFarIslets = removeFarIslets;

function removeFarIslets(imageData, fardistance) {
    var detectedPixels = {};
    var mainland;
    var mainlandpixels = 0;
    var islets = [];
    for (var x = 0; x < imageData.width; x++) {
        for (var y = 0; y < imageData.height; y++) {
            var i = x * 4 + y * 4 * imageData.width;

            if (detectedPixels[i] !== undefined || imageData.data[i] === BACKGROUND_COLOR && imageData.data[i + 1] === BACKGROUND_COLOR && imageData.data[i + 2] === BACKGROUND_COLOR) continue;

            var nbrs = {};
            imageUtil.detectIslet(imageData, x, y, nbrs, BACKGROUND_COLOR);
            var count = 0;
            for (var att in nbrs) {
                detectedPixels[att] = nbrs[att];
                count++;
            }
            if (count > mainlandpixels) {
                mainlandpixels = count;
                mainland = nbrs;
            }
            islets.push(nbrs);
        }
    }

    var mainlandBorders = imageUtil.getIsletBorders(imageData, mainland);
    for (var i = 0; i < islets.length; i++) {
        if (islets[i] === mainland) continue;
        var borders = imageUtil.getIsletBorders(imageData, islets[i]);
        if (mainlandBorders.left - borders.right > fardistance || mainlandBorders.top - borders.bottom > fardistance || borders.left - mainlandBorders.right > fardistance || borders.top - mainlandBorders.bottom > fardistance) {
            imageUtil.clearIslet(islets[i], imageData);
        }
    }




}
