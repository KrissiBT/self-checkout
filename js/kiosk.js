/*jshint esversion: 6 */ 
/* Kiosk Javascript library */

function fetchParams(pMethod, token='', data={})
{
    let tParams = {
        method: pMethod, // *GET, POST, PUT, DELETE, etc.
        credentials: 'same-origin',
        referrerPolicy: 'origin',
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    }

    let tHeaders = {};
    if (pMethod == "POST" && data != {})
    {
        tHeaders['Content-Type'] = 'application/json';
        tParams.body = JSON.stringify(data); // body data type must match "Content-Type" header
    }
    else
    {
         tHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    if (token != '')
    {
        tHeaders.Authorization = "Bearer " + token;
    }

    if (tHeaders != {})
    {
        tParams.headers = tHeaders;
    }

    console.log("fetchParams:");
    console.log(tParams);
    return tParams;
}

function getData(url = '', token = '', params = {})
{
    // Default options are marked with *
    console.log("getData");
    let paramCount = 0;
    for (let key in params) {
        if (paramCount == 0){url += "?";}
        else {url += "&";}

        url += encodeURIComponent(key) + "=" + encodeURIComponent(params.key);
    }
    console.log("URL: " + url);
    return fetch(url, fetchParams('GET', token));
}

// Example POST method implementation:
function postData(url = '', data = {}, token = '') {
    // Default options are marked with *
    console.log("postData");
    return fetch(url, fetchParams('POST', token, data));
}

function isEmpty(pObject)
{
    for (let i in pObject)
    {
        return false;
    }
    return true;
}

class Kiosk
{
    constructor(pURL, pToken){
        this._token = pToken;
        this._url = pURL;
    }

    static kSessKeyCartID = 'myturn.kiosk.activecartid';

    static getSessionKiosk(pURL)
    {
        if (isEmpty(Kiosk._session))
        {
            Kiosk._session = new Kiosk(pURL, Kiosk._fetchVar('token'));
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

    _endPointURL(pAPI)
    {
        return this._url + "/" + pAPI;
    }

    _getRequest(pApi)
    {
        return getData(this._endPointURL(pApi), this._token);
    }

    _postRequest(pApi, pData={}, pNeedToken=true)
    {
        if (pNeedToken)
        {
            return postData(this._endPointURL(pApi), pData, this._token);
        }
        else
        {
            return postData(this._endPointURL(pApi), pData);
        }
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
                            Kiosk._storeVar('token', data['access_token']);
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
                else
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
                    debugger;
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
}
