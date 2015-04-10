var minInterest = 13;
var minAmount = 10;
var _u = "13810394810";
var _p = "B3ijing19r";

var webdriver = require('selenium-webdriver');
var ajaxRequest = require('request');

var driver = new webdriver.Builder().
withCapabilities(webdriver.Capabilities.chrome()).
build();

var timeouts = (new webdriver.WebDriver.Timeouts(driver))
timeouts.setScriptTimeout(10000);

driver.get('https://www.renrendai.com/loginPage.action');

var user = driver.findElement(webdriver.By.id('j_username'));
var password = driver.findElement(webdriver.By.id('J_pass_input'));

user.sendKeys(_u);
password.sendKeys(_p);
driver.sleep(1000);
driver.findElement(webdriver.By.className('ui-button-rrd-blue')).click();

var availableBalance = 0;
function updateBalance(){
    driver.get('https://www.renrendai.com/account/index.action');
    driver.findElement(webdriver.By.xpath('//span[@class="fn-left num-xl color-orange-text"]/em'))
        .getText().then(function(fund){
            console.log("updateBalance", fund)
            availableBalance = Number(fund);
    });
}
updateBalance();

var nextTransferId;
ajaxRequest({
        uri: "http://www.renrendai.com/transfer/transferList!json.action",
        timeout: 5000
    },
    function(error, response, body) {
        if (error) {
            return null;
        } else if (response.statusCode == 200) {
            var json = JSON.parse(body);
            var products = json.data.transferList;  
            nextTransferId = 1+Number(products[0].id);
            // nextTransferId = 1233780;
            console.log("nextTransferId", nextTransferId)
        }
    });

var sessionHeartBeat = new Date();
var isAjaxRequesting = false;
var lastRequestingTime = new Date();
var ajaxInterval = 1000;
var gBuyingTransferId;
var gBuyingPricePerShare;
var gBuyingStartTime = new Date();
var gFinishBuyingTime = new Date();
var gStartBuying = false;

driver.wait(function() {
    if (!nextTransferId) return false;
    if (isAjaxRequesting) return false;

    if (gStartBuying) return false;
    if (gBuyingTransferId && (new Date()-gFinishBuyingTime)>5000) {
        gStartBuying = true;
        gBuyingStartTime = new Date();
        console.log("start:", gBuyingTransferId, new Date().toLocaleTimeString());
        buyTransfer();
        return false;
    }

    if (new Date() - sessionHeartBeat > 600000) {
        driver.get('http://www.renrendai.com/transfer/transferList.action');
        sessionHeartBeat = new Date();
        console.log("sessionHeartBeat:", nextTransferId, sessionHeartBeat.toLocaleTimeString())
    }

    
    if (new Date() - lastRequestingTime<ajaxInterval) return false;
    isAjaxRequesting = true;
    lastRequestingTime = new Date();
    ajaxRequest({
            uri: "http://www.renrendai.com/transfer/loanTransferDetail.action?transferId="+nextTransferId,
            timeout: 1000
        },
        function(error, response, body) {
            isAjaxRequesting = false;
            if (error) {
                console.log("timeout loanTransferDetail")
                return null;
            } else if (response.statusCode == 200) {
                var errorcode = getValueFromBody('<div style="display: none;">', '</div>', body);
                // console.log("errorcode", nextTransferId, errorcode)
                if (errorcode === "500") {
                    ajaxInterval = 1000;
                    return;
                }
                var sharesAvailable = getValueFromBody('<em id="max-shares" data-shares="', '">', body);
                //var creditlevel = getValueFromBody('<span title="信用分数：', '" class="icon-creditlevel', body);

                var interest = Number(getValueFromBody('<dd class="text-xxl"><em class="text-xxxl color-dark-text">', '</em>%</dd>', body));
                var price = Number(getValueFromBody('<em id="amount-per-share" data-amount-per-share="', '">', body));

                ajaxInterval = -1;
                // console.log("nextTransferId:", sharesAvailable, price, interest)
                if (sharesAvailable/* && creditlevel>=180*/) {
                    
                    //console.log("sharesAvailable==", interest, sharesAvailable, price)

                    if (interest>=minInterest && sharesAvailable*price>minAmount) {
                        gBuyingTransferId = nextTransferId;
                        gBuyingPricePerShare = price;
                        console.log("\nfound================: ", gBuyingTransferId, sharesAvailable, price, new Date().toLocaleTimeString())
                    }
                } else {
                    var timeUsed = getValueFromBody('<div class="box"><em>成交用时</em><span>', '秒</span></div>', body);
                    if (timeUsed) console.log("timeUsed", timeUsed, nextTransferId);
                }

                nextTransferId++;
                // console.log("\nnextTransferId", nextTransferId);
            }
        
        });
    return false;
}, Infinity);

function clearBuyingStatus(buyingTransferId){
    gStartBuying = false;
    if (buyingTransferId === gBuyingTransferId) gBuyingTransferId = null;
    else {
        console.log("clearBuyingStatus", buyingTransferId, gBuyingTransferId)
    }
    gBuyingPricePerShare = null;

}

function buyTransfer() {
        var buyingTransferId = gBuyingTransferId;
        var creditLevel;
        driver.get('http://www.renrendai.com/transfer/loanTransferDetail.action?transferId=' + buyingTransferId)
            .then(function(){
                console.log("loaded detail", new Date().toLocaleTimeString());
            });

        // driver.isElementPresent(webdriver.By.id('max-shares'))
        driver.isElementPresent(webdriver.By.xpath("//input[@class='ui-term-input ui-input ui-input-text']"))
        .then(function(found){
            if (!found) {
                console.log("----------------Too late", buyingTransferId, new Date().toLocaleTimeString());
                clearBuyingStatus(buyingTransferId);
                return;
            }
            // var allowbuy = false;
            // driver.isElementPresent(webdriver.By.xpath("//input[@class='ui-term-input ui-input ui-input-text']"))
            // .then(function(found){
            //     allowbuy = found;
            //     console.log("-----------------allowbuy", found)
            // });

            driver.findElement(webdriver.By.xpath(
             "//div[@id='loan-tab-content']//span[@class='icon-creditlevel AA snow ml10'"
             +" or @class='icon-creditlevel A snow ml10'"
             +" or @class='icon-creditlevel B snow ml10'"
             +" or @class='icon-creditlevel C snow ml10'"
             +" or @class='icon-creditlevel D snow ml10'"
             +" or @class='icon-creditlevel E snow ml10'"
             +" or @class='icon-creditlevel HR snow ml10']"))
            .getText().then(function(text) {
                //console.log("creditLevel", text);
                creditLevel = text;
            });

            return driver.findElement(webdriver.By.id('max-shares')).getAttribute("data-shares")
            .then(function(shares){
                
                console.log("shares:", creditLevel, buyingTransferId, shares+" * "+gBuyingPricePerShare)
                if (creditLevel != "A" && creditLevel != "AA") {
                    console.log("Too low credit level:", creditLevel);
                    clearBuyingStatus(buyingTransferId);
                    return;
                }
                
                shares = Math.floor(0.8*Number(shares));
                if (shares*gBuyingPricePerShare > availableBalance) {
                    shares = Math.floor(availableBalance/gBuyingPricePerShare);
                }

                if (shares*gBuyingPricePerShare<minAmount) {
                    console.log("----------------Too small", buyingTransferId, shares, gBuyingPricePerShare);
                    clearBuyingStatus(buyingTransferId);
                    return;
                }

                if (new Date() - gBuyingStartTime<2500) driver.sleep(2500- (new Date() - gBuyingStartTime));
                
                // shares = 1;

                driver.findElement(webdriver.By.xpath("//input[@class='ui-term-input ui-input ui-input-text']")).sendKeys(shares);
                
                driver.findElement(webdriver.By.id('invest-submit')).click();
                driver.sleep(10).then(function(){
                    console.log("before final click:", buyingTransferId, new Date().toLocaleTimeString(), (new Date() - gBuyingStartTime));
                });
                driver.findElement(webdriver.By.xpath(
                    "//form[@action='/transfer/buyLoanTransfer.action']//button[@class='fn-left ui-button ui-button-blue ui-button-mid']"))
                .click().then(function(){
                    console.log("*******Finish!", buyingTransferId, new Date().toLocaleTimeString(), (new Date() - gBuyingStartTime), 
                        availableBalance+" - "+shares*gBuyingPricePerShare, "\n");
                    gFinishBuyingTime = new Date();
                    clearBuyingStatus(buyingTransferId);
                    updateBalance();
                });
            });
        });

}

function getValueFromBody(preStr, postStr, body){
    var startIdx = body.indexOf(preStr);
    if (startIdx<0) return null;
    var endIdx = body.indexOf(postStr, startIdx);
    if (endIdx<0) return null;
    
    var str = body.substring(startIdx+preStr.length, endIdx);
    return str;
}