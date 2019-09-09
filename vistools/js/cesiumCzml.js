//==============================================================================
// CesiumCzml object
//
// Events:
//  "message": emitted to send messages to the app's message area
//
// Depends on:
//  async
//  lodash
//  Cesium
//  VisSet
//==============================================================================
function CesiumCzml(appEmitter, viewer, visSet)
{
  // UI-related
  this._selector = "body";
  this._appEmitter = appEmitter;

  // Other data members
  this._viewer = viewer;
  this._set = visSet;
  this._dataSources = {};   // Dict<sourceName, CZMLDataSource>

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
// Callback is node-style: callback(err, result) where err is null if no error.
CesiumCzml.load = function(visset, callback)
{
  var czmlLinks = visset.links.czml;

  // Add a loader function to a loadFuncs array for CZML link in the visset,
  // along with legend symbols if they use them.
  var loadFuncs = [];
  _.forEach(czmlLinks, function(linkSpec, key)
  {
    var url = visset.getCzmlUrl(key);
    loadFuncs.push(function(cb)
    {
      Cesium.CzmlDataSource.load(url)
        .then(function(dataSource)
        {
          linkSpec.dataSource = dataSource;
          cb(null);
        })
        .otherwise(function(error)
        {
          cb("Couldn't load " + Utils.shortenUrl(url) + ":\n" + error);
        });
    });

    // Additionally, if there's a legend symbol for this layer, preload that
    // and stash its size. We'll need that later in _addUi().
    if ("legendSymbol" in linkSpec)
      loadFuncs.push(function(cb)
      {
        var img = new Image();
        img.onload = function()
        {
          linkSpec.legendSymbolWidth = this.width;
          linkSpec.legendSymbolHeight= this.height;
          cb(null);
        };
        img.src = "/vistools/image/" + linkSpec.legendSymbol + ".png";
      });
  });

  // Do all the CZML loads in parallel
  async.parallel(loadFuncs, function allCompleteOrError(err)
  {
    if (err)
    {
      callback(err);
    }
    else
    {
      callback(null);
    }
  });
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.initialize = function(selector)
{
  this._selector = selector;

  // Loading has already been done before by load(). It has stashed the
  // dataSources back into the visset. So here we just add them to the viewer.
  var instance = this;
  var czmlLinks = this._set.links.czml;
  var czmlLoaded = false;
  _.forEach(czmlLinks, function(link, key)
  {
    if (!("dataSource" in link)) return;
    instance._dataSources[key] = link.dataSource;
    instance._viewer.dataSources.add(link.dataSource);
    czmlLoaded = true;
  });

  if (czmlLoaded)
    this._viewer.clock.shouldAnimate = false;

  // Add our UI
  instance._addUi();
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.update = function(timestep)
{
  // Nothing to do. The CZML layers know how to handle themselves.
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.getState = function()
{
  var result = {};
  _.forEach(this._dataSources, function(source, sourceKey)
  {
    result[sourceKey] = source.show;
  });
  return result;
};

//------------------------------------------------------------------------------
CesiumCzml.prototype.setState = function(state)
{
  // These setChecked calls will cause callbacks which update the layers.
  var instance = this;
  _.forEach(state, function(show, dataLayer)
  {
    var $rollup =
      $(instance._selector).find("div[data-layer='" + dataLayer + "']");
    if ($rollup.length > 0)
      $rollup.rollup("setChecked", show);
  });
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
CesiumCzml.prototype._onRollupChanged = function(evt, data)
{
  if (data.type === "checkbox")
  {
    var $rollup = $(evt.target).closest(".rollup");
    var sourceName = $rollup.attr("data-layer");
    this._dataSources[sourceName].show = data.newValue;
    this._set.links.czml[sourceName].show = data.newValue;
  }
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
CesiumCzml.prototype._addUi = function()
{
  var rollupCount = $(this._selector).find(".rollup").length;
  var instance = this;

  // Make an empty rollup for each CZML source present in the set
  var czmlLinks = this._set.links.czml;
  var keys = Object.keys(czmlLinks).sort();
  for (var i = 0; i < keys.length; i++)
  {
    var key = keys[i];
    var link = czmlLinks[key];
    if ("legendSymbol" in link && "legendColor" in link &&
      "legendSymbolWidth" in link && "legendSymbolHeight" in link)
    {
      // Title with legend symbol
      var svgText = Utils.colorizeImageSync(
        "/vistools/image/" + link.legendSymbol + ".png",
        link.legendColor, link.legendSymbolWidth, link.legendSymbolHeight);
      var title = link.friendlyName + "&nbsp;&nbsp;" + svgText;
      var $rollup = $("<div data-layer='" + keys[i] + "'></div>")
        .appendTo(instance._selector);
      $rollup.rollup({
        title: title,
        tooltip: "Toggle " + link.friendlyName.toLowerCase() +
          " (" + (rollupCount + i + 1) + ")",
        checkbox: true,
        initiallyChecked: link.show,
        initiallyOpen: false,
        titleOnly: true,
        changed: function(evt, data) { instance._onRollupChanged(evt, data); }
      });
      instance._dataSources[key].show = link.show;
    }
    else
    {
      // No legend symbol
      var $rollup = $("<div data-layer='" + keys[i] + "'></div>")
        .appendTo(this._selector);
      $rollup.rollup({
        title: link.friendlyName,
        tooltip: "Toggle " + link.friendlyName.toLowerCase() +
          " (" + (rollupCount + i + 1) + ")",
        checkbox: true,
        initiallyChecked: link.show,
        initiallyOpen: false,
        titleOnly: true,
        changed: function(evt, data) { instance._onRollupChanged(evt, data); }
      });
      this._dataSources[key].show = link.show;
    }
  }
};

//------------------------------------------------------------------------------
CesiumCzml._makeFriendlyName = function(str)
{
  return str.replace(/([a-z])([A-Z][a-z])/g, "$1 $2").replace("_", " ");
};
