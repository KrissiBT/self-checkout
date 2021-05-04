const kKopaKioskURL = "https://kopakioskprototype.myturn.com/library";

function goToPage(pPage)
{
    window.open(pPage + ".html", name="_self");
}

function initKopaKiosk() {
    return Kiosk.getSessionKiosk(kKopaKioskURL);
}

function UILogout()
{
    console.log("soeunfo");
    initKopaKiosk().logout()
        .then(() => {
            goToPage("index");
        },
        () => {
            goToPage("oops");
        });
}

window.onload = function() 
{
    $("#header-logout").click(function() {UILogout()});
};