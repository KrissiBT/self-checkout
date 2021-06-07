/*jshint esversion: 6 */ 
/* Kiosk Javascript library */


function isEmpty(pObject)
{
    for (let i in pObject)
    {
        return false;
    }
    return true;
}

class Storage
{
    static store(pKey, pValue)
    {
        window.sessionStorage.setItem(pKey, JSON.stringify(pValue));
    }

    static fetch(pKey)
    {
        let tValue = window.sessionStorage.getItem(pKey);

        if (tValue === null)
        {
            return null;
        }
        else
        {
            return JSON.parse(tValue);
        }
    }

    static remove(pKey)
    {
        window.sessionStorage.removeItem(pKey);
    }

    static clear()
    {
        window.sessionStorage.clear();
    }
}

class NetworkOp
{
    constructor (pURL)
    {
        this._url = pURL;
    }

    fetchParams(pMethod, pData = {}, pDataType)
    {
        let tParams = {
            method: pMethod, // *GET, POST, PUT, DELETE, etc.
            credentials: 'same-origin',
            referrerPolicy: 'origin',
            "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        }

        let tHeaders = {};
        if (pMethod == "POST" && pData != {})
        {
            if (pDataType === "body")
            {
                tHeaders['Content-Type'] = 'application/json';
                tParams.body = JSON.stringify(pData); // body data type must match "Content-Type" header
            }
            else if (pDataType === "form")
            {
                let tFormData = new FormData();

                for (let tKey in pData)
                {
                    tFormData.append(tKey, pData[tKey]);
                }

                tParams.body = tFormData;
            }
        }
        else
        {
            tHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        if (tHeaders != {})
        {
            tParams.headers = tHeaders;
        }

        console.log("NetworkOp fetchParams:");
        console.log(tParams);
        return tParams;
    }

    getData(pUrl = "", pParams = {})
    {
        console.log("GET from " + pUrl);
        let tParamCount = 0;
        for (let tKey in pParams) {
            if (tParamCount == 0){pUrl += "?";}
            else {pUrl += "&";}

            pUrl += encodeURIComponent(tKey) + "=" + encodeURIComponent(pParams[tKey]);
            tParamCount++;
        }

        return fetch(pUrl, this.fetchParams('GET'));
    }

    postData(pUrl = "", pData = {}, pDataType = "body") {
        console.log("POST to " + pUrl);
        return fetch(pUrl, this.fetchParams('POST', pData, pDataType));
    }

    deleteData(pUrl = "")
    {
        console.log("deleteData " + pUrl);
        return fetch(pUrl, this.fetchParams("DELETE"));
    }

    _endPointURL(pAPI)
    {
        return this._url + "/" + pAPI;
    }

    _getRequest(pApi, pParams = {})
    {
        return this.getData(this._endPointURL(pApi), pParams);
    }

    _postRequest(pApi, pData = {}, pDataType = "body")
    {
        return this.postData(this._endPointURL(pApi), pData, pDataType);
    }

    _deleteRequest(pApi)
    {
        return this.deleteData(this._endPointURL(pApi));
    }
}

class Kiosk extends NetworkOp
{
    constructor(pURL, pToken, pRefreshToken){
        super(pURL);
        this._token = pToken;
        this._refresh_token = pRefreshToken
    }

    static getSessionKiosk(pURL)
    {
        if (isEmpty(Kiosk._session))
        {
            Kiosk._session = new Kiosk(pURL,
                        Kiosk._fetchVar("token"),
                        Kiosk._fetchVar("refresh_token"));
        }

        return Kiosk._session;
    }

    static _clearSessionVar()
    {
        Storage.clear();
    }

    static _clearVar(pKey)
    {
        Storage.remove("myturn.kiosk." + pKey);
    }

    static _storeVar(pKey, pValue)
    {
        Storage.store("myturn.kiosk." + pKey, pValue);
    }

    static _fetchVar(pKey)
    {
        return Storage.fetch("myturn.kiosk." + pKey);
    }

    _processLogin(pResponse)
    {
        if (pResponse.ok)
        {
            return pResponse.json()
                .then(data => {
                    Kiosk._storeVar("token", data["access_token"]);
                    Kiosk._storeVar("refresh_token", data["refresh_token"]);

                    this._token = data["access_token"];
                    this._refresh_token = data["refresh_token"];

                    return 200;
                });
        }
        else
        {
            throw pResponse;
        }
    }

    _refreshToken()
    {
        // Consider existing token now invalid
        this._token = null;
        Kiosk._clearVar("token");

        return this._postRequest("oauth/access_token",
                    {grant_type: "refresh_token", refresh_token: this._refresh_token}, "form")
            .then(response => {
                return this._processLogin(response);
            });
    }

    _postRequest(pUrl, pData, pDataType)
    {
        return super._postRequest(pUrl, pData, pDataType)
            .then(pResponse => {
                if (pResponse.status === 401)
                {
                    // Refresh the token if outdated
                    return this._refreshToken()
                        .then(() => {
                            return super._postRequest(pUrl, pData, pDataType);
                        });
                }
                else
                {
                    return pResponse;
                }
            });
    }

    _getRequest(pUrl, pParams)
    {
        return super._getRequest(pUrl, pParams)
            .then(pResponse => {
                if (pResponse.status === 401)
                {
                    // Refresh the token and try again
                    return this._refreshToken()
                        .then(() => {
                            return super._getRequest(pUrl, pParams);
                        });
                }
                else
                {
                    return pResponse;
                }
            });
    }

    fetchParams(pMethod, pData, pDataType)
    {
        let tParams = super.fetchParams(pMethod, pData, pDataType);

        if (this._token != '')
        {
            let tBearer = "Bearer " + this._token
            if (!("headers" in tParams))
            {
                tParams.headers = { Authorization: tBearer };
            }
            else
            {
                tParams.headers.Authorization = tBearer;
            }
        }

        return tParams;
    }

    // Return an HTTP status code
    login(pUsername, pPassword)
    {
        // First clear all previous login info
        Kiosk._clearSessionVar();

        return this._postRequest("api/login",
                {"username": pUsername, "password": pPassword})
            .then(response => {
                return this._processLogin(response);
            });
    }

    getReservations()
    {
        return this._getRequest("api/v1.1/reservations");
    }

    _fetchCartDetails(pCartID)
    {
        return this._getRequest("api/v1.1/self-checkout/carts/" + pCartID)
            .then(response => {
                if (response.ok)
                {
                    return response.json()
                        .then(pCart => {
                            Kiosk._storeVar("cart", pCart);
                        });
                }
            });
    }

    // Return promise
    loadCart()
    {
        let tCart = Kiosk._fetchVar("cart");
        if (tCart === null)
        {
            return this._getRequest("api/v1.1/self-checkout/carts")
                .then(response => {
                    if (response.ok)
                    {
                        return response.json()
                            .then(pCarts => {
                                if (pCarts.length > 0)
                                {
                                    console.log("cart found");
                                    return this._fetchCartDetails(pCarts[0].id);
                                }
                                else
                                {
                                    console.log("no 404, but no cart found. Creating one");
                                    return this.createCart();
                                }
                            });
                    }
                    else if (response.status == 404)
                    {
                        console.log("no cart found, creating one");
                        return this.createCart();
                    }
                    else if (response.status == 401 && this._refresh_token !== null)
                    {
                        throw response.statusText;
                    }
                })
                .catch(error => {
                    console.log(error);
                    throw error;
                });
        }
        else
        {
            return new Promise((resolve, reject) => {
                resolve(true);
            });
        }
    }

    // Create a cart and return the ID
    createCart()
    {
        return this._postRequest("api/v1.1/self-checkout/carts")
            .then(response => {
                return response.json()
                        .then(pCart => {
                            Kiosk._storeVar("cart", pCart);
                        });
            })
            .catch(error => {
                console.log("createCart error");
                console.log(error);
            });
    }

    getCurrentCartID(pID)
    {
        let tCart = Kiosk._fetchVar("cart");

        if (tCart === null)
        {
            return "";
        }
        else
        {
            return tCart.id;
        }
    }

    _userHasLoans()
    {
        let tCartID = this.getCurrentCartID();

        if (tCartID === null)
        {
            return false;
        }

        return this._getRequest("api/v1.1/self-checkout/carts/" + tCartID)
            .then(response => {
                if (!response.ok)
                {
                    console.log("get cart content failed:" + response.status);
                    throw response.statusText;
                }

                return response.json()
                    .then(pCartContent => {
                        if ("outstandingLoans" in pCartContent
                                && pCartContent.outstandingLoans.length > 0)
                        {
                            return true;
                        }

                        return false;
                    })
            })
            .catch(error => {
                console.log("_userHasLoans");
                console.log(error);

                throw error;
            });
    }

    userHasLoans()
    {
        let tCartID = this.getCurrentCartID();

        if (tCartID == "")
        {
            return this.loadCart()
                    .then(() => {
                        return this._userHasLoans();
                    })
                    .catch(error => {
                        console.log("userHasLoan error");
                        console.log(error);
                        return false;
                    });
        }
        else
        {
            return this._userHasLoans();
        }
    }

    // Return a list of items
    listItems(pAvailableOnly = true)
    {
        return this._getRequest("api/v1.1/items")
            .then(response => {
                if (response.ok)
                {
                    console.log("items returned a positive reply")
                    return response.json();
                }
                else
                {
                    console.log("listItems returned " + response.status);
                    
                    if (userHasLoansresponse.status == 404)
                    {
                        return [];
                    }
                    else
                    {
                        response.text()
                            .then(text => {
                                throw text;
                            },
                            error => {
                                throw error;
                            });
                    }
                }
            })
            .then(pJson => {
                let tItems = [];
                for (let tItem of pJson)
                {
                    if (!pAvailableOnly || tItem.availableForCheckout)
                    {
                        tItems.push(tItem);
                    }
                }

                console.log("JSON ready");
                return tItems;
            });
    }

    // Return true on success
    // Throw an error on failure
    borrowItem(pItemID)
    {
        this.loadCart()
            .then(() => {
                let tCartID = this.getCurrentCartID();

                return this._postRequest("api/v1.1/self-checkout/carts/" + tCartID + "/checkouts",
                        { "item-id": pItemID }, "form")
                    .then(response => {
                        if (response.ok)
                        {
                            return response.json();
                        }
                        else
                        {
                            UIReportError(response.statusText);
                            throw response.status;
                        }
                    })
                    .then(pCart => {
                        // New cart state returned, store it
                        console.log("borrowItem finished");
                        return Kiosk._storeVar("cart", pCart);
                    });
                });
    }

    returnItem(pItemID)
    {
        this.loadCart()
            .then(() => {
                let tCart = Kiosk._fetchVar("cart");

                let tLoanID = null;
                for (let tLoan of tCart.outstandingLoans)
                {
                    if (tLoan.item.itemId == pItemID)
                    {
                        tLoanID = tLoan.id;
                    }
                }

                if (tLoanID === null)
                {
                    throw "Cannot find loan ID for the item ID " + pItemID;
                }

                return this._postRequest("api/v1.1/self-checkout/carts/" + tCart.id +
                            "/checkins/" + tLoanID)
                    .then(pResponse => {
                        if (pResponse.ok)
                        {
                            return pResponse.json();
                        }
                        else
                        {
                            UIReportError(pResponse.statusText);
                            throw pResponse.status;
                        }
                    })
                    .then(pCart => {
                        // New cart state returned, store it
                        console.log("returnItem finished");
                        return Kiosk._storeVar("cart", pCart);
                    });

            });
    }

    // Commit the cart transaction
    // Return promise
    commitCart()
    {
        let tCartID = this.getCurrentCartID();

        return this._postRequest("api/v1.1/self-checkout/carts/" + tCartID + "/convert")
            .then(response => {
                if (response.ok)
                {
                    // Cart converted and deleted, remove from Object
                    Kiosk._storeVar("cart", null);
                    return true;
                }
                else
                {
                    debugger;
                    // Cart converted and deleted, remove from Object
                    Kiosk._clearVar("cart");
                    UIReportError(response);
                    throw response.status;
                }
            });
    }

    // Commit the current checkouts.
    // Note that the cart must be committed with commitCart to finalise the transaction
    // Return true on success
    // Throw an error on failure
    commitCheckouts()
    {
        let tCartID = this.getCurrentCartID();
        let tCart = Kiosk._fetchVar("cart");

        if (!("checkouts" in tCart) || tCart.checkouts.length === 0 ||
                    tCart.checkouts[0].committed)
        {
            console.log("Cannot commit:");
            console.log(tCart);
            return;
        }

        // Commit the last checkout of the cart
        debugger;
        return this._postRequest("api/v1.1/self-checkout/carts/" + tCartID + "/checkouts/"
                + tCart.checkouts[0].id + "/commit")
            .then(response => {
                debugger;
                if (response.ok)
                {
                    console.log("commitCheckouts terminated");
                    return true;
                }
                else
                {
                    UIReportError(response.statusText);
                    throw response.status;
                }
            });
    }

    // Return a list of items
    // Throw an error on failure
    listBorrowedItems()
    {
        let tCartID = this.getCurrentCartID();

        if (tCartID === null)
        {
            throw 'No current cart ID defined';
        }
        
        return this._getRequest("api/v1.1/self-checkout/carts/" + tCartID)
            .then(response => {
                if (response.ok)
                {
                    console.log("borrowed item list returned");
                    return response.json();
                }
                else
                {
                    console.log("listBorrowedItems returned " + response.status);

                    if (response.status == 404)
                    {
                        return [];
                    }
                    else if (response.status == 401)
                    {
                        // Logged out, back to login page
                        UIGoToPage("login");
                    }
                    else
                    {
                        throw response.statusText;
                    }
                }
            })
            .then(pJson => {
                if (pJson === null)
                {
                    return [];
                }

                let tItems = [];

                if ('outstandingLoans' in pJson)
                {
                    for (let tItem of pJson.outstandingLoans)
                    {
                        tItems.push(tItem.item);
                    }
                }

                console.log("JSON ready");
                console.log(tItems);

                return tItems;
            });
    }

    clearCart()
    {
        let tCartID = this.getCurrentCartID();
        if (tCartID === "")
        {
            return new Promise((resolve, reject) => {
                resolve(true);
            });
        }

        return this._deleteRequest("api/v1.1/self-checkout/carts/" + tCartID)
            .then(pResponse => {
                if (pResponse.ok)
                {
                    return this.loadCart();
                }
                else
                {
                    return Kiosk._clearVar("cart");
                }
            });
    }

    lastError()
    {
        return this._lastError;
    }

    logout()
    {
        Kiosk._storeVar('token', "");
        return this._postRequest("api/logout", {})
            .then(data => {},
                error =>{});
    }

    static getReturnDate(pItem)
    {
        let tDate = new Date(Date.now() + pItem["loanLength"] * 24 * 60 * 60 * 1000);

        return {
            day: tDate.getDate(),
            month: tDate.getMonth(),
            year: tDate.getFullYear()
        };
    }
}



class Locker extends NetworkOp
{
    constructor(pURL)
    {
        super(pURL);
        this._map = null;
        this._openDoor = -1;

        document.addEventListener("keypress", function onPress(event) {
            if (event.key === "c" || event.key === "C") {
                Locker._openDoor = -1;
            }
        });
    }

    static getLocker(pURL)
    {
        return new Locker(pURL);
    }

    _getRequest(pApi)
    {
        return new Promise((resolve, reject) => {
            setTimeout( function() {
                if (pApi.startsWith("lockerMap"))
                {
                    let tMap = new Map();
                    tMap.set("1", 12);
                    tMap.set("2", 4);
                    tMap.set("3", 6);
                    tMap.set("4", 1);
                    tMap.set("5", 3);
                    tMap.set("6", 2);
                    tMap.set("7", 11);
                    tMap.set("8", 7);
                    tMap.set("9", 9);
                    tMap.set("10", 8);
                    tMap.set("11", 10);
                    tMap.set("12", 5);

                    resolve(tMap);
                }
                else
                {
                    reject({error: "Invalid operation " + pApi});
                }
            })
        });

        // return this.getData(this._endPointURL(pApi), this._token);
    }

    _postRequest(pApi, pData = {})
    {
        return new Promise((resolve, reject) => {
            setTimeout( function() {
                if (pApi.startsWith("open"))
                {
                    resolve({status: 200});
                }
                else if (pApi.startsWith("return"))
                {
                    resolve({status: 200});
                }
                else if (pApi.startsWith("status"))
                {
                    resolve({closed: (Locker._openDoor === -1)});
                }
                else
                {
                    reject({error: "invalid operation " + pApi});
                }
            }, 2000)});

        // return this.postData(this._endPointURL(pApi), pData);
    }

    _getMap()
    {
        return this._getRequest("lockerMap");
    }

    // Return the Promise of a Map <doorID> => <itemID>
    loadMap()
    {
        return this._getMap()
                .then(map => {
                    this._map = map;
                    return map;
                })
                .catch(error => {
                    console.log(error);
                });
    }

    getItemDoor(pItemID)
    {
        if (this._map === null)
        {
            throw -1;
        }

        for (let [key, value] of this._map)
        {
            if (value == pItemID)
            {
                return key;
            }
        }
        debugger;
        console.log("Cannot find item ID " + pItemID + " in locker map");
        throw -1;
    }

    openDoor(pDoorID)
    {
        return this._postRequest("open/" + pDoorID)
                .then(response => {
                    if (response.status === 200)
                    {
                        Locker._openDoor = pDoorID;
                        return true;
                    }
                    else
                    {
                        return false;
                    }
                });
    }

    openItemDoor(pItemID)
    {
        return this.openDoor(this.getItemDoor(pItemID));
    }

    returnItem(pItemID, pDoorID)
    {
        return this._postRequest("return/" + pDoorID, JSON.stringify(pItemID));
    }

    // Call with a positive integer to periodically check whether that door is
    // open or closed
    // Call with a negative integer to stop the checking
    isDoorClosed(pDoorID)
    {
        if (this._openDoor !== -1 && pDoorID != this._openDoor)
        {
            return true;
        }

        return this._postRequest("status/" + pDoorID);
    }

    watchItemDoorStatus(pItemID, pCallback)
    {
        let tDoorID = this.getItemDoor(pItemID);

        this.watchDoorStatus(tDoorID, pCallback);
    }

    watchDoorStatus(pDoorID, pCallback)
    {
        this._callback = pCallback;
        this._watchDoorID = pDoorID;

        this._checkDoor();
    }

    _checkDoor()
    {
        this.isDoorClosed(this._watchDoorID)
                .then(reply => {
                    if (reply.closed)
                    {
                        console.log("closed");
                        this._callback();
                    }
                    else
                    {
                        console.log("not closed yet, waiting");
                        setTimeout(() => {
                            this._checkDoor()
                        }, 1000);
                    }
                });
    }
}
