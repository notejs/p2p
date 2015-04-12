var config = require("./renrendai_config.js");
var minInterest = 13.1;
var minAmount = 100;
var _u = config.account || "";
var _p = config.password || "";

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

var gAvailableBalance = 0;

function updateBalance() {
    driver.get('https://www.renrendai.com/account/index.action');
    driver.findElement(webdriver.By.xpath('//span[@class="fn-left num-xl color-orange-text"]/em'))
        .getText().then(function(fund) {
            fund = fund.replace(",", "");
            console.log("updateBalance", fund)
            gAvailableBalance = Number(fund);
        });
}
updateBalance();

var newTransfers = [];
var nextTransferId = 0;
var loopCheckIntervalLong = 1000;
var loopCheckIntervalShort = 200;
var gStartBuying = false;
var gFinishBuyingTime = 0;

longBehindChecking(function(tid) {
    if (tid > nextTransferId) {
        nextTransferId = tid;
    }
    console.log(tid, nextTransferId)
    loopCheckingNext(loopCheckIntervalShort)
});

var sessionHeartBeat = new Date();
driver.wait(function() {
     if (new Date() - sessionHeartBeat > 600000) {
        driver.get('http://www.renrendai.com/transfer/transferList.action');
        sessionHeartBeat = new Date();
        longBehindChecking(function(tid) {
            if (tid > nextTransferId) {
                nextTransferId = tid;
            }
        })
        console.log("sessionHeartBeat:", nextTransferId, gAvailableBalance, new Date().toLocaleTimeString())
    }
    if (newTransfers.length === 0) return false;
    if (gStartBuying) return false;
    if ((new Date() - gFinishBuyingTime) > 5000) {
        var productToBuy = newTransfers[newTransfers.length - 1];
        newTransfers.length = 0;

        gStartBuying = true;
        var startBuyingTime = new Date();
        console.log("\nstart:", productToBuy.transferId, new Date().toLocaleTimeString());

        driver.get('http://www.renrendai.com/transfer/loanTransferDetail.action?transferId=' + productToBuy.transferId)
            .then(function() {
                console.log("loaded detail", new Date().toLocaleTimeString());
            });

        driver.isElementPresent(webdriver.By.xpath("//input[@class='ui-term-input ui-input ui-input-text']"))
            .then(function(found) {
                if (!found) {
                    console.log("----------------Too late", productToBuy.transferId, new Date().toLocaleTimeString());
                    gStartBuying = false;
                    return;
                }
                var creditLevel;
                driver.findElement(webdriver.By.xpath(
                        "//div[@id='loan-tab-content']//span[@class='icon-creditlevel AA snow ml10'" + " or @class='icon-creditlevel A snow ml10'" + " or @class='icon-creditlevel B snow ml10'" + " or @class='icon-creditlevel C snow ml10'" + " or @class='icon-creditlevel D snow ml10'" + " or @class='icon-creditlevel E snow ml10'" + " or @class='icon-creditlevel HR snow ml10']"))
                    .getText().then(function(text) {
                        //console.log("creditLevel", text);
                        creditLevel = text;
                    });

                driver.findElement(webdriver.By.id('max-shares')).getAttribute("data-shares")
                    .then(function(shares) {
                        console.log("shares:", creditLevel, productToBuy.transferId, shares + " * " + productToBuy.pricePerShare)
                        if (creditLevel != "A" && creditLevel != "AA") {
                            console.log("Too low credit level:", creditLevel);
                            gStartBuying = false;
                            return;
                        }

                        shares = adjuestShareNumber(shares, productToBuy.pricePerShare);
                        if(shares===0) {
                            console.log("No enough shares.");
                            gStartBuying = false;
                            return;
                        }
                        // if (shares * productToBuy.pricePerShare > gAvailableBalance) {
                        //     shares = Math.floor(gAvailableBalance / productToBuy.pricePerShare);
                        // }

                        // if (shares * productToBuy.pricePerShare < minAmount) {
                        //     console.log("----------------Too small", productToBuy.transferId, shares, productToBuy.pricePerShare);
                        //     gStartBuying = false;
                        //     return;
                        // }

                        if (new Date() - startBuyingTime < 2500) driver.sleep(2500 - (new Date() - startBuyingTime));

                        // shares = 1;

                        driver.findElement(webdriver.By.xpath("//input[@class='ui-term-input ui-input ui-input-text']")).sendKeys(shares);

                        driver.findElement(webdriver.By.id('invest-submit')).click();
                        driver.sleep(100).then(function() {
                            console.log("before final click:", productToBuy.transferId, "To Buy:", shares+"*"+ productToBuy.pricePerShare, new Date().toLocaleTimeString(), (new Date() - startBuyingTime));
                        });

                        driver.findElement(webdriver.By.xpath(
                                "//form[@action='/transfer/buyLoanTransfer.action']//button[@class='fn-left ui-button ui-button-blue ui-button-mid']"))
                            .click();
                            // .then(function() {
                            
                            // });
                        //driver.sleep(1000);
                        driver.findElement(webdriver.By.xpath("//div[@class='ui-dialog']//p[@class='text-big']"))
                            .then(function(textele) {
                                textele.getText().then(function(text){
                                    if (0===text.indexOf("您已成功投资")) {
                                        console.log("*******Finish!", productToBuy.transferId, new Date().toLocaleTimeString(), (new Date() - startBuyingTime),
                                        "("+gAvailableBalance + "-" + (shares * productToBuy.pricePerShare)+")", "\n", productToBuy, "\n");
                                        gFinishBuyingTime = new Date();
                                        updateBalance();
                                    } else if (0===text.indexOf("该债权不能购买")) {
                                        gFinishBuyingTime = 0;
                                        console.log("***********************Failed: can buy it", new Date().toLocaleTimeString());
                                    } else if (0===text.indexOf("购买此债权的人数过多")){
                                        gFinishBuyingTime = 0;
                                        console.log("***********************Failed: not enough", new Date().toLocaleTimeString());
                                    } else {
                                        gFinishBuyingTime = 0;
                                        console.log("***********************Failed: others");
                                    }
                                    
                                    
                                    gStartBuying = false;
                                })
                                   
                            })


                    });
            });
        return false;
    }

}, Infinity);

function longBehindChecking(callback) {
    ajaxRequest({
            uri: "http://www.renrendai.com/transfer/transferList!json.action",
            timeout: 10000
        },
        function(error, response, body) {
            var tid;
            if (error) {
                console.log("longBehindChecking", error);
            } else if (response.statusCode == 200) {
                var json = JSON.parse(body);
                var products = json.data.transferList;
                products.sort(function(p1, p2) {
                    var p1id = Number(p1.id);
                    var p2id = Number(p2.id);
                    if (p1id > p2id) return -1;
                    else if (p1id < p2id) return 1;
                    else return 0;
                })
                tid = 1 + Number(products[0].id);
            }
            console.log("longBehindChecking:", tid)
            callback(tid);
        });
}

var requestingNewTransfer = false;

function loopCheckingNext(interval) {
    //console.log("\nloopCheckingNext--------------", interval, requestingNewTransfer)
    var intervalObj = setInterval(function() {

        if (requestingNewTransfer) return;
        requestingNewTransfer = true;

        detectNewTransfer(nextTransferId, function(tid, obj) {
            requestingNewTransfer = false;
            // console.log("setInterval", tid, obj==null, nextTransferId, interval, new Date().toLocaleTimeString())
            if (obj) {
                nextTransferId++;
                var sh = adjuestShareNumber(obj.shares, obj.pricePerShare);
                if (obj.interest >= minInterest && sh > 0) newTransfers.push(obj);
                console.log("next id:", nextTransferId, obj.transferId, obj.timestemp.toLocaleTimeString(), newTransfers.length, gStartBuying);

                if (interval === loopCheckIntervalLong) {
                    console.log("->", nextTransferId, new Date().toLocaleTimeString())
                    clearInterval(intervalObj);
                    loopCheckingNext(loopCheckIntervalShort);
                }
            } else {
                if (interval === loopCheckIntervalShort) {
                    console.log("-|", nextTransferId, new Date().toLocaleTimeString(), gStartBuying)
                    clearInterval(intervalObj);
                    loopCheckingNext(loopCheckIntervalLong);
                }
            }

        })
    }, interval);

}
function adjuestShareNumber(shares, pricePerShare) {
    var shr = Math.floor((shares > 50 ? 0.5 : 0.8) * Number(shares));
    var price = shr * pricePerShare;
    if (price > gAvailableBalance) {
        shr = Math.floor(gAvailableBalance / pricePerShare);
    } else if (price < minAmount) {
        shr = 0;
    }
    return shr;
}

function detectNewTransfer(tid, callback) {
    ajaxRequest({
            uri: "http://www.renrendai.com/transfer/loanTransferDetail.action?transferId=" + tid,
            timeout: 1000
        },
        function(error, response, body) {
            if (error) {
                console.log("timeout loanTransferDetail", nextTransferId, gStartBuying)
                callback(tid, null);
                return null;
            } else if (response.statusCode == 200) {
                var errorcode = getValueFromBody('<div style="display: none;">', '</div>', body);
                if (errorcode === "500") {
                    //no new item.
                    callback(tid, null);
                } else {
                    var sharesAvailable = getValueFromBody('<em id="max-shares" data-shares="', '">', body);
                    var interest = Number(getValueFromBody('<dd class="text-xxl"><em class="text-xxxl color-dark-text">', '</em>%</dd>', body));
                    var price = Number(getValueFromBody('<em id="amount-per-share" data-amount-per-share="', '">', body));
                    var duration = getValueFromBody('<div class="box"><em>成交用时</em><span>', '秒</span></div>', body);
                    var callbackObj = null;
                    callbackObj = {
                        transferId: tid,
                        interest: interest,
                        shares: sharesAvailable,
                        pricePerShare: price,
                        duration: duration,
                        timestemp: new Date()
                    };
                    callback(tid, callbackObj);
                }
            } else {
                console.log("??????????????????????????????", response.statusCode)
                callback(tid, null);
            }

        });
}

function getValueFromBody(preStr, postStr, body) {
    var startIdx = body.indexOf(preStr);
    if (startIdx < 0) return null;
    var endIdx = body.indexOf(postStr, startIdx);
    if (endIdx < 0) return null;

    var str = body.substring(startIdx + preStr.length, endIdx);
    return str;
}
