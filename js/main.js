const kKopaKioskURL = "https://kopakioskprototype.myturn.com/library";

function UIGoToPage(pPage)
{
    window.open(pPage + ".html", name="_self");
}

function initKopaKiosk() {
    return Kiosk.getSessionKiosk(kKopaKioskURL);
}

function UILogout()
{
    initKopaKiosk().logout()
        .then(() => {
            UIGoToPage("index");
        },
        () => {
            UIGoToPage("oops");
        });
}

window.onload = function() 
{
    $("#header-logout").click(function() {UILogout()});
};