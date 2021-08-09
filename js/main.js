/*jshint esversion: 6 */ 

const kKopaKioskURL = "https://kopakioskprototype.myturn.com/library";
const kLockerURL = "https://yettodefi.ne"

let sContGenFuncs = null;

function initKopaKiosk() {
    return Kiosk.getSessionKiosk(kKopaKioskURL);
}

function initLocker()
{
    return Locker.getLocker(kLockerURL);
}

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

// Add a content-generating function to be executed when the page is loaded
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
        Storage.store("selection", null);
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
            let tSelection = Storage.fetch("selection");

            if (tSelection !== null)
            {
                Object.values(tSelection).forEach(tItem =>
                {
                    this.addItem(tItem, true);
                });
            }
        }
        catch (pErr) {console.log(pErr);}
    }

    getTargetElement()
    {
        return document.getElementById(this._target);
    }

    _updateSelection()
    {
        Storage.store("selection", this._selectedItems);

        try
        {
            if (this._counterID != "")
            {
                document.getElementById(this._counterID).innerHTML =
                        Translator.translate("selected", 
                            Object.keys(this._selectedItems).length);
            }
        }
        catch (pErr){console.log(pErr);}
    }

    _selectItem(pID)
    {
        let tElement = document.getElementById(pID);
        this._selectedItems[pID] = this._elements[pID];
        tElement.classList.add("selected");

        this._updateSelection();
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

        this._updateSelection();
    }

    addItem(pItem, pSelected = false)
    {
        if (pItem["itemId"] !== null)
        {
            this._elements[pItem["itemId"]] = pItem;
            this._itemCount++;

            if (pSelected)
            {
                this._selectItem(pItem["itemId"]);
            }
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
                    '<div class="message translate">' + Translator.translate(pMessage) + "</div>";
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

    addItem(pItem, pSelected = false)
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

        super.addItem(pItem, pSelected);
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

    addItem(pItem, pSelected = false)
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
                tHeader.innerHTML = Translator.translate(this._extraColumn.header);

                tHeaderRow.append(tHeader);
                tListContainer.append(tHeaderRow);
            }
        }

        let tItemCount = this.getItemCount();
        this._idList.push(pItem["itemId"]);

        let tCounter = document.createElement("div");
        tCounter.classList.add("counter");
        tCounter.innerHTML = (tItemCount + 1) + ".";

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
            tSwitchElem.innerHTML = Translator.translate("no").toUpperCase();

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

        super.addItem(pItem, pSelected);
    }

    itemClicked(pID)
    {
        if (this._extraColumn.class === "need-maintenance")
        {
            let tText;
            if (!(pID in this._selectedItems))
            {
                tText = "yes";
            }
            else
            {
                tText = "no";
            }

            let tElement = document.getElementById(pID);

            if (tElement === null)
            {
                return;
            }

            let tSwitch = tElement.getElementsByClassName(this._extraColumn.class);
            if (tSwitch !== null && tSwitch.length == 1)
            {
                tSwitch[0].innerHTML = Translator.translate(tText).toUpperCase();
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
            tHeader[0].innerHTML = Translator.translate(this._extraColumn.header);
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

    _setNextItemActive(pInstructionStringID)
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

            let tFormerInstructions = ItemList.getElementById("locker", tFormerID);
            tFormerInstructions.classList.remove("item-active");
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
        let tInstructionsDiv = ItemList.getElementById("locker", tItemID);
        if (tDomElem === null || tItemID === -1)
        {
            debugger;
            throw -1;
        }

        // Mark item as active
        let tDoorID = this._findDoorID(tItemID);
        tDomElem.classList.add("hollow-green");

        // Create instruction elements
        if (tInstructionsDiv === null)
        {
            return null;
        }

        let tSubTitle = document.createElement("div");
        tSubTitle.classList.add("shelf");
        tSubTitle.innerHTML = Translator.translate("shelf-open", tDoorID);

        let tInstruction = document.createElement("div");
        tInstruction.classList.add("instruction");
        tInstruction.innerHTML = Translator.translate(pInstructionStringID);

        tInstructionsDiv.append(tSubTitle);
        tInstructionsDiv.append(tInstruction);
        tInstructionsDiv.classList.add("item-active");

        return this.getItem(tItemID);
    }

    pickUpNextItem()
    {
        return this._setNextItemActive("collect-item");
    }

    returnNextItem()
    {
        return this._setNextItemActive("return-item");
    }

    getActiveItem()
    {
        return this.getItem(this._getItemId(this._activeItemIndex));
    }

    setLockerMap(pMap)
    {
        this._map = pMap;
    }

    static createLockerList(pListElementID, pCounterID = "", pUseSelection = true)
    {
        let tList = StackedList._createList(pListElementID, pCounterID);
        tList._addColumn("locker", "");

        if (pUseSelection)
        {
            tList._loadSelection();
        }

        return tList;
    }

    static createReturnList(pListElementID, pCounterID = "", pUseSelection = false)
    {
        let tItemList = StackedList._createList(pListElementID, "");
        tItemList._addColumn("need-maintenance", "need-maintenance");

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

const sLanguages = [ "en", "is" ];

/*
 Translator is a tool used to automatically translate all nodes in the
 DOM that have the class 'translate'.

 A JSON file with the language name (e.g. 'en.json') must exist in the `lang`
 folder. Such file should use the string IDs that are used in lieu of the text
 in the DOM elements.

 The DOM element with the id "lang-switch" will assigned the 2-letter
 code for the current language.
*/
class Translator
{
    static _strings = null;

    static _clearVar(pKey)
    {
        window.sessionStorage.removeItem("munasafn.translator." + pKey);
    }

    static _storeVar(pKey, pValue)
    {
        window.sessionStorage.setItem("munasafn.translator." + pKey, 
                JSON.stringify(pValue));
    }

    static _fetchVar(pKey)
    {
        let tValue = window.sessionStorage.getItem("munasafn.translator." + pKey);

        if (tValue === null)
        {
            return null;
        }
        else
        {
            return JSON.parse(tValue);
        }
    }

    // Return a Promise, fulfilled upon parsing of the whole language package
    static initialise()
    {
        let tLanguage = Translator._fetchVar("language");

        if (tLanguage === null)
        {
            return Translator.setLanguage("is");
        }
        else
        {
            return Translator.setLanguage(tLanguage);
        }
    }

    static _fetchStrings(pLanguage)
    {
        let tParams = {
            method: "GET",
            credentials: 'same-origin',
            referrerPolicy: 'origin',
            "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        };

        Translator._storeVar("language", pLanguage);

        return fetch("lang/" + pLanguage + ".json", tParams)
                .then(reply => {
                    if (reply.status != 200)
                    {
                        throw reply.status;
                    }

                    return reply.json()
                        .then(pJson => {
                            Translator._strings = pJson;
                            Translator._storeVar("strings", pJson);

                            return true;
                        });
                })
                .catch(pError => {
                    debugger;
                    console.log(pError);
                    Translator._clearVar("language");
                    Translator._clearVar("strings");
                });
    }

    // Return a Promise completing upon parsing of the whole language file
    // The promise returns true if the language has changed, false otherwise
    static setLanguage(pLanguage)
    {
        let tLanguage = Translator._fetchVar("language");

        if (tLanguage !== pLanguage)
        {
            return Translator._fetchStrings(pLanguage);
        }

        let tStrings = Translator._fetchVar("strings");
        if (tStrings === null)
        {
            return Translator._fetchStrings(pLanguage);
        }

        Translator._strings = tStrings;
        
        // Return a Promise returning false
        return new Promise((resolve, reject) => {
            resolve(false);
        });
    }

    // Any extra parameter will be inserted in the {} placeholders present in
    // the string
    static translate(pStringID)
    {
        if (Translator._strings === null)
        {
            return "";
        }
        else if (!(pStringID in Translator._strings))
        {
            return "missing " + pStringID;
        }
        else
        {
            let tString = Translator._strings[pStringID];

            for (let i = 1; i < arguments.length; i++)
            {
                tString = tString.replace("{" + i + "}", arguments[i]);
            }
            return tString;
        }
    }


    static getDate(pDate)
    {
        let tMonths = ["january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"];

        let tMonth = Translator.translate(tMonths[pDate.month]);

        return Translator.translate("date-format").replace("{day}", pDate.day)
                .replace("{month}", tMonth).replace("{year}", pDate.year);
    }

    static fillLangIcon(pDomElement, pLanguage)
    {
        pDomElement.className = "lang-icon";
        pDomElement.classList.add(pLanguage);
        pDomElement.innerHTML = pLanguage.toUpperCase();
    }

    static closePopup()
    {
        let tPopup = document.getElementById("lang-popup");
        if (tPopup !== null)
        {
            tPopup.remove();
        }

        let tBackdrop = document.getElementById("backdrop");
        if (tBackdrop !== null)
        {
            tBackdrop.remove();
        }
    }

    static openLangPopup(event)
    {
        // Create a backdrop to catch the clicks
        let tBackdrop = document.createElement("div");
        tBackdrop.id = "backdrop";
        tBackdrop.addEventListener("click", function() {
                setTimeout(Translator.closePopup(), 50);
            });

        document.body.append(tBackdrop);

        // Create the popup
        let tPopup = document.createElement("div");
        tPopup.id = "lang-popup";

        for (let i = 0; i < sLanguages.length; i++)
        {
            let tLang = document.createElement("div");
            Translator.fillLangIcon(tLang, sLanguages[i]);

            tLang.addEventListener("click", function() {
                Translator.setLanguage(sLanguages[i])
                    .then(pChanged => {
                        if (pChanged)
                        {
                            window.location.reload(true);
                        }
                        else
                        {
                            setTimeout(Translator.closePopup(), 50);
                        }
                    });
            }, true);
            tPopup.append(tLang);
        }

        document.body.append(tPopup);
    }

    static translatePage()
    {
        let tElements = document.getElementsByClassName("translate");
        
        for (var i=0, len=tElements.length|0; i<len; i=i+1|0)
        {
            let tElement = tElements[i];
            tElement.innerHTML = Translator.translate(tElement.innerHTML);
        }

        let tSwitch = document.getElementById("lang-switch");

        if (tSwitch !== null)
        {
            let tLanguage = Translator._fetchVar("language");
            Translator.fillLangIcon(tSwitch, tLanguage);

            tSwitch.addEventListener("click", Translator.openLangPopup);
        }
    }
}