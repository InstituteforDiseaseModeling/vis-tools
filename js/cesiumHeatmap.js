//==============================================================================
// CesiumHeatmap object
//
// Events:
//  "dialogup": emitted when we put up a modal dialog
//  "message": emitted to send messages to the app's message area
//
// Depends on:
//  lodash
//  Cesium
//  VisSet
//  Heatmap
//  Emitter
//==============================================================================
function CesiumHeatmap(appEmitter, viewer, visSet)
{
  // UI-related
  this._selector = "body";

  // Other data members
  this._viewer = viewer;
  this._set = visSet;
  this._nodes = visSet.nodes;
  this._opts = visSet.options.heatmapVis;
  this._appEmitter = appEmitter;

  this._gradient = new Gradient();  // Reference to gradientBlock's gradient
  this._rangeLow = this._opts.gradientRangeLow;
  this._rangeHigh = this._opts.gradientRangeHigh;

  this._imageSize = null;           // Actual width/height (not _opts.sizePx)
  this._curCanvas = "a";
  this._heatmapA = null;
  this._heatmapB = null;
  this._heatmapLayer = null;        // Type varies depending on approach
  this._lastCallbackTimestep = -1;

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
CesiumHeatmap.kDfltAltitude = 1;
CesiumHeatmap.kForce = true;
CesiumHeatmap.kNoForce = false;
CesiumHeatmap.kHeatmapEntityId = "Heatmap";

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
CesiumHeatmap.prototype.initialize = function(selector)
{
  this._selector = selector;
  this._initializeHeatmap();

  // Add heatmap-related UI elements. Note that at runtime _set.opts is going
  // to get written-over with the values from the some of the UI controls.
  this._addUi();
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.update = function(timestep)
{
  // Updates to the heatmap are driven by Cesium. Our _heatmapLayer uses a
  // callback material - so every frame Cesium will ask us for that material.
  // Our _onEntityMaterialCallback is smart enough to only calculate a new
  // material when the timestep has changed. So this function is superfluous for
  // this particular visualization object.
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.flyTo = function(callback)
{
  // Add a temporary bounding box entity
  var ent = this._viewer.entities.add({
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(
        this._info.longitudeMin,
        this._info.latitudeMin,
        this._info.longitudeMax,
        this._info.latitudeMax
      ),
      outline: false,
      material: Cesium.Color.TRANSPARENT
    }
  });
  var instance = this;
  this._viewer.flyTo(ent)
    .then(function()
    {
      // Remove the bounding box entity now that our flight is complete.
      instance._viewer.entities.remove(ent);
      callback();
    });
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.getEntityId = function()
{
  return CesiumHeatmap.kHeatmapEntityId;
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.setVisible = function(visible)
{
  // If we set this._heatmapLayer.show to false, the Entity is hidden but the
  // material callback still happens. But if we set the *rectangle*'s show to
  // false, the entity is hidden and we don't get material callbacks at all.
  this._opts.show = visible;
  this._heatmapLayer.rectangle.show = visible;
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.getCanvas = function()
{
  var heatmap = (this._curCanvas === "a") ? this._heatmapA : this._heatmapB;
  return heatmap._renderer.canvas;
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.getState = function()
{
  var $rollup = $(this._selector).find("div.heatmapUi");
  var state = {
    show: $rollup.rollup("isChecked"),
    rollupOpen: $rollup.rollup("isOpen"),
    gradient: $rollup.find(".gradBlock").gradientBlock("getState"),
    size: this._opts.sizePx,
    opacity: this._opts.opacity,
    bindings: $rollup.find(".bindingBlock").bindingBlock("getState")
  };
  return state;
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype.setState = function(state)
{
  // Show/hide heatmap - change rollup checkbox, and it will file a change event
  var $rollup = $(this._selector).find(".heatmapUi");
  $rollup.rollup("setChecked", state.show);

  // Rollup state
  if (state.rollupOpen)
    $rollup.rollup("open");
  else $rollup.rollup("close");

  // Gradient
  $rollup.find(".gradBlock").gradientBlock("setState", state.gradient);

  // Size
  $rollup.find(".sizeBlock").labeledSlider("getSlider").set(state.size);

  // Opacity
  $rollup.find(".opacityBlock").labeledSlider("getSlider").set(state.opacity);

  // Bindings
  $rollup.find(".bindBlock").bindingBlock("setState", state.bindings);
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onRollupChanged = function(evt, data)
{
  if (data.type === "checkbox" && this._heatmapLayer)
    this.setVisible(data.newValue);
  else if (data.type === "openState")
    Persist.set("heatmapUiRollupOpenState", data.newValue);
  $(this._selector).perfectScrollbar("update");
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onGradientBlockChanged = function(evt, data)
{
  if (data.type === "range")
  {
    this._rangeLow = data.newValue[0];
    this._rangeHigh = data.newValue[1];
  }
  else
  {
    // Change in gradient or quantization
    this._gradient = data.instance.getGradient();
    var hjsGrad = this._gradient.toHeatmapJsGradient();
    if (this._heatmapA) this._heatmapA.configure({ gradient: hjsGrad });
    if (this._heatmapB) this._heatmapB.configure({ gradient: hjsGrad });
  }
  if (!this._viewer.clock.shouldAnimate)
    this._forceRedraw(this._lastCallbackTimestep);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onBindingListChanged = function(evt, data)
{
  // Update the binding
  var sink = this._opts.sinks[data.sinkKey];
  var binding = sink.binding;
  var source = this._set.getSource(data.source);
  this.emit("message", null);

  // Update both the sink and the binding
  sink.source = data.source;
  sink.function = data.function;
  binding.setSource(data.source, source.data, source.min, source.max);
  binding.setFunction(data.function);  // Will work, already validated

  this._forceRedraw(this._lastCallbackTimestep);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onBindingListUpdated = function()
{
  // All the bindings have been updated, so update all our bindings from the
  // bindingBlock and rebuild everything. The simple way to get all the bindings
  // out of the bindingBlock is to call its getState function.
  var $bindingBlock = $(this._selector).find(".heatmapUi .bindBlock");
  var bindings = $bindingBlock.bindingBlock("getState");

  var instance = this;
  _.forEach(bindings, function(binding, sinkKey)
  {
    if (!(sinkKey in instance._opts.sinks))
      return;
    instance._applyBinding(sinkKey, binding.source, binding.function);
  });

  this._forceRedraw(this._lastCallbackTimestep);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._applyBinding = function(sinkKey, sourceName, funcText)
{
  // This exact method is in CesiumNodes too. All of this binding management
  // that the vis objects needs to do points to a better way where the *actual*
  // bindings live in the bindingBlock, or the Binding object (which right now
  // is mostly a bag of stuff we want to pass to the binding functions) could
  // make it easier to maintain bindings.
  var sink = this._opts.sinks[sinkKey];
  var source = this._set.getSource(sourceName);
  var sinkBinding = sink.binding;
  sink.source = sourceName;
  sink.function = funcText;
  sinkBinding.setSource(sourceName, source.data, source.min, source.max);
  sinkBinding.setFunction(funcText);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onEntityMaterialCallback = function(time, result)
{
  if (!this._heatmapLayer.rectangle.show) return null;
  var timestep = this._set.clockToTimestep(this._viewer, time);
  if (this._lastCallbackTimestep === timestep)
  {
    var canvas = $(".canvas-" + this._curCanvas + " canvas")[0];
    return canvas;
  }
  else this._lastCallbackTimestep = timestep;
  this._curCanvas = (this._curCanvas === "a") ? "b" : "a";
  canvas = this._drawHeatmap(timestep);
  if (result !== undefined) result = canvas;
  return canvas;  // DO NOT return result, it may be undefined
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onSizePxChanged = function(newValue)
{
  this._opts.sizePx = newValue;
  this._ensureHeatmapResources();
  if (!this._viewer.clock.shouldAnimate)
    this._forceRedraw(this._lastCallbackTimestep);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onOpacityChanged = function(newValue)
{
  this._opts.opacity = newValue;
  this._ensureHeatmapResources();
  if (!this._viewer.clock.shouldAnimate)
    this._forceRedraw(this._lastCallbackTimestep);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._onSaveHeatmapClick = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  var canvas = this.getCanvas();
  canvas.toBlob(function(blob) { saveAs(blob, "Heatmap.png"); })
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
CesiumHeatmap.prototype._addUi = function()
{
  var rollupCount = $(this._selector).find(".rollup").length;
  var instance = this;
  var $rollup = $("<div class='heatmapUi'></div>").appendTo(this._selector);
  $rollup.rollup({
    title: "Heatmap",
    tooltip: "Toggle heatmap (" + (rollupCount + 1) + ")",
    checkbox: true,
    initiallyChecked: this._opts.show,
    initiallyOpen: Persist.get("heatmapUiRollupOpenState", false) === "true",
    changed: function(evt, data) { instance._onRollupChanged(evt, data); }
  });
  var $contentArea = $rollup.rollup("getContentArea");

  var $gradBlock = $("<div class='gradBlock'></div>").appendTo($contentArea);
  $gradBlock.gradientBlock({
    gradientSpec: this._opts.gradient,
    minValue: this._opts.gradientRangeLow,
    maxValue: this._opts.gradientRangeHigh,
    changed: function(evt, data) { instance._onGradientBlockChanged(evt, data); }
  });
  this._gradient = $gradBlock.gradientBlock("getGradient");

  var $sizeSlider = $("<div class='sizeBlock'></div>").appendTo($contentArea);
  $sizeSlider.labeledSlider({
    title: "Size:",
    suffix: "px",
    sliderOptions: {
      start: this._opts.sizePx,
      range: { min: 256, max: 4096 },
      step: 256
    },
    changed: function(evt, newValue) { instance._onSizePxChanged(newValue) }
  });

  var $opacitySlider = $("<div class='opacityBlock'></div>").appendTo($contentArea);
  $opacitySlider.labeledSlider({
    title: "Opacity:",
    sliderOptions: {
      start: this._opts.opacity,
      range: { min: 0, max: 1 },
      step: 0.01
    },
    changed: function(evt, newValue) { instance._onOpacityChanged(newValue) }
  });

  // Add all the binding UI
  var $bindingBlock = $("<div class='bindBlock'></div>").appendTo($contentArea);
  $bindingBlock.bindingBlock({
    sinks: this._opts.sinks,
    sources: this._set.getSources(),
    functionExamples: Binding.kFunctionExamples,
    changed: function(evt, data) { instance._onBindingListChanged(evt, data); },
    updated: function() { instance._onBindingListUpdated(); },
    dialogUp: function() { instance.emit("dialogup"); }
  });

  // Put the "open heatmap in new tab" button into the title bar
  var $titleArea = $rollup.rollup("getTitleArea");
  var $button = $("<div class='saveHeatmap' " +
    "title='Download current heatmap as image file'>" +
    "<i class=\"fa fa-external-link\"></i></div>");
  $button.appendTo($titleArea);
  $button.on("click", function(evt) { instance._onSaveHeatmapClick(evt); });
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._constrainToMax = function(size)
{
  var aspect;
  if (size.width > size.height)
  {
    // Landscape
    if (size.width > this._opts.sizePx)
    {
      aspect = size.height / size.width;
      size.width = this._opts.sizePx;
      size.height = aspect * size.width;
    }
  }
  else
  {
    // Portrait
    if (size.height > this._opts.sizePx)
    {
      aspect = size.width / size.height;
      size.height = this._opts.sizePx;
      size.width = aspect * size.height;
    }
  }
  return { width: Math.round(size.width), height: Math.round(size.height) };
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._calcImageSize = function()
{
  // minRes is the smallest lat or long non-zero delta between nodes. We define
  // this to map to one pixel. From this we can divide the latitude range and
  // longitude range and come up with a bitmap size.
  var ni = this._set.nodeInfo;
  var minRes = Math.min(ni.longitudeDeltaMin, ni.latitudeDeltaMin);
  var pixelWidth = Math.ceil((ni.longitudeMax - ni.longitudeMin) / minRes);
  var pixelHeight = Math.ceil((ni.latitudeMax - ni.latitudeMin) / minRes);
  var result = { width: pixelWidth, height: pixelHeight };
  result = this._constrainToMax(result);
  return result;
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._nodeLocToPx = function(node)
{
  var ni = this._set.nodeInfo;
  var y = this._imageSize.height - (node.latitude - ni.latitudeMin) *
      this._imageSize.height / (ni.latitudeMax - ni.latitudeMin);
  var x = (node.longitude - ni.longitudeMin) *
      this._imageSize.width / (ni.longitudeMax - ni.longitudeMin);
  return { x: Math.floor(x), y: Math.floor(y) };
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._setupHeatmapEntity = function()
{
  if (this._heatmapLayer === null)
  {
    var instance = this;
    this._heatmapLayer = new Cesium.Entity({
      id: CesiumHeatmap.kHeatmapEntityId,
      rectangle: {
        coordinates: this._set.getCesiumBoundingRectangle(),
        material: new Cesium.ImageMaterialProperty({
          image: new Cesium.CallbackProperty(function (time, result)
            {
              return instance._onEntityMaterialCallback(time, result);
            }, false),
          transparent: true
        })
      }
    });
    this._heatmapLayer.rectangle.show = this._opts.show;
    this._viewer.entities.add(this._heatmapLayer);
  }
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._ensureHeatmapResources = function()
{
  // Size the canvas containers to the image size
  this._imageSize = this._calcImageSize();
  $(".canvas-a,.canvas-b")
    .css({
      width: this._imageSize.width + "px",
      height: this._imageSize.height + "px"
    })
    .empty();
  this._heatmapA = this._heatmapB = null;
  this._curCanvas = "a";

  // Ensure that the nodes have cached (x, y) coordinates stored in them (these
  // have to be updated when you change the heatmap sizePx).
  var instance = this;
  if (!("x" in _.sample(this._nodes)) ||
    this._heatmapA === null || this._heatmapB === null)
  {
    // Add integer pixel Cartesian coordinates (within our image) to the nodes.
    _.forEach(this._nodes, function(node)
    {
      _.extend(node, instance._nodeLocToPx(node));
    });
  }

  // Ensure heatmaps
  var gradient = this._gradient.toHeatmapJsGradient();
  if (this._heatmapA === null)
  {
    var $a = $(".canvas-a").empty();
    this._heatmapA = h337.create({
      container: $a[0],
      maxOpacity: this._opts.opacity,
      //radius: 100,
      gradient: gradient
    });
  }
  if (this._heatmapB === null)
  {
    var $b = $(".canvas-b").empty();
    this._heatmapB = h337.create({
      container: $b[0],
      maxOpacity: this._opts.opacity,
      //radius: 100,
      gradient: gradient
    });
  }

  // Ensure the callback entity
  this._setupHeatmapEntity();
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._initializeHeatmap = function()
{
  // Add two canvases for the heatmap drawings. We use two canvases, alternating
  // between them, which fools Cesium into smoothly updating the textures. We
  // don't actually make the canvases, just the divs that hold them. The heatmap
  // library will make the canvases themselves.
  var $body = $("body");
  $body.append("<div class='canvas-a hidden'></div>");
  $body.append("<div class='canvas-b hidden'></div>");

  this._ensureHeatmapResources();
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._forceRedraw = function(timestep)
{
  this._lastCallbackTimestep = -1;
  if (this._heatmapLayer)
  {
    // This will force the entity to callback to get its material
    //this._heatmapLayer.rectangle.material.color = Cesium.Color.WHITE;
    this._viewer.render();
  }
};

//------------------------------------------------------------------------------
// Currently this is not optimized to take advantage that bindings to static
// sources don't change from frame to frame. We redraw the heatmaps anyway.
// IMPROVE
//------------------------------------------------------------------------------
CesiumHeatmap.prototype._drawHeatmap = function(timestep, force)
{
  if (force === undefined) force = false;
  var sink = this._opts.sinks.source;
  if (sink.binding.data === null)       // Fast test for static source
    return this._drawStaticHeatmap(timestep);
  else
    return this._drawDynamicHeatmap(timestep);
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._drawStaticHeatmap = function(timestep)
{
  var set = this._set;
  var nodes = this._nodes;
  var instance = this;
  var heatmap = (this._curCanvas === "a") ? this._heatmapA : this._heatmapB;
  var canvas;

  // Get the binding for our (one and only) sink, and fix up the fields that
  // don't change per-node.
  var sink = this._opts.sinks.source;
  var binding = sink.binding;
  if (sink.source === "none")
  {
    heatmap.setData({ min: 0, max: 0, data: [] });
    return heatmap._renderer.canvas;
  }
  binding.timestep = timestep;
  binding.timestepCount = set.timestepCount;
  binding.gradient = instance._gradient;
  binding.error = null;

  var range = binding.max - binding.min;
  var heatmapData = {
    min: binding.min + range * this._rangeLow,
    max: binding.max - range * (1.0 - this._rangeHigh),
    data: []
  };
  if (heatmapData.max < heatmapData.min) heatmapData.max = heatmapData.min;
  _.forEach(nodes, function(node)
  {
    binding.node = node;
    binding.value = node[sink.source];
    var value = binding.evaluate();
    if (binding.error)
    {
      instance.emit("message", binding.error);
      return false;   // Stop iteration
    }
    // Don't add values that are exactly the min - it blots out the heatmap
    if (value > heatmapData.min)
      heatmapData.data.push({ x: node.x, y: node.y, value: value });
  });
  canvas = heatmap._renderer.canvas;
  heatmap.setData(heatmapData);
  return canvas;
};

//------------------------------------------------------------------------------
CesiumHeatmap.prototype._drawDynamicHeatmap = function(timestep)
{
  var set = this._set;
  var nodes = this._nodes;
  var instance = this;
  var heatmap = (this._curCanvas === "a") ? this._heatmapA : this._heatmapB;
  var canvas;

  // Get the binding for our (one and only) sink, and fix up the fields that
  // don't change per-node.
  var sink = this._opts.sinks.source;
  var binding = sink.binding;
  if (binding.data === null)
  {
    heatmap.setData({ min: 0, max: 0, data: [] });
    return heatmap._renderer.canvas;
  }
  binding.timestep = timestep;
  binding.timestepCount = set.timestepCount;
  binding.gradient = instance._gradient;
  binding.error = null;

  var timestepRec = binding.data._timestepRecs[timestep];
  if (!timestepRec) return null;
  var range = binding.max - binding.min;
  var heatmapData = {
    min: binding.min + range * this._rangeLow,
    max: binding.max - range * (1.0 - this._rangeHigh),
    data: []
  };
  if (heatmapData.max < heatmapData.min) heatmapData.max = heatmapData.min;
  _.forEach(nodes, function(node)
  {
    binding.node = node;
    binding.value = timestepRec[node.nodeId];
    var value = binding.evaluate();
    if (binding.error)
    {
      instance.emit("message", binding.error);
      return false;   // Stop iteration
    }
    // Don't add values that are exactly the min - it blots out the heatmap
    if (value > heatmapData.min)
      heatmapData.data.push({ x: node.x, y: node.y, value: value });
  });
  canvas = heatmap._renderer.canvas;
  heatmap.setData(heatmapData);
  return canvas;
};
