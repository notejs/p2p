var fs = require('fs');

var repository;

var IMAGE_STANDARD_SIZE = 32;
var MIN_MATCH_RATIO = 0.80;

exports.init = init;
function init(){
    loadCharactorImages();
    return this;
}

function loadCharactorImages() {
    var exists = fs.existsSync("captcha/data.dat");
    if (exists) {
        var content = fs.readFileSync("captcha/data.dat", "utf8");
        repository = JSON.parse(content);
    } else {
        repository = {};
    }

}

exports.getCharactorImages = getCharactorImages;
function getCharactorImages(charactor) {
    var dataArr = repository[charactor];
    var imgs = [];
    for (var i=0; dataArr && i<dataArr.length; i++) {
        var data = dataArr[i];
        var img = convertDataToImage(data);
        imgs.push(img);
    }

    return imgs;
}

function convertDataToImage(data) {
    var img = {width:data.width, height:data.height, data: []};
    for (var j=0; j<data.data.length; j++) {
        if (data.data[j] === 0) {
            img.data.push(255);
            img.data.push(255);
            img.data.push(255);
            img.data.push(255);
        } else {
            img.data.push(0);
            img.data.push(0);
            img.data.push(0);
            img.data.push(255);
        }
    }

    return img;
}

exports.guess = guess;
function guess(imageData, type) {
    var maxRatio = 0;
    var maxRatioCharactor;
    var maxRatioImage;
    var img = convertToData(imageData);
    for (var charactor in repository) {
        var learnedArr = repository[charactor];
        for (var i=0; learnedArr && i<learnedArr.length; i++) {
            var learned = learnedArr[i];
            if (Math.abs(learned.pixelNum-img.pixelNum)/Math.min(learned.pixelNum,img.pixelNum)>0.2) continue;
            if (Math.abs(img.width-learned.width)/IMAGE_STANDARD_SIZE > 0.1
                || Math.abs(img.height-learned.height)/IMAGE_STANDARD_SIZE > 0.1) {
                continue;
            }
            var overlap = overlapPixels(img, learned);

            var r1 = overlap/learned.pixelNum;
            var r2 = overlap/img.pixelNum;
            var r = (r1+r2)/2
            if (charactor==="t" || charactor==='r') {
                console.log("guess....", charactor, r, r1, r2, overlap, img.pixelNum, learned.pixelNum)
            }
            if (r > MIN_MATCH_RATIO && maxRatio < r) {
                maxRatio = r;
                maxRatioCharactor = charactor;
                maxRatioImage = learned;
            }
        }
    }

    if (maxRatio===0) return null;
    
    return type==="charactor" ? maxRatioCharactor : convertDataToImage(maxRatioImage);
}

function matchCharactor(charactor, imageData){
    var learnedArr = repository[charactor];
    var img = imageData;//convertToData(imageData);
    for (var i=0; learnedArr && i<learnedArr.length; i++) {
        var learned = learnedArr[i];
        if (Math.abs(learned.pixelNum-img.pixelNum)/Math.min(learned.pixelNum,img.pixelNum)>0.2) continue;
        if (Math.abs(img.width-learned.width)/IMAGE_STANDARD_SIZE > 0.1
            || Math.abs(img.height-learned.height)/IMAGE_STANDARD_SIZE > 0.1) {
            continue;
        }
        var overlap = overlapPixels(img, learned);

        // if (overlap/learned.pixelNum > 0.8 && overlap/img.pixelNum > 0.8) {
        //     console.log("matchCharactor", charactor, overlap, learned.pixelNum, img.pixelNum, overlap/learned.pixelNum, overlap/img.pixelNum);
        // }
        var r1 = overlap/learned.pixelNum;
        var r2 = overlap/img.pixelNum;
        if (r1 > MIN_MATCH_RATIO && r2 > MIN_MATCH_RATIO) {
            // console.log("matchCharactor", charactor, overlap, learned.pixelNum, img.pixelNum, overlap/learned.pixelNum, overlap/img.pixelNum);
            return true;
        }
    }

    return false;
}

function overlapPixels(source, target, offsetx, offsety) {
    if (offsetx === undefined) offsetx = 0;
    if (offsety === undefined) offsety = 0;
    var overlap = 0;
    for (var y=0; y<target.height; y++) {
        for (var x=0; x<target.width; x++) {
            var ti = x+y*target.width;
            var tv = target.data[ti];
            if ((x-offsetx) < 0 || (y-offsety)< 0
                || (x-offsetx) >= source.width || (y-offsety) >= source.height) continue;
            var si = x-offsetx + (y-offsety)*source.width;
            var sv = source.data[si];
            if (tv===1 && tv === sv) overlap++;
        }
    }
    
    return overlap;
}

exports.addCharactorImage = addCharactorImage;
function addCharactorImage(imageData, charactor) { 
    var data = convertToData(imageData);

    if (!repository[charactor]) {
        repository[charactor] = [];
    }
    
    if (!matchCharactor(charactor, data)) {
        repository[charactor].push(data);
        console.log("added, match = ", charactor, repository[charactor].length)
    } else {
        //console.log("Not added, match:", charactor)
    }
}

exports.save = save; 
function save() {
    // console.log("y/Y", repository['y'].length, repository['Y'].length)
    fs.writeFileSync("captcha/data.dat", JSON.stringify(repository));
}

function convertToData(imageData) {
    var data = {
        width: imageData.width,
        height: imageData.height,
        pixelNum: 0,
        data: []
    };
    var pixelNum = 0;
    for (var y = 0; y < imageData.height; y++) {
        for (var x = 0; x < imageData.width; x++) {
            var i = x * 4 + y * 4 * imageData.width;
            if (imageData.data[i] === 255 && imageData.data[i + 1] === 255 && imageData.data[i + 2] === 255 && imageData.data[i + 3] === 255) {
                data.data.push(0);
            } else {
                data.data.push(1);
                pixelNum++
            }
        }
    }
    data.pixelNum = pixelNum;

    return data;
}