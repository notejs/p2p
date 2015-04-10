
var imageUtil = require('./captcha/imageutil');
var imageProcessor = require('./captcha/imageprocessor').config({
    MINOR_PIXEL_NOISE_LIMIT: 20,
    BACKGROUND_COLOR: 255,
    COLOR_RANGE_OFFSET: 5,
    HOLLOW_PIXELS_MAX_NUM: 20,
    COLOR_ISLET_MAX_NUM: 20
    });

var webdriver = require('selenium-webdriver');
var ajaxRequest = require('request');

var driver = new webdriver.Builder().
withCapabilities(webdriver.Capabilities.chrome()).
build();

var timeouts = (new webdriver.WebDriver.Timeouts(driver))
timeouts.setScriptTimeout(10000);

// driver.get('https://user.lufax.com/user/captcha/captcha.jpg?source=login&_=1426057499488');
//hby3 huu4 7ng8 7pec                                7ng8
driver.get('file:///D:/works/bitbucket/p2p/images/huu4.jpg');
driver.sleep(1000);


var CHAR_COUNT = 4;

function crackCaptcha(imageData) {
    imageProcessor.degrade(imageData);
    imageProcessor.removeBackground(imageData);
    //imageData = imageUtil.shrinkImage(imageData, 2);
    imageProcessor.vRemoveNoisePIxels(imageData, 6);
    imageProcessor.hRemoveNoisePIxels(imageData, 6);
    var cpixels = imageProcessor.identifyCharactorIslets(imageData);
    var imgs = [];
    for (var i=0; i<cpixels.length; i++) {
        var img = imageProcessor.generateCharactorImage(imageData, cpixels[i]);
        imageProcessor.vRemoveNoisePIxels(img, 6);
        imageProcessor.hRemoveNoisePIxels(img, 6);
        imageProcessor.removeNoiseIslet(img);
        imageProcessor.vRemoveNoisePIxels(img, 6);

        //imageProcessor.removeColorNoiseIslets(img);
        
        img = imageUtil.removePadding(img, 255);
        img = imageUtil.scale(img, 32, 32);

        imageProcessor.hRemoveNoisePIxels(img, 4);
        imageProcessor.vRemoveNoisePIxels(img, 4);
        imageProcessor.removeColorNoiseIslets(img, 4);

        imageUtil.makeSingleColor(img, 0);

        imgs.push(img);
    }
    return imgs;
}

function crackCaptcha1(imageData) {
    imageUtil.grayImageData(imageData);
    var charColorRangeMap = imageProcessor.identifyCharactorColorRange(imageData, CHAR_COUNT);
    imageProcessor.simplifyCharColors(imageData, CHAR_COUNT, charColorRangeMap);
    imageProcessor.mergeEdgeColors(imageData, CHAR_COUNT);

    imageProcessor.verticallyRepairSimplifiedImage(imageData);
    var images = [];
    imgData = imageProcessor.generateCharactorImageData(imageData, charColorRangeMap[0][2], CHAR_COUNT, 0);
    imageProcessor.fillHollow(imgData);
    imageProcessor.removeNoisePixels(imgData);
    imageProcessor.repairPixelsH(imgData);
    imageProcessor.repairPixelsV(imgData);
    //shrinkImage(imageData, 2);
    imageProcessor.removeNoisePixels(imgData);
    imageProcessor.removeColorIslets(imgData)
    
    images.push(imgData)

    imgData = imageProcessor.generateCharactorImageData(imageData, charColorRangeMap[1][2], CHAR_COUNT, 1);
    imageProcessor.fillHollow(imgData);
    imageProcessor.removeNoisePixels(imgData);
    imageProcessor.repairPixelsH(imgData);
    imageProcessor.repairPixelsV(imgData);
    //shrinkImage(imageData, 2);
    imageProcessor.removeNoisePixels(imgData);
    imageProcessor.removeColorIslets(imgData)
    
    images.push(imgData)

    imgData = imageProcessor.generateCharactorImageData(imageData, charColorRangeMap[2][2], CHAR_COUNT, 2);
    imageProcessor.fillHollow(imgData);
    imageProcessor.removeNoisePixels(imgData);
    imageProcessor.repairPixelsH(imgData);
    imageProcessor.repairPixelsV(imgData);
    //shrinkImage(imageData, 2);
    imageProcessor.removeColorIslets(imgData)
    imageProcessor.removeNoisePixels(imgData);
    images.push(imgData)

    imgData = imageProcessor.generateCharactorImageData(imageData, charColorRangeMap[3][2], CHAR_COUNT, 3);
    imageProcessor.fillHollow(imgData);
    imageProcessor.removeNoisePixels(imgData);
    imageProcessor.repairPixelsH(imgData);
    imageProcessor.repairPixelsV(imgData);
    //shrinkImage(imageData, 2);
    imageProcessor.removeColorIslets(imgData)
    imageProcessor.removeColorIslets(imgData)
    //imageProcessor.removeNoisePixels(imgData);
    images.push(imgData)
     
    return images;
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
    var imgs = crackCaptcha(mydata);
    console.log(imgs.length, "duration:", new Date() - _s);
    outputImageData(imgs);
    return true;
});


function outputImageData(mydata) {
    driver.executeAsyncScript(function() {
        var imgsData = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];

        //var img = document.getElementsByTagName("img")[0];
        
        //context.drawImage(img, 0, 0);
        
        for (var i=0; i<imgsData.length; i++) {
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            var imgData = imgsData[i];
            var img = context.createImageData(imgData.width, imgData.height);
            img.data.set(imgData.data);
            context.putImageData(img, 0, 0);
            var body = document.getElementsByTagName("body")[0];
            var newNode = document.createElement('div');      
            newNode.appendChild(canvas);
            body.appendChild( newNode )

            // body.appendChild(canvas);
        }

        callback();
    }, mydata).then(function() {
        console.log("imgData===:");
        return true;
    });
}
