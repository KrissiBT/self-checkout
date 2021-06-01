/*jshint esversion: 6 */ 

// Key listener
//  * L / l: shows the log
//  * c / C: clears the log
document.addEventListener("keydown", function(pKey) {
    if (pKey === "L" || pKey === "l")
    {
        console.log(Logger.fetch());
    }
    else if (pKey === "C" || pKey === "c")
    {
        Logger.clear();
    }
});

class Logger
{
    static append(pObject)
    {
        let tLog = window.sessionStorage.getItem("log");

        let tLogList;
        if (tLog === null)
        {
            tLogList = [];
        }
        else
        {
            tLogList = JSON.parse(tLog);
        }

        tLogList.append(pObject);

        window.sessionStorage.setItem("log", JSON.stringify(tLogList));
    }

    static fetch()
    {
        let tLog = window.sessionStorage.getItem("log");

        if (tLog === null)
        {
            return [];
        }
        else
        {
            return JSON.parse(tLog);
        }
    }

    static clear()
    {
        window.sessionStorage.clearItem("log");
    }
}