var webdriver = require('selenium-webdriver');
var ajaxRequest = require('request');

var availableFund = 0;
var minInterest = 13;

var driver = new webdriver.Builder().
withCapabilities(webdriver.Capabilities.chrome()).
build();
// var waitingdriver = new webdriver.Builder().
// withCapabilities(webdriver.Capabilities.chrome()).
// build();
//https://www.renrendai.com/loginPage.action
// waitingdriver.get("http://www.baidu.com");
var timeouts = (new webdriver.WebDriver.Timeouts(driver))
timeouts.setScriptTimeout(10000);

driver.get('https://www.renrendai.com/loginPage.action');

var user = driver.findElement(webdriver.By.id('j_username'));
var password = driver.findElement(webdriver.By.id('J_pass_input'));

// user.sendKeys(webdriver.Key.CONTROL +"t");
user.sendKeys("13810394810");
password.sendKeys("B3ijing19r");

// var acode = "12345\n";
// acode = acode.replace("\n", "\\n");
// driver.executeAsyncScript(createBuyTransferFormHtml(acode, 1, 1)).then(function(){
            
//             console.log("asdf===================")
//         });

driver.sleep(1000);

driver.findElement(webdriver.By.className('ui-button-rrd-blue')).click();

var isAjaxRequesting = 0;
var sessionHeartBeat = new Date();
var ajaxRequestingTime;
var pageNumberTransfer = 1, pageNumberLoan = 1;
var goodSamples = {};
var transferProductIDs = [];
var isBuying = false;
var lastBuyTime = new Date();
driver.wait(function() {
    if (isBuying) return false;
    if ((new Date() - lastBuyTime) < 8000) return false;

    if (transferProductIDs.length>0) {
        transferProductIDs.sort(function(obj1, obj2) {
            var v1 = obj1.shares*obj1.pricePerShare;
            var v2 = obj2.shares*obj2.pricePerShare;
            if (v1 > v2) return -1;
            else if (v1 < v2) return 1;
            else return 0;
        });

        var pobj = transferProductIDs.shift();
        isBuying = true;
        var beginBuyTime = new Date();
        console.log("\nbuying==================", pobj, beginBuyTime);
        transferProductIDs = [];
        
        driver.get('http://www.renrendai.com/transfer/transferList.action').then(function(){
            console.log("transferList.action", new Date());
        });

        driver.get('http://www.renrendai.com/transfer/loanTransferDetail.action?transferId=' + pobj.productId).then(function(){
            console.log("loanTransferDetail.action", new Date());
             if ((beginBuyTime- new Date())<2500) driver.sleep(500);
        });

       

        driver.isElementPresent(webdriver.By.id('max-shares'))
        .then(function(found){
            if (!found) {
                isBuying = false;
                console.log("----------------Too late", pobj);
                return;
            }
            
            return driver.findElement(webdriver.By.id('max-shares')).getAttribute("data-shares")
            .then(function(shares){
                if (Number(shares)*pobj.pricePerShare<100) {
                    isBuying = false;
                    console.log("----------------Too small", shares, pobj);
                    return;
                }
                console.log("shares:",shares, pobj)
                if (shares>10) shares = Math.floor(0.8*shares);
                else if (shares>1) shares = shares -1;

                driver.findElement(webdriver.By.xpath("//input[@class='ui-term-input ui-input ui-input-text']")).sendKeys(shares);
                driver.findElement(webdriver.By.id('invest-submit')).click();
                driver.sleep(200);
                driver.findElement(webdriver.By.xpath(
                    "//form[@action='/transfer/buyLoanTransfer.action']//button[@class='fn-left ui-button ui-button-blue ui-button-mid']"))
                .click().then(function(){
                    isBuying = false;
                    console.log("*******click buy!")
                    lastBuyTime = new Date();
                });
            });
        });

        return false;
    } else if (new Date() - sessionHeartBeat > 300000) {
        driver.get('http://www.renrendai.com/transfer/transferList.action');
        sessionHeartBeat = new Date();
        console.log("sessionHeartBeat", sessionHeartBeat)
    }

    if (isAjaxRequesting != 0) return false;
    if (ajaxRequestingTime && (new Date() - ajaxRequestingTime) < 1000) return false;
    // console.log("requesting----------");
    ajaxRequestingTime = new Date();

    isAjaxRequesting++;
    ajaxRequest({
            uri: "http://www.renrendai.com/transfer/transferList!json.action?creditLevel=CREDITLEVEL_A&pageIndex=" + pageNumberTransfer + "&_=" + new Date().getTime(),
            timeout: 5000
        },
        function(error, response, body) {
            isAjaxRequesting--;
            var products = [];
            var lastPage = listDataHandler(error, response, body, products);
            pageNumberTransfer = lastPage === null ? pageNumberTransfer : (lastPage===true?1:(pageNumberTransfer+1));
            //console.log("----------------", error, products)
            products.forEach(function(product){
                transferProductIDs.push(product);                 
            });

        });

    isAjaxRequesting++;
    ajaxRequest({
            uri: "http://www.renrendai.com/lend/loanList!json.action?creditLevel=CREDITLEVEL_A&pageIndex=" + pageNumberLoan + "&_=" + new Date().getTime(),
            timeout: 5000
        },
        function(error, response, body) {
            isAjaxRequesting--;
            var products = [];
            var lastPage = listDataHandler(error, response, body, products);
            pageNumberLoan = lastPage === null ? pageNumberLoan : (lastPage===true?1:(pageNumberLoan+1));
            products.forEach(function(productId){
                console.log("go to productId:", productId)
            });

        
        });


    if (false) {
        console.log("breakLoop=======");
        console.log(new Date());
        return true;
    } else {
        return false;
    }

}, Infinity);

function encodeTransferProductID(productId, callback) {
    ajaxRequest({
            uri: "http://www.renrendai.com/transfer/loanTransferDetail.action?transferId=" + productId,
            timeout: 5000
        },
        function(error, response, body) {
            if (response.statusCode == 200) {
                // var startStr = '<input name="transferId" type="hidden" value="';
                // var startIdx = body.indexOf(startStr);
                // var endIdx = body.indexOf('" />', startIdx);
                // var code = body.substring(startIdx+startStr.length, endIdx);
                var code  = pullFromBody('<input name="transferId" type="hidden" value="', '" />', body);
                var shares = pullFromBody('<em id="max-shares" data-shares="', '">', body);
                shares = Number(shares);
                var price = pullFromBody('<input name="currentPrice" type="hidden" value="', '" />', body);
                price = Number(price);

                // startStr = '<em id="max-shares" data-shares="';
                // startIdx = body.indexOf(startStr);
                // endIdx = body.indexOf('">', startIdx);
                // var shares = body.substring(startIdx+startStr.length, endIdx);
                // shares = Number(shares);
                callback(code, shares, price)
            }
        });
}

function submitBuyTransferFormHtml(transferId, share, price){
    return "my_form=document.createElement('FORM');"
        +"my_form.name='myForm';"
        +"my_form.method='POST';"
        +"my_form.action='http://www.renrendai.com/transfer/buyLoanTransfer.action';"
        +"my_tb=document.createElement('INPUT');"
        +"my_tb.type='HIDDEN';"
        +"my_tb.name='transferId';"
        +"my_tb.value='"+transferId+"';"
        +"my_form.appendChild(my_tb);"
        +"my_tb=document.createElement('INPUT');"
        +"my_tb.type='HIDDEN';"
        +"my_tb.name='currentPrice';"
        +"my_tb.value='"+price+"';"
        +"my_form.appendChild(my_tb);"
        +"my_tb=document.createElement('INPUT');"
        +"my_tb.type='HIDDEN';"
        +"my_tb.name='share';"
        +"my_tb.value='"+share+"';"
        +"my_form.appendChild(my_tb);"
        +"my_tb=document.createElement('INPUT');"
        +"my_tb.type='HIDDEN';"
        +"my_tb.name='couponId';"
        +"my_tb.value='';"
        +"my_form.appendChild(my_tb);"
        +"my_tb=document.createElement('INPUT');"
        +"my_tb.type='HIDDEN';"
        +"my_tb.name='agree-contract';"
        +"my_tb.value='on';"
        +"my_form.appendChild(my_tb);"
        +"my_tb=document.createElement('INPUT');"
        +"my_tb.type='HIDDEN';"
        +"my_tb.name='countRatio';"
        +"my_tb.value='0.00';"
        +"my_form.appendChild(my_tb);"
        +"document.body.appendChild(my_form);"
        +"my_form.submit();"
    
}

function createBuyTransferFormHtml(transferId, shares, price) {
    var htmlstr = "<form id='_buyForm' method='post' action='http://www.renrendai.com/transfer/buyLoanTransfer.action'>" +
                                "<input type='hidden' id='_buyFormTransferId' name='transferId' value='"+transferId.replace('\n', '\\n')+"'>" +
                                "<input type='hidden' name='currentPrice' value='"+price+"'>" +
                                "<input type='hidden' name='share' value='"+shares+"'>" +
                                "<input type='hidden' name='couponId' value=''>" +
                                "<input type='hidden' name='agree-contract' value='on'>" +
                                "<input type='hidden' name='countRatio' value='0.00'>" +
                                "<input type='submit' id='_submitBtn'>" +
                                "</form>";      
    var script = "var h1 = document.createElement('div'); " + "h1.innerHTML=\"" 
        + htmlstr + "\"; h1.style.position='absolute'; h1.style.top='100px'; h1.style.zIndex=100000;"
        +"document.body.appendChild(h1); var callback = arguments[arguments.length - 1]; callback()"
         // +"document.getElementById('_buyForm').submit()";
    return script;
}

function pullFromBody(preStr, postStr, body){
    var startIdx = body.indexOf(preStr);
    var endIdx = body.indexOf(postStr, startIdx);
    var str = body.substring(startIdx+preStr.length, endIdx);
    return str;
}

function listDataHandler(error, response, body, validproducts) {
    if (error) {
        // console.log("listDataHandler", error);
        return null;
    } else if (response.statusCode == 200) {
        var json = JSON.parse(body);
        if (!json) {
            return null
        }
        var productType = json.data.loans?"loan":"transfer";
        var products = productType==="loan" ? json.data.loans : json.data.transferList;
        
        var lastPage = false;
        products.forEach(function(product) {
            // console.log(productType, product.hasTransfered, product.loanId, product.title, product.interest);
            if (product.finishedRatio === 100 || product.hasTransfered === "true") {
                lastPage = true;
                return;
            }

            if (productType === "loan" && product.interest>=minInterest) {
                if (!goodSamples[product.loanId]) {
                    console.log(productType, product.loanId, product.finishedRatio, product.interest);
                    goodSamples[product.loanId] = productType;
                    validproducts.push(product.loanId);
                }
            } else if (productType === "transfer" && product.interest>=minInterest) {
                if (!goodSamples[product.id]) {
                    goodSamples[product.id] = productType;
                }

                var shares = Number(product.share);
                var price = Number(product.pricePerShare);
                console.log("-------------", product.id, shares, price)
                if (shares*price>100) {
                    console.log(product.id, shares, price)
                    validproducts.push({productId: product.id, pricePerShare: price, shares: shares});
                }
            }

        })
        return lastPage;
    }
}


//http://www.renrendai.com/lend/detailPage.action?loanId=461898
