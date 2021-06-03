/*jshint esversion: 6 */ 

const kKopaKioskURL = "https://kopakioskprototype.myturn.com/library";
const kLockerURL = "https://yettodefi.ne"

function initKopaKiosk() {
    return Kiosk.getSessionKiosk(kKopaKioskURL);
}

function initLocker()
{
    return Locker.getLocker(kLockerURL);
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
    initKopaKiosk().logout()
        .then(() => {
            UIGoToPage("index");
        },
        () => {
            debugger;
            UIGoToPage("oops");
        });
}

function UITranslateDate(pDate)
{
    return
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
});

class Translator
{
    static _language = "EN";

    static _month(pMonthIndex)
    {
        let tMonths = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        return tMonths[pMonthIndex];
    }

    static getDate(pDate)
    {
        return pDate.day + " " + Translator._month(pDate.month) + " " + pDate.year;
    }
}

class ItemList
{
    static _instance = null;

    constructor(pTarget, pCounterID = ""){
        this._target = pTarget;
        this._counterID = pCounterID;
        this._itemCount = 0;
        this._selectedItems = {};
        this._elements = {};
    }

    static clearSelection()
    {
        window.sessionStorage.removeItem("selection");
    }

    static getItemList()
    {
        if (ItemList._instance === null)
        {
            throw "No existing list";
        }

        return ItemList._instance;
    }

    static genId(pType, pID)
    {
        return pType + "_" + pID;
    }

    static getElementById(pType, pID)
    {
        return document.getElementById(ItemList.genId(pType, pID));
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

    getTargetElement()
    {
        return document.getElementById(this._target);
    }

    itemClicked(pID)
    {
        // Item in the selected list should be deselected
        let tSelectItem = !(pID in this._selectedItems);
        let tElement = document.getElementById(pID);

        if (tElement === null)
        {
            return;
        }

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

    addItem(pItem)
    {
        if (pItem["itemId"] !== null)
        {
            this._elements[pItem["itemId"]] = pItem;
            this._itemCount++;
        }
    }

    getItemCount()
    {
        return this._itemCount;
    }

    getItems()
    {
        return this._elements;
    }

    getItem(pID)
    {
        if (pID in this._elements)
        {
            return this._elements[pID];
        }
        else
        {
            return null;
        }
    }

    showEmpty(pMessage)
    {
        console.log("showEmpty");
        let tDomElem = this.getTargetElement();

        if (tDomElem !== null)
        {
            tDomElem.innerHTML = tDomElem.innerHTML +
                    '<div class="message">' + pMessage + "</div>";
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
        super(pListElementID, pCounterID);
    }

    static createList(pListElementID, pCounterID = "", pUseSelection= false)
    {
        let tList = new GridList(pListElementID, pCounterID);
        ItemList._instance = tList;

        if (pUseSelection)
        {
            tList._loadSelection();
        }

        return tList;
    }

    addItem(pItem)
    {
        let tRow, tRowElement;
        let tCurrentItemCount = this.getItemCount();

        let tItemBox = document.createElement("div");
        tItemBox.classList.add("item");
        tItemBox.classList.add("col" + ((tCurrentItemCount % 4) + 1));

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
                        let tList = ItemList.getItemList()

                        tList.itemClicked(tElement.id);
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
        if ((tCurrentItemCount % 4) == 0)
        {
            tRow = Math.ceil(tCurrentItemCount / 4) + 1;
            tRowElement = document.createElement("div");
            tRowElement.classList.add("row");
            tRowElement.id = ItemList.genId("row", tRow);

            tRowElement.append(tItemBox);

            let tListElem = this.getTargetElement();

            tListElem.classList.add("grid-list");
            tListElem.append(tRowElement);
        }
        else
        {
            tRow = Math.ceil(tCurrentItemCount / 4);

            ItemList.getElementById("row", tRow).append(tItemBox);
        }

        super.addItem(pItem);
    }
}

class StackedList extends ItemList
{
    constructor(pListElementID, pCounterID)
    {
        super(pListElementID, pCounterID);
        this._extraColumn = {class: "", header: ""};
        this._activeItemIndex = -1;
        this._idList = [];
        this._map = null;
    }

    static _createList(pListElementID, pCounterID = "")
    {
        let tList = new StackedList(pListElementID, pCounterID);
        ItemList._instance = tList;

        return tList;
    }

    addItem(pItem)
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
                tHeader.innerHTML = this._extraColumn.header;

                tHeaderRow.append(tHeader);
                tListContainer.append(tHeaderRow);
            }
        }

        super.addItem(pItem);

        let tItemCount = this.getItemCount();
        this._idList.push(pItem["itemId"]);

        let tCounter = document.createElement("div");
        tCounter.classList.add("counter");
        tCounter.innerHTML = tItemCount + ".";

        let tEntry = document.createElement("div");
        tEntry.classList.add("hollow-green");
        tEntry.classList.add("item");
        tEntry.innerHTML = pItem["name"];
        tEntry.id = pItem["itemId"];

        let tRow = document.createElement("div");
        tRow.classList.add("row");
        tRow.id = ItemList.genId("row", tItemCount);

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
        else if (this._extraColumn.class === "locker")
        {
            let tTextElem = document.createElement("div");
            tTextElem.classList.add(this._extraColumn.class);
            tTextElem.id = ItemList.genId("locker", pItem["itemId"]);

            tRow.append(tTextElem);
        }

        tListContainer.append(tRow);

        try
        {
            if (this._counterID != "")
            {
                document.getElementById(this._counterID).innerHTML =
                        tItemCount + " selected";
            }
        }
        catch(pErr){console.log(pErr);}
    }

    itemClicked(pID)
    {
        if (this._extraColumn.class === "need-maintenance")
        {
            let tText;
            if (!(pID in this._selectedItems))
            {
                tText = "YES";
            }
            else
            {
                tText = "NO";
            }

            let tElement = document.getElementById(pID);

            if (tElement === null)
            {
                return;
            }

            let tSwitch = tElement.getElementsByClassName(this._extraColumn.class);
            if (tSwitch !== null && tSwitch.length == 1)
            {
                tSwitch[0].innerHTML = tText;
            }
        }

        super.itemClicked(pID);
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
        let tTarget = this.getTargetElement();

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

    _setNextItemActive(pInstruction)
    {
        let tFormerIndex = this._activeItemIndex;
        let tNewIndex = ++this._activeItemIndex;

        // Clear old active item CSS classes
        if (tFormerIndex != -1)
        {
            let tFormerID = this._getItemId(tFormerIndex);
            let tFormerlyActive = document.getElementById(tFormerID);

            if (tFormerlyActive !== null)
            {
                tFormerlyActive.classList.remove("hollow-green");
                tFormerlyActive.classList.add("hollow-gray");
            }

            let tFormerInstructions = ItemList.findElementById("locker", tFormerID);
            tFormerInstructions.classList.remove("show-arrow");
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
        let tDomElem = document.getElementById(tItemID);
        let tInstructions = ItemList.getElementById("locker", tItemID);
        if (tDomElem === null || tItemID === -1)
        {
            debugger;
            throw -1;
        }

        // Mark item as active
        let tDoorID = this._findDoorID(tItemID);
        tDomElem.classList.add("hollow-green");

        // Create instruction elements
        if (tInstructions === null)
        {
            return null;
        }

        let tSubTitle = document.createElement("div");
        tSubTitle.classList.add("shelf");
        tSubTitle.innerHTML = "Shelf no." + tDoorID + " is now open"

        let tInstruction = document.createElement("div");
        tInstruction.classList.add("instruction");
        tInstruction.innerHTML = pInstruction;

        tInstructions.append(tSubTitle);
        tInstructions.append(tInstruction);

        return this.getItem(tItemID);
    }

    pickUpNextItem()
    {
        return this._setNextItemActive("Please collect item and close door");
    }

    getActiveItem()
    {
        return this.getItem(this._getItemId(this._activeItemIndex));
    }

    setLockerMap(pMap)
    {
        this._map = pMap;
    }

    static createLockerList(pListElementID, pUseSelection = true)
    {
        let tList = StackedList._createList(pListElementID, "");
        tList._addColumn("locker", "");

        if (pUseSelection)
        {
            tList._loadSelection();
        }

        return tList;
    }

    static createReturnList(pListElementID, pUseSelection = false)
    {
        let tItemList = StackedList._createList(pListElementID, "");
        tItemList._addColumn("need-maintenance", "Need maintenance?");

        if (pUseSelection)
        {
            tItemList._loadSelection();
        }
        return tItemList;
    }

    static createList(pListElementID, pCounterID = "", pUseSelection = false)
    {
        let tList = StackedList._createList(pListElementID, pCounterID);

        if (pUseSelection)
        {
            tList._loadSelection();
        }
        return tList;
    }
}