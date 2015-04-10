var ndarray = require("ndarray")
var savePixels = require("save-pixels")
var fs = require('fs');
var getPixels = require("get-pixels");

var imageRepository = require('./captcha/imagerepository').init();
var imageUtil = require('./captcha/imageutil');

var imageProcessor = require('./captcha/imageprocessor').config({
    MINOR_PIXEL_NOISE_LIMIT: 20,
    BACKGROUND_COLOR: 255,
    COLOR_RANGE_OFFSET: 5,
    HOLLOW_PIXELS_MAX_NUM: 20,
    COLOR_ISLET_MAX_NUM: 20
});

var imagefiles = fs.readdirSync("images/guess/");
var fileMap = {};
imagefiles.forEach(function(f){
    fileMap[f] = f;
})

var count0 = 0, count1 = 0;
for (var n = 0; n < imagefiles.length; n++) {
    var fileName = imagefiles[n];
    if (fileName.length === 8) {
        fileName = fileName.substring(0, 4);
        count1++;
        getPixels("images/guess/" + fileName + ".jpg", function(fileName) {
            return function(err, pixels) {
                var image = {
                    width: pixels.shape[0],
                    height: pixels.shape[1],
                    data: pixels.data
                };
                var imgs = crackCaptcha(image);
                if (imgs.length != 4) {
                    console.log("Fail:**********************************************imgs.length>4", fileName, imgs.length);
                    // process.exit(1);
                } 
                for (var i = 0; i < imgs.length; i++) {
                    var img = imgs[i];
                    var gimg //= imageRepository.guess(img, "image");
                    var charactor = imageRepository.guess(img, "charactor");
                    console.log("charactor:", charactor)
                    if (gimg) {
                        var nda = ndarray(new Float32Array(gimg.data), [gimg.width, gimg.height, 4], [4, gimg.width * 4, 1]);
                        savePixels(nda, "png").pipe(fs.createWriteStream("images/guess/" + fileName+ "_" + charactor + "_" + i + ".png"));
                    }
                }
                
            }
        }(fileName));

    }

}


function crackCaptcha(imageData) {
    imageProcessor.degrade(imageData);
    imageProcessor.removeBackground(imageData);
    imageProcessor.removeNoisePIxels(imageData);
    imageProcessor.vRemoveNoisePIxels(imageData, 6);
    imageProcessor.hRemoveNoisePIxels(imageData, 6);
    // return [imageData];
    var cpixels = imageProcessor.identifyCharactorIslets(imageData);
    var imgs = [];
    for (var i = 0; i < cpixels.length; i++) {
        var img = imageProcessor.generateCharactorImage(imageData, cpixels[i]);
        imageProcessor.vRemoveNoisePIxels(img, 7);
        imageProcessor.hRemoveNoisePIxels(img, 6);
        imageProcessor.removeNoiseIslet(img);
        imageProcessor.vRemoveNoisePIxels(img, 7);
        imageProcessor.removeColorNoiseIslets(img);

        img = imageUtil.removePadding(img, 255);
        img = imageUtil.scale(img, 32, 32);
        imageProcessor.hRemoveNoisePIxels(img, 4);
        imageProcessor.vRemoveNoisePIxels(img, 4);
        imageProcessor.removeNoiseIslet(img);
        imageProcessor.removeColorNoiseIslets(img, 8);
        imageProcessor.removeOnePixelColorOnNoise(img);
        imageProcessor.removeNoisePIxels(img);
        imageUtil.makeSingleColor(img, 0);

        imageProcessor.hRemoveNoisePIxels(img, 2);
        imageProcessor.vRemoveNoisePIxels(img, 2);
        imageProcessor.removeNoiseIslet(img);

        img = imageUtil.removePadding(img, 255);
        if (img.width<32 && img.height<32) {
            img = imageUtil.scale(img, 32, 32);
        }
        imgs.push(img);
    }
    return imgs;
}
