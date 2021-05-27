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
            debugger;
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
    static _instance = null;

    constructor(pTarget, pCounterID="", pType="grid"){
        this._target = "#" + pTarget;
        this._counterID = pCounterID;
        this._itemCount = 0;
        this._selectedItems = {};
        this._type = pType;
        this._elements = {};
    }

    static clearSelection()
    {
        window.sessionStorage.removeItem("selection");
    }

    // pType: 'grid' or 'list'
    static createEmptyList(pTarget="", pCounterID="", pType="grid")
    {
        itemList._instance = new itemList(pTarget, pCounterID, pType);
        return itemList._instance;
    }
    
    static getItemList()
    {
        if (itemList._instance === null)
        {
            throw "No existing list";
        }

        return itemList._instance;
    }

    // pType: 'grid' or 'list'
    static createListFromSavedSelection(pListElementID, pCounterID="", pType="grid")
    {
        let tItemList = itemList.createEmptyList(pListElementID, pCounterID, pType);
        let tListElement = document.getElementById(pListElementID);
        if (tListElement === null)
        {
            return tItemList;
        }

        try
        {
            let tSelection =JSON.parse(
                        window.sessionStorage.getItem("selection"));

            Object.values(tSelection).forEach(tItem =>
            {
                tItemList.addItem(tItem);
            });
        }
        catch (pErr) {console.log(pErr);}

        return tItemList;
    }

    itemClicked(pID)
    {
        if (!pID in this._selectedItems)
        {
            return;
        }

        if (this._selectedItems.pID)
        {
            delete this._selectedItems.pID;
            document.getElementById(pID).classList.remove("selected");
        }
        else
        {
            this._selectedItems.pID = this._elements[pID];
            document.getElementById(pID).classList.add("selected");
        }

        window.sessionStorage.setItem("selection", 
                JSON.stringify(this._selectedItems));

        try
        {
            document.getElementById(this._counterID).innerHTML = 
                    Object.keys(this._selectedItems).length + " selected";
        }
        catch (pErr){console.log(pErr);}
    }
    
    _addGridItem(pItem)
    {
        let tRow, tRowElement;

        let tItemBox = document.createElement("div");
        tItemBox.classList.add("item");
        tItemBox.classList.add("col" + ((this._itemCount % 4) + 1));

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
                        itemList.getItemList().itemClicked(tElement.id);
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
    }

    _addListItem(pItem)
    {
        let tListContainer = document.querySelector(this._target);

        if (tListContainer === null)
        {
            return;
        }

        this._itemCount++;

        let tCounter = document.createElement("div");
        tCounter.classList.add("counter");
        tCounter.innerHTML = this._itemCount + ".";

        let tEntry = document.createElement("div");
        tEntry.classList.add("hollow-blue");
        tEntry.classList.add("item");
        tEntry.innerHTML = pItem["name"];
        tEntry.id = pItem["itemId"];

        let tRow = document.createElement("div");
        tRow.classList.add("row");
        tRow.append(tCounter);
        tRow.append(tEntry);

        tListContainer.append(tRow);

        try
        {
            document.getElementById(this._counterID).innerHTML = 
                    this._itemCount + " selected";
        }
        catch(pErr){console.log(pErr);}
    }

    addItem(pItem)
    {
        if (this._type == "grid")
        {
            this._addGridItem(pItem);
        }
        else if (this._type == "list")
        {
            this._addListItem(pItem);
        }
        
        if (pItem["itemId"] !== null)
        {
            this._elements[pItem["itemId"]] = pItem;
        }
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