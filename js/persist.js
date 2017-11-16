"use strict";
//==============================================================================
// persist - an object to do persistent storage.
//
// This class basically wraps localStorage, but exists mostly so that I can
// replace persistent storage later when all this gets integrated with COMPS.
//
// As is, Persist is a straightforward wrapper on localStorage. But since
// localStorage won't store objects, it stringifies objects to JSON on set and
// parses them on get. To get this behavior from get you need to pass an object
// as the default, and an empty object will work.
//==============================================================================
function Persist()
{
}

//------------------------------------------------------------------------------
Persist.get = function(key, dflt)
{
  var result = localStorage[key];
  if (typeof dflt === "object" && result && typeof result === "string")
  {
    try {
      result = JSON.parse(result);
    }
    catch(e)
    {
      // Just leave result as-is if can't parse
    }
  }
  if (result === undefined)
    result = dflt;
  return result;
};

//------------------------------------------------------------------------------
Persist.set = function(key, value)
{
  if (typeof value === "object")
    value = JSON.stringify(value);
  localStorage[key] = value;
};

//------------------------------------------------------------------------------
Persist.remove = function(key)
{
  localStorage.removeItem(key);
};

//------------------------------------------------------------------------------
Persist.dump = function()
{
  for (var i = 0; i < localStorage.length; i++)
  {
    var key = localStorage.key(i);
    var value = localStorage[key];
    console.log("localStorage['" + key + "'] = " + value);
  }
};
