function Geospatial()
//==============================================================================
// Geospatial object
//
// Events:
//  "layoutchanged": emitted when the window size has changed
//  "panelschanged": emitted when edgePanel or insetPanels change size/loc/state
//
// Depends on:
//  async
//  lodash
//  jQuery
//  VisSet
//  Widgets
//  Visualizers
//==============================================================================
{
  // VisSet - null until initialize
  this._set = null;
  this._options = null;     // Will be shortcut to _set.options

  // Cesium-related stuff
  this._viewer = null;
  this._setUrl = "";
  this._lastTickTime = 0;
  this._lastTickTimestep = -1;

  // Visualizers
  this._nodesVis = null;
  this._heatmapVis = null;
  this._czmlVis = null;
  this._perNodeInsetsVis = null;
  this._aggregateInsetsVis = null;

  this._openedOnNodeSelect = false;
  this._presentation = false;

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
Geospatial.kCesiumOptions = {
  geocoder: false,
  homeButton: false,
  infoBox: false,
  baseLayerPicker: true,
  fullscreenButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  animation: false,
  scene3DOnly: false,
  timeline: true,
  selectionIndicator: true
  //creditContainer: set in initialize...too early to use jQuery
};
Geospatial.kDefaultVisSetUrl = "/vistools/defaultvisset.json";
Geospatial.kArrowKeyChangeSec = 4 * 60 * 60;
Geospatial.kShiftArrowChangeSec = 24 * 60 * 60;
Geospatial.kDfltClockStepDurationSec = 4 * 60 * 60;
Geospatial.kBoundingBoxMarginPercent = 15; // Margin around bounds in percent
Geospatial.kInsetFadeDurationMs = 100;  // ms
Geospatial.kSceneModeAnimationTimeSec = 1.5;
Geospatial.kCOMPSProdPrefix = "https://comps.idmod.org";
Geospatial.kCOMPSExploreSim = "/#explore/Simulations?filters=Id=";

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
Geospatial.prototype.initialize = function()
{
  var instance = this;

  // Make sure we're running on a supported browser. If not, this function sets
  // the page to something instructive, so we can bail early.
  if (!this._checkBrowser()) return;

  // Put up the spinner
  this.setMessage("Loading...", "wait");

  // Create the edgePanel controls. We will set their sizes later in
  // _postLoadInitialize.
  $(".leftPanel").edgePanel({
    initiallyOpen: false,
    location: "left",
    marginTop: "46px",
    marginBottom: "35px",
    minSize: "280px",
    maxSize: "650px",
    tooltip: "Open/close controls panel (W)",
    changed: function(evt, data) { instance._onEdgePanelChanged(evt, data); }
  });
  $(".rightPanel").edgePanel({
    initiallyOpen: false,
    location: "right",
    marginTop: "46px",
    marginBottom: "35px",
    minSize: "280px",
    maxSize: "650px",
    tooltip: "Open/close charts panel (E)",
    changed: function(evt, data) { instance._onEdgePanelChanged(evt, data); }
  });

  // Initialize VisSet object
  setTimeout(function()
  {
    VisSet.initialize(Geospatial.kDefaultVisSetUrl, function(err)
    {
      if (err)
      {
        instance.setMessage("Error from VisSet.initialize " + err.message, "error");
        return;
      }

      // Load up the set
      var url = Utils.getParameterByName("set");
      if (!url)
      {
        instance.setMessage("No set=xxx data source given in URL.", "error");
        instance._set = new VisSet();
        instance._options = instance._set.options;
        instance._set.setEmpty();
        instance._postLoadInitialize(); // Just init with default VisSet
        return;
      }
      instance._setUrl = url;

      // We have to load the visset first, because it contains the links that
      // the visualizers need to do their loading.
      VisSet.load(instance._setUrl, function(err, visSet)
      {
        if (err)
        {
          // err will be errorThrown
          instance.setMessage("Couldn't load " + url + ", error: " + err,
            "error");
        }
        else
        {
          instance._set = visSet;
          instance._options = visSet.options;
          instance._doVisualizerLoads(function(err)
          {
            if (err)
            {
              instance.setMessage(err, "error");
            }
            else
            {
              instance._postLoadInitialize();
              instance.setMessage();
            }
          });
        }
      });
    });
  }, 1);
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
Geospatial.prototype._onEdgePanelChanged = function(evt, data)
{
  if (!this._set) return; // In case we get called before _postLoadInit
  var $target = $(evt.target);
  var left = $target.hasClass("leftPanel");
  var state = $target.edgePanel("getState");
  Persist.set(left ? "leftEdgePanelState" : "rightEdgePanelState", state);
  this.emit("panelschanged");
};

//------------------------------------------------------------------------------
Geospatial.prototype._onHtmlKeyDown = function(evt)
{
  var $target = $(evt.target);
  if ($target.is("[type=text]")) return;
  var eat = true;
  var $elem;

  // If one of the transport-area buttons is focused, unfocus it.
  if ($(document.activeElement).parent().hasClass("transportArea"))
  {
    $("html").focus();
  }

  // We only want bare keys - let others through so they don't interfere with
  // the built-in browser key combos
  if (evt.ctrlKey)
    eat = false;
  else switch (evt.which)
  {
    case Utils.keyCodes.kE:
      $(".rightPanel").edgePanel("toggle");
      break;
    case Utils.keyCodes.kF:
      // NOTE: I tried using scene.morphTo2D() and morphTo3D() here and they
      // don't look very good, especially with points being displayed, so
      // sticking to instantaneous mode change.
      this._viewer.scene.mode =
        (this._viewer.scene.mode === Cesium.SceneMode.SCENE2D) ?
          Cesium.SceneMode.SCENE3D : Cesium.SceneMode.SCENE2D;
      break;
    case Utils.keyCodes.kI:
      $elem = $("button.toggleInset");
      if ($elem.is(":visible"))
        $elem.trigger("click");
      break;
    case Utils.keyCodes.kL:
      $("button.load").trigger("click");
      break;
    case Utils.keyCodes.kP:
      this._togglePresentationMode();
      break;
    case Utils.keyCodes.kR:
      $("button.recenter").trigger("click");
      break;
    case Utils.keyCodes.kS:
      $("button.save").trigger("click");
      break;
    case Utils.keyCodes.kW:
      $(".leftPanel").edgePanel("toggle");
      break;
    case Utils.keyCodes.k1:
    case Utils.keyCodes.k2:
    case Utils.keyCodes.k3:
    case Utils.keyCodes.k4:
    case Utils.keyCodes.k5:
    case Utils.keyCodes.k6:
    case Utils.keyCodes.k7:
    case Utils.keyCodes.k8:
    case Utils.keyCodes.k9:
      this._toggleNthRollup($(".leftPanel").edgePanel("getContentArea"),
        evt.which - Utils.keyCodes.k1);
      break;
    case Utils.keyCodes.kSpace:
      var newValue = !this._viewer.clock.shouldAnimate;
      if (newValue && this._presentation)
      {
        $(".animationStart")[0].play();
      }
      this._viewer.clock.shouldAnimate = newValue;
      break;
    case Utils.keyCodes.kLeft:
      this._stepBack(evt.shiftKey);
      break;
    case Utils.keyCodes.kRight:
      this._stepForward(evt.shiftKey);
      break;
    case Utils.keyCodes.kHome:
      this._seekStart();
      break;
    case Utils.keyCodes.kEnd:
      this._seekEnd();
      break;
    default:
      eat = false;
      break;
  }
  if (eat)
  {
    evt.stopPropagation();
    evt.preventDefault();
  }
};

//------------------------------------------------------------------------------
Geospatial.prototype._onWindowResize = function()
{
  var $inset = $(".inset");
  if ($inset.hasClass("insetPanel"))
    $inset.insetPanel("layoutChanged");
  this.emit("layoutchanged");
};

//------------------------------------------------------------------------------
Geospatial.prototype._onInsetPanelChanged = function(evt, data)
{
  if (!this._set) return; // In case we get called before _postLoadInit
  var $inset = $(".inset");
  var state = $inset.insetPanel("getState");
  Persist.set("insetPanelState", state);
  this.emit("layoutchanged");
};

//------------------------------------------------------------------------------
Geospatial.prototype._onToggleInsetClick = function(evt)
{
  var $inset = $(".inset");
  $inset.toggle({ effect: "fade", duration: Geospatial.kInsetFadeDurationMs });
  this.emit("panelschanged");
};

//------------------------------------------------------------------------------
Geospatial.prototype._onRecenterClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  this._recenter();
};

//------------------------------------------------------------------------------
Geospatial.prototype._onPlayClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  this._viewer.clock.shouldAnimate = true;
};

//------------------------------------------------------------------------------
Geospatial.prototype._onPauseClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  this._viewer.clock.shouldAnimate = false;
};

//------------------------------------------------------------------------------
Geospatial.prototype._onSaveClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  var state = this._getState();
  state = JSON.stringify(state);
  var blob = new Blob([state], { type: "text/plain;charset=utf-8" });
  saveAs(blob, "ExportedSettings_" + this._set.name + ".json");
};

//------------------------------------------------------------------------------
Geospatial.prototype._onLoadClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  $(".transportArea").find("input[type=file]").trigger("click");
  // Actual file processing is in _onFileLoaded, the next function.
};

//------------------------------------------------------------------------------
Geospatial.prototype._onHelpClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  var $dialog =
    $("<div class='helpDialog' title='Vis-Tools Geospatial Help'></div>");
  var $help =
    $("<iframe class='helpContent' src='/vistools/help/geospatialHelp.html'></iframe>");
  $help.appendTo($dialog);
  $("body").append($dialog);
  $dialog.dialog({
    //dialogClass: "no-close",
    // buttons: [
    //   { text: "Close", click: function() { $(this).dialog("close"); }}
    // ],
    modal: true,
    draggable: true,
    resizable: true,
    minWidth: 840,
    minHeight: 600,
    width: 840,
    height: 600,
    position: { my: "center center", at: "center center", of: window },
    create: function() {
      var $chrome = $dialog.closest("div[role='dialog']");
      $chrome.find("button").removeClass("ui-corner-all");
      $chrome.find(".ui-dialog-titlebar")
        .css({
          backgroundColor: "transparent",
          borderWidth: "0 0 1px 0"
        })
        .removeClass("ui-corner-all")
    },
    close: function() {
      $dialog.remove();
    }
  });
};

//------------------------------------------------------------------------------
Geospatial.prototype._onCompsClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  if (!this._set || !("simId" in this._set)) return;
  var url;
  if (Utils.isLocalhost())
  {
    // We're running from the local python web server, but we have a simId.
    // That's a little unusual, since usually the standalone vissets don't have
    // a simId, but we'll try anyway. Since we don't have a COMPS origin in our
    // own URL, we'll just hand this off to COMPS production
    url = Geospatial.kCOMPSProdPrefix + Geospatial.kCOMPSExploreSim +
      this._set.simId;
  }
  else
  {
    // As far as we can tell, we're being served by COMPS itself. So we'll just
    // hand this off to the COMPS server that's serving us
    url = location.origin + Geospatial.kCOMPSExploreSim + this._set.simId;
  }
  location.href = url;
};

//------------------------------------------------------------------------------
Geospatial.prototype._onFileLoaded = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  var instance = this;
  this.setMessage();
  var files = $("input[type=file].loadFile")[0].files;
  if (files.length < 1) return;
  var file = files[0];
  var reader = new FileReader();
  reader.onloadend = function(event)
  {
    var state = {};
    if (event.target.readyState === FileReader.DONE)
    {
      $(evt.target).val("");      // Clear it
      try
      {
        state = JSON.parse(event.target.result);
        instance._setState(state);
      }
      catch(e)
      {
        instance.setMessage("Couldn't parse or apply given JSON file. Details: " +
          e.message, "error");
      }
    }
  };
  reader.onerror = function(event)
  {
    $(evt.target).val("");      // Clear it
    instance.setMessage("Sorry, that file could not be read.", "error");
  };
  var blob = file.slice(0, file.size);
  reader.readAsText(blob);
};

//------------------------------------------------------------------------------
Geospatial.prototype._onTick = function(clock, force)
{
  if (this._set === null) return;
  // Hack until Cesium has pick-priority implemented - disallow pick of Heatmap
  if (this._viewer.selectedEntity &&
    this._viewer.selectedEntity.id === this._heatmapVis.getEntityId())
  {
    this._viewer.selectedEntity = undefined;
  }

  // Try to avoid doing anything
  if (force === undefined) force = false;
  if (!force &&
      Cesium.JulianDate.compare(clock.currentTime, this._lastTickTime) === 0)
    return;
  this._lastTickTime = Cesium.JulianDate.clone(clock.currentTime);

  // Back-calculate our timestep from the clock's JulianDate
  var curXValue = Cesium.JulianDate.toDate(clock.currentTime).getTime();
  var startMs = Cesium.JulianDate.toDate(this._viewer.clock.startTime).getTime();
  var delta = curXValue - startMs;
  var timestep = Math.floor(delta / 86400000);  // milliseconds in one day
  if (timestep < 0)
    timestep = 0;
  if (timestep >= this._set.timestepCount)
    timestep = this._set.timestepCount - 1;
  if (this._presentation && timestep === this._set.timestepCount - 1)
  {
    setTimeout(function()
    {
      $(".animationStop")[0].play();
    }, 10);
  }
  if (!force && (timestep === this._lastTickTimestep))
    return;
  this._lastTickTimestep = timestep;

  // Update date status display
  $(".status").text(
    Cesium.JulianDate.toDate(clock.currentTime).toLocaleDateString() +
    ", " + timestep);

  // Update node appearance
  this._nodesVis.update(timestep, force);

  // Update the per-node inset charts
  this._perNodeInsetsVis.update(curXValue);
  this._aggregateInsetsVis.update(curXValue);
};

//------------------------------------------------------------------------------
Geospatial.prototype._onNodeSelected = function(nodeIdOrUndef)
{
  // Handle opening/closing the right panel. It feels like perNodeInsets should
  // be doing this, but it is a high-level UI element, so I'm a bit torn.
  // Decided to do it here, so perNodeInsets doesn't have to know anything about
  // the chrome in which its UI lives.
  if (nodeIdOrUndef)
  {
    // Node has been selected
    if (!$(".rightPanel").edgePanel("isOpen"))
    {
      // When node is selected, open right panel.
      this._openedOnNodeSelect = true;
      $(".rightPanel").edgePanel("open");
    }
    else this._openedOnNodeSelect = false;
  }
  else
  {
    // No selected node
    if (this._openedOnNodeSelect && $(".rightPanel").edgePanel("isOpen"))
    {
      // Close panel, since it was closed before the node was selected.
      $(".rightPanel").edgePanel("close");
    }
    // otherwise leave panel state alone
  }

  // Re-broadcast this event with addition of curXValue for insets
  var curXValue =
    Cesium.JulianDate.toDate(this._viewer.clock.currentTime).getTime();
  this.emit("nodeselected", nodeIdOrUndef, curXValue);
};

//------------------------------------------------------------------------------
Geospatial.prototype._onSeekDate = function(jsDate)
{
  var jDate = Cesium.JulianDate.fromDate(jsDate);
  var ts = this._set.julianDateToTimestep(this._viewer, jDate);
  var clock = this._viewer.clock;
  Cesium.JulianDate.addSeconds(clock.startTime, ts * Utils.kSecondsInDay,
    clock.currentTime);
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Node-style callback: cb(err), where err is null if there is no error.
//------------------------------------------------------------------------------
Geospatial.prototype._doVisualizerLoads = function(cb)
{
  var loadFuncs = [];
  var instance = this;

  // Collect loader functions
  loadFuncs.push(function(callback)
  {
    CesiumNodes.load(instance._set, function(err) { callback(err); });
  });
  loadFuncs.push(function(callback)
  {
    CesiumCzml.load(instance._set, function(err) { callback(err); });
  });
  loadFuncs.push(function(callback)
  {
    CesiumHeatmap.load(instance._set, function(err) { callback(err); });
  });
  loadFuncs.push(function(callback)
  {
    PerNodeInsets.load(instance._set, function(err) { callback(err); });
  });
  loadFuncs.push(function(callback)
  {
    AggregateInsets.load(instance._set, function(err) { callback(err); });
  });

  // Do all the I/O in parallel
  async.parallel(loadFuncs, function allCompleteOrErr(err)
  {
    cb(err);  // Just pass the error along
  });
};

//------------------------------------------------------------------------------
// Detection via duck-typing:
// https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
//------------------------------------------------------------------------------
Geospatial.prototype._checkBrowser = function()
{
  // Chrome 1+
  var isChrome = !!window.chrome && !!window.chrome.webstore;

  // Firefox 1.0+
  var isFirefox = typeof InstallTrigger !== 'undefined';

  // Opera 8.0+
  var isOpera = (!!window.opr && !!opr.addons) || !!window.opera ||
    navigator.userAgent.indexOf(' OPR/') >= 0;

  // Internet Explorer 6-11
  //var isIE = /*@cc_on!@*/false || !!document.documentMode;

  // Edge 20+
  //var isEdge = !isIE && !!window.StyleMedia;

  if (isChrome || isFirefox || isOpera) return true;

  $("body").empty().append("<div class='browserFailBox'>" +
    "<div class='browserFailMessage'>Sorry, the Vis-Tools Geospatial " +
    "client<br/>does not support this browser.<br/>Please use Chrome, " +
    "Firefox, or Opera.</div></div>");

  return false;
};

//------------------------------------------------------------------------------
Geospatial.prototype._stopClock = function()
{
  if (!this._viewer) return;
  this._viewer.clock.shouldAnimate = false;
};

//------------------------------------------------------------------------------
Geospatial.prototype.setMessage = function(html, infoWarnErrorWait)
{
  // Clear case
  var $area = $(".messageArea");
  var $text = $(".messageText");
  $area.removeClass("info warn error wait");
  if (!html || html === "")
  {
    $text.empty();
    return;
  }

  if (infoWarnErrorWait === undefined) infoWarnErrorWait = "info";
  $text.html(html);
  if (infoWarnErrorWait !== "none")
      $area.addClass(infoWarnErrorWait);
};

//------------------------------------------------------------------------------
Geospatial.prototype._setupCesium = function()
{
  // Create the viewer
  Cesium.BingMapsApi.defaultKey = Utils.kBingMapsApiKey;
  Cesium.MapboxApi.defaultAccessToken = Utils.kMapboxKey;
  Geospatial.kCesiumOptions.creditContainer = $(".credits")[0];
  this._viewer = new Cesium.Viewer($(".cesiumContainer")[0],
    Geospatial.kCesiumOptions);
  var scene = this._viewer.scene;
  scene.sun = scene.sun.destroy();         // Turn off the sun
  scene.moon = scene.moon.destroy();       // Turn off the moon
  scene.skyBox = scene.skyBox.destroy();   // Turn off the stars
                                           // ...I feel like an angry god.

  // Debugging stuff you might want once in a while
  //scene.debugShowFramesPerSecond = true;
  //this._viewer.extend(Cesium.viewerCesiumInspectorMixin);

  // Set up zoom gestures
  scene.screenSpaceCameraController.zoomEventTypes = [
    Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH
  ];

  // Slam default texture * HACK * IMPROVE
  this._viewer.scene.context._defaultTexture = new Cesium.Texture({
    context : this._viewer.scene.context,
    source : {
      width : 1,
      height : 1,
      arrayBufferView : new Uint8Array([0, 0, 0, 0])
    }
  });

  // This is a bit of a hack. Cesium is going to rewrite the timeline, but for
  // now this is the only way to change the date label formatting. * HACK
  this._viewer.timeline.makeLabel = Geospatial._timelineMakeLabel;

  // Set default base layer, using base layer provided in visset if present.
  var useDefaultBaseLayer = true;
  var baseLayerUrl = this._set.getBaseLayerUrl();
  var baseLayerFriendlyName = this._set.getBaseLayerFriendlyName() || "Custom";
  if (baseLayerUrl !== null)
  {
    this._viewer.baseLayerPicker.viewModel.imageryProviderViewModels.push(
      new Cesium.ProviderViewModel({
        name: baseLayerFriendlyName,
        tooltip: "User-customized base layer",
        iconUrl: "image/CustomBaseLayerIcon.png",
        creationFunction: function()
        {
          return new Cesium.SingleTileImageryProvider({ url: baseLayerUrl });
        }
      })
    );
    this._setBaseLayer(baseLayerFriendlyName);
    useDefaultBaseLayer = false;
  }
  if (useDefaultBaseLayer)
    this._setBaseLayer(this._set.options.defaultBaseLayer);
};

//------------------------------------------------------------------------------
Geospatial.prototype._setBaseLayer = function(baseLayerName)
{
  var ip =
    _.find(this._viewer.baseLayerPicker.viewModel.imageryProviderViewModels,
      { name: baseLayerName });
  if (ip) this._viewer.baseLayerPicker.viewModel.selectedImagery = ip;
};

//------------------------------------------------------------------------------
Geospatial.prototype._setupPanels = function()
{
  var leftState = Persist.get("leftEdgePanelState", {});
  $(".leftPanel").edgePanel("setState", leftState);
  var rightState = Persist.get("rightEdgePanelState", {});
  $(".rightPanel").edgePanel("setState", rightState);
  var insetState = Persist.get("insetPanelState", {});

  // Create the inset panel. If there's no inset chart url specified, hide it.
  var $inset = $(".inset");
  var instance = this;
  $inset.insetPanel({
    initialLocation: this._set.options.insetCharts.location,
    initialWidth: this._set.options.insetCharts.initialWidth,
    initialHeight: this._set.options.insetCharts.initialHeight,
    changed: function(evt, data) { instance._onInsetPanelChanged(evt, data); }
  });
  $inset.insetPanel("setState", insetState);
  var $aggInsets = $inset.insetPanel("getContentArea");
  $aggInsets.addClass("aggregateInsets");

  // It really feels like we should be asking the AggregateInsets visualization
  // object whether it should be visible or not, but alas, we haven't created
  // that object yet.
  if (this._set.getInsetChartUrl() === null)
  {
    // No inset chart data, so hide inset panel and toggle button
    $inset.hide();
    $("button.toggleInset").hide();
  }
  else
  {
    // Inset data exists, so just show/hide based on inset options
    if (!this._set.options.insetCharts.show)
      $inset.hide();
    else $inset.show();
  }

  // Show/hide the COMPS button depending on whether we have a sim id.
  $("button .comps").toggle("simId" in this._set);
};

//------------------------------------------------------------------------------
Geospatial.prototype._setupClock = function()
{
  var clock = this._viewer.clock;
  clock.startTime = Cesium.JulianDate.fromDate(new Date(this._set.startDate));
  Cesium.JulianDate.addDays(clock.startTime, this._set.timestepCount,
    clock.stopTime);
  Cesium.JulianDate.addSeconds(clock.startTime,
    this._set.options.clockInitialTimestep * Utils.kSecondsInDay,
    clock.currentTime);
  clock.multiplier = this._set.options.clockStepDurationSecs;
  clock.clockRange = Cesium.ClockRange.CLAMPED;
  clock.clockStep = Cesium.ClockStep.TICK_DEPENDENT;
  clock.shouldAnimate = false;  // Keep the clock stopped initially
  var timeline = this._viewer.timeline;
  timeline.updateFromClock();
  timeline.zoomTo(clock.startTime, clock.stopTime);
};

//------------------------------------------------------------------------------
// These things are all deferred until VisSet.load is complete. All of this
// expects this._set to be fully populated.
//------------------------------------------------------------------------------
Geospatial.prototype._postLoadInitialize = function()
{
  var instance = this;
  this._setupCesium();
  this._setupPanels();

  // Set up the clock - need to do this if there are no CZML layers
  if (Object.keys(this._set.links.czml).length === 0)
    this._setupClock();

  // Change interface to vis components to take a $parent instead of a selector
  // IMPROVE
  var leftContentSelector = ".leftPanel > " +
    $(".leftPanel").edgePanel("getContentSelector");
  var rightContentSelector = ".rightPanel > " +
    $(".rightPanel").edgePanel("getContentSelector");
  var insetContentSelector = ".inset > " +
    $(".inset").insetPanel("getContentSelector");

  // Set up the visualization objects. These objects handle the visualization
  // heavy-lifting. Each adds its own block(s) of UI to the left panel in its
  // initialize call. So the order you initialize them is the order they appear
  // in the left panel. All of these objects are Emitters. We pass this (gApp)
  // into these objects so they can bind events (not for them to make method
  // calls on gApp).
  this._nodesVis = new CesiumNodes(this, this._viewer, this._set);
  this._nodesVis.initialize(leftContentSelector);
  this._nodesVis.on("dialogup", function() { instance._stopClock(); });
  this._nodesVis.on("nodeselected", function(nodeIdOrUndef)
    { instance._onNodeSelected(nodeIdOrUndef); });
  this._nodesVis.on("message", function(html, infoWarnErrorWait)
    { instance.setMessage(html, infoWarnErrorWait); });

  this._heatmapVis = new CesiumHeatmap(this, this._viewer, this._set);
  this._heatmapVis.initialize(leftContentSelector);
  this._heatmapVis.on("dialogup", function() { instance._stopClock(); });
  this._heatmapVis.on("message", function(html, infoWarnErrorWait)
    { instance.setMessage(html, infoWarnErrorWait); });

  this._czmlVis = new CesiumCzml(this, this._viewer, this._set);
  this._czmlVis.initialize(leftContentSelector);
  this._czmlVis.on("dialogup", function() { instance._stopClock(); });
  this._czmlVis.on("message", function(html, infoWarnErrorWait)
    { instance.setMessage(html, infoWarnErrorWait); });

  this._perNodeInsetsVis = new PerNodeInsets(this, this._set);
  this._perNodeInsetsVis.initialize(rightContentSelector);
  this._perNodeInsetsVis.on("message", function(html, infoWarnErrorWait)
    { instance.setMessage(html, infoWarnErrorWait); });
  this._perNodeInsetsVis.on("selectNodeId", function(id)
    { instance._nodesVis.selectNode(id); });
  this._perNodeInsetsVis.on("recenter", function()
    { instance._recenter(); });
  this._perNodeInsetsVis.on("focusNodeId", function(id)
    { instance._nodesVis.focusNode(id); });
  this._perNodeInsetsVis.on("seekDate", function(jsDate)
    { instance._onSeekDate(jsDate); });

  this._aggregateInsetsVis = new AggregateInsets(this, this._set);
  this._aggregateInsetsVis.initialize(insetContentSelector);
  this._aggregateInsetsVis.on("message", function(html, infoWarnErrorWait)
    { instance.setMessage(html, infoWarnErrorWait); });
  this._aggregateInsetsVis.on("seekDate", function(jsDate)
    { instance._onSeekDate(jsDate); });

  // Now that the vis objects have added their UI, update the scroll bars.
  $(leftContentSelector).perfectScrollbar("update");
  $(rightContentSelector).perfectScrollbar("update");

  this._bind();

  // Zoom in, and when the zoom is done, start the clock
  var instance = this;
  this._nodesVis.flyTo(function()
  {
    // Install the tick function
    instance._viewer.clock.onTick.addEventListener(function(clock)
    {
      instance._onTick(clock);
    });

    // Set initial time and start the clock
    var clock = instance._viewer.clock;
    Cesium.JulianDate.addSeconds(clock.startTime,
      instance._set.options.clockInitialTimestep * Utils.kSecondsInDay,
      clock.currentTime);
    clock.shouldAnimate = instance._set.options.clockAutoRun;
    if (!clock.shouldAnimate)
    {
      instance._onTick(clock);
    }
  });
};

//------------------------------------------------------------------------------
Geospatial.prototype._bind = function()
{
  var instance = this;
  $("button.toggleInset").on("click", function(evt)
  {
    instance._onToggleInsetClick(evt);
  });
  $("button.recenter").on("click", function(evt)
  {
    instance._onRecenterClick(evt);
  });
  $("button.play").on("click", function(evt)
  {
    instance._onPlayClick(evt);
  });
  $("button.pause").on("click", function(evt)
  {
    instance._onPauseClick(evt);
  });
  $("button.save").on("click", function(evt)
  {
    instance._onSaveClick(evt);
  });
  $("button.load").on("click", function(evt)
  {
    instance._onLoadClick(evt);
  });
  $("button.help").on("click", function(evt)
  {
    instance._onHelpClick(evt);
  });
  $("button.comps").on("click", function(evt)
  {
    instance._onCompsClick(evt);
  });
  $("input[type=file].loadFile").on("change", function(evt)
  {
    instance._onFileLoaded(evt);
  });
  $(".leftPanel").edgePanel("getContentArea").perfectScrollbar();
  $(".rightPanel").edgePanel("getContentArea").perfectScrollbar();
  $("html").on("keydown", function(evt)
  {
    instance._onHtmlKeyDown(evt);
  }).focus();
  $(window).resize(function(evt)
  {
    if (evt.target !== window) return;
    instance._onWindowResize();
  });
  $(".cesium-viewer-toolbar .cesium-toolbar-button").on("click", function(evt)
  {
    $(".rightPanel").edgePanel("close");
    // Let click propagate
  });
};

//------------------------------------------------------------------------------
Geospatial.prototype._getState = function()
{
  var selNode = this._nodesVis.getSelectedNode() || null;
  return {
    leftEdgePanelState: $(".leftPanel").edgePanel("getState"),
    rightEdgePanelState: $(".rightPanel").edgePanel("getState"),
    insetPanelState: $(".inset").insetPanel("getState"),
    nodesVisState: this._nodesVis.getState(),
    heatmapVisState: this._heatmapVis.getState(),
    czmlVisState: this._czmlVis.getState(),
    aggregateInsetsVisState: this._aggregateInsetsVis.getState(),
    perNodeInsetsState: this._perNodeInsetsVis.getState(),
    baseLayer: this._viewer.baseLayerPicker.viewModel.selectedImagery.name,
    camera: VisSet.serializeCamera(this._viewer),
    selectedNodeId: selNode ? selNode.nodeId : null,
    timestep: this._set.clockToTimestep(this._viewer)
  };
};

//------------------------------------------------------------------------------
Geospatial.prototype._setState = function(state)
{
  // Panel states
  var $left = $(".leftPanel");
  $left.edgePanel("setState", state.leftEdgePanelState);
  this._onEdgePanelChanged({ target: $left });
  var $right = $(".rightPanel");
  $right.edgePanel("setState", state.rightEdgePanelState);
  this._onEdgePanelChanged({ target: $right });
  $(".inset").insetPanel("setState", state.insetPanelState);

  // Visualization objects
  this._nodesVis.setState(state.nodesVisState);
  this._heatmapVis.setState(state.heatmapVisState);
  this._czmlVis.setState(state.czmlVisState);
  this._aggregateInsetsVis.setState(state.aggregateInsetsVisState);
  this._perNodeInsetsVis.setState(state.perNodeInsetsState);

  // Base layer
  this._setBaseLayer(state.baseLayer);

  // Camera
  VisSet.deserializeCamera(this._viewer, state.camera);

  // Selected node
  if (state.selectedNodeId)
    this._nodesVis.selectNode(state.selectedNodeId);

  // Current timestep
  var clock = this._viewer.clock;
  Cesium.JulianDate.addSeconds(clock.startTime,
    state.timestep * Utils.kSecondsInDay,
    clock.currentTime);
};

//------------------------------------------------------------------------------
Geospatial._timelineMakeLabel = function(julianDate)
{
  var str = julianDate.toString();
  return str.substr(0, 4) + "-" + parseInt(str.substr(5, 2)) + "-" +
    str.substr(8, 2);
};

//------------------------------------------------------------------------------
Geospatial.prototype._stepBack = function(shifted)
{
  var clock = this._viewer.clock;
  clock.shouldAnimate = false;
  var curTime = Cesium.JulianDate.clone(clock.currentTime);
  if (shifted)
  {
    var quant = this._set.options.clockShiftArrowAdvance;
    if (quant === Utils.kSecondsInDay)
    {
      // User has configured shift-arrows to move by whole timesteps, so we will
      // quantize to that. Cesium JulianDates store a date as an integer and
      // a number of seconds in the current day as a float. So to step back
      // to the previous day boundary, we can just decrement dayNumber and set
      // secondsOfDay to zero.
      curTime.secondsOfDay = 0;
      curTime.dayNumber--;
    }
    else
    {
      // User is using some customized shift-advance value, so just use it.
      Cesium.JulianDate.addSeconds(curTime, -quant, curTime);
    }
  }
  else
  {
    // Unshifted
    Cesium.JulianDate.addSeconds(curTime, -this._set.options.clockArrowAdvance,
      curTime);
  }

  // Now bounds-check and store the new time
  if (Cesium.JulianDate.compare(curTime, clock.stopTime) > 0)
    curTime = Cesium.JulianDate.clone(clock.stopTime);
  if (Cesium.JulianDate.compare(curTime, clock.starteTime < 0))
    curTime = Cesium.JulianDate.clone(clock.startTime);
  clock.currentTime = curTime;
};

//------------------------------------------------------------------------------
Geospatial.prototype._stepForward = function(shifted)
{
  var clock = this._viewer.clock;
  clock.shouldAnimate = false;
  var curTime = Cesium.JulianDate.clone(clock.currentTime);
  if (shifted)
  {
    var quant = this._set.options.clockShiftArrowAdvance;
    if (quant === Utils.kSecondsInDay)
    {
      // User has configured shift-arrows to move by whole timesteps, so we will
      // quantize to that. Cesium JulianDates store a date as an integer and
      // a number of seconds in the current day as a float. So to step forward
      // to the next day boundary, we can just advance dayNumber and set
      // secondsOfDay to zero.
      curTime.secondsOfDay = 0;
      curTime.dayNumber++;
    }
    else
    {
      // User is using some customized shift-advance value, so just use it.
      Cesium.JulianDate.addSeconds(curTime, quant, curTime);
    }
  }
  else
  {
    // Unshifted
    Cesium.JulianDate.addSeconds(curTime, this._set.options.clockArrowAdvance,
      curTime);
  }

  // Now bounds-check and store the new time
  if (Cesium.JulianDate.compare(curTime, clock.stopTime) > 0)
    curTime = Cesium.JulianDate.clone(clock.stopTime);
  if (Cesium.JulianDate.compare(curTime, clock.starteTime < 0))
    curTime = Cesium.JulianDate.clone(clock.startTime);
  clock.currentTime = curTime;
};

//------------------------------------------------------------------------------
Geospatial.prototype._seekStart = function()
{
  var clock = this._viewer.clock;
  clock.currentTime = Cesium.JulianDate.clone(clock.startTime);
};

//------------------------------------------------------------------------------
Geospatial.prototype._seekEnd = function()
{
  var clock = this._viewer.clock;
  clock.currentTime = Cesium.JulianDate.clone(clock.stopTime);
};

//------------------------------------------------------------------------------
Geospatial.prototype._recenter = function()
{
  if (!this._set) return;
  var bbox = this._set.getBoundingBox();
  var width = bbox.longitudeMax - bbox.longitudeMin;
  var height = bbox.latitudeMax - bbox.latitudeMin;
  var xExpansion = width * Geospatial.kBoundingBoxMarginPercent / 100.0 / 2.0;
  var yExpansion = height * Geospatial.kBoundingBoxMarginPercent / 100.0 / 2.0;
  var rect = new Cesium.Rectangle.fromDegrees(
    bbox.longitudeMin - xExpansion,
    bbox.latitudeMin - yExpansion,
    bbox.longitudeMax + xExpansion,
    bbox.latitudeMax + yExpansion);
  this._viewer.camera.flyTo({ destination: rect });
};

//------------------------------------------------------------------------------
Geospatial.prototype._toggleNthRollup = function($contentArea, n)
{
  var $rollups = $contentArea.find("div.rollup");
  if (n < 0 || n >= $rollups.length) return;
  var $rollup = $($rollups[n]);
  $rollup.find(".title input[type=checkbox]").trigger("click");
};

//------------------------------------------------------------------------------
Geospatial.prototype._togglePresentationMode = function()
{
  this._presentation = !this._presentation;
  var areas = [
    $(".messageArea"),                  // Message, help button
    $(".transportArea"),                // Transport buttons
    $(".overlay"),                      // Panels
    $(this._viewer.timeline.container), // Timeline
    $(".cesium-viewer-toolbar")         // Cesium controls (basemap button)
  ];
  if (this._presentation)
  {
    // Show overlay UI
    _.forEach(areas, function($area) { $area.hide(); });
  }
  else
  {
    // Hide overlay UI
    _.forEach(areas, function($area) { $area.show(); });
  }
};

//==============================================================================
// Global app and ready function
//==============================================================================
var gApp = new Geospatial();
$(function()
{
  gApp.initialize();
});
