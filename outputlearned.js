var imageRepository = require('./captcha/imagerepository').init();
var savePixels = require("save-pixels");
var ndarray = require("ndarray");
var fs = require('fs');

var charactor = process.argv.length>2?process.argv[2]:null;
var imgs = imageRepository.getCharactorImages(charactor);

for (var i=0; i<imgs.length; i++) {
    var img = imgs[i];
    
    var nda = ndarray(new Float32Array(img.data), [img.width, img.height, 4], [4, img.width*4, 1]);
    savePixels(nda, "png").pipe(fs.createWriteStream("images/output/"+charactor+"_"+i+".png"));
}
