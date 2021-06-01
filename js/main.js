/*jshint esversion: 6 */ 

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
    $("#logout").click(function() {UILogout()});
});

class ItemList
{
    static _instance = null;

    constructor(pTarget, pType="grid", pCounterID=""){
        this._target = "#" + pTarget;
        this._counterID = pCounterID;
        this._itemCount = 0;
        this._selectedItems = {};
        this._type = pType;
        this._elements = {};
        this._extraColumn = {class: "", header: ""};
    }

    static clearSelection()
    {
        window.sessionStorage.removeItem("selection");
    }

    static _createEmptyList(pTarget="", pType="grid", pCounterID="")
    {
        ItemList._instance = new ItemList(pTarget, pType, pCounterID);
        return ItemList._instance;
    }

    // pType: 'grid' or 'list'
    static createEmptyList(pTarget="", pType="grid", pCounterID="")
    {
        return ItemList._createEmptyList(pTarget, pType, pCounterID);
    }

    static createEmptyReturnList(pListElementID = "")
    {
        let tItemList = ItemList._createEmptyList(pListElementID, "return-list");
        tItemList._addColumn("need-maintenance", "Need maintenance?");
        return tItemList;
    }  
    
    static getItemList()
    {
        if (ItemList._instance === null)
        {
            throw "No existing list";
        }

        return ItemList._instance;
    }

    // pType: 'grid', 'list', 'locker-list', 'return-list'
    static createListFromSavedSelection(pListElementID, pType="grid", pCounterID="")
    {
        let tItemList = ItemList.createEmptyList(pListElementID, pType, pCounterID);
        tItemList._loadSelection();
    }

    static createReturnList(pListElementID)
    {
        let tItemList = ItemList.createEmptyReturnList(pListElementID, "return-list");
        tItemList._loadSelection();
    }

    _loadSelection()
    {
        try
        {
            let tSelection =JSON.parse(
                        window.sessionStorage.getItem("selection"));

            Object.values(tSelection).forEach(tItem =>
            {
                this.addItem(tItem);
            });
        }
        catch (pErr) {console.log(pErr);}
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
        let tTarget = document.getElementById(this._target);

        if (tTarget === null)
        {
            return;
        }

        let tHeader = tTarget.getElementsByClassName("header");

        if (tHeader !== null && tHeader.length == 1)
        {
            tHeader[0].innerHTML = this._extraColumn.header;
        }
    }

    itemClicked(pID)
    {
        // Item in the selected list should be deselected
        let tSelectItem = !(pID in this._selectedItems);
        let tElement = document.getElementById(pID);

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
        // debugger;
        if (this._extraColumn.class === "need-maintenance")
        {
            let tText;
            if (tSelectItem)
            {
                tText = "YES";
            }
            else
            {
                tText = "NO";
            }

            let tSwitch = tElement.getElementsByClassName(this._extraColumn.class);
            if (tSwitch !== null && tSwitch.length == 1)
            {
                tSwitch[0].innerHTML = tText;   
            }
        }

        window.sessionStorage.setItem("selection", 
                JSON.stringify(this._selectedItems));

        try
        {
            if (this._counterID != "")
            {
                document.getElementById(this._counterID).innerHTML = 
                        Object.keys(this._selectedItems).length + " selected";
            }
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
                        ItemList.getItemList().itemClicked(tElement.id);
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

            let tListElem = document.querySelector(this._target);

            tListElem.classList.add("grid-list");
            tListElem.append(tRowElement);
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

        if (this._itemCount == 0)
        {
            tListContainer.classList.add("rounded-list");
            if (this._extraColumn.header !== "")
            {
                let tHeaderRow = document.createElement("div");
                tHeaderRow.classList.add("list-header");

                let tHeader = document.createElement("div");
                tHeader.classList.add(this._extraColumn.class);
                tHeader.innerHTML = this._extraColumn.header;

                tHeaderRow.append(tHeader);
                tListContainer.append(tHeaderRow);
            }
        }

        this._itemCount++;

        let tCounter = document.createElement("div");
        tCounter.classList.add("counter");
        tCounter.innerHTML = this._itemCount + ".";

        let tEntry = document.createElement("div");
        tEntry.classList.add("hollow-green");
        tEntry.classList.add("item");
        tEntry.innerHTML = pItem["name"];
        tEntry.id = pItem["itemId"];

        let tRow = document.createElement("div");
        tRow.classList.add("row");
        tRow.id = this._itemCount;

        tRow.append(tCounter);
        tRow.append(tEntry);

        if (this._extraColumn.class === "need-maintenance")
        {
            let tSwitchElem = document.createElement("div");
            tSwitchElem.classList.add(this._extraColumn.class);
            tSwitchElem.innerHTML = "NO";

            tSwitchElem.addEventListener("click", function (event) {
                    let tElement = event.target;
                    while(tElement.id == "" && tElement != null)
                    {
                        tElement = tElement.parentElement;
                    }

                    if (tElement != null)
                    {
                        ItemList.getItemList().itemClicked(tElement.id);
                    }});

            tRow.append(tSwitchElem);
        }

        tListContainer.append(tRow);

        try
        {
            if (this._counterID != "")
            {
                debugger;
                document.getElementById(this._counterID).innerHTML = 
                        this._itemCount + " selected";
            }
        }
        catch(pErr){console.log(pErr);}
    }

    addItem(pItem)
    {
        if (this._type == "grid")
        {
            this._addGridItem(pItem);
        }
        else if (this._type == "list" || this._type == "locker-list" ||
                this._type == "return-list")
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