
var webdriver = require('selenium-webdriver');
var ajaxRequest = require('request');
var _u = "";
var _p = "";
var _j = "";

var userId;
var availableFund = 0;

var maxAmount = 10000;
var maxProductPrice = process.argv.length>2?Number(process.argv[2]):undefined;
var minInterest = process.argv.length>3?Number(process.argv[3]):0.084;

var driver = new webdriver.Builder().
withCapabilities(webdriver.Capabilities.chrome()).
build();

var timeouts = (new webdriver.WebDriver.Timeouts(driver))
timeouts.setScriptTimeout(10000);

driver.get('https://user.lufax.com/user/login?returnPostURL=http%3A%2F%2Fmy.lufax.com%2Fmy%2Faccount');
var form = driver.findElement(webdriver.By.id('loginForm'));
var user = form.findElement(webdriver.By.id('userNameLogin'));
var password = form.findElement(webdriver.By.id('pwd'));
var validNum = form.findElement(webdriver.By.id('validNum'));

user.sendKeys(_u);
password.sendKeys(_p);
validNum.sendKeys("");

driver.wait(function() {
    return validNum.getAttribute('value').then(function(value) {
        return value.length === 4;
    });
}, Infinity);

driver.findElement(webdriver.By.id('loginBtn')).click();

driver.sleep(1000);
driver.get("https://user.lufax.com/user/service/user/current-user-info-for-homepage");
driver.findElement(webdriver.By.xpath("//pre")).then(function(ele){
    return ele.getText().then(function(str){
        var json = JSON.parse(str)
        userId= json.uid;
        console.log("Got uid:", userId);
        return driver.get("https://my.lufax.com/my/service/users/" + userId + "/asset-overview");
    });
});

driver.findElement(webdriver.By.xpath("//pre")).then(function(ele){
    ele.getText().then(function(str){
        var json = JSON.parse(str)
        availableFund= json.availableFund;
        if (!maxProductPrice) maxProductPrice = availableFund;
        if (maxAmount>maxProductPrice) maxAmount = Math.floor(maxProductPrice);

        console.log("Got availableFund:", availableFund, maxProductPrice, minInterest);
    });
});

driver.get("https://list.lufax.com/list/transfer");
driver.sleep(1000);

driver.wait(function() {
    console.log("counts-info", new Date());
    var url = "https://list.lufax.com/list/service/product/counts-info";
    return driver.executeAsyncScript(function() {
        var url = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                callback(xhr.responseText);
            }
        }
        xhr.send('');
    }, url).then(function(str) {
        var json = JSON.parse(str)
        console.log("Got counts-info:", json.successInvestCounts);
        return true;
    });
}, 5000);


var productID;
var isAjaxRequesting = false;
var sessionHeartBeat = new Date();
var ajaxRequestingTime;
var pageNumber = 1;
var maxInterest = 0;

driver.wait(function() {
    
    if (new Date() - sessionHeartBeat > 120000) {
        driver.get('https://my.lufax.com/my/account');
        sessionHeartBeat = new Date();
        console.log("sessionHeartBeat", maxAmount, maxProductPrice, availableFund, minInterest, pageNumber, sessionHeartBeat)
    }

    if (isAjaxRequesting === false && (!ajaxRequestingTime || (new Date() - ajaxRequestingTime) > 500)) {

        isAjaxRequesting = true;
        ajaxRequestingTime = new Date();
        ajaxRequest({
                uri: "https://list.lufax.com/list/service/product/transfer-product-list/listing/"+pageNumber+"?"
                +"minAmount=0&maxAmount="+maxAmount
                +"&column=currentPrice&tradingMode=&order=asc&isDefault=true",

                // uri: "https://list.lufax.com/list/service/product/transfer-product-list/listing/"
                    // +pageNumber+"?minAmount=0&maxAmount=100000000&tradingMode=&column=publishedAt&order=asc&isDefault=true",
                timeout: 5000
            },
            //https://list.lufax.com/list/service/product/transfer-product-list/listing/2?minAmount=0&maxAmount=100000000&column=publishedAt&tradingMode=&order=desc&isDefault=true&_=1404353632804

            function(error, response, body) {
                if (error) {
                    console.log(error);
                } else if (response.statusCode == 200) {
                    var json = JSON.parse(body);
                    if (pageNumber<15 && json.currentPage<json.totalPage && pageNumber<json.totalPage) pageNumber++;
                    else {
                        pageNumber = 1;//json.totalPage-10;
                    }
                    var products = json.data;
                                      
                    products.forEach(function(product) {
                        if (productID) return;
                        var valueDate = Number(product.valueDate.substr(6,2));//=20140624
                        var currentDate = (new Date()).getDate();
                        var publishedTime = new Date(Date.parse(product.publishedAt+"T"+product.publishAtDateTime+"+0800"))
                        var adjustPrice = product.adjustPrice;

                        //if (product.productId!==213769) return;

                        if(product.bidCurrentPrice === undefined && product.tradingMode === "06"
                            || product.bidCurrentPrice !== undefined && product.tradingMode !== "06") 
                            console.log("****************product.tradingMode=06", product.tradingMode, product.productId, product.adjustPrice)

                        if (product.tradingMode === "06") {
                            if (new Date()-publishedTime<0*60*1000) return;
                            adjustPrice += product.bidCurrentPrice+10;

                        }    

                        var _adjustInterest = adjustInterestPrice(product.principal, adjustPrice, product.interestRate, product.numberOfInstalments)
                        
                        if (product.productId == 475100) {
                            console.log("475100", _adjustInterest, product.adjustPrice, adjustPrice);
                        }
                         var adjustDays = (currentDate + 30 - valueDate)%30;
                         _adjustInterest = adjustInterestDays(adjustDays, _adjustInterest, product.numberOfInstalments);
                         
                         //maxProductPrice = 5000;
                        
                        if (product.productStatus === "ONLINE" 
                            && (_adjustInterest > minInterest && product.price < maxProductPrice)

                            ) {
                            maxInterest = _adjustInterest;
                            productID = product.productId;
                            
                            console.log("PID********", pageNumber>=10?pageNumber:"0"+pageNumber, 
                                productID, (_adjustInterest*100).toFixed(2), product.principal.toFixed(2), 
                                "floatingRate: "+product.floatingRate, 
                                "Remaining: "+product.currentRemainingInterest,
                                product.bidCurrentPrice!=undefined?" Bid: "+product.bidCurrentPrice:"",
                                product.adjustPrice?"Adj: "+product.adjustPrice:"", 
                                "Time(mins): "+(((new Date())-publishedTime)/60000).toFixed(2),
                                product.valueDate.substr(0,8));


                        }
                    })

                }
                isAjaxRequesting = false;
            });
        //});
    }

    if (productID != undefined) {
        console.log("get productID=======", productID, new Date().toLocaleTimeString());
        console.log(new Date());
        return true;
    } else {
        return false;
    }

}, Infinity);

var tradingSid;
driver.wait(function() {
    console.log("invest-check", new Date());
    var url = "https://list.lufax.com/list/service/users/"+userId+"/products/"+productID+"/invest-check"
    return driver.executeAsyncScript(function() {
        var url = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                callback(xhr.responseText);
            }
        }
        xhr.send("source=0");
    }, url).then(function(str) {
        var json = JSON.parse(str)
        tradingSid = json.sid;
        console.log("Got sid:", tradingSid);
        return true;
    });
}, 5000);

// driver.wait(function() {
//     return driver.get("https://trading.lufax.com/trading/trade-info?productId="+productID+"&sid="+tradingSid)
//         .then(function(){ 
//             console.log("Got https://trading.lufax.com", new Date());
//             return true; 

//         });

// }, 5000);
driver.wait(function() {
    console.log("check-trace ......", new Date());
    var url = "https://trading.lufax.com/trading/service/trade/check-trace?sid="
        +tradingSid+"&productId="+productID+"&userId="+userId+"&curStep=TRADE_INFO"
        +"&_="+(new Date()).getTime();
    return driver.get(url).then(function(){
            console.log("check-trace: TRADE_INFO", new Date());
            return true; 
        });

}, 5000);

// driver.wait(function() {
//     console.log("check-trace", new Date());
//     var url = "https://trading.lufax.com/trading/service/trade/check-trace?sid="
//         +tradingSid+"&productId="+productID+"&userId="+userId+"&curStep=TRADE_INFO"
//         +"&_="+(new Date()).getTime();
//     return driver.executeAsyncScript(function() {
//         var url = arguments[arguments.length - 2];
//         var callback = arguments[arguments.length - 1];
//         var xhr = new XMLHttpRequest();
//         xhr.open("GET", url, true);
//         xhr.onreadystatechange = function() {
//             if (xhr.readyState == 4) {
//                 callback(xhr.responseText);
//             }
//         }
//         xhr.send('');
//     }, url).then(function(str) {
//         console.log("check-trace: TRADE_INFO", new Date(), str);
//         return true;
//     });
// }, 5000);

driver.wait(function() {
    console.log("trace-trace......", new Date());
    var url = "https://trading.lufax.com/trading/service/trade/trace";
    var postParam = "sid="+tradingSid+"&productId="+productID+"&curStep=TRADE_INFO";
    return driver.executeAsyncScript(function() {
        var url = arguments[arguments.length - 3];
        var postParam = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                callback(xhr.responseText);
            }
        }
        
        xhr.send(postParam);
    }, url, postParam).then(function(str) {
        console.log("trace-trace: TRADE_INFO", new Date(), str);
        return true;
    });
}, 5000);

driver.wait(function() {
    console.log("check-trace......", new Date());
    var url = "https://trading.lufax.com/trading/service/trade/check-trace?sid="
        +tradingSid+"&productId="+productID+"&userId="+userId+"&curStep=CONTRACT"
        +"&_="+(new Date()).getTime();
    return driver.executeAsyncScript(function() {
        var url = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                callback(xhr.responseText);
            }
        }
        xhr.send('');
    }, url).then(function(str) {
        console.log("check-trace: CONTRACT", new Date(), str);
        return true;
    });
}, 5000);


driver.wait(function() {
    console.log("trace-trace......", new Date());
    var url = "https://trading.lufax.com/trading/service/trade/trace";
    var postParam = "sid="+tradingSid+"&productId="+productID+"&curStep=CONTRACT";
    return driver.executeAsyncScript(function() {
        var url = arguments[arguments.length - 3];
        var postParam = arguments[arguments.length - 2];
        var callback = arguments[arguments.length - 1];
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                callback(xhr.responseText);
            }
        }
        
        xhr.send(postParam);
    }, url, postParam).then(function(str) {
        console.log("trace-trace: CONTRACT", new Date(), str);
        return true;
    });
}, 5000);

var inputValidJY;
driver.wait(function() {
    driver.get("https://trading.lufax.com/trading/security-valid?productId="+productID+"&sid="+tradingSid);
    driver.findElement(webdriver.By.xpath("//input[@id='tradeCode']")).sendKeys(_j);
    inputValidJY = driver.findElement(webdriver.By.xpath("//input[@id='inputValid']"));
    return inputValidJY.sendKeys("").then(function(){
        console.log("waiting valid code...", new Date())
        fireAlarm();
        return true;
    });

},5000);

driver.wait(function() {
    return inputValidJY.getAttribute('value').then(function(value) {
       return value.length===4;
    });

}, Infinity);

driver.wait(function() {
     console.log("Find validBtn......", new Date())
    return driver.findElement(webdriver.By.xpath("//a[@id='validBtn']")).then(
        function(element){
            return element.click().then(
                        function(){
                            console.log("Finish========================click validBtn", new Date())
                            return true;
                        });
        }, function(error){
            console.log("findElement validBtn......", new Date())
            return false;
        });

}, 10000);



function math_power(x, y) {
    var result = 1;
    for (var i=0; i<y; i++) {
        result *= x; 
    }
    return result;
}

function payment_month(principal, interest_month, months) {
    return principal*interest_month*math_power((1+interest_month), months)/(
        math_power((1+interest_month), months)-1)
}


function adjustInterestDays(adjustDays, interestRate, months) {
     return interestRate/(1- (adjustDays/30)/months);
}

function adjustInterestPrice(principal, adjustPrice, interest, months) {
    var paymentPerMonth = payment_month(principal, interest/12, months);
    var interestCeil = interest;
    var interestFloor = interest;
    while (paymentPerMonth < payment_month(principal+adjustPrice, interestFloor/12, months)) {
        interestCeil = interestFloor;
        interestFloor -= 0.001;
    }

    while (paymentPerMonth > payment_month(principal+adjustPrice, interestCeil/12, months)) {
        interestFloor = interestCeil;
        interestCeil += 0.001;
    }

    //console.log("start:", interestFloor, paymentPerMonth, interestCeil);
    interest = interestCeil;
    var _count = 0;
    while(_count<20){
        _count++;
        var adjustedPaymentPerMonth = payment_month(principal+adjustPrice, interest/12, months);
        //console.log("---", interestFloor, interestCeil, interest,  adjustedPaymentPerMonth, paymentPerMonth)
        if (Math.round(adjustedPaymentPerMonth*10)-Math.round(paymentPerMonth*10) === 0) return interest;
        //if (_count===10) console.log(interest, adjustedPaymentPerMonth, paymentPerMonth)
        if (adjustedPaymentPerMonth > paymentPerMonth) {
            interest = (interestCeil+interestFloor)/2;
            interestCeil = interest;
        } else {
            interestFloor = interest;
            interest += 0.0002;
            interestCeil = interest;
        }
    }
    console.log("------------------------", principal, adjustPrice, interest, months)
}

function fireAlarm(){
    var html ="<audio controls autoplay>"
                +"<source src='http://www.universal-soundbank.com/802a/805020000000000000000000000pkjn800000000000000000000000000000090/g/85055050505050505050505/k/146.mp3'"
                +" type='audio/mpeg'>"
                +"</audio>"
    var script = "var h1 = document.createElement('div'); " + "h1.innerHTML=\"" 
        + html + "\"; h1.style.position='absolute'; h1.style.top='100px'; h1.style.zIndex=100000;"
        +"document.body.appendChild(h1); var callback = arguments[arguments.length - 1]; callback()"
    driver.executeAsyncScript(script);
}