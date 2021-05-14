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

addLoadEvent(function() 
{
    $("#header-logout").click(function() {UILogout()});
});



class itemList
{
    static _selectedItems = new Map();
    
    constructor(pTarget){
        this._target = "#" + pTarget;
        this._itemCount = 0;
    }

    static itemClicked(pID)
    {
        if (this._selectedItems.has(pID))
        {
            this._selectedItems.delete(pID);
            $("#item-" + pID). removeClass("selected");
        }
        else
        {
            this._selectedItems.set(pID, true);
            $("#item-" + pID). addClass("selected");
        }
    }
    
    addItem(pItem)
    {
        console.log("addItem");
        let tRow, tRowElement;

        let tItemBox = document.createElement("div");
        tItemBox.classList.add("item");
        tItemBox.classList.add("col" + ((this._itemCount % 4) + 1));

        tItemBox.id = "item-" + pItem["id"];
        tItemBox.addEventListener("click", 
                () => { itemList.itemClicked(pItem["id"])});

        let tImage = document.createElement("img");
        tImage.classList.add("thumbnail");
        tImage.setAttribute("alt", pItem["name"]);
        tImage.setAttribute("src", pItem["thumbnail"]);

        let tTitle = document.createElement("div");
        tTitle.classList.add("name");
        tTitle.innerHTML = pItem["name"];

        tItemBox.append(tImage);
        tItemBox.append(tTitle);

        console.log(this._itemCount);

        // Create a row if required
        if ((this._itemCount % 4) == 0)
        {
            tRow = Math.ceil(this._itemCount / 4) + 1;
            tRowElement = document.createElement("div");
            tRowElement.classList.add("row");
            tRowElement.id = "row-" + tRow;

            tRowElement.append(tItemBox);

            document.querySelector(this._target).append(tRowElement);
        }
        else
        {
            tRow = Math.ceil(this._itemCount / 4);

            document.querySelector("#row-" + tRow).append(tItemBox);
        }

        this._itemCount++;

        // let tItemHtml = '<div onclick="itemList.itemClicked(' + pItem["id"] + 
        //         ')" class="item" id="item-' + pItem["id"] + '">' +
        //         '<img class="thumbnail" alt="' + pItem["name"] +
        //         '" src="' + pItem["thumbnail"] + '" />' +
        //         '<div class="name">' + pItem["name"] + '</div>' +
        //         '</div>';

        // $(this._target).append(tItemHtml);
    }

    showEmpty(pMessage)
    {
        console.log("showEmpty");
        $(this._target).append('<div class="message">' + pMessage + "</div>");
    }

    showError(pError)
    {
        console.log("showError");
        console.log(pError);
        $(this._target).append('<div class="message error">' + pError + "</div>");
    }
}