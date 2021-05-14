/* Kiosk Javascript library */

function fetchParams(pMethod, token='', data={})
{
    let tParams = {
        'method': pMethod, // *GET, POST, PUT, DELETE, etc.
        'credentials': 'same-origin',
        'referrerPolicy': 'origin',
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    }

    let tHeaders = {};
    if (pMethod == "POST" && data != {})
    {
        tHeaders['Content-Type'] = 'application/json';
        tParams['body'] = JSON.stringify(data); // body data type must match "Content-Type" header
    }
    else
    {
         tHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    if (token != '')
    {
        tHeaders["Authorization"] = "Bearer " + token;
    }

    if (tHeaders != {})
    {
        tParams['headers'] = tHeaders;
    }

    console.log("fetchParams:");
    console.log(tParams);
    return tParams;
}

function getData(url = '', token='', params={})
{
    // Default options are marked with *
    console.log("getData");
    let paramCount = 0;
    for (key in params) {
        if (paramCount == 0){url += "?";}
        else {url += "&";}

        url += encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    }
    console.log("URL: " + url);
    return fetch(url, fetchParams('GET', token));
}

// Example POST method implementation:
function postData(url = '', data={}, token='') {
    // Default options are marked with *
    console.log("postData");
    return fetch(url, fetchParams('POST', token, data));
}

function storeToken(pToken)
{
    window.sessionStorage.setItem()
}

function isEmpty(pObject)
{
    for (i in pObject)
        return false;
    return true;
}
class Kiosk
{
    constructor(pURL, pToken){
        this._token = pToken;
        this._url = pURL;
    }

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

    login(pUsername, pPassword)
    {
        //pUsername = "snouat";
        //pPassword = "T0ol!Plusvite!";

        return postData(this._endPointURL("api/login"),
                {"username": pUsername, "password": pPassword});
    }

    getReservations()
    {
        return getData(this._endPointURL("api/v1.1/reservations"),
            this._token);
    }

    getCarts()
    {
        return getData(this._endPointURL("api/v1.1/self-checkout/carts"),
            this._token);
    }

    createCart()
    {
        return postData(this._endPointURL("api/v1.1/self-checkout/carts"), 
            this._token);
    }

    listItems(availableOnly = true)
    {
        return getData(this._endPointURL("api/v1.1/items"), this._token)
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
                let tItem;
                for (tItem of pJson)
                {
                    if (!availableOnly || tItem['availableForCheckout'])
                    {
                        tItems.push(tItem);
                    }
                }

                console.log("JSON ready");
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
        return postData(this._endPointURL("api/logout"))
            .then(data => {},
                error =>{});
    }
}
