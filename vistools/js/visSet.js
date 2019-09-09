//==============================================================================
// visSet - Visualization set file for Vis-Tools
//
// Depends on:
//  lodash
//  Binding
//  Utils
//==============================================================================

//==============================================================================
// See FileFormats.md for details on the history of visset.json.
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
  this._nodes = this._nodes ? this._nodes : [];
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

// Timeout for loads. Really only need this if somehow we end up doing cross-
// domain GETs on the spatial binaries, which never call back in any way.
VisSet.kSpatialBinaryTimeoutMs = 10000;

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
      callback(Utils.formatError(jqxhr, errorThrown));
    });
};

//------------------------------------------------------------------------------
VisSet.prototype.getVersion = function()
{
  if ("version" in this) return this.version;
  else return "<1.2";
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
VisSet.prototype.setEmpty = function()
{
  this.nodeInfo = {
    "longitudeMin": -122.16332263480352,
    "latitudeDeltaMin": 3.3333330051732446e-07,
    "longitudeDeltaMin": 3.333332969646108e-07,
    "longitudeMax": -122.14332263480352,
    "ranges": {
      "InitialPopulation": {
        "max": 65,
        "min": 65
      }
    },
    "latitudeMax": 47.59285581419902,
    "latitudeMin": 47.57285581419902
  };
  this.nodes = [{
      "latitude": 47.58289581419902,
      "InitialPopulation": 65,
      "altitude": 1,
      "nodeId": 0,
      "longitude": -122.15332263480352
    }];
};

//------------------------------------------------------------------------------
// Given a set of sinks, returns a dictionary of sinks where
//   * source is static and the function IS NOT "none()"
// OR
//   * source is None and the function is "fixed(...)"
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
    if (!source) return;
    var isNone = source.friendlyName === "None";
    if (source.type === "static" && !isNone)
    {
      result[sinkKey] = sink;
    }
    else if (isNone && sink.function.startsWith("fixed("))
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
      
      // Just in case, ensure that timestepCount is an integer
      visSet.timestepCount = Math.trunc(visSet.timestepCount);

      visSet._loadLinks(function(err)
      {
        if (err)
          callback(err);
        else
        {
          // Now that linked files are loaded, finish processing the visset, and
          // upgrade any old structures in the visset data structure. Note that
          // starting in Vis-Tools version 1.2, the defaultvisset.json contains
          // a "version" key, but that key is not present in earlier versions.
          visSet._process();
          callback(null, visSet);
        }
      });
    })
    .fail(function(jqxhr, textStatus, errorThrown)
    {
      var visSet = new VisSet();
      callback(Utils.formatError(jqxhr, errorThrown));
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
    var url = instance.getSpatialUrl(name);
    loadFuncs.push(function(cb)
    {
      instance._loadSpatialBinary(url, linkSpec.friendlyName,
        function(err, result)
        {
          if (err) cb(err);
          else
          {
            // Shove the spatial binary data back into the visset spatial link
            linkSpec.spatialBinary = result;
            cb(null);
          }
        });
    });
  });

  // Run all the load functions in parallel, and call the function below when
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
  var jqxhr = null;
  var timeout = setTimeout(function()
  {
    if (jqxhr)
      jqxhr.abort();
  }, VisSet.kSpatialBinaryTimeoutMs);
  var jqxhr = $.ajax({
    url: url,
    method: "GET",
    processData: false,
    dataType: "binary",
    responseType: "arraybuffer"
  })
  .done(function(data, textStatus, xhr)
  {
    var spatialBinary = new SpatialBinary(friendlyName);
    spatialBinary.setData(data);
    clearTimeout(timeout);
    callback(null, spatialBinary);
  })
  .fail(function(xhr, textStatus, errorThrown)
  {
    clearTimeout(timeout);
    callback(Utils.formatError(xhr, errorThrown));
  });
};

//------------------------------------------------------------------------------
// This function fills in various aspects of the visset with real-time data,
// and upgrades old-style structures to the latest format. Those are carefully
// documented below.
// Note that starting in Vis-Tools version 1.2, the defaultvisset.json contains
// a "version" key, but that key is not present in earlier versions.
//------------------------------------------------------------------------------
VisSet.prototype._process = function()
{
  // Data structure updates
  // 1.2: links.inset is now a structure. If it is a string, upgrade it.
  if ("inset" in this.links && typeof this.links.inset === "string")
  {
    this.links.inset = { url: this.links.inset }
  }

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

//------------------------------------------------------------------------------
// May return null
//------------------------------------------------------------------------------
VisSet.prototype.getBaseLayerUrl = function()
{
  if (!("customBaseLayer" in this.links) || this.links.customBaseLayer === null)
    return null;

  var result = this.links.customBaseLayer.url;
  if (!Utils.isLocalhost() && "url_asset" in this.links.customBaseLayer)
    result = this.links.customBaseLayer.url_asset;
  return result;
};

//------------------------------------------------------------------------------
// May return null
//------------------------------------------------------------------------------
VisSet.prototype.getBaseLayerFriendlyName = function()
{
  if (!("customBaseLayer" in this.links) || this.links.customBaseLayer === null)
    return null;
  return ("friendlyName" in this.links.customBaseLayer) ?
    this.links.customBaseLayer.friendlyName : null;
};

//------------------------------------------------------------------------------
// May return null. This function handles the old-skool string-type inset
// too because it may be called before _process() has upgraded the structure.
//------------------------------------------------------------------------------
VisSet.prototype.getInsetChartUrl = function()
{
  if (!("inset" in this.links) || this.links.inset === null)
    return null;

  var result = this.links.inset;
  if (typeof result === "object")
  {
    if (!Utils.isLocalhost() && "url_asset" in this.links.inset)
      result = this.links.inset.url_asset;
    else result = this.links.inset.url;
  }
  return result;
};

//------------------------------------------------------------------------------
// May return null
//------------------------------------------------------------------------------
VisSet.prototype.getSpatialUrl = function(key)
{
  if (!(key in this.links.spatial) || this.links.spatial[key] === null)
    return null;

  var result = this.links.spatial[key].url;
  if (!Utils.isLocalhost() && "url_asset" in this.links.spatial[key])
    result = this.links.spatial[key].url_asset;

  return result;
};

// NOTE: getCZmlUrl is in cesiumVisSet.js since it is Cesium-specific
