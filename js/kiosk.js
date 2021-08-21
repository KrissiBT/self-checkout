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

    // Clear all the items stored for this Storage
    clear()
    {
        for (let i = localStorage.length - 1; i >= 0 ; i--)
        {
            let tKey = window.sessionStorage.key(i);

            if (tKey.startsWith(this._prefix))
            {
                window.sessionStorage.removeItem(tKey);
            }
        }
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
    static _storage = new Storage("munasafn.kiosk");

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
                        Kiosk._storage.fetch("token"),
                        Kiosk._storage.fetch("refresh_token"));
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

    _processLogin(pResponse)
    {
        if (pResponse.ok)
        {
            return pResponse.json()
                .then(data => {
                    Kiosk._storage.store("token", data["access_token"]);
                    Kiosk._storage.store("refresh_token", data["refresh_token"]);
                    Kiosk._storage.store("user", data["membership"]);
                    Kiosk._storage.store("admin_user", data["is_admin"]);

                    AutoLogout.setLogged(true);
                    AutoLogout.allowAutoLogout(true);
                    AutoLogout.checkLogout();

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
        Kiosk._storage.remove("token");

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
        Kiosk._storage.clear();

        return this._postRequest("api/login",
                {"username": pUsername, "password": pPassword})
            .then(response => {
                return this._processLogin(response);
            });
    }

    logout()
    {
        Kiosk._storage.store('token', "");
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
                            Kiosk._storage.store("cart", pCart);
                        });
                }
            });
    }

    // Return promise
    loadCart()
    {
        let tCart = Kiosk._storage.fetch("cart");
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
                            Kiosk._storage.store("cart", pCart);
                        });
            })
            .catch(error => {
                console.log("createCart error");
                console.log(error);
            });
    }

    getCurrentCartID(pID)
    {
        let tCart = Kiosk._storage.fetch("cart");

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
        let tUserInfo = Kiosk._storage.fetch("user");

        return tUserInfo["may_borrow"] && tUserInfo["may_use_kiosk"];
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
                        return Kiosk._storage.store("cart", pCart);
                    });
                });
    }

    returnItem(pItemID)
    {
        this.loadCart()
            .then(() => {
                let tCart = Kiosk._storage.fetch("cart");

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
                        return Kiosk._storage.store("cart", pCart);
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
                    Kiosk._storage.store("cart", null);
                    return true;
                }
                else
                {
                    debugger;
                    // Cart converted and deleted, remove from Object
                    Kiosk._storage.remove("cart");
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
        let tCart = Kiosk._storage.fetch("cart");

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
                    return Kiosk._storage.remove("cart");
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

    constructor(pTarget, pCounterID = "", pElementType){
        this._target = pTarget;
        this._counterID = pCounterID;
        this._itemCount = 0;
        this._selectedItems = {};
        this._items = {};
        this._clickCallback = null;
        this._actionCB = null;
        this._actionButtonID = null;
        this._storage = new Storage("munasafn.selection");
        this._elementType = pElementType;
    }

    static getItemList()
    {
        if (ItemList._instance === null)
        {
            throw "No existing list";
        }

        return ItemList._instance;
    }

    static genId(pID, pType)
    {
        return pType + "_" + pID;
    }

    static getIdFromElementID(pElemID, pElemType)
    {
        let tPrefix = pElemType + "_";
        if (pElemID.startsWith(tPrefix) !== -1)
        {
            return pElemID.replace(tPrefix, "");
        }
        return pElemID;
    }

    static getElementById(pID, pType)
    {
        return document.getElementById(ItemList.genId(pID, pType));
    }

    _initSelection(pUseExistingSelection)
    {
        if (pUseExistingSelection)
        {
            try
            {
                let tSelection = this._storage.fetch("selection");

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
            this._storage.clear();
        }
    }

    getTargetElement()
    {
        return document.getElementById(this._target);
    }

    _updateSelection()
    {
        this._storage.store("selection", this._selectedItems);

        try
        {
            if (this._counterID != "")
            {
                document.getElementById(this._counterID).innerHTML =
                        Translator.translate("selected", 
                            Object.keys(this._selectedItems).length);
            }

            if (this._actionButtonID !== null)
            {
                // Enable / disabled action button according to selection state
                let tActionButton = document.getElementById(this._actionButtonID);
                
                if (Object.keys(this._selectedItems).length > 0)
                {
                    tActionButton.classList.remove("disabled");
                }
                else
                {
                    tActionButton.classList.add("disabled");
                }
            }
        }
        catch (pErr){console.log(pErr);}
    }

    _selectItem(pID, pType)
    {
        let tElement = ItemList.getElementById(pID, this._elementType);
        this._selectedItems[pID] = this._items[pID];
        tElement.classList.add("selected");

        this._updateSelection();
    }

    setAction(pElementID, pCallback)
    {
        let tActionButton = document.getElementById(pElementID);

        if (tActionButton !== null)
        {
            this._actionButtonID = pElementID;
            this._actionCB = pCallback;

            tActionButton.addEventListener("click", function() {
                if (!tActionButton.classList.contains("disabled"))
                {
                    ItemList.getItemList().executeAction();
                }
            });

            this._updateSelection();
        }
    }

    executeAction()
    {
        if (this._actionCB !== null)
        {
            this._actionCB();
        }
    }

    elementClicked(pElementID, pElementType)
    {
        let tItemID = ItemList.getIdFromElementID(pElementID, pElementType);

        AutoLogout.recordInteraction();
        
        // Item in the selected list should be deselected
        let tSelectItem = !(tItemID in this._selectedItems);
        let tElement = document.getElementById(pElementID);

        if (tElement === null)
        {
            return;
        }

        if (tSelectItem)
        {
            this._selectedItems[tItemID] = this._items[tItemID];
            tElement.classList.add("selected");
        }
        else
        {
            delete this._selectedItems[tItemID];
            tElement.classList.remove("selected");
        }

        this._updateSelection();
    }

    addItem(pItem, pType, pSelected = false)
    {
        if (pItem["itemId"] !== null)
        {
            this._items[pItem["itemId"]] = pItem;
            this._itemCount++;

            if (pSelected)
            {
                this._selectItem(pItem["itemId"], pType);
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
        return this._items;
    }

    getItem(pID)
    {
        if (pID in this._items)
        {
            return this._items[pID];
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
        super(pListElementID, pCounterID, "item");
    }

    static createList(pListElementID, pCounterID = "", pUseSelection= false)
    {
        let tList = new GridList(pListElementID, pCounterID);
        ItemList._instance = tList;

        tList._initSelection(pUseSelection);

        return tList;
    }

    static handleClickEvent(event)
    {
        let tElement = event.target;
        while(tElement !== null && tElement.id == "")
        {
            tElement = tElement.parentElement;
        }

        if (tElement != null)
        {
            let tList = ItemList.getItemList()

            tList.elementClicked(tElement.id, "item");
        }
    }

    addItem(pItem, pSelected = false)
    {
        let tRow, tRowElement;
        let tCurrentItemCount = this.getItemCount();

        let tItemBox = document.createElement("div");
        tItemBox.classList.add("item");
        tItemBox.classList.add("col" + ((tCurrentItemCount % 4) + 1));
        
        tItemBox.id = ItemList.genId(pItem["itemId"], "item");
        tItemBox.addEventListener("click", GridList.handleClickEvent);

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
            tRowElement.id = ItemList.genId(tRow, "row");

            tRowElement.append(tItemBox);

            let tListElem = this.getTargetElement();

            tListElem.classList.add("grid-list");
            tListElem.append(tRowElement);
        }
        else
        {
            tRow = Math.ceil(tCurrentItemCount / 4);

            ItemList.getElementById(tRow, "row").append(tItemBox);
        }

        super.addItem(pItem, pSelected);
    }
}

class StackedList extends ItemList
{
    constructor(pListElementID, pCounterID, pDefaultStyle)
    {
        super(pListElementID, pCounterID, "item");
        this._extraColumn = {class: "", header: ""};
        this._activeItemIndex = -1;
        this._idList = [];
        this._map = null;
        this._defaultStyle = pDefaultStyle;
    }

    static _createList(pListElementID, pCounterID = "", pDefaultStyle = "hollow-green")
    {
        let tList = new StackedList(pListElementID, pCounterID, pDefaultStyle);
        ItemList._instance = tList;

        return tList;
    }

    static handleClickEvent(event)
    {
        let tElement = event.target;
        while(tElement !== null && tElement.id == "")
        {
            tElement = tElement.parentElement;
        }

        if (tElement === null)
        {
            return;
        }

        let tItemID = ItemList.getIdFromElementID(tElement.id, "item");

        let tList = ItemList.getItemList();
        tList.elementClicked(tElement.id, "item");

        // Find the row element to add / remove selected
        while (tElement !== null && 
                    (tElement.id === "" || !tElement.classList.contains("row")))
        {
            tElement = tElement.parentElement;
        }

        if (tElement !== null)
        {
            if (tList.itemIsSelected(tItemID))
            {
                tElement.classList.add("selected");
            }
            else
            {
                tElement.classList.remove("selected");
            }
        }
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

        if (this._defaultStyle !== null)
        {
            tEntry.classList.add(this._defaultStyle);
        }

        tEntry.classList.add("item");
        tEntry.innerHTML = pItem["name"];
        tEntry.id = ItemList.genId(pItem["itemId"], "item");

        tEntry.addEventListener("click", StackedList.handleClickEvent);

        let tRow = document.createElement("div");
        tRow.classList.add("row");
        tRow.id = ItemList.genId(tItemCount, "row");

        tRow.append(tCounter);
        tRow.append(tEntry);

        if (this._extraColumn.class === "need-maintenance")
        {
            let tSwitchElem = document.createElement("div");
            tSwitchElem.classList.add(this._extraColumn.class);
            tSwitchElem.innerHTML = Translator.translate("no").toUpperCase();
            tSwitchElem.id = ItemList.genId(pItem["itemId"], "switch")

            tSwitchElem.addEventListener("click", function (event) {
                let tElement = event.target;
                let tID = ItemList.getIdFromElementID(tElement.id, "switch");
                let tList = ItemList.getItemList();

                // Ignore click if the item is not selected
                if (!tList.itemIsSelected(tID))
                {
                    return;
                }

                // Was only needing maintenance if switch was on
                // Flip the state
                let tNeedMaintenance = !tElement.classList.contains("switch-on");

                if (tNeedMaintenance)
                {
                    tElement.classList.remove("switch-off");
                    tElement.classList.add("switch-on");
                }
                else
                {
                    tElement.classList.remove("switch-on");
                    tElement.classList.add("swich-off");
                }

                let tText;
                if (tNeedMaintenance)
                {
                    tText = "yes";
                }
                else
                {
                    tText = "no";
                }

                tElement.innerHTML = Translator.translate(tText).toUpperCase();

                // Update the dictionary of items needing maintenance
                if (tNeedMaintenance)
                {
                    if (!("data" in tList._extraColumn))
                    {
                        let tData = {};
                        tData[tID] = true;
                        tList._extraColumn.data = tData;
                    }
                    else
                    {
                        tList._extraColumn.data[tID] = true;
                    }
                }
                else
                {
                    delete tList._extraColumn.data[tID];
                }

                tList._extraColumn._storage.store("selection", tList._extraColumn.data);

                AutoLogout.recordInteraction();
            });

            tRow.append(tSwitchElem);
        }
        else if (this._extraColumn.class === "locker")
        {
            let tTextElem = document.createElement("div");
            tTextElem.classList.add(this._extraColumn.class);
            tTextElem.id = ItemList.genId(pItem["itemId"], "locker");

            tRow.append(tTextElem);
        }

        tListContainer.append(tRow);

        super.addItem(pItem, pSelected);
    }

    static getExtraStorage(pExtraClass)
    {
        return new Storage("munasafn." + pExtraClass);
    }

    _addColumn(pClass, pHeaderText)
    {
        this._extraColumn = {class: pClass, header:pHeaderText};
        this._updateHeader();
        this._extraColumn._storage = StackedList.getExtraStorage(pClass);
        this._extraColumn._storage.clear();
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
            let tFormerlyActive = ItemList.getElementById(tFormerID, "item");

            if (tFormerlyActive !== null)
            {
                tFormerlyActive.classList.remove("hollow-green");
                tFormerlyActive.classList.add("hollow-gray");
            }

            let tFormerInstructions = ItemList.getElementById(tFormerID, "locker");
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
        let tDomElem = ItemList.getElementById(tItemID, "item");
        let tInstructionsDiv = ItemList.getElementById(tItemID, "locker");
        if (tDomElem === null || tItemID === -1)
        {
            debugger;
            throw -1;
        }

        // Mark item as active
        let tDoorID = this._findDoorID(tItemID);
        tDomElem.classList.add("hollow-green");
        tDomElem.classList.remove("hollow-gray");

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
        let tList = StackedList._createList(pListElementID, pCounterID, "hollow-gray");
        tList._addColumn("locker", "");

        tList._initSelection(pUseSelection);

        return tList;
    }

    static createReturnList(pListElementID, pCounterID = "", pUseSelection = false)
    {
        let tItemList = StackedList._createList(pListElementID, pCounterID, "hollow-gray");
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
    static _storage = new Storage("munasafn.autologout");

    static initialise(pTimeoutInSeconds, pLogoutCallback)
    {
        AutoLogout._logout_cb = pLogoutCallback;
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