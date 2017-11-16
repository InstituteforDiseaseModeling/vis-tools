//==============================================================================
// visSet - Visualization set file for Vis-Tools
//
// Depends on:
//  lodash
//  Binding
//==============================================================================

//==============================================================================
// VisSet object
//==============================================================================
function VisSet()
{
  // Ensure defaults
  if (!VisSet.kDefaults)
  {
    console.error("VisSet constructor called before VisSet.kDefaults set.");
    return;
  }

  _.merge(this, VisSet.kDefaults);
  this.options = this.defaultOptions[this.targetClient];
  this._sources = {};    // Fill in by load() via process()
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
// Defaults (read on first construction from defaultvisset.json)
VisSet.kDefaults = null;

// Target clients (_targetClient)
VisSet.kGeospatialClient = "Geospatial";
// More later

// Node vis types (_nodeVis.visType)
VisSet.kNodesAsPoints = "Points";
VisSet.kNodesAsShapes = "Shapes";

// Defaults are set in defaultvisset.js - do not put defaults here

// Node keys NOT offered as static sources
VisSet.kNodeNonSourceKeys = [ "altitude", "latitude", "longitude", "nodeId" ];

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Node-style callback: callback(err). Err will null for success, else err is
// the errorThrown.
//------------------------------------------------------------------------------
VisSet.initialize = function(defaultsUrl, callback)
{
  $.getJSON(defaultsUrl)
    .done(function(data, textStatus, jqxhr)
    {
      VisSet.kDefaults = data;
      callback(null);
    })
    .fail(function(jqxhr, textStatus, errorThrown)
    {
      callback(errorThrown);
    });
};

//------------------------------------------------------------------------------
// Returns the data sources available in the VisSet.
//------------------------------------------------------------------------------
VisSet.prototype.getSources = function()
{
  return this._sources;
};

//------------------------------------------------------------------------------
VisSet.prototype.getSource = function(srcKey)
{
  return this._sources[srcKey];
};

//------------------------------------------------------------------------------
VisSet.prototype.getSinks = function(within)
{
  return within.sinks;
};

//------------------------------------------------------------------------------
// Returns an array of "sinks" objects within this.options.
//------------------------------------------------------------------------------
VisSet.prototype.getAllSinks = function()
{
  function findMatchingKeys(obj, keyName)
  {
    var matches = [];
    if (obj && typeof obj === "object" && keyName in obj)
      matches.push(obj[keyName]);
    for (var key in obj)
    {
      if (obj[key] && typeof obj[key] === "object")
        matches = matches.concat(findMatchingKeys(obj[key], keyName));
    }
    return matches;
  }
  return findMatchingKeys(this.options, "sinks");
};

//------------------------------------------------------------------------------
// Public methods
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Given a set of sinks, returns a dictionary of sinks where the source is
// static and the function IS NOT "none()".
//------------------------------------------------------------------------------
VisSet.prototype.getStaticSinks = function(sinks)
{
  var result = {};
  var instance = this;
  _.forEach(sinks, function(sink, sinkKey)
  {
    // Now we have a binding, which is a source and a function. Look up the
    // source to see if it is static. If so, include it in the result.
    var source = instance._sources[sink.source];
    if (source && source.type === "static" && source.friendlyName !== "None")
    {
      result[sinkKey] = sink;
    }
  });
  return result;
};

//------------------------------------------------------------------------------
// Given a set of sinks, returns a dictionary of sinks where the source is
// dynamic.
//------------------------------------------------------------------------------
VisSet.prototype.getDynamicSinks = function(sinks)
{
  var result = {};
  var instance = this;
  _.forEach(sinks, function(sink, sinkKey)
  {
    var source = instance._sources[sink.source];
    if (source && source.type === "dynamic")
      result[sinkKey] = sink;
  });
  return result;
};

//------------------------------------------------------------------------------
// Given a set of sinks, returns an array of binding objects for any BOUND sinks
// that match the names in sinkNameArr. Optional sourceType "static"|"dynamic"
//------------------------------------------------------------------------------
VisSet.prototype.findBindingsTo = function(sinks, sinkNameArr, sourceType)
{
  var result = [];
  var instance = this;
  _.forEach(sinkNameArr, function(sinkKey)
  {
    var sink = sinks[sinkKey];
    var source = instance._sources[sink.source];
    if (sink.source !== "none" || sink.function !== "none()")
    {
      if (sourceType === undefined || source.type === sourceType)
        result.push(sink.binding);
    }
  });
  return result;
};

//------------------------------------------------------------------------------
VisSet.prototype.getBoundingBox = function()
{
  var ni = this.nodeInfo;
  return {
    latitudeMin: ni.latitudeMin,
    latitudeMax: ni.latitudeMax,
    longitudeMin: ni.longitudeMin,
    longitudeMax: ni.longitudeMax
  };
};

//------------------------------------------------------------------------------
// I/O
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Node-style callback: callback(err, result). If err is null, result is a new
// VisSet object. If err is not null, there was an error, and err is the
// errorThrown.
//------------------------------------------------------------------------------
VisSet.load = function(url, callback)
{
  $.getJSON(url)
    .done(function(data, textStatus, jqxhr)
    {
      var visSet = new VisSet();
      visSet = _.merge(visSet, data);

      visSet._loadLinks(function(err)
      {
        if (err)
          callback(err);
        else
        {
          // Now that linked files are loaded, finish processing the visset
          visSet._process();
          callback(null, visSet);
        }
      });
    })
    .fail(function(jqxhr, textStatus, errorThrown)
    {
      callback(errorThrown);
    });
};

//------------------------------------------------------------------------------
// Public helper functions
//------------------------------------------------------------------------------
VisSet.backCalculateStartDate = function(timestepCount)
{
  return new Date(Date.now() - timestepCount * 86400000);
};

//------------------------------------------------------------------------------
VisSet.friendlyCaps = function(str)
{
  return str[0].toUpperCase() + str.substr(1);
};

//------------------------------------------------------------------------------
VisSet.functionToSummary = function(funcText)
{
  if (!funcText || funcText.length === 0) return "None";
  else if (funcText[0] === "{")
    return "Custom";
  var parts = VisSet._breakFunctionText(funcText);
  if (!parts) return "Error";
  else return VisSet.friendlyCaps(parts[0]);
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Node-style callback(err), err is null on success.
//------------------------------------------------------------------------------
VisSet.prototype._loadLinks = function(callback)
{
  var loadFuncs = [];
  var instance = this;

  // Add load functions for each "shown" spatial link
  _.forEach(this.links.spatial, function(linkSpec, name)
  {
    if (!linkSpec.show) return;   // Omit channels with show == false
    loadFuncs.push(function(cb)
    {
      instance._loadSpatialBinary(linkSpec.url, linkSpec.friendlyName,
        function(err, result)
        {
          if (err) cb(err);
          else
          {
            linkSpec.spatialBinary = result;
            cb(null);
          }
        });
    });
  });

  // Run all the load functions in parallel, and call teh function below when
  // all of them complete or any one of them fails.
  async.parallel(loadFuncs, function finish(err)
  {
    callback(err);
  });
};

//------------------------------------------------------------------------------
// Node style callback: callback(err, spatialBinary), err is null on success.
// On failure err will be an error string.
//------------------------------------------------------------------------------
VisSet.prototype._loadSpatialBinary = function(url, friendlyName, callback)
{
  // Read binary. bin variable will be a Uint8Array.
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function()
  {
    if (this.status === 200)
    {
      var spatialBinary = new SpatialBinary(friendlyName);
      spatialBinary.setData(this.response);
      callback(null, spatialBinary);
    }
    else
    {
      callback("Couldn't load spatial channel " + url + ": " +
        xhr.statusText);
    }
  };
  xhr.send();
};

//------------------------------------------------------------------------------
VisSet.prototype._process = function()
{
  this._surveySources();    // Fills out this._sources
  this._fixupBindings();    // Fix up null sources, create Binding objects
};

//------------------------------------------------------------------------------
VisSet.prototype._fixupBindings = function()
{
  var instance = this;
  var sinksObjects = this.getAllSinks();
  _.forEach(sinksObjects, function(sinksObj)
  {
    for (var sinkKey in sinksObj)
    {
      var sink = sinksObj[sinkKey];
      if (sink.source === null || instance.getSource(sink.source) === undefined)
        sink.source = "none";
      if (sink.function === null)
        sink.function = "none()";
      var returnType = "returnType" in sink ? sink.returnType : "number";
      sink.binding = new Binding(returnType, sink.returnConversion);
      var sourceInfo = instance.getSource(sink.source);
      sink.binding.setSource(sink.source, sourceInfo.data, sourceInfo.min,
        sourceInfo.max);
      if (!sink.binding.setFunction(sink.function))
      {
        sink.funciton = "none()";
        sink.binding.function(sink.function);
        // Alert user that 1+ functions were invalid * IMPROVE
      }
    }
  });
};

//------------------------------------------------------------------------------
// Returns array: [ functionName, [ functionArguments ] ], or null if can't be
// parsed
//------------------------------------------------------------------------------
VisSet._breakFunctionText = function(funcText)
{
  if (!funcText || funcText.length === 0) return [ "", [] ];
  if (funcText[0] === "{") return [ "Custom", [] ];
  var matches = funcText.match(/(.*)\((.*)\)/);
  if (!matches) return null;
  var args;
  try
  {
    args = eval("[" + matches[2] + "]");
    return [ matches[1], args ];
  }
  catch(e)
  {
    return null
  }
};

//------------------------------------------------------------------------------
VisSet.prototype._surveySources = function()
{
  this._sources = {};
  var i;

  // "None" is a source. This simplifies a number of things.
  this._sources["none"] = {
    friendlyName: "None",
    type: "static",   // This let us use fixed(...) with no source.
    data: null,
    min: 0,
    max: 1    // Using 1 here avoids various divide-by-zero situations
  };

  // Include any node fields that are not among the standard four as static
  // sources.
  var node = _.clone(this.nodes[0]);
  for (i = 0; i < VisSet.kNodeNonSourceKeys.length; i++)
  {
    // Delete keys for non-sources
    delete node[VisSet.kNodeNonSourceKeys[i]];
  }
  var keys = Object.keys(node).sort();
  var instance = this;
  _.forEach(keys, function(key)
  {
    var range = instance.nodeInfo.ranges[key];
    instance._sources[key] = {
      friendlyName: VisSet._friendlyNodeAttribute(key),
      type: "static",
      data: null,
      min: range.min,
      max: range.max
    }
  });

  // Include all spatial channels that have show == true
  _.forEach(this.links.spatial, function(linkObj, key)
  {
    if (linkObj.show)
      instance._sources[key] = {
        friendlyName: linkObj.friendlyName,
        type: "dynamic",
        data: linkObj.spatialBinary,
        min: linkObj.min,
        max: linkObj.max
      }
  });
};

//------------------------------------------------------------------------------
// Make a node attribute friendly.
//------------------------------------------------------------------------------
VisSet._friendlyNodeAttribute = function(str)
{
  // For now only handling [Upper|lower]CamelCase, _ -> ' '
  if (str === "") return;
  str = str[0].toUpperCase() + str.substr(1);
  str = str.replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace("_", " ");
  return str;
};
