/* Kiosk Javascript library */

function requestHeaders(token='')
{
    let t_headers = {'Content-Type': 'application/json'};

    if (token != '')
    {
        t_headers["authorisation"] = "Bearer " + token;
    }

    return t_headers;
}

function fetchParams(pMethod, token='', data={})
{
    console.log(data);
    return {
        'method': pMethod, // *GET, POST, PUT, DELETE, etc.
        'headers': requestHeaders(token),
        'body': JSON.stringify(data) // body data type must match "Content-Type" header
    };
}

async function getData(url = '', token='')
{
    // Default options are marked with *
    return await fetch(url, fetchParams('POSGETT', token));
}

// Example POST method implementation:
function postData(url = '', data={}, token='') {
    // Default options are marked with *
    console.log("postData");
    let s = fetch(url, fetchParams('POST', token, data));
    console.log("fetch terminated");
    return s;
}

function storeToken(pToken)
{
    window.sessionStorage.setItem()
}
class Kiosk
{
    constructor(pURL, pToken){
        this._token = pToken;
        this._url = pURL;
    }

    static getSessionKiosk(pURL)
    {
        let tKiosk = new Kiosk(pURL, Kiosk._fetchVar('token'));

        return tKiosk
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

    login(pUsername, pPassword, pSuccess, pFailure)
    {
        let tError = "";
        let tToken = "";

        return postData(this._endPointURL("api/login"),
                {"username": pUsername, "password": pPassword});
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
