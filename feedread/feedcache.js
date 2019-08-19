// Service worker and caching code for FeedRead

////////////////////////////////////////
// Configurable variables:

// The top level of the feed dir:
var feedTop = '/feeds';

////////////////////// End configuration

const CACHENAME = "feed-read-cache";


// Current date in format mm-dd-day
var days = ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"];
function formatDate(d) {
    var d = new Date();
    var date = d.getDate();
    if (date < 10) date = '0' + date;
    var month = d.getMonth() + 1;
    if (month < 10) month = '0' + month;
    var day = days[d.getDay()];
    return month + '-' + date + '-' + day;
}


// Fetch all the feeds generated today.
// Start with $feedTop/mm-dd-day/MANIFEST
// and then fetch all the files referenced there.

// XXX Zoe suggests async await as a more straightforward and
// easier to read alternative to promises.

// Variables used by fetchDaily:
var todayStr = null;
var manifestURL = null;
var manifestList = null;


// Read the manifest (which should already be in the cache)
// and set the global variable manifestList to its split contents.
// Returns a promise so you can call .then.
async function readManifest() {
    // For debugging: show if it's in the caches now.
    matchStatus = await caches.match(manifestURL);
    console.log("Here's " + manifestURL + " in the caches: " + matchStatus);

    console.log("fetching " + manifestURL);

    // Try to fetch from network, not cache:
    var myHeaders = new Headers();
    myHeaders.append('pragma', 'no-cache');
    myHeaders.append('cache-control', 'no-cache');
    var myRequest = new Request(manifestURL);
    var myInit = {
        method: 'GET',
        headers: myHeaders,
    };
    response = await fetch(myRequest, myInit);

    // response = await fetch(manifestURL);
    if (!response.ok) {
        err = new Error("Couldn't fetch " + manifestURL + ": status "
                        + response.status + " " + response.statusText);
        err.code = response.status;
        throw(err);
    }
    var txt = await response.text();
    console.log("Read text: '" + txt + "'");
    manifestList = txt.split(/\r?\n/);

    // This split adds a bogus final empty entry. Remove it.
    // Note, this won't do anything about empty lines in the
    // middle of the list, but feedme shouldn't create any.
    if (manifestList[manifestList.length-1] == "")
        manifestList.pop();
    console.log("Split into " + manifestList.length + " lines");
    return manifestList;
}

// Fetch the MANIFEST file for today's daily feeds,
// and then fetch and cache all the files referred to there.
async function fetchDaily() {
    if (!todayStr)
        todayStr = formatDate(new Date());

    var todayURL = feedTop + '/' + todayStr + '/';
    manifestURL = todayURL + 'MANIFEST';

    try {
        const cache = await caches.open(CACHENAME);

        // Clear out the MANIFEST from the cache.
        // This is arguable, since really the MANIFEST shouldn't change,
        // but it's vaguely possible to have gotten an early copy of it
        // before it was fully written.
        // In any case, it's useful for testing.
        deleteStatus = await cache.delete(manifestURL);
        console.log("status of deleting " + manifestURL + ": " + deleteStatus);

        // Read the manifest and parse it into an array, manifestList.
        const status = await readManifest();
        console.log("Read the manifest");
        if (!manifestList) {
            console.log("I guess reading the manifest failed");
            return status;
        }

        console.log("Inside the promise, the manifest has "
                    + manifestList.length + " lines");
        await cache.add(manifestURL);

        newURLs = [];
        for (f in manifestList) {
            if (! manifestList[f])    // skip blank lines
                continue;
            if (manifestList[f] == ".EOF." || manifestList[f] == "MANIFEST")
                continue;

            // Is it already cached?
            newurl = todayURL + manifestList[f];
            console.log("*   " + newurl);
            matchResponse = await cache.match(newurl);
            if (!matchResponse) {
                console.log("    not in the cache; will add");
                newURLs.push(newurl);
            }
            else
                console.log("    already cached");
        }
        console.log("Requesting to add", newURLs.length, "to the cache");
        await cache.addAll(newURLs);
        return 0;
    }
    catch (err) {
        alert("fetch failed:" + err);
        return err;
    }
}

//
// Return an array of all the URLs in the cache, in no particular order.
//
async function listCachedPages() {
    if (! CACHENAME) {
        console.log("CACHENAME is null, can't show TOC!");
        return null;
    }

    var cache = await caches.open(CACHENAME);
    var cachedFiles = await cache.keys();
    return cachedFiles;
}

//
// Return a sorted array of all the top-level pages available.
//
async function TOC() {
    var cachedFiles = await listCachedPages();

    tocPages = [];
    for (var key in cachedFiles) {
        // Skip directories and the manifest:
        var url = cachedFiles[key].url;
        if (url.endsWith('/') || url == "MANIFEST")
            continue

        // Find index.html files
        if (url.endsWith('index.html')) {
            tocPages.push(url);
        }
    }
    tocPages.sort();
    return tocPages;
}

/*
// Service worker: cache, falling back to network.
// This doesn't seem to ever get called.
console.log("Adding service worker:");
self.addEventListener('fetch', function(event) {
    console.log("fetch listener, " + event.request);
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
*/
