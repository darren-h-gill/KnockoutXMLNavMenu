"use strict";
/*
Using the appearing module pattern to create
navigation helper in the window scope
NB: Pass the jQuery noConfilct into the $ parameter
*/
(function (navControl, $, undefined) {
    //Revealing Module Pattern

    var isModalOpen = false;
    var _openPanelName = null;
    var _bookmarkName = null;
    ///This template will be used to add content to the foot of a document and then displayed as a popup
    var _templatePopup = '<div class="w3-container w3-modal w3-animate-zoom" id="[[popupPanelID]]" ><div class="w3-modal-content"><div class="w3-content"><header class="[[popupPanelHeaderCSS]] w3-container"><div class="w3-right"><a href="javascript:void(0)" onclick="navControl.modal(\'[[popupPanelID]]\',true)"><i class="fa fa-window-close" aria-hidden="true"></i></a></div><span>[[popupPanelName]]</span></header><div class="w3-panel"><div class="w3-content" id="[[popupPanelID]]_content">Loading Content to Display ...</div></div><header class="[[popupPanelHeaderCSS]] w3-container"><div class="w3-right"><a href="javascript:void(0)" onclick="navControl.modal(\'[[popupPanelID]]\',true)"><i class="fa fa-window-close" aria-hidden="true"></i></a></div><span>[[popupPanelName]]</span></header></div></div></div>';
    var _defPopupOptions = {
        popupPanelID: null, //Expect this to be generated later if required
        popupPanelHeaderCSS: "w3-teal",
        popupPanelName: "" //expect this to come from a menu name working in popup mode
    };
    var _dynamicDivPanelCounter = 1000;
    
    var processHash = function (sBookmark) {
        //have a bookmark so check to see if it is valid
        var sBookmarkSelector = "a[name='" + sBookmark + "']";
        var urlContent = "content/" + sBookmark + ".html";
        var tagBookmark = $(sBookmarkSelector).get(0);

        console.log("Bookmark for \"" + sBookmark + "\"....");
        console.log(tagBookmark);

        if (tagBookmark) {
            if (tagBookmark.innerHTML) {
                //content already present, no special processing required as the browser should scrol into view ...
                console.log("Standard Bookmark Processing. If you need to call any analyticts to register this 'view' then this could be the place....");
            } else {
                //No content.try and load it ....
                $.ajax(urlContent, {
                    success: function (data, textStatus, jqXHR) {
                        //assume that the data is valid HTML
                        tagBookmark.innerHTML = data;
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log("Failure to load requested content from " + urlContent);
                    }
                });
                
            }
        } else {
            //No Tag Found - create it at the end of the document and load ONLY if there is content
            
            $.ajax(urlContent, {
                success: function (data, textStatus, jqXHR) {
                    //assume that the data is valid HTML
                    var jqBookmark = $("<a name='" + sBookmark + "'></a>");
                    tagBookmark = jqBookmark.get(0);
                    tagBookmark.innerHTML = data;
                    
                    $("body").append(tagBookmark);

                    //ensure a bit of margin padding is added (assuming that the W3.CSS stylesheet in use!)
                    $(sBookmarkSelector).wrap("<div class='w3-content'></div>");
                    //scroll the new tag into view ....
                    $('html, body').animate({
                        scrollTop: jqBookmark.offset().top
                    }, 1000);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Failure to load requested content from " + urlContent);
                }
            });
        }
    };

    if (window.location.hash) {
        //must wait for the DOM to be ready before deciding what to do next ...
        _bookmarkName = window.location.hash.substring(1);
        $(document).ready(function () {
            processHash(_bookmarkName);
        });
    }

    $(window).bind('hashchange', function (e) {
        console.log("Hash Change Event triggered");
        console.log(e);
        processHash(window.location.hash.substring(1));
    });

  
    //interpret XML from url
    /*
      * @param { string } url locatin to load the menu data from
      * @param { string | number } menuID (optional)
      * @param { function } cbHandler function(data){}
      * @param { function } cbError function(errorText){}
      * @return {array<menuItem>}
    */
    navControl.buildMenu = function (url, menuID, cbReady, cbError) {
        console.log("buildMenu started");
        if (!url) throw "Source Url Required";

        if (!cbReady) throw "Expect to have a callback to receive the menu object array";

        ////
        /* a recursive function to work down the XML structure building up the JS object  as it goes
            * @param {object} oContainer object that nees an array of items added
            * @param { element } tagContainer element that may contain other menu items
        */
        var fMenuWalker = function (oContainer, tagContainer) {
            var aMenuItem = [];
            $(tagContainer).children().each(function (idx, tag) {

                if (tag.tagName === "menuitem") {
                    var newMenuItem = {//NB: Have to use the first filter to prevent descendant menuitem names and urls getting picked up
                        name: $("name", tag).first().text(),
                        url: $("url", tag).first().text(),
                        target: $("target", tag).first().text(),
                        popup: $("popup", tag).length ? true : false //existance of a popup tag indicates that a modal popup should be used
                    };

                    if (newMenuItem.popup) {
                        newMenuItem.url = "JAVASCRIPT:navControl.dynamicPopup('" + newMenuItem.url + "','" + newMenuItem.name + "')";
                    }
                    //recurse
                    fMenuWalker(newMenuItem, tag);
                    aMenuItem.push(newMenuItem);
                }
            });

            if (aMenuItem.length) {
                oContainer.items = aMenuItem;
            }
            return;

        };
        
        $.ajax({
            url: url,
            dataType: "xml",
            success: function (data, statusText, jqXHR) {
                //assume that data is a DOM with at least one menu block full of menuitems
                var sSelector = "menus > menu";
                
                if (menuID) {
                    if (typeof menuID === "number") {
                        sSelector += ":nth-child(" + menuID + ")"; //NB. 1 based idexing, which is fine because if a zero gets passed the  if(menuID) is falsey so will just get 1st menu anyway!
                    } else {
                        sSelector += "[id='" + menuID + "']"; //may need to check the content?
                    }
                    
                }
                
                //process the Nav XML with jQuery
                try {
                    var tagMenu = $(sSelector, data).first().get(); //NB: doiing first in case no men ID was used!
                    if (!tagMenu) throw "Could not find menu!";

                    var retMenu = {};
                    fMenuWalker(retMenu, tagMenu); //start the recurse process
                    console.log("buildMenu completed sucessfully. Invoking callback ...");
                    cbReady(retMenu);
                } catch (ex) {
                    var sErrorMessage = ex.message || "No Message!";
                    console.error("navControl.buildMenu Error processing menu DOM\n" + sErrorMessage);
                    if (cbError && typeof cbError === "function") cbError(sErrorMessage);
                    return;
                }
            },
            error: function (jqXHR, statusText, errorText) { console.error("navControl.buildMenu Error:" + errorText); if (cbError && typeof cbError === "function") cbError(errorText); return; }

        });

    };


    //capture keyup to process an escape on a modal panel
    $(document).keyup(function (e) { if (e.keyCode === 27 && _openPanelName) navControl.modal(_openPanelName, true); return; });

    //Everybody loves a Lightbox modal display!
    // The W3.CSS has a helper class for this 
    // This routine is a helper wrapper around that functionality, not specifically "core" to this requirement.
    navControl.modal = function (panelName, close) {
        
        var sDisplay = close ? "none" : "block"; //When close is true(ish) then close the modal otherwise open it
        var elmPanel = document.getElementById(panelName);
        if (elmPanel) {
            if (jQuery(elmPanel).hasClass("w3-modal")) {
                elmPanel.style.display = sDisplay;
                if (!close) {
                    isModalOpen = true;
                    _openPanelName = panelName;
                } else {
                    isModalOpen = false;
                    _openPanelName = null;
                }
            } else {
                console.error("ID passed (" + panelName + ") is a valid emlement identifier, but the element does not have the CSS class w3-modal so will not be displayed!");
                return;
            }

        } else {
            console.error("ID passed (" + panelName + ") to specify a modal panel was not valid. No element found");
            return;
        }
        return null;
    };

    //Generate a new DOM element from the template and load 
    // with the content specified by the URL
    navControl.dynamicPopup = function (url, options) {

    /*  {
             popupPanelID: null, //Expect this to be generated later if required
             popupPanelHeaderCSS: "w3-teal",
             popupPanelName: "" //expect this to come from a menu name working in popup mode
        }
        */

        var effectiveOptions = {};
        $.extend(effectiveOptions, _defPopupOptions);
        if (typeof options === "object") {
            $.extend(effectiveOptions, options);
        } else if (typeof options === "string") {
            effectiveOptions.popupPanelName = options;
        }

        //build a hidden div ready to accept content
        if (!effectiveOptions.popupPanelID) effectiveOptions.popupPanelID = "dynamicPanel" + _dynamicDivPanelCounter++;


        //build content for display  from the template
        var sTemplate = _templatePopup;
        //replace tokens
        sTemplate = sTemplate.replace(/\[\[popupPanelID\]\]/g, effectiveOptions.popupPanelID);
        sTemplate = sTemplate.replace(/\[\[popupPanelHeaderCSS\]\]/g, effectiveOptions.popupPanelHeaderCSS);
        sTemplate = sTemplate.replace(/\[\[popupPanelName\]\]/g, effectiveOptions.popupPanelName);
        debugger
        var $content = $(sTemplate);
        $("body").append($content);
        //load the content from the url
        $.ajax(url, {
            success: function (data, textStatus, jqXHR) {
                //stuff the text into the generated modal div
                $("#" + effectiveOptions.popupPanelID + "_content").get(0).innerHTML = data;

                //display the popup
                navControl.modal(effectiveOptions.popupPanelID);
            }
        });
        

    };

    navControl.openNav = function () {
        document.getElementsByClassName("w3-sidenav")[0].style.display = "block";
        document.getElementsByClassName("w3-overlay")[0].style.display = "block";
    };
    navControl.closeNav = function () {
        document.getElementsByClassName("w3-sidenav")[0].style.display = "none";
        document.getElementsByClassName("w3-overlay")[0].style.display = "none";
    };






}(window.navControl = window.navControl || {}, jQuery));


jQuery(window).ready(function () {

    //load the Nav into an element with ID "topNav"
    navControl.buildMenu("data/nav.xml", 1, function (oMenuRoot) {
        window.oMenuRoot = oMenuRoot;
        ko.applyBindings(oMenuRoot, document.getElementById("topNav"));
    }, null);

});