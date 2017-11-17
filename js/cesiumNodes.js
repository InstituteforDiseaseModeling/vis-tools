//==============================================================================
// CesiumNodes object
//
// Events:
//  "dialogup": no args. Emitted when we put up a modal dialog
//  "nodeselected": arg nodeIdOrUndef. Emitted on node select or deselect
//  "message": emitted to send messages to the app's message area
//
// Depends on:
//  lodash
//  Cesium
//  VisSet
//  Emitter
//==============================================================================
function CesiumNodes(appEmitter, viewer, visSet)
{
  // UI-related
  this._selector = "body";

  // Other data members
  this._viewer = viewer;
  this._set = visSet;
  this._nodes = visSet.nodes;
  this._isPoints = visSet.options.nodeVis.visType === VisSet.kNodesAsPoints;
  this._opts = (this._isPoints) ?
    visSet.options.nodeVis.pointOptions : visSet.options.nodeVis.shapeOptions;
  this._info = visSet.nodeInfo;
  this._nodePrims = null;
  this._appEmitter = appEmitter;
  this._suppressChangeActions = true;

  this._lastUpdateTimestep = -1;

  this._selectionIndicator = null; // Billboard for points, primitive for shapes
  this._selectedNode = null;

  this._gradient = new Gradient();  // Kept pointing to gradientBlock's gradient

  // Options - should be in visset?
  this._useAltitude = false;

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
CesiumNodes.kDfltAltitude = 1;
CesiumNodes.kMinSelectionIndicatorSizeM = 50;
CesiumNodes.kPointSinkKeyToPrimitiveField =
{
  "pointColor": "color",
  "pointOpacity": "opacity",    // Note: this is special-cased
  "pointOutlineColor": "outlineColor",
  "pointOutlineThickness": "outlineWidth",
  "pointSize": "pixelSize"
};
// For shapes, currently *all* of the primitive fields are special-cased. I'm
// leaving this bit of indirection in here though in case we add more bindables
// that directly map into primitive fields.
CesiumNodes.kShapeSinkKeyToPrimitiveField =
{
  "shapeColor": "color",          // Note: this is special-cased
  "shapeExtrusion": "extrusion",  // Note: this is special-cased
  "shapeOpacity": "opacity",      // Note: this is special-cased
  "shapeSize": "size"             // Note: this is special-cased
};
CesiumNodes.kForce = true;
CesiumNodes.kNoForce = false;
CesiumNodes.kSelectionIndicatorUrl = "../image/PointSelectionIndicator.svg";
CesiumNodes.kSelectionIndicatorEyeOffset = -500; // Lifts above point nodes
CesiumNodes.kShapeSelectionIndicatorAlpha = 0.5;

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
CesiumNodes.prototype.initialize = function(selector)
{
  this._selector = selector;

  // Add nodes-related UI elements (do this first, because bindings require
  // the gradient and other values populated from the UI).
  this._addUi();

  // Create point or shape node representations
  if (this._isPoints)
    this._initializePoints();
  else this._initializeShapes();

  // We are in charge of node representation, so we are also in charge of node
  // picking. We install the pick handler here, and emit an event (along with
  // handling per-node insets).

  // Install an entity picker handler
  var instance = this;
  var handler = new Cesium.ScreenSpaceEventHandler(this._viewer.scene.canvas);
  handler.setInputAction(function(movement)
  {
    var nodeId;
    // We only do primitives, so a selected entity is definitely not us. (The
    // heatmap *is* an entity, but we don't want it to be pickable anyway.)
    if (instance._viewer.selectedEntity)
    {
      instance._viewer.selectedEntity = null;
    }

    var pickArray = instance._viewer.scene.drillPick(movement.position);
    for (var i = 0; i < pickArray.length; i++)
    {
      var picked = pickArray[i];
      // If picked an entity, picked.id will be the entity object. If picked is
      // a primitive, picked.id will be the primitive id.
      if ("id" in picked && typeof picked.id === "string" &&
        picked.id.startsWith("Node_"))
      {
        // Found a node
        nodeId = parseInt(picked.id.substr(5)); // "Node_".length
        instance._onNodeSelected(nodeId);  // may be undefined
        return;
      }
    }

    // Fall through: click with nothing selected
    instance._onNodeSelected(undefined);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.update = function(timestep, force)
{
  if (!this._nodePrims) return;
  if (this._isPoints)
    this._updatePoints(timestep, force);
  else this._updateShapes(timestep, force);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.flyTo = function(callback)
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
CesiumNodes.prototype.setVisible = function(visible)
{
  this._nodePrims.show = visible;
  this._opts.show = visible;
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.selectNode = function(id)
{
  this._onNodeSelected(id);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.focusNode = function(id)
{
  this._onFocusNode(id);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.getSelectedNode = function()
{
  return this._selectedNode;
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.getState = function()
{
  var $rollup = $(this._selector).find("div.nodesUi");
  var state = {
    show: this._nodePrims.show,
    rollupOpen: $rollup.rollup("isOpen"),
    gradient: $rollup.find(".gradBlock").gradientBlock("getState"),
    scale: this._opts.scale,
    visType: this._isPoints ? "Points" : "Shapes",
    bindings: $rollup.find(".bindingBlock").bindingBlock("getState")
  };
  return state;
};

//------------------------------------------------------------------------------
CesiumNodes.prototype.setState = function(state)
{
  // Show/hide nodes - change rollup checkbox, and it will fire a change event
  var $rollup = $(this._selector).find("div.nodesUi");
  $rollup.rollup("setChecked", state.show);

  // Rollup state
  if (state.rollupOpen)
    $rollup.rollup("open");
  else $rollup.rollup("close");

  // Gradient
  $rollup.find(".gradBlock").gradientBlock("setState", state.gradient);

  // Scale
  $rollup.find(".scaleBlock").labeledSlider("getSlider").set(state.scale);

  // Vis type - ignoring for now. Later you'll be able to change this on the fly

  // Bindings
  $rollup.find(".bindBlock").bindingBlock("setState", state.bindings);
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
CesiumNodes.prototype._onRollupChanged = function(evt, data)
{
  if (data.type === "checkbox" && this._nodePrims)
    this.setVisible(data.newValue);
  else if (data.type === "openState")
    Persist.set("nodeUiRollupOpenState", data.newValue);
  $(this._selector).perfectScrollbar("update");
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._onGradientBlockChanged = function(evt, data)
{
  if (this._suppressChangeActions) return;

  if (data.type === "range")
  {
    this._opts.gradientRangeLow = data.newValue[0];
    this._opts.gradientRangeHigh = data.newValue[1];
  }
  else
  {
    // Gradient or quantization changed
    this._gradient = data.instance.getGradient();
  }

  // Handle static bindings
  var bindings;
  if (this._isPoints)
  {
    // Points
    bindings = this._set.findBindingsTo(this._opts.sinks,
      [ "pointColor", "pointOutlineColor" ], "static");
    if (bindings.length > 0)
    {
      // There are static bindings to color, so rebuild
      this._recreatePrimitives();
    }
  }
  else
  {
    // Shapes
    bindings = this._set.findBindingsTo(this._opts.sinks, [ "shapeColor" ],
      "static");
    if (bindings.length > 0)
    {
      // There are static bindings to color, so rebuild
      this._recreatePrimitives();
    }
  }

  // Handle dynamic bindings
  if (!this._viewer.clock.shouldAnimate)
  {
    this.update(this._lastUpdateTimestep, CesiumNodes.kForce);
  }
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._onScaleChanged = function(evt, newValue)
{
  this._opts.scale = newValue;
  if (this._viewer.clock.shouldAnimate)
  {
    // Will update on next clock tick
  }
  else
  {
    // Clock is stopped, so forcibly update.
    this.update(this._lastUpdateTimestep, CesiumNodes.kForce)
  }
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._onBindingListChanged = function(evt, data)
{
  if (this._suppressChangeActions) return;

  this._applyBinding(data.sinkKey, data.source, data.function);
  this.emit("message", "");

  this._recreatePrimitives();

  // Binding to a dynamic source changed
  if (this._viewer.clock.shouldAnimate)
  {
    // Will update on next clock tick
  }
  else
  {
    // Clock is stopped, so forcibly update.
    this.update(this._lastUpdateTimestep, CesiumNodes.kForce);
  }
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._onBindingListUpdated = function()
{
  if (this._suppressChangeActions) return;

  // All the bindings have been updated, so update all our bindings from the
  // bindingBlock and rebuild everything. The simple way to get all the bindings
  // out of the bindingBlock is to call its getState function.
  var $bindingBlock = $(this._selector).find(".nodesUi .bindBlock");
  var bindings = $bindingBlock.bindingBlock("getState");
  this.emit("message", "");

  var instance = this;
  _.forEach(bindings, function(binding, sinkKey)
  {
    if (!(sinkKey in instance._opts.sinks))
      return;
    instance._applyBinding(sinkKey, binding.source, binding.function);
  });
  this._recreatePrimitives();
  this.update(this._lastUpdateTimestep, CesiumNodes.kForce);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._applyBinding = function(sinkKey, sourceName, funcText)
{
  var sink = this._opts.sinks[sinkKey];
  var source = this._set.getSource(sourceName);
  var sinkBinding = sink.binding;
  sink.source = sourceName;
  sink.function = funcText;
  sinkBinding.setSource(sourceName, source.data, source.min, source.max);
  sinkBinding.setFunction(funcText);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._onNodeSelected = function(nodeIdOrUndefined)
{
  var remove = false;
  if (nodeIdOrUndefined === undefined)
  {
    if (this._selectionIndicator) remove = true;
  }
  else
  {
    var node = _.find(this._nodes, {nodeId: nodeIdOrUndefined});
    this._selectedNode = node;  // If undefined, will get set to null below
    if (node === undefined) remove = true;
    else if (this._selectionIndicator)
    {
      // Update
      if (this._isPoints)
        this._selectionIndicator.position = Cesium.Cartesian3.fromDegrees(
          node.longitude, node.latitude,
          this._useAltitude ? node.altitude : CesiumNodes.kDfltAltitude);
      else this._updateShapeSelectionPrimitive(node);
    }
    else
    {
      // Create
      if (this._isPoints)
      {
        // For points, use a billboard for selection indication
        this._selectionIndicator = new Cesium.Entity({
          position: Cesium.Cartesian3.fromDegrees(
            node.longitude, node.latitude,
            this._useAltitude ? node.altitude : CesiumNodes.kDfltAltitude),
          billboard: {
            image: CesiumNodes.kSelectionIndicatorUrl,
            color: Cesium.Color.fromCssColorString(
              this._opts.selectionIndicatorColor),
            eyeOffset: new Cesium.Cartesian3(0, 0,
              CesiumNodes.kSelectionIndicatorEyeOffset)
          }
        });
        this._viewer.entities.add(this._selectionIndicator);
      }
      else
      {
        // For shapes, use a 3D cone for selection indication. See the comment
        // below on _updateShapeSelectionPrimitive for an explanation of this
        // code.
        var coneGeometry = new Cesium.CylinderGeometry({
          length: 1.0,
          topRadius: 1.0,
          bottomRadius: 0
        });
        var coneInstance = new Cesium.GeometryInstance({
          geometry: coneGeometry,
          id: "SelectedNode"
        });
        var color = Cesium.Color.fromCssColorString(
              this._opts.selectionIndicatorColor);
        color.alpha = CesiumNodes.kShapeSelectionIndicatorAlpha;
        var primOpts = {
          geometryInstances: coneInstance,
          releaseGeometryInstances: false,   // Keep instance around
          show: true,
          appearance: new Cesium.MaterialAppearance({
            material: Cesium.Material.fromType("Color",
              { color: color, translucent: true })
          })
        };
        this._selectionIndicator = new Cesium.Primitive(primOpts);
        this._viewer.scene.primitives.add(this._selectionIndicator);
        this._updateShapeSelectionPrimitive(node);
      }
    }
  }
  if (remove)
  {
    if (this._isPoints)
    {
      this._viewer.entities.remove(this._selectionIndicator);
    }
    else
    {
      // Could just hide it * IMPROVE
      this._viewer.scene.primitives.remove(this._selectionIndicator);
    }
    this._selectionIndicator = null;
    this._selectedNode = null;
  }

  this.emit("nodeselected", nodeIdOrUndefined);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._onFocusNode = function(id)
{
  if (id)
  {
    var node = _.find(this._nodes, {nodeId: id});
    if (node)
      var alt = this._viewer.camera.positionCartographic.height;
      this._viewer.camera.flyTo({ destination:
        Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, alt) });
  }
};

//------------------------------------------------------------------------------
// The selection indication cone is created as 1x1x1 at the origin. Here we
// scale it to the size of the selected node, then translate it to the location
// of the node, and translate it up above any current extrusion. This method
// has no effective detrimental effect on frame rate, compared to using an
// entity, even with callbackProperties.
//------------------------------------------------------------------------------
CesiumNodes.prototype._updateShapeSelectionPrimitive = function(node)
{
  var prim = this._selectionIndicator;
  var size = Math.max(CesiumNodes.kMinSelectionIndicatorSizeM, node.curSize);
  var halfSize = size / 2.0;
  var mat = Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(
    0.0, 0.0, halfSize + node.curExtrusion));
  Cesium.Matrix4.multiply(node.positioningMatrix, mat, mat);
  Cesium.Matrix4.multiplyByScale(mat, new Cesium.Cartesian3(
    halfSize, halfSize, size), mat);
  prim.modelMatrix = mat;
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
CesiumNodes.prototype._addUi = function()
{
  this._suppressChangeActions = true;
  var rollupCount = $(this._selector).find(".rollup").length;
  var instance = this;
  var $rollup = $("<div class='nodesUi'></div>").appendTo(this._selector);
  $rollup.rollup({
    title: "Nodes",
    tooltip: "Toggle nodes (" + (rollupCount + 1) + ")",
    checkbox: true,
    initiallyChecked: this._opts.show,
    initiallyOpen: Persist.get("nodeUiRollupOpenState", true) === "true",
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

  var $scaleSlider = $("<div class='scaleBlock'></div>").appendTo($contentArea);
  $scaleSlider.labeledSlider({
    title: "Scale",
    sliderOptions: {
      start: this._opts.scale,
      range: {min: 0.1, max: 10},
      step: 0.1
    },
    changed: function(evt, newValue) { instance._onScaleChanged(evt, newValue); }
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
  this._suppressChangeActions = false;
};

//------------------------------------------------------------------------------
// Note that this function gets called before the UI is created, so no direct
// references to our UI are allowed here.
//------------------------------------------------------------------------------
CesiumNodes.prototype._initializePoints = function()
{
  // NOTE: PointPrimitiveCollection doesn't (at the time of this writing) have a
  // show property. It is *not* inherited from PrimitiveCollection. So here we
  // wrap the PointPrimitiveCollection in a PrimitiveCollection so we can show/
  // hide it independently of other primitive layers.
  var opts = this._opts;
  var set = this._set;
  var instance = this;
  this._nodePrims = new Cesium.PrimitiveCollection();
  var pts = new Cesium.PointPrimitiveCollection();

  // Collect bindings to static sources
  var staticBindings = set.getStaticSinks(opts.sinks);

  var color = Cesium.Color.fromCssColorString(opts.defaultColor);
  color.alpha = opts.defaultOpacity;
  var outlineColor = Cesium.Color.fromCssColorString(opts.defaultOutlineColor);

  // Fix up binding fields that don't change per-node
  _.forEach(staticBindings, function(sink)
  {
    var binding = sink.binding;
    binding.timestep = 0;
    binding.timestepCount = set.timestepCount;
    binding.gradient = instance._gradient;
    binding.gradientLow = instance._opts.gradientRangeLow;
    binding.gradientHigh = instance._opts.gradientRangeHigh;
    binding.error = null;
  });

  _.forEach(this._nodes, function(node)
  {
    // Start with defaults for everything
    var primOpts = {
      show : true,
      position : Cesium.Cartesian3.fromDegrees(
        node.longitude, node.latitude,
        this._useAltitude ? node.altitude : CesiumNodes.kDfltAltitude),
      pixelSize : opts.defaultSizePx,
      color : color,
      outlineColor : outlineColor,
      outlineWidth : opts.defaultOutlineThicknessPx,
      id : "Node_" + node.nodeId
    };

    // Reset defaults
    node.defaultColor = color;
    node.defaultOpacity = opts.defaultOpacity;
    node.defaultSize = 1.0;
    node.defaultOutlineColor = outlineColor;
    node.defaultOutlineWidth = opts.defaultOutlineThicknessPx;

    // Apply static bindings
    var binding = { source: "none" };
    try
    {
      _.forEach(staticBindings, function (sink, sinkKey)
      {
        // A static binding is one where the source is static, e.g. a node
        // attribute like InitialPopulation.
        var primField = CesiumNodes.kPointSinkKeyToPrimitiveField[sinkKey];
        binding = sink.binding;
        binding.node = node;
        binding.value = (sink.source === "none") ? 0 : node[sink.source];
        if (binding.value === undefined)
        {
          throw { message: "Data missing for " + binding.source + " binding of node " + node.nodeId }
        }
        _.set(primOpts, primField, binding.evaluate());
        if (binding.error)
        {
          throw { message: binding.error };
        }
      });
    }
    catch (e)
    {
      instance.emit("message",
        "Exception applying binding '" + binding.source + "': " +
        (typeof e === "string" ? e : e.message), "error");
      return false; // Break out of the forEach(nodes)
    }

    // Semi-hack: static bindings to opacity set an opacity property in
    // primOpts, but Cesium doesn't know how to use that. If we find one, then
    // there was a binding, so we apply that to the color.
    if ("opacity" in primOpts)
    {
      primOpts.color.alpha = primOpts.opacity;
      node.defaultOpacity = primOpts.opacity;
    }
    node.defaultColor = primOpts.color;

    // Now that primOpts is completely filled out, add the point primitive
    pts.add(primOpts);
  });
  this._nodePrims.show = opts.show;
  this._nodePrims.add(pts);
  this._viewer.scene.primitives.add(this._nodePrims);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._updatePoints = function(timestep, force)
{
  if (!force && timestep === this._lastUpdateTimestep) return;
  this._lastUpdateTimestep = timestep;

  var opts = this._opts;
  var set = this._set;
  var instance = this;
  var prims = this._nodePrims.get(0); // PrimitiveCollection(PointPrimitiveCollection)
  var nfs = new Cesium.NearFarScalar(0.0, opts.scale, 1.0, opts.scale);

  // Collect bindings to dynamic sources
  var dynamicBindings = set.getDynamicSinks(opts.sinks);

  // Fix up binding fields that don't change per-node
  _.forEach(dynamicBindings, function(sink)
  {
    var binding = sink.binding;
    binding.timestep = timestep;
    binding.timestepCount = set.timestepCount;
    binding.gradient = instance._gradient;
    binding.gradientLow = instance._opts.gradientRangeLow;
    binding.gradientHigh = instance._opts.gradientRangeHigh;
    binding.error = null;
  });

  // Loop over the primitives updating any attributes for which we have bindings
  var primCount = prims.length;
  for (var i = 0; i < primCount; i++)
  {
    var node = this._nodes[i];
    var prim = prims.get(i);
    var id = node.nodeId;

    var primOpts = {};
    var binding = { source: "None" };
    try
    {
      _.forEach(dynamicBindings, function (sink, sinkKey)
      {
        // Dynamic bindings come from spatial channels which change over time.
        var primField = CesiumNodes.kPointSinkKeyToPrimitiveField[sinkKey];
        binding = sink.binding;
        binding.node = node;
        binding.value = binding.data ? binding.data._timestepRecs[timestep][id] : 0;
        if (binding.value === undefined)
        {
          throw { message: "Data missing for " + binding.source + " binding of node " + node.nodeId + " at timestep " + timestep }
        }
        _.set(primOpts, primField, binding.evaluate());
        if (binding.error)
        {
          throw { message: binding.error };
        }
      });
    }
    catch(e)
    {
      this.emit("message",
        "Exception applying binding '" + binding.source + "': " +
        (typeof e === "string" ? e : e.message), "error");
      return false; // Break out of the forEach(nodes)
    }

    // Now we have a primOpts field describing what to update in the primitive,
    // so update those things.

    // Apply opacity, which goes into the same place as color
    var hasColor = ("color" in primOpts);
    var hasOpacity = ("opacity" in primOpts);
    if (hasColor || hasOpacity)
    {
      // Update color, opacity, or both, respecting default color and opacity
      if (hasColor)
      {
        // Color is bound
        if (hasOpacity)
        {
          // Opacity is also bound, so combine that with the bound color
          primOpts.color.alpha = primOpts.opacity;
          delete primOpts.opacity;
        }
        else
        {
          // Opacity is not bound, so use the default opacity from the node
          primOpts.color.alpha = node.defaultOpacity;
        }
      }
      else
      {
        // Color is not bound, so use default color
        if (hasOpacity)
        {
          // Opacity is bound, so combine that with the default color
          primOpts.color = node.defaultColor;
          primOpts.color.alpha = primOpts.opacity;
          delete primOpts.opacity;
        }
      }
    }

    // Apply scale
    primOpts.scaleByDistance = nfs;

    // Apply whatever's left directly to the primitive
    _.assignIn(prim, primOpts);
  }
};

//------------------------------------------------------------------------------
// Note that this function gets called before the UI is created, so no direct
// references to our UI are allowed here.
//------------------------------------------------------------------------------
CesiumNodes.prototype._initializeShapes = function()
{
  var opts = this._opts;
  var set = this._set;
  var instance = this;
  var ellipsoid = this._viewer.scene.globe.ellipsoid;
  this._nodePrims = new Cesium.PrimitiveCollection();

  // Collect bindings to static sources
  var staticBindings = set.getStaticSinks(opts.sinks);

  var color = Cesium.Color.fromCssColorString(opts.defaultColor);
  color.alpha = opts.defaultOpacity;

  // Fix up binding fields that don't change per-node
  _.forEach(staticBindings, function(sink)
  {
    var binding = sink.binding;
    binding.timestep = 0;
    binding.timestepCount = set.timestepCount;
    binding.gradient = instance._gradient;
    binding.gradientLow = instance._opts.gradientRangeLow;
    binding.gradientHigh = instance._opts.gradientRangeHigh;
    binding.error = null;
  });

  _.forEach(this._nodes, function(node)
  {
    var posOnEllipsoid = ellipsoid.cartographicToCartesian(
      Cesium.Cartographic.fromDegrees(node.longitude, node.latitude, 0.0));
    var modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(posOnEllipsoid);
    var boxGeometry = new Cesium.BoxGeometry.fromDimensions({
      dimensions: new Cesium.Cartesian3(1.0, 1.0, 1.0)  // "Unit" box
    });
    var boxInstance = new Cesium.GeometryInstance({
      geometry: boxGeometry,
      id: "Node_" + node.nodeId
    });

    // Reset defaults
    node.defaultColor = color;
    node.defaultOpacity = opts.defaultOpacity;
    node.defaultExtrusion = 1.0;
    node.defaultSize = 1.0;
    node.curSize = 1.0;
    node.curExtrusion = 1.0;

    // While we're at it, stash the position on the ellipsoid so we can use that
    // later at update time.
    node.positioningMatrix = new Cesium.Matrix4();
    modelMatrix.clone(node.positioningMatrix);

    // Start with defaults for everything
    var primOpts = {
      geometryInstances: boxInstance,
      releaseGeometryInstances: false,  // so it keeps the instances around
      show: true,
      appearance: new Cesium.MaterialAppearance({
        material: Cesium.Material.fromType("Color",
          {
            color: color,
            translucent: true
          })
      }),
      color: color  // this is the one we'll combine with opacity
    };

    // Apply static bindings
    var binding = { source: "none" };
    try
    {
      _.forEach(staticBindings, function (sink, sinkKey)
      {
        // A static binding is one where the source is static, e.g. a node
        // attribute like InitialPopulation.
        var primField = CesiumNodes.kShapeSinkKeyToPrimitiveField[sinkKey];
        if (!primField) return; // continue to next binding
        binding = sink.binding;
        binding.node = node;
        binding.value = (sink.source === "none") ? 0 : node[sink.source];
        if (binding.value === undefined)
        {
          throw { message: "Data missing for " + binding.source + " binding of node " + node.nodeId }
        }
        primOpts[primField] = binding.evaluate(); // Do NOT use _.set
        if (binding.error)
        {
          throw { message: binding.error };
        }
      });
    }
    catch (e)
    {
      instance.emit("message",
        "Exception applying binding '" + binding.source + "': " +
        (typeof e === "string" ? e : e.message), "error");
      return false; // Break out of the forEach(nodes)
    }

    // Semi-hack: static bindings to opacity set an opacity property in
    // primOpts, but Cesium doesn't know how to use that. If we find one, then
    // there was a binding, so we apply that to the color. Also store the
    // opacity in the node so we can use it as the default in later dynamic
    // bindings (to color).
    if ("opacity" in primOpts)
    {
      primOpts.color.alpha = primOpts.opacity;
      node.defaultOpacity = primOpts.opacity;
    }
    primOpts.appearance.material.uniforms.color = primOpts.color;
    node.defaultColor = primOpts.color;

    // Create the primitive
    var boxPrimitive = new Cesium.Primitive(primOpts);

    // Update the matrix with size and extrusion. Semi-hack: static bindings to
    // size and extrusion set size or extrusion properties in primOpts, but
    // Cesium doesn't know how to use them. If we find them, then there was a
    // binding, so we apply that to the matrix. Also, store the extrusion and
    // size we used into the node as the default. We need this because we have
    // to rebuild the matrix every time in update.
    var size = primOpts["size"] || opts.defaultSizeM;             // meters
    node.defaultSize = size;  // Store before applying scale slider
    size = Math.max(size * opts.scale, 1);
    node.curSize = size;    // Store current size *after* applying scale slider
    var extrusion = primOpts["extrusion"] || opts.defaultExtrusionM; // meters
    node.defaultExtrusion = extrusion;
    node.curExtrusion = extrusion;
    Cesium.Matrix4.multiplyByTranslation(modelMatrix,
      new Cesium.Cartesian3(0.0, 0.0, extrusion / 2.0), modelMatrix);
    Cesium.Matrix4.multiplyByScale(modelMatrix,
      new Cesium.Cartesian3(size, size, extrusion),
      modelMatrix);
    boxPrimitive.modelMatrix = modelMatrix;

    instance._nodePrims.add(boxPrimitive);
  });
  this._nodePrims.show = opts.show;
  this._viewer.scene.primitives.add(this._nodePrims);

  // Update node selection entity if present
  if (this._selectionIndicator && this._selectedNode)
    this._updateShapeSelectionPrimitive(this._selectedNode);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._updateShapes = function(timestep, force)
{
  if (!force && timestep === this._lastUpdateTimestep) return;
  this._lastUpdateTimestep = timestep;

  var opts = this._opts;
  var set = this._set;
  var instance = this;
  var prims = this._nodePrims; // PrimitiveCollection of Primitives

  // Collect bindings to dynamic sources
  var dynamicBindings = set.getDynamicSinks(opts.sinks);

  // Fix up binding fields that don't change per-node
  _.forEach(dynamicBindings, function(sink)
  {
    var binding = sink.binding;
    binding.timestep = timestep;
    binding.timestepCount = set.timestepCount;
    binding.gradient = instance._gradient;
    binding.gradientLow = instance._opts.gradientRangeLow;
    binding.gradientHigh = instance._opts.gradientRangeHigh;
    binding.error = null;
  });

  // Loop over the primitives updating any attributes for which we have bindings
  var primCount = prims.length;
  for (var i = 0; i < primCount; i++)
  {
    var node = this._nodes[i];
    var prim = prims.get(i);
    var id = node.nodeId;

    var primOpts = {};
    var binding = { source: "None" };
    try
    {
      _.forEach(dynamicBindings, function (sink, sinkKey)
      {
        // Dynamic bindings come from spatial channels which change over time.
        var primField = CesiumNodes.kShapeSinkKeyToPrimitiveField[sinkKey];
        if (!primField) return; // continue to next binding
        binding = sink.binding;
        binding.node = node;
        binding.value = binding.data ? binding.data._timestepRecs[timestep][id] : 0;
        if (binding.value === undefined)
        {
          throw { message: "Data missing for " + binding.source + " binding of node " + node.nodeId + " at timestep " + timestep }
        }
        primOpts[primField] = binding.evaluate();   // Do NOT use _.set
        if (binding.error)
        {
          throw { message: binding.error };
        }
      });
    }
    catch(e)
    {
      this.emit("message",
        "Exception applying binding '" + binding.source + "': " +
        (typeof e === "string" ? e : e.message), "error");
      return false; // Break out of the forEach(nodes)
    }

    // Now we have a primOpts field describing what to update in the primitive,
    // so update those things.

    // Apply opacity, which goes into the same place as color
    var hasColor = ("color" in primOpts);
    var hasOpacity = ("opacity" in primOpts);
    if (hasColor || hasOpacity)
    {
      // Update color, opacity, or both, respecting default color and opacity
      if (hasColor)
      {
        // Color is bound
        if (hasOpacity)
        {
          // Opacity is also bound, so combine that with the bound color
          prim.appearance.material.uniforms.color = primOpts.color;
          prim.appearance.material.uniforms.color.alpha = primOpts.opacity;
        }
        else
        {
          // Opacity is not bound, so use the default opacity from the node
          prim.appearance.material.uniforms.color = primOpts.color;
          prim.appearance.material.uniforms.color.alpha = node.defaultOpacity;
        }
      }
      else
      {
        // Color is not bound, so use default color
        if (hasOpacity)
        {
          // Opacity is bound, so combine that with the default color
          prim.appearance.material.uniforms.color = node.defaultColor;
          prim.appearance.material.uniforms.color.alpha = primOpts.opacity;
        }
      }
    }

    // Update the matrix with size and extrusion
    var size = primOpts["size"] || node.defaultSize;  // meters
    size = Math.max(size * opts.scale, 1);
    node.curSize = size;
    var extrusion = primOpts["extrusion"] || node.defaultExtrusion; // meters
    node.curExtrusion = extrusion;
    Cesium.Matrix4.multiplyByTranslation(node.positioningMatrix,
      new Cesium.Cartesian3(0.0, 0.0, extrusion / 2.0), prim.modelMatrix);
    Cesium.Matrix4.multiplyByScale(prim.modelMatrix,
      new Cesium.Cartesian3(size, size, extrusion),
      prim.modelMatrix);
  }

  // Update node selection entity if present
  if (this._selectionIndicator && this._selectedNode)
    this._updateShapeSelectionPrimitive(this._selectedNode);
};

//------------------------------------------------------------------------------
CesiumNodes.prototype._recreatePrimitives = function()
{
  // This could be optimized to not re-generate all the primitives. * IMPROVE
  this._viewer.scene.primitives.remove(this._nodePrims);
  this._nodePrims = null;
  if (this._isPoints)
    this._initializePoints();
  else this._initializeShapes();
};

//------------------------------------------------------------------------------
CesiumNodes.stringToCesiumColor = function(str)
{
  if (!str) throw "No color string to convert.";
  if (typeof str !== "string") throw "Color in form of string required.";
  return Cesium.Color.fromCssColorString(str);
};
