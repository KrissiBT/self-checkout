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
    constructor(pPrefix)
    {
        if (pPrefix === undefined)
        {
            this._prefix = "";
        }
        else
        {
            if (pPrefix[-1] !== '.')
            {
                this._prefix = pPrefix + ".";
            }
            else
            {
                this._prefix = pPrefix;
            }
        }
    }

    store(pKey, pValue)
    {
        Storage.store(this._prefix + pKey, pValue);
    }

    fetch(pKey)
    {
        return Storage.fetch(this._prefix + pKey);
    }

    remove(pKey)
    {
        Storage.remove(this._prefix + pKey);
    }

    static store(pKey, pValue)
    {
        window.sessionStorage.setItem(pKey, JSON.stringify(pValue));
    }

    static fetch(pKey)
    {
        let tValue = window.sessionStorage.getItem(pKey);

        if (tValue === undefined || tValue === null)
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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        }

        let tHeaders = {};
        if (pMethod == "POST" && pData !== undefined && Object.keys(pData).length != 0)
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
    static _keys = ["token", "refresh_token", "cart"];

    constructor(pURL, pToken, pRefreshToken){
        super(pURL);
        this._token = pToken;
        this._refresh_token = pRefreshToken;
    }

    static initialise(pURL)
    {
        if (isEmpty(Kiosk._session))
        {
            Kiosk._session = new Kiosk(pURL,
                        Kiosk._fetchVar("token"),
                        Kiosk._fetchVar("refresh_token"));
        }
    }

    static getSessionKiosk()
    {
        if (isEmpty(Kiosk._session))
        {
            throw "cannot fetch session Kiosk: not initialised";
        }

        return Kiosk._session;
    }

    static _clearSessionVar()
    {
        for (let tKey in Kiosk._keys)
        {
            Kiosk._clearVar(tKey);
        }
    }

    static _clearVar(pKey)
    {
        Storage.remove("munasafn.kiosk." + pKey);
    }

    static _storeVar(pKey, pValue)
    {
        Storage.store("munasafn.kiosk." + pKey, pValue);
    }

    static _fetchVar(pKey)
    {
        return Storage.fetch("munasafn.kiosk." + pKey);
    }

    _processLogin(pResponse)
    {
        if (pResponse.ok)
        {
            return pResponse.json()
                .then(data => {
                    Kiosk._storeVar("token", data["access_token"]);
                    Kiosk._storeVar("refresh_token", data["refresh_token"]);
                    AutoLogout.setLogged(true);
                    AutoLogout.allowAutoLogout(true);
                    AutoLogout.checkLogout();
                    Kiosk._storeVar("user", data["membership_type"]);
                    Kiosk._storeVar("admin_user", data["is_admin"]);

                    this._token = data["access_token"];
                    this._refresh_token = data["refresh_token"];

                    return 200;
                });
        }
        else
        {
            AutoLogout.setLogged(false);
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
        AutoLogout.recordInteraction();
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
        AutoLogout.recordInteraction();
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

    logout()
    {
        Kiosk._storeVar('token', "");
        AutoLogout.setLogged(false);
        return this._postRequest("api/logout", {}, "empty")
            .then(data => {},
                error =>{});
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

    userCanBorrow()
    {
        debugger;
        let tUserInfo = Kiosk.fetchVar("membership_type");

        return tUserInfo["may_borrow"];
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
                    
                    if (response.status == 404)
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
                
                if (pJson !== undefined)
                {
                    for (let tItem of pJson)
                    {
                        if (!pAvailableOnly || tItem.availableForCheckout)
                        {
                            tItems.push(tItem);
                        }
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

    static initialise(pURL)
    {
        Locker._session = new Locker(pURL);
    }

    static getSessionLocker()
    {
        if (isEmpty(Locker._session))
        {
            throw "cannot fetch session Locker: not initialised";
        }

        return Locker._session;
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



class ItemList
{
    static _instance = null;

    constructor(pTarget, pCounterID = ""){
        this._target = pTarget;
        this._counterID = pCounterID;
        this._itemCount = 0;
        this._selectedItems = {};
        this._elements = {};
    }

    static clearSelection()
    {
        Storage.store("selection", null);
    }

    static getItemList()
    {
        if (ItemList._instance === null)
        {
            throw "No existing list";
        }

        return ItemList._instance;
    }

    static genId(pType, pID)
    {
        return pType + "_" + pID;
    }

    static getElementById(pType, pID)
    {
        return document.getElementById(ItemList.genId(pType, pID));
    }

    _initSelection(pUseExistingSelection)
    {
        if (pUseExistingSelection)
        {
            try
            {
                let tSelection = Storage.fetch("selection");

                if (tSelection !== null)
                {
                    Object.values(tSelection).forEach(tItem =>
                    {
                        this.addItem(tItem, true);
                    });
                }
            }
            catch (pErr) {console.log(pErr);}
        }
        else
        {
            ItemList.clearSelection();
        }
    }

    getTargetElement()
    {
        return document.getElementById(this._target);
    }

    _updateSelection()
    {
        Storage.store("selection", this._selectedItems);

        try
        {
            if (this._counterID != "")
            {
                document.getElementById(this._counterID).innerHTML =
                        Translator.translate("selected", 
                            Object.keys(this._selectedItems).length);
            }
        }
        catch (pErr){console.log(pErr);}
    }

    _selectItem(pID)
    {
        let tElement = document.getElementById(pID);
        this._selectedItems[pID] = this._elements[pID];
        tElement.classList.add("selected");

        this._updateSelection();
    }

    itemClicked(pID)
    {
        AutoLogout.recordInteraction();

        // Item in the selected list should be deselected
        let tSelectItem = !(pID in this._selectedItems);
        let tElement = document.getElementById(pID);

        if (tElement === null)
        {
            return;
        }

        if (tSelectItem)
        {
            this._selectedItems[pID] = this._elements[pID];
            tElement.classList.add("selected");
        }
        else
        {
            delete this._selectedItems[pID];
            tElement.classList.remove("selected");
        }

        this._updateSelection();
    }

    addItem(pItem, pSelected = false)
    {
        if (pItem["itemId"] !== null)
        {
            this._elements[pItem["itemId"]] = pItem;
            this._itemCount++;

            if (pSelected)
            {
                this._selectItem(pItem["itemId"]);
            }
        }
    }

    getItemCount()
    {
        return this._itemCount;
    }

    itemIsSelected(pID)
    {
        if (this._selectedItems !== null)
        {
            return (pID in this._selectedItems);
        }
        else
        {
            return false;
        }
    }

    getItems()
    {
        return this._elements;
    }

    getItem(pID)
    {
        if (pID in this._elements)
        {
            return this._elements[pID];
        }
        else
        {
            return null;
        }
    }

    showEmpty(pMessage)
    {
        console.log("showEmpty");
        debugger;
        let tDomElem = this.getTargetElement();

        if (tDomElem !== null)
        {
            tDomElem.innerHTML = tDomElem.innerHTML +
                    '<div class="message translate">' + Translator.translate(pMessage) + "</div>";
        }
    }

    showError(pError)
    {
        console.log("showError");
        console.log(pError);
        let tDomElem = this.getTargetElement();

        if (tDomElem !== null)
        {
            tDomElem.innerHTML = tDomElem.innerHTML +
                    '<div class="message error">' + pError + "</div>";
        }
    }
}

class GridList extends ItemList
{
    constructor(pListElementID, pCounterID)
    {
        super(pListElementID, pCounterID);
    }

    static createList(pListElementID, pCounterID = "", pUseSelection= false)
    {
        let tList = new GridList(pListElementID, pCounterID);
        ItemList._instance = tList;

        tList._initSelection(pUseSelection);

        return tList;
    }

    addItem(pItem, pSelected = false)
    {
        let tRow, tRowElement;
        let tCurrentItemCount = this.getItemCount();

        let tItemBox = document.createElement("div");
        tItemBox.classList.add("item");
        tItemBox.classList.add("col" + ((tCurrentItemCount % 4) + 1));

        tItemBox.id = pItem["itemId"];
        tItemBox.addEventListener("click",
                function (event) {
                    let tElement = event.target;
                    while(tElement.id == "" && tElement != null)
                    {
                        tElement = tElement.parentElement;
                    }

                    if (tElement != null)
                    {
                        let tList = ItemList.getItemList()

                        tList.itemClicked(tElement.id);
                    }});

        let tImage = document.createElement("img");
        tImage.classList.add("thumbnail");
        tImage.setAttribute("alt", pItem["name"]);
        tImage.setAttribute("src", pItem["thumbnail"]);

        let tTitle = document.createElement("div");
        tTitle.classList.add("name");
        tTitle.innerHTML = pItem["name"];

        tItemBox.append(tImage);
        tItemBox.append(tTitle);

        // Create a row if required
        if ((tCurrentItemCount % 4) == 0)
        {
            tRow = Math.ceil(tCurrentItemCount / 4) + 1;
            tRowElement = document.createElement("div");
            tRowElement.classList.add("row");
            tRowElement.id = ItemList.genId("row", tRow);

            tRowElement.append(tItemBox);

            let tListElem = this.getTargetElement();

            tListElem.classList.add("grid-list");
            tListElem.append(tRowElement);
        }
        else
        {
            tRow = Math.ceil(tCurrentItemCount / 4);

            ItemList.getElementById("row", tRow).append(tItemBox);
        }

        super.addItem(pItem, pSelected);
    }
}

class StackedList extends ItemList
{
    constructor(pListElementID, pCounterID)
    {
        super(pListElementID, pCounterID);
        this._extraColumn = {class: "", header: ""};
        this._activeItemIndex = -1;
        this._idList = [];
        this._map = null;
    }

    static _createList(pListElementID, pCounterID = "")
    {
        let tList = new StackedList(pListElementID, pCounterID);
        ItemList._instance = tList;

        return tList;
    }

    addItem(pItem, pSelected = false)
    {
        let tListContainer = this.getTargetElement();

        if (tListContainer === null)
        {
            return;
        }

        if (this.getItemCount() == 0)
        {
            tListContainer.classList.add("rounded-list");
            if (this._extraColumn.header !== "")
            {
                let tHeaderRow = document.createElement("div");
                tHeaderRow.classList.add("list-header");

                let tHeader = document.createElement("div");
                tHeader.classList.add(this._extraColumn.class);
                tHeader.innerHTML = Translator.translate(this._extraColumn.header);

                tHeaderRow.append(tHeader);
                tListContainer.append(tHeaderRow);
            }
        }

        let tItemCount = this.getItemCount();
        this._idList.push(pItem["itemId"]);

        let tCounter = document.createElement("div");
        tCounter.classList.add("counter");
        tCounter.innerHTML = (tItemCount + 1) + ".";

        let tEntry = document.createElement("div");
        tEntry.classList.add("hollow-green");
        tEntry.classList.add("item");
        tEntry.innerHTML = pItem["name"];
        tEntry.id = pItem["itemId"];

        let tRow = document.createElement("div");
        tRow.classList.add("row");
        tRow.id = ItemList.genId("row", tItemCount);

        tRow.append(tCounter);
        tRow.append(tEntry);

        if (this._extraColumn.class === "need-maintenance")
        {
            let tSwitchElem = document.createElement("div");
            tSwitchElem.classList.add(this._extraColumn.class);
            tSwitchElem.innerHTML = Translator.translate("no").toUpperCase();

            tSwitchElem.addEventListener("click", function (event) {
                    let tElement = event.target;
                    while(tElement.id == "" && tElement != null)
                    {
                        tElement = tElement.parentElement;
                    }

                    if (tElement != null)
                    {
                        AutoLogout.recordInteraction();
                        ItemList.getItemList().itemClicked(tElement.id);
                    }});

            tRow.append(tSwitchElem);
        }
        else if (this._extraColumn.class === "locker")
        {
            let tTextElem = document.createElement("div");
            tTextElem.classList.add(this._extraColumn.class);
            tTextElem.id = ItemList.genId("locker", pItem["itemId"]);

            tRow.append(tTextElem);
        }

        tListContainer.append(tRow);

        super.addItem(pItem, pSelected);
    }

    itemClicked(pID)
    {
        if (this._extraColumn.class === "need-maintenance")
        {
            let tText;
            if (!(pID in this._selectedItems))
            {
                tText = "yes";
            }
            else
            {
                tText = "no";
            }

            let tElement = document.getElementById(pID);

            if (tElement === null)
            {
                return;
            }

            let tSwitch = tElement.getElementsByClassName(this._extraColumn.class);
            if (tSwitch !== null && tSwitch.length == 1)
            {
                tSwitch[0].innerHTML = Translator.translate(tText).toUpperCase();
            }
        }

        super.itemClicked(pID);
    }

    _addColumn(pClass, pHeaderText)
    {
        this._extraColumn = {class: pClass, header:pHeaderText};
        this._updateHeader();
    }

    _changeColumnHeader(pHeader)
    {
       this._extraColumn.header = pHeader;
    }

    _updateHeader()
    {
        let tTarget = this.getTargetElement();

        if (tTarget === null)
        {
            return;
        }

        let tHeader = tTarget.getElementsByClassName("header");

        if (tHeader !== null && tHeader.length == 1)
        {
            tHeader[0].innerHTML = Translator.translate(this._extraColumn.header);
        }
    }

    _getItemId(pItemIndex)
    {
        if (this._idList.length > pItemIndex)
        {
            return this._idList[pItemIndex];
        }
        else
        {
            debugger;
            console.log("Item index cannot be found: " + pItemIndex);
            return -1;
        }
    }

    _findDoorID(pItemID)
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

    _setNextItemActive(pInstructionStringID)
    {
        let tFormerIndex = this._activeItemIndex;
        let tNewIndex = ++this._activeItemIndex;

        // Clear old active item CSS classes
        if (tFormerIndex != -1)
        {
            let tFormerID = this._getItemId(tFormerIndex);
            let tFormerlyActive = document.getElementById(tFormerID);

            if (tFormerlyActive !== null)
            {
                tFormerlyActive.classList.remove("hollow-green");
                tFormerlyActive.classList.add("hollow-gray");
            }

            let tFormerInstructions = ItemList.getElementById("locker", tFormerID);
            tFormerInstructions.classList.remove("item-active");
            if (tFormerInstructions !== null)
            {
                tFormerInstructions.innerHTML = "";
            }
        }

        // Done if no other item can be activated
        if (tNewIndex >= this._idList.length)
        {
            return null;
        }

        let tItemID = this._getItemId(tNewIndex);
        let tDomElem = document.getElementById(tItemID);
        let tInstructionsDiv = ItemList.getElementById("locker", tItemID);
        if (tDomElem === null || tItemID === -1)
        {
            debugger;
            throw -1;
        }

        // Mark item as active
        let tDoorID = this._findDoorID(tItemID);
        tDomElem.classList.add("hollow-green");

        // Create instruction elements
        if (tInstructionsDiv === null)
        {
            return null;
        }

        let tSubTitle = document.createElement("div");
        tSubTitle.classList.add("shelf");
        tSubTitle.innerHTML = Translator.translate("shelf-open", tDoorID);

        let tInstruction = document.createElement("div");
        tInstruction.classList.add("instruction");
        tInstruction.innerHTML = Translator.translate(pInstructionStringID);

        tInstructionsDiv.append(tSubTitle);
        tInstructionsDiv.append(tInstruction);
        tInstructionsDiv.classList.add("item-active");

        return this.getItem(tItemID);
    }

    pickUpNextItem()
    {
        return this._setNextItemActive("collect-item");
    }

    returnNextItem()
    {
        return this._setNextItemActive("return-item");
    }

    getActiveItem()
    {
        return this.getItem(this._getItemId(this._activeItemIndex));
    }

    setLockerMap(pMap)
    {
        this._map = pMap;
    }

    static createLockerList(pListElementID, pCounterID = "", pUseSelection = true)
    {
        let tList = StackedList._createList(pListElementID, pCounterID);
        tList._addColumn("locker", "");

        tList._initSelection(pUseSelection);

        return tList;
    }

    static createReturnList(pListElementID, pCounterID = "", pUseSelection = false)
    {
        let tItemList = StackedList._createList(pListElementID, "");
        tItemList._addColumn("need-maintenance", "need-maintenance");

        tItemList._initSelection(pUseSelection);
        
        return tItemList;
    }

    static createList(pListElementID, pCounterID = "", pUseSelection = false)
    {
        let tList = StackedList._createList(pListElementID, pCounterID);
        tList._initSelection(pUseSelection);
        return tList;
    }
}

class AutoLogout
{
    static initialise(pTimeoutInSeconds, pLogoutCallback)
    {
        AutoLogout._logout_cb = pLogoutCallback;
        AutoLogout._storage = new Storage("munasafn.autologout");
        AutoLogout._initialised = true;
        AutoLogout._timeout = pTimeoutInSeconds * 1000;

        // Clear the last log_out, as the page might have been refreshed
        AutoLogout._storage.remove("logout_timeout");

        // Initialise the last interaction when the page Kiosk object is
        // created
        AutoLogout._storage.store("lastInteraction", Date.now());

        AutoLogout._autoLogout = true;

        if (AutoLogout._storage.fetch("logged"))
        {
            AutoLogout._checkLogout();
        }
    }

    static checkInit()
    {
        if (AutoLogout._initialised !== true)
        {
            throw "Trying to use unitialised Autologout";
        }
    }

    static recordInteraction()
    {
        AutoLogout.checkInit();
        AutoLogout._storage.store("lastInteraction", Date.now());
        AutoLogout._checkLogout();
    }

    static _checkLogout()
    {
        if (AutoLogout._autoLogout && AutoLogout._storage.fetch("logged"))
        {
            // Let 2 minutes of inactivity before disconnection
            let tLastInteraction = AutoLogout._storage.fetch("lastInteraction");
            let tTime = Date.now() - tLastInteraction;
            if (Date.now() - AutoLogout._storage.fetch("lastInteraction") >
                    AutoLogout._timeout)
            {
                AutoLogout._storage.remove("logout_timeout");

                // Execute the callback function to logout
                AutoLogout._logout_cb();
            }
            else
            {
                if (AutoLogout._storage.fetch("logout_timeout") === null)
                {
                    let tTimeoutID = setTimeout(function() {
                            AutoLogout._storage.remove("logout_timeout");
                            AutoLogout._checkLogout()}, 1000);

                    AutoLogout._storage.store("logout_timeout", tTimeoutID);
                }
            }
        }
    }

    static setLogged(pLogged)
    {
        AutoLogout.checkInit();
        AutoLogout._storage.store("logged", true);
    }

    static allowAutoLogout(pAllow)
    {
        AutoLogout.checkInit();
        AutoLogout._autoLogout = pAllow;
    }

    static checkLogout()
    {
        AutoLogout.checkInit();
        AutoLogout._checkLogout();
    }
}

class File
{
    static _read(pRelativePath)
    {
        let tParams = {
            method: "GET",
            credentials: 'same-origin',
            referrerPolicy: 'origin',
            "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        };

        return fetch(pRelativePath);
    }

    static readJson(pRelativePath)
    {
        return File._read(pRelativePath)
            .then(reply => {
                if (reply.status != 200)
                {
                    throw reply.status;
                }

                return reply.json();
            });
    }

    static readText(pRelativePath)
    {
        return File._read(pRelativePath)
            .then(reply => {
                if (reply.status != 200)
                {
                    throw reply.status;
                }

                return reply.text();
            });
    }
}

const sLanguages = [ "en", "is" ];

/*
 Translator is a tool used to automatically translate all nodes in the
 DOM that have the class 'translate'.

 A JSON file with the language name (e.g. 'en.json') must exist in the `lang`
 folder. Such file should use the string IDs that are used in lieu of the text
 in the DOM elements.

 The DOM element with the id "lang-switch" will assigned the 2-letter
 code for the current language.
*/
class Translator
{
    static _strings = null;
    static _storage = new Storage("munasafn.translator");

    // Return a Promise, fulfilled upon parsing of the whole language package
    static initialise()
    {
        let tLanguage = Translator._storage.fetch("language");

        if (tLanguage === null)
        {
            return Translator.setLanguage("is");
        }
        else
        {
            return Translator.setLanguage(tLanguage);
        }
    }

    static _fetchStrings(pLanguage)
    {
        Translator._storage.store("language", pLanguage);

        return File.readJson("lang/" + pLanguage + ".json")
            .then(pJson => {
                Translator._strings = pJson;
                Translator._storage.store("strings", pJson);

                return true;
            })
            .catch(pError => {
                debugger;
                console.log(pError);
                Translator._storage.remove("language");
                Translator._storage.remove("strings");
            });
    }

    // Return a Promise completing upon parsing of the whole language file
    // The promise returns true if the language has changed, false otherwise
    static setLanguage(pLanguage)
    {
        let tLanguage = Translator._storage.fetch("language");

        if (tLanguage !== pLanguage)
        {
            return Translator._fetchStrings(pLanguage);
        }

        let tStrings = Translator._storage.fetch("strings");
        if (tStrings === null)
        {
            return Translator.fetchStrings(pLanguage);
        }

        Translator._strings = tStrings;
        
        // Return a Promise returning false
        return new Promise((resolve, reject) => {
            resolve(false);
        });
    }

    // Any extra parameter will be inserted in the {} placeholders present in
    // the string
    static translate(pStringID)
    {
        if (Translator._strings === null)
        {
            return "";
        }
        else if (!(pStringID in Translator._strings))
        {
            return "missing " + pStringID;
        }
        else
        {
            let tString = Translator._strings[pStringID];

            for (let i = 1; i < arguments.length; i++)
            {
                tString = tString.replace("{" + i + "}", arguments[i]);
            }
            return tString;
        }
    }


    static getDate(pDate)
    {
        let tMonths = ["january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"];

        let tMonth = Translator.translate(tMonths[pDate.month]);

        return Translator.translate("date-format").replace("{day}", pDate.day)
                .replace("{month}", tMonth).replace("{year}", pDate.year);
    }

    static fillLangIcon(pDomElement, pLanguage)
    {
        pDomElement.className = "lang-icon";
        pDomElement.classList.add(pLanguage);
        pDomElement.innerHTML = pLanguage.toUpperCase();
    }

    static closePopup()
    {
        let tPopup = document.getElementById("lang-popup");
        if (tPopup !== null)
        {
            tPopup.remove();
        }

        let tBackdrop = document.getElementById("backdrop");
        if (tBackdrop !== null)
        {
            tBackdrop.remove();
        }
    }

    static openLangPopup(event)
    {
        // Create a backdrop to catch the clicks
        let tBackdrop = document.createElement("div");
        tBackdrop.id = "backdrop";
        tBackdrop.addEventListener("click", function() {
                setTimeout(Translator.closePopup(), 50);
            });

        document.body.append(tBackdrop);

        // Create the popup
        let tPopup = document.createElement("div");
        tPopup.id = "lang-popup";

        for (let i = 0; i < sLanguages.length; i++)
        {
            let tLang = document.createElement("div");
            Translator.fillLangIcon(tLang, sLanguages[i]);

            tLang.addEventListener("click", function() {
                Translator.setLanguage(sLanguages[i])
                    .then(pChanged => {
                        if (pChanged)
                        {
                            window.location.reload(true);
                        }
                        else
                        {
                            setTimeout(Translator.closePopup(), 50);
                        }
                    });
            }, true);
            tPopup.append(tLang);
        }

        document.body.append(tPopup);
    }

    static translatePage()
    {
        let tElements = document.getElementsByClassName("translate");
        
        for (var i=0, len=tElements.length|0; i<len; i=i+1|0)
        {
            let tElement = tElements[i];
            tElement.innerHTML = Translator.translate(tElement.innerHTML);
        }

        let tSwitch = document.getElementById("lang-switch");

        if (tSwitch !== null)
        {
            let tLanguage = Translator._storage.fetch("language");
            Translator.fillLangIcon(tSwitch, tLanguage);

            tSwitch.addEventListener("click", Translator.openLangPopup);
        }
    }
}

class Notify
{
    static _pendingEmails = 0;

    static _loadTemplate(pTemplate, pData)
    {
        return File.readText("mail/" + pTemplate + ".html")
            .then(pEmailTemplate => {
                let tFilled = pEmailTemplate;

                for (let tKey in pData)
                {
                    tFilled = tFilled.replace("{" + tKey + "}", pData[tKey]);
                }
                return tFilled;
            });
    }

    static _sendEmail(pSubject, pEmail, pRecipient)
    {
        // Call function from stmp.js
        Notify._pendingEmails += 1;
        return Email.send({
                SecureToken: "67b68ddc-42de-4f4b-8b47-4f09f1793180",
                To : pRecipient,
                From : "no-reply@hringrasarsetur.org",
                Subject : pSubject,
                Body : pEmail
            })
            .then(() => {
                Notify._pendingEmails -= 1;
                console.log("email sent");
                console.log("about to pick up next item");
            })
            .catch(error => console.log(error));
    }

    static toolNeedsMaintenance(pToolID, pToolName)
    {
        let tData = {"tool-name": pToolName, "tool-id": pToolID};
        return Notify._loadTemplate("maintenance", tData)
            .then(pEmail => {
                Notify._sendEmail("[Maintenance] " + pToolName + " needs maintenance",
                        pEmail, kNotificationEmail);
            });
    }

    static allEmailsSent()
    {

        return (Notify._pendingEmails == 0);
    }
}