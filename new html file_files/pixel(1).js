"use strict"
window["FLPIXEL"] = (function () {
  var PIXEL_CONNECTOR_URL = "https://pixelconnector.pixeltracker.co";
  var TRACKER_URL = "https://tracker.pixeltracker.co";

  var LOG_URL = TRACKER_URL + "/log.php";

  var verboseMode = false;
  var advertiser_map = {};

  var consoleLog = function (message) {
    if (!verboseMode) {
      return;
    }
    var d = new Date();
    console.log(d.toString() + message);
  }

  var getRequest = function (url, method, data, successCallback, failCallback) {
    method = method || "GET";
    data = data || null;
    successCallback = successCallback || function(){};
    failCallback = failCallback || function(){};

    consoleLog("Executing " + method + " " + url + (data ? " [data = " + data + "]" : ""));
    try {
      var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
      (xhr.onreadystatechange = function () {
        4 === xhr.readyState &&
        (200 === xhr.status ? successCallback(xhr.response) : failCallback(xhr.status));
      }),
          (xhr.ontimeout = function () {
            failCallback("timeout");
          }),
          xhr.open(method, url, true);
      xhr.timeout = 5000;
      xhr.send(data);
    } catch (errors) {
      failCallback(errors);
    }
  }

  var appendPixel = function (url) {
    try {
      var body = document.getElementsByTagName("body")[0];
      var pixelstyle =
          "position:absolute;overflow:hidden;clip:rect(0 0 0 0);height:1px;width:1px;margin:-1px;padding:0;border:0;";
      var pixel = document.createElement("img");

      pixel.src = url;
      pixel.width = "1";
      pixel.height = "1";
      pixel.style = pixelstyle;
      body.appendChild(pixel);
    } catch (e) {
      consoleLog(e);
    }
  }

  var appendPiggybackPixels = function (piggyback_pixels) {
    piggyback_pixels.map(function (pixel) {
      consoleLog("Adding [" + pixel + "] pixel...");
      appendPixel(pixel);
    });
  }

  var appendAdvertiserFile = function (external_file) {
    try {
      if (external_file !== "") {
        var script = document.createElement("script"); 
        script.src = TRACKER_URL + "/scripts/" + external_file; 
        var head = document.getElementsByTagName("head")[0];
        head.appendChild(script);
      }
    } catch (e) {
      consoleLog(e);
    }
  }

  var encodeQueryData = function (data) {
    var ret = [];
    for (var d in data)
      ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
    return ret.join("&");
  }

  var logging = function (data, errors) {
    data = data || '';
    var d = new Date();
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var hr = d.getHours();
    var min = d.getMinutes();
    var sec = d.getSeconds();
    var date = d.getDate();
    var month = months[d.getMonth()];
    var year = d.getFullYear();
    if (min < 10) {
      min = '0' + min;
    }
    if (sec < 10) {
      sec = '0' + sec;
    }

    var dateFormat = '[' + date + '-' + month + '-' + year + ' ' + hr + ':' + min + ':' + sec + ' UTC]';
    var strFormat = dateFormat + ' ' + data + ' | ' + errors + '\n';

    consoleLog(strFormat);
  }

  function getCookie(cName) {
    try {
      var cookieName = cName + "=";
      var decodedCookie = decodeURIComponent(document.cookie);
      var ca = decodedCookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') {
          c = c.substring(1);
        }
        if (c.indexOf(cookieName) === 0) {
          return c.substring(cookieName.length, c.length);
        }
      }
    } catch (e) {
      consoleLog(e);
    }
    return "";
  }

  function setCookie(cName, cValue, numDays) {
    try {
      if (!cName || cName.length == 0) {
        return;
      }
      cValue = cValue || "";

      var expires = '';
      if (numDays) {
        var d = new Date();
        d.setTime(d.getTime() + (numDays * 24 * 60 * 60 * 1000));
        expires = ";expires=" + d.toUTCString();
      }
      document.cookie = cName + "=" + encodeURIComponent(cValue) + expires;
    } catch (e) {
      consoleLog(e);
    }
  }

  function deleteCookie(cName) {
    document.cookie = cName + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

  var fetchDocumentData = function() {
    var document_data = {};
    document_data.host = document.location.host;
    document_data.hostname = document.location.hostname;
    document_data.pathname = document.location.pathname;
    document_data.href = document.location.href;
    return document_data;
  }

  var fetchGAEventsData = function(gaData) {
    try {
      var cookieGAEventsArr = getCookie("ga_events");
      if (cookieGAEventsArr && cookieGAEventsArr.length > 0) {
        var cookieGAEventsObj = JSON.parse(cookieGAEventsArr);
        gaData.events = cookieGAEventsObj;
        gaData.ga_present = true;
        return true;
      }
    } catch (e) {
      consoleLog(e);
    }

    try {
      var gaEventsArray = [];
      var gaEvents = window.ga ? window.ga.getAll() : [];
      if (gaEvents.length > 0) {
        var fieldsToCapture = ['clientId', 'trackingId', 'name'];
        for (var ei = 0; ei < gaEvents.length; ei++) {
          var obj = {};
          for (var fi = 0; fi < fieldsToCapture.length; fi++) {
            var f = fieldsToCapture[fi];
            obj[f] = gaEvents[ei].get(f);
          }
          gaEventsArray.push(obj);
        }
      }
      var dataFound = gaEventsArray.length >= 1;
      if (dataFound) {
        gaData.events = gaEventsArray;
        gaData.ga_present = true;
        setCookie("ga_events", JSON.stringify(gaEventsArray));
      } else {
        deleteCookie("ga_events");
      }
      return dataFound;
    } catch (e) {
      consoleLog(e);
    }
    return false;
  }

  var getClientId = async function (measurementId) {
    try {
      if (typeof gtag !== 'function') {
        return undefined;
      }
      const clientIdPromise = new Promise((resolve) =>
          gtag('get', measurementId, 'client_id', resolve)
      );
      const clientId = await clientIdPromise;
      return clientId;
    } catch (e) {
      consoleLog(e);
      return undefined;
    }
  }

  var fetchGADLData = async function(gaData) {
    try {
      var cookieGADLArr = getCookie("ga_dl");
      if (cookieGADLArr && cookieGADLArr.length > 0) {
        var cookieGADLObj = JSON.parse(cookieGADLArr);
        gaData.dl = cookieGADLObj;
        gaData.ga_present = true;
        return true;
      }
    } catch (e) {
      consoleLog(e);
    }
    try {
      const gaDLObjectArray = [];
      let measurementId = '';
      if (window.dataLayer) {
        for (let i = 0; i < window.dataLayer.length; i++) {
          if (window.dataLayer[i][0]) {
            if (window.dataLayer[i][0] === 'config') {
              measurementId = window.dataLayer[i][1];
              if (measurementId !== '') {
                const clientId = await getClientId(measurementId);
                gaDLObjectArray.push({clientId, measurementId});
              }
            }
          }
        }
      }
      var dataFound = gaDLObjectArray.length >= 1;
      if (dataFound) {
        gaData.dl = gaDLObjectArray;
        gaData.ga_present = true;
        setCookie("ga_dl", JSON.stringify(gaDLObjectArray));
      } else {
        deleteCookie("ga_dl");
      }
      return dataFound;
    } catch (e) {
      consoleLog(e);
    }
    return false;
  };

  var fetchGTMData = async function(gaData) {
    try {
      var cookieGTMArr = getCookie("ga_gtm");
      if (cookieGTMArr && cookieGTMArr.length > 0) {
        var cookieGTMObj = JSON.parse(cookieGTMArr);
        gaData.gtm = cookieGTMObj;
        gaData.ga_present = true;
        return true;
      }
    } catch (e) {
      consoleLog(e);
    }
    try {
      const gtmObjectArray = [];
      let measurementId = '';
      if (window.google_tag_manager) {
        const keys = Object.keys(window.google_tag_manager);
        for (let i = 0; i < keys.length; i++) {
          if (keys[i].startsWith('G-')) {
            measurementId = keys[i];
            break;
          }
        }

        if (measurementId !== '') {
          const clientId = await getClientId(measurementId);
          gtmObjectArray.push({clientId, measurementId});
        }
      }
      var dataFound = gtmObjectArray.length >= 1;
      if (dataFound) {
        gaData.gtm = gtmObjectArray;
        gaData.ga_present = true;
        setCookie("ga_gtm", JSON.stringify(gtmObjectArray));
      } else {
        deleteCookie("ga_gtm");
      }
      return dataFound;
    } catch (e) {
      consoleLog(e);
    }
  };

  const firePixel = function(advertiser, data_object, eventTS, client_ga_data) {
    if (!advertiser) {
      consoleLog('Invalid advertiser');
      return;
    }

    if (advertiser.piggyback_pixels && advertiser.piggyback_pixels.length > 0) {
      consoleLog(`Adding piggyback [${  advertiser.piggyback_pixels.length  }] pixels...`);
      appendPiggybackPixels(advertiser.piggyback_pixels);
    } else {
      consoleLog('No piggyback pixels...');
    }

    if (advertiser.external_file !== '') {
      consoleLog("Appending external file [" + advertiser.external_file + "]...");
      appendAdvertiserFile(advertiser.external_file);
    } else {
      consoleLog('No external files to download...');
    }

    var document_data = fetchDocumentData();
    var post_data = {
      flip_pixel_id: advertiser.flip_id,
      advertiser: advertiser.name,
      timestamp: eventTS,
    };

    var isUniversal = advertiser.conversion_type === 'Universal';
    if (isUniversal) {
      if (!data_object) {
        data_object = {};
      }
      if (!data_object.category) {
        consoleLog("WARN: Universal Pixel fire: Category not specified. Pixel ID: " + advertiser.flip_id);
        if (!data_object.subcategory){
          consoleLog("WARN: Universal Pixel fire: Subcategory not specified. Pixel ID: " + advertiser.flip_id);
        }
      }
      else if (data_object.category !== 'checkout' && !data_object.subcategory){
        consoleLog("WARN: Universal Pixel fire: Subcategory not specified. Pixel ID: " + advertiser.flip_id);
      }
      post_data.event = data_object;
      post_data.event.client_ga_data = client_ga_data;
      post_data.event.document_data = document_data;
    } else {
      var isHomePage = advertiser.conversion_type === "HomepageConv";
      if (isHomePage) {
        data_object = null;
      } else if (!data_object) {
        data_object = {};
      }

      post_data.order_number = null;
      post_data.checkout_values = [];
      post_data.timestamp = eventTS;
      if (data_object) {
        post_data.order_number = data_object.orderNumber || null;
        post_data.checkout_values = data_object.amount ? [data_object.amount] : [];
      }
    }
    consoleLog("Firing pixel update request with [" + JSON.stringify(post_data) + "] data. Universal: " + isUniversal);
    getRequest(PIXEL_CONNECTOR_URL + "/update?s=" + "pixel.js", "POST", JSON.stringify(post_data),
        function () {
          consoleLog("Post to pixelconnector successful...");
        },
        function (e) {
          logging('Advertiser "' + advertiser.flip_id + '" encounter an error: Could not post to pixelconnector.', e);
        }
    );
  };

  var execute = function (pixelId, data_object, eventTS, client_ga_data) {
    if (!pixelId) {
      consoleLog("Missing Advertiser Pixel Id");
      return;
    }

    var flip_advertiser = advertiser_map[pixelId];
    if (!flip_advertiser) {
      var validate_url = PIXEL_CONNECTOR_URL + "/validate" + "?id=" + pixelId;

      consoleLog("Validating [" + pixelId + "] pixel id...");
      getRequest(validate_url, 'GET', null,
          function(valid_res) {
            consoleLog("Pixel validate response = " + valid_res);
            flip_advertiser = JSON.parse(valid_res);
            advertiser_map[pixelId] = flip_advertiser;
            firePixel(flip_advertiser, data_object, eventTS, client_ga_data);
          },
          function(e) {
            logging('Advertiser "' + pixelId + '" encountered an error: Unable to fetch the advertiser details.', e);
          }
      );
    } else {
      firePixel(flip_advertiser, data_object, eventTS, client_ga_data);
    }
  };

  var obj = {};
  var num_tries = 20;
  var current_try = num_tries;
  var wait_for = 150;
  var gaData = {ga_present: false};
  var waitingGAEvents = [];
  var activity_detail = {};
  var loader = undefined;

  async function getGADataThenFireEvent() {
    current_try--;
    var theLoader = loader;
    var localWaitingGAEvents = waitingGAEvents;

    if (current_try < 1) {
      consoleLog("GA loader thread: last iter. Closing up");
      waitingGAEvents = undefined;
      loader = undefined;
      clearInterval(theLoader);
    }
    activity_detail.iteration = (num_tries - current_try);
    consoleLog(JSON.stringify(activity_detail));

    if (gaData.events === undefined) {
      fetchGAEventsData(gaData);
    }
    if (gaData.dl === undefined) {
      await fetchGADLData(gaData);
    }
    if (gaData.gtm === undefined) {
      await fetchGTMData(gaData);
    }
    consoleLog(`GA Data fetch attempted. Present: ${gaData.ga_present}`);

    if (current_try < 1 && gaData.ga_present === false) {
      var msg = "Problems encountered loading GA parameters. Timed out (" + (num_tries * wait_for) + "ms).";
      consoleLog(msg);
    }

    if (current_try < 1 || gaData.ga_present) {
      consoleLog('GA loader: Queue size: ' + localWaitingGAEvents.length + '. GA data present: ' + gaData.ga_present);
      while (localWaitingGAEvents.length >= 1) {
        var eventBundle = localWaitingGAEvents.pop();
        if (!eventBundle.data_object) {
          eventBundle.data_object = {};
        }
        eventBundle.data_object.ga = gaData;
        execute(eventBundle.pixelId, eventBundle.data_object, eventBundle.eventTS, eventBundle.client_ga_data);
      }
    }
  }

  obj.fireWithoutGA = function (pixelId, data_object) {
    try {
      const eventTS = new Date().getTime();
      execute(pixelId, data_object, eventTS);
    } catch (errors) {
      logging('Advertiser "' + pixelId + '" encountered an error: Unable to execute pixel.', errors);
    }
  };

  obj.fire = function (pixelId, data_object, client_ga_data) {
    try {
      var eventTS = new Date().getTime();
      if (waitingGAEvents === undefined) {
        consoleLog("With GA: Iterations done. Firing directly with available data");
        data_object.ga = gaData;
        execute(pixelId, data_object, eventTS, client_ga_data);
      }
      else if (gaData !== undefined && gaData.ga_present) {
        consoleLog("With GA: GA data present. Firing directly");
        data_object.ga = gaData;
        execute(pixelId, data_object, eventTS, client_ga_data);
      } else {
        consoleLog("With GA: Queuing for fire");
        var myWaitingGAEvents = waitingGAEvents;
        if (myWaitingGAEvents !== undefined) {
          myWaitingGAEvents.push({
            pixelId,
            data_object,
            eventTS,
            client_ga_data,
          });
          if (loader === undefined) {
            current_try = num_tries;
            loader = setInterval(getGADataThenFireEvent, wait_for);
          }
        } else {
          data_object.ga = gaData;
          execute(pixelId, data_object, eventTS, client_ga_data);
        }
      }
    } catch (errors) {
      logging('Advertiser "' + pixelId + '" encountered an error: Unable to execute pixel with GA.', errors);
    }
  };

  obj.setVerbose = function (verbose) {
    verboseMode = (verbose ? true : false);
  };

  return obj;
}());
