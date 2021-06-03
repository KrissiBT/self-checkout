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

class NetworkOp
{
    constructor (pURL)
    {
        this._url = pURL;
    }

    fetchParams(pMethod, pData = {})
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
            tHeaders['Content-Type'] = 'application/json';
            tParams.body = JSON.stringify(pData); // body data type must match "Content-Type" header
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
        // Default options are marked with *
        console.log("getData");
        let tParamCount = 0;
        for (let tKey in pParams) {
            if (tParamCount == 0){pUrl += "?";}
            else {pUrl += "&";}

            pUrl += encodeURIComponent(tKey) + "=" + encodeURIComponent(pParams[tKey]);
            tParamCount++;
        }
        console.log("URL: " + pUrl);
        return fetch(pUrl, this.fetchParams('GET'));
    }

    // Example POST method implementation:
    postData(pUrl = "", pData = {}) {
        // Default options are marked with *
        console.log("postData");
        return fetch(pUrl, this.fetchParams('POST', pData));
    }

    _endPointURL(pAPI)
    {
        return this._url + "/" + pAPI;
    }

    _getRequest(pApi, pParams = {})
    {
        return this.getData(this._endPointURL(pApi), pParams, this._token);
    }

    _postRequest(pApi, pData={}, pNeedToken=true)
    {
        if (pNeedToken)
        {
            return this.postData(this._endPointURL(pApi), pData, this._token);
        }
        else
        {
            return this.postData(this._endPointURL(pApi), pData);
        }
    }
}

class Kiosk extends NetworkOp
{
    constructor(pURL, pToken, pRefreshToken){
        super(pURL);
        this._token = pToken;
        this._refresh_token = pRefreshToken
    }

    static kSessKeyCartID = 'myturn.kiosk.activecartid';

    static getSessionKiosk(pURL)
    {
        if (isEmpty(Kiosk._session))
        {
            Kiosk._session = new Kiosk(pURL,
                        Kiosk._fetchVar('token'),
                        Kiosk._fetchVar("refresh_token"));
        }

        return Kiosk._session;
    }

    static setToken(pToken)
    {
        Kiosk._storeVar('token', pToken);
    }

    static _clearSessionVar()
    {
        window.sessionStorage.clear();
    }

    static _storeVar(pKey, pValue)
    {
        window.sessionStorage.setItem('kiosk' + pKey, pValue);
    }

    static _fetchVar(pKey)
    {
        return window.sessionStorage.getItem('kiosk' + pKey);
    }

    fetchParams(pURL, pData)
    {
        let tParams = super.fetchParams(pURL, pData);

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

        console.log("Kiosk fetchParams:");
        console.log(tParams);
        return tParams;
    }

    // Return an HTTP status code
    login(pUsername, pPassword)
    {
        return this._postRequest("api/login",
                {"username": pUsername, "password": pPassword}, false)
            .then(response => {
                if (response.ok){
                    return response.json()
                        .then(data => {
                            Kiosk._clearSessionVar();
                            Kiosk._storeVar("token", data["access_token"]);
                            Kiosk._storeVar("refresh_token", data["refresh_token"]);

                            return 200;
                        });
                }
                else if (response.status == 400 || response.status == 401)
                {
                    return response.status;
                }
                else
                {
                    return response.status;
                }
            })
            .catch(error => {
                console.log("response is not OK");
                return 500;
            });
    }

    getReservations()
    {
        return this._getRequest("api/v1.1/reservations");
    }

    loadCart()
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
                                if ("id" in pCarts[0])
                                {
                                    this.setCurrentCartID(pCarts[0].id);
                                }
                                else
                                {
                                    this.setCurrentCartID("");
                                }
                            }
                            else
                            {
                                console.log("no 404, but no cart. Creating one");
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

                }
                {
                    throw response.statusText;
                }
            })
            .catch(error => {
                console.log(error);
                throw error;
            });
    }

    // Create a cart and return the ID
    createCart()
    {
        return this._postRequest("api/v1.1/self-checkout/carts")
            .then(response => {
                return response.json()
                        .then(pCart => {
                            if ('id' in pCart)
                            {
                                this.setCurrentCartID(pCart.id);
                            }
                        });
            })
            .catch(error => {
                console.log("createCart error");
                console.log(error);
            });
    }

    getCurrentCartID(pID)
    {
        let tCartID = window.sessionStorage.getItem(Kiosk.kSessKeyCartID);

        if (tCartID === null)
        {
            return "";
        }
        else
        {
            return tCartID;
        }
    }

    setCurrentCartID(pID)
    {
        window.sessionStorage.setItem(Kiosk.kSessKeyCartID, pID);
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
                    console.log("get cart content failed:" + response.statusCode);
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

    // Return a list of items
    listBorrowedItems()
    {
        let tCartID = window.sessionStorage.getItem(Kiosk.kSessKeyCartID);

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

    lastError()
    {
        return this._lastError;
    }

    logout()
    {
        Kiosk._storeVar('token', "");
        return this._postRequest("api/logout", {}, false)
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
        this._map = {};
        this._openDoor = -1;
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

    _postRequest(pApi, pData={}, pNeedToken=true)
    {
        return new Promise((resolve, reject) => {
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
                    if ((Date.now() % 3) == 0)
                    {
                        resolve({closed: true});
                    }
                    else
                    {
                        resolve({closed: false});
                    }
                }
                else
                {
                    reject({error: "invalid operation " + pApi});
                }

            }, 1000);

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

    getItemDoor(pID)
    {
        if (pID in this._map)
        {
            return this._map[pID];
        }
        else
        {
            return 1;
        }
    }

    openDoor(pDoorID)
    {
        return this._postRequest("open/" + pDoorID);
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

    watchDoorStatus(pDoorID, pCallback)
    {
        this._callback = pCallback;
        this._watchDoorID = pDoorID;

        this._checkDoor();
    }

    _checkDoor()
    {
        if (isDoorClosed(this._watchDoorID))
        {
            pCallback();
        }
        else
        {
            setTimeout(_checkDoor, 1000);
        }
    }
}
