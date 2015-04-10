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

var imagefiles = fs.readdirSync("images/learned/");
var fileMap = {};
imagefiles.forEach(function(f){
    fileMap[f] = f;
})

var count0 = 0, count1 = 0;
for (var n = 0; n < imagefiles.length; n++) {
    var fileName = imagefiles[n];
    if (fileName.length === 8) {
        fileName = fileName.substring(0, 4);
        if (fileMap[fileName+"_0.png"]) continue;
        count1++;
        getPixels("images/learned/" + fileName + ".jpg", function(fileName) {
            return function(err, pixels) {
                var image = {
                    width: pixels.shape[0],
                    height: pixels.shape[1],
                    data: pixels.data
                };
                var imgs = crackCaptcha(image);
                if (imgs.length != 4) {
                    console.log("ERROR:**********************************************imgs.length>4", fileName, imgs.length);
                    process.exit(1);
                }
                //console.log("=======================", fileName, count0, count1, imagefiles.length)
                for (var i = 0; i < imgs.length; i++) {
                    var img = imgs[i];

                    imageRepository.addCharactorImage(img, fileName.charAt(i));

                    var nda = ndarray(new Float32Array(img.data), [img.width, img.height, 4], [4, img.width * 4, 1]);
                    savePixels(nda, "png").pipe(fs.createWriteStream("images/learned/" + fileName + "_" + i + ".png"));

                }
                count0++;
                if (count0 === count1) {
                    imageRepository.save();
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
    var cpixels = imageProcessor.identifyCharactorIslets(imageData);
    // return [imageData];
    var imgs = [];
    for (var i = 0; i < cpixels.length; i++) {
        var img = imageProcessor.generateCharactorImage(imageData, cpixels[i]);
        imageProcessor.vRemoveNoisePIxels(img, 7);
        imageProcessor.hRemoveNoisePIxels(img, 6);
        imageProcessor.removeNoiseIslet(img);
        imageProcessor.vRemoveNoisePIxels(img, 7);
        imageProcessor.removeColorNoiseIslets(img);
        
        img = imageUtil.removePadding(img, 255);

        if (img.width>80 || img.height>80) {
            imageProcessor.removeFarIslets(img, 5);
            img = imageUtil.removePadding(img);
        }

        img = imageUtil.scale(img, 32, 32);

        imageProcessor.hRemoveNoisePIxels(img, 4);
        imageProcessor.vRemoveNoisePIxels(img, 4);
        imageProcessor.removeNoiseIslet(img);
        imageProcessor.removeColorNoiseIslets(img, 8);
        imageProcessor.removeOnePixelColorOnNoise(img);
        imageProcessor.removeNoisePIxels(img);
        imageUtil.makeSingleColor(img, 0);
        imageUtil.fillHollow(img);

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
