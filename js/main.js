/*jshint esversion: 6 */ 

const kKioskURL = "https://hringrasarsafnprototype.myturn.com/library";
const kNotificationEmail = "sebastien.nouat@gmail.com";
const kLockerURL = "https://yettodefi.ne"

let sContGenFuncs = null;

function UIReportError(pError)
{
    debugger;
    console.log(pError);
    //TODO Send report to an email address
}

function UIGoToPage(pPage, pGetParams = {})
{
    let tSuffix = "";
    if (pGetParams.length != 0)
    {
        for (tKey in pGetParams)
        {
            if (tSuffix.length === 0)
            {
                tSuffix = "?";
            }
            else
            {
                tSuffix += "&";
            }

            tSuffix += encodeURIComponent(tKey) + "=" +
                            encodeURIComponent(pGetParams[tKey]);
        }
    }

    window.open(pPage + ".html" + tSuffix, name="_self");
}

function UILogout()
{
    Kiosk.getSessionKiosk().logout();
    UIGoToPage("index");
}

function UIGoToIndexPage()
{
    UIGoToPage("index");
}

function UIGoToErrorPage(pError)
{
    UIGoToPage("error");
}

function UIInitKiosk()
{
    Kiosk.initialise(kKioskURL, UIGoToIndexPage, UIGoToErrorPage);
}

function UIInitLocker()
{
    Locker.initialise(kLockerURL);
}

function UIInitAutoLogout()
{
    // Set the timeout to 2 minutes
    AutoLogout.initialise(10, UILogout);
}

function addLoadEvent(func)
{
    let oldonload = window.onload;
    if (typeof(window.onload) != 'function')
    {
        window.onload = func;
    }
    else
    {
        window.onload = function()
        {
            if (oldonload)
            {
                oldonload();
            }
            func();
        }
    }
}

// Content-generating function to be executed when the page is loaded
function addContGenFunction(pFunc)
{
    if (sContGenFuncs === null)
    {
        sContGenFuncs = pFunc;
    }
    else
    {
        let tOldFunc = sContGenFuncs;

        sContGenFuncs = function()
        {
            tOldFunc();
            pFunc();
        }
    }
}

// Initialise the page so that the log out button react to click
addLoadEvent(function()
{
    for (let tElement of ["header-logout", "logout"])
    {
        let tDomElem = document.getElementById(tElement);

        if (tDomElem !== null)
        {
            tDomElem.addEventListener("click", function() {
                UILogout();
            });
        }
    }

    // Translate the page at loading
    // then call all the content-generating functions (which might need the
    // translator to be fully loaded to translate content)
    Translator.initialise()
        .then(() => {
            Translator.translatePage();

            if (sContGenFuncs !== null)
            {
                sContGenFuncs();
            }
        });
});
