//==============================================================================
// PerNodeInsets object
//
// Events:
//  "dialogup": emitted when we put up a modal dialog
//  "message": emitted to send messages to the app's message area
//  "selectNodeId": emitted to cause caller to select a given node id
//  "recenter": emitted to cause caller to recenter on data
//  "focusNodeId": emitted to cause caller to focus view on a given node id
//  "seekDate": emitted to cause caller to move to given JS Date argument
//
// Depends on:
//  lodash
//  VisSet
//  Heatmap
//  Emitter
//  Highcharts
//==============================================================================
function PerNodeInsets(appEmitter, visSet)
{
  // UI-related
  this._selector = "body";

  // Other data members
  this._set = visSet;
  this._opts = visSet.options.nodeInsets;
  this._appEmitter = appEmitter;
  this._selectedNode = null;
  this._lastScrollTop = 0;    // For trying to keep scroll continuity
  this._lastCurXValue = 0;
  this._channels = {};        // map<sourceKey, SpatialBinary>

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
PerNodeInsets.kDisplayPrecision = 5;
PerNodeInsets.kMinInsetChartSize = 200;   // px

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
PerNodeInsets.prototype.initialize = function(selector)
{
  this._selector = selector;

  this._channels = this._getChannelList();

  // Add the framework for our UI. The rest is handled when we get a
  // nodeSelected() call comes in.
  this._addUi();

  // Bind app's panelschanged event so we can update the charts' size
  var instance = this;
  this._appEmitter.on("panelschanged", function()
    { instance._onPanelsChanged() });
  this._appEmitter.on("nodeselected", function(nodeIdOrUndef, curXValue)
    { instance._onNodeSelected(nodeIdOrUndef, curXValue); });
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype.update = function(curXValue)
{
  // Update all the timebars
  this._lastCurXValue = curXValue;
  $(this._selector).find(".perNodeInsetCharts > div")
    .each(function(index, elem)
    {
      var $chart = $(elem);
      var chart = $chart.highcharts();
      var x = chart.xAxis[0].toPixels(curXValue, true); // sense of last parameter is backwards
      var bgRect = $chart.find("rect.highcharts-plot-background")[0];
      var timebar = $chart.find("rect.timebar")[0];
      timebar.setAttributeNS(null, "x", x + parseFloat(bgRect.getAttribute("x")));
    });
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype.getState = function()
{
  var $rollup = $(this._selector).find("div.perNodeInsetUi");
  return {
    rollupOpen: $rollup.rollup("isOpen")
  };
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype.setState = function(state)
{
  // Rollup state
  var $rollup = $(this._selector).find("div.perNodeInsetUi ");
  if (state.rollupOpen)
    $rollup.rollup("open");
  else $rollup.rollup("close");
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
PerNodeInsets.prototype._onRollupChanged = function(evt, data)
{
  if (data.type === "openState")
    Persist.set("perNodeInsetUiRollupOpenState", data.newValue);
  $(this._selector).perfectScrollbar("update");
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._onPanelsChanged = function()
{
  $(this._selector).find(".perNodeInsetCharts > div")
    .each(function(index, elem)
    {
      var $chart = $(elem);
      var chart = $chart.highcharts();
      chart.reflow();
    });
  this.update(this._lastCurXValue);
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._onNodeSelected = function(nodeIdOrUndef, curXValue)
{
  this._lastCurXValue = curXValue;
  if (this._selectedNode)
    this._lastScrollTop = $(this._selector)[0].scrollTop;
  this._selectedNode = (nodeIdOrUndef === undefined) ?
    null : _.find(this._set.nodes, { nodeId: nodeIdOrUndef });
  var $rollup = $(this._selector).find(".perNodeInsetUi");
  $rollup.rollup("option", "title", this._titleText());
  var $contentArea = $rollup.rollup("getContentArea");
  this._clearContent($contentArea);
  this._setNodeInfo($contentArea);
  this._updateCharts();
  var $titleArea = $rollup.rollup("getTitleArea");
  $titleArea.find(".nodeIdSearchArea input[type=text]")
    .val(nodeIdOrUndef ? nodeIdOrUndef : "");
  var $container = $(this._selector);
  $container[0].scrollTop = this._lastScrollTop;
  $container.perfectScrollbar("update");
  this.update(curXValue);
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._onNodeIdSearch = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  var $nodeIdSearchArea = $(evt.target).closest(".nodeIdSearchArea");
  var id = parseInt($nodeIdSearchArea.find("> input[type=text]").val());
  if (!id || id.length === 0)
  {
    this.emit("message", "Enter a node id.", "error");
  }
  else
  {
    var node = _.find(this._set.nodes, { nodeId: id });
    if (!node)
      this.emit("message", "A node with id " + id + " could not be found.",
        "error");
    else
    {
      this.emit("message", "");
      this.emit("selectNodeId", id);
    }
  }
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._onNodeFocus = function(evt)
{
  var $nodeIdSearchArea = $(evt.target).closest(".nodeIdSearchArea");
  var id = parseInt($nodeIdSearchArea.find("> input[type=text]").val());
  if (!id || id.length === 0)
    this.emit("recenter");
  else this.emit("focusNodeId", id);
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._onChartClick = function(evt) {
  var x = evt.xAxis[0].value;
  var d = new Date(x);
  this.emit("seekDate", d);
  evt.stopPropagation();
  evt.preventDefault();
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
PerNodeInsets.prototype._addUi = function()
{
  var instance = this;
  var $rollup = $("<div class='perNodeInsetUi'></div>").appendTo(this._selector);
  $rollup.rollup({
    title: this._titleText(),
    checkbox: false,
    initiallyChecked: false,
    initiallyOpen: Persist.get("perNodeInsetUiRollupOpenState", false) === "true",
    changed: function(evt, data) { instance._onRollupChanged(evt, data); }
  });
  var $contentArea = $rollup.rollup("getContentArea");
  $contentArea.append("<div class='nodeInfo'></div>");
  $contentArea.append("<div class='controls'></div>");
  $("<div class='perNodeInsetCharts'></div>").appendTo(this._selector);
  this._setNodeInfo($contentArea);
  var $rollupTitle = $rollup.rollup("getTitleArea");
  $("<div class='nodeIdSearchArea'>" +
      "<input type='text' class='nodeId' placeholder='node id' title='node id'>" +
      "<button class='nodeIdSearch' title='Search by node id'><i class='fa fa-search'></i></button>" +
      "<button class='nodeFocus' title='Focus view on selected node'><i class='fa fa-crosshairs'></i></button>" +
      "</div>")
    .appendTo($rollupTitle);
  $rollupTitle.find(".nodeIdSearchArea")
    .find("button.nodeIdSearch")
      .on("click", function(evt)
      {
        instance._onNodeIdSearch(evt);
      })
    .end()
    .find("button.nodeFocus")
      .on("click", function(evt)
      {
        instance._onNodeFocus(evt);
      })
    .end()
    .find("input[type=text]")
      .on("keydown", function(evt)
      {
        // Wow this is annoying
        if (evt.keyCode === Utils.keyCodes.kEnter ||
           evt.keyCode === Utils.keyCodes.kBackspace ||
           evt.keyCode === Utils.keyCodes.kDelete ||
           evt.keyCode === Utils.keyCodes.kUp ||
           evt.keyCode === Utils.keyCodes.kDown ||
           evt.keyCode === Utils.keyCodes.kLeft ||
           evt.keyCode === Utils.keyCodes.kRight ||
           evt.keyCode === Utils.keyCodes.kHome ||
           evt.keyCode === Utils.keyCodes.kEnd ||
          (evt.keyCode >= Utils.keyCodes.k0 && evt.keyCode <= Utils.keyCodes.k9) ||
          (evt.keyCode >= Utils.keyCodes.kNumpad0 && evt.keyCode <= Utils.keyCodes.kNumpad9)
        )
        {
          // let it pass
        }
        else
        {
          // eat it
          evt.stopPropagation();
          evt.preventDefault();
        }
      })
      .on("keyup", function(evt)
      {
        if (evt.keyCode === Utils.keyCodes.kEnter)
        {
          $rollupTitle.find(".nodeIdSearchArea button").trigger("click");
        }
      })
    .end();
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._clearContent = function($contentArea)
{
  $contentArea.find(".nodeInfo").empty();
  $contentArea.find(".controls").empty();
  $(this._selector).find(".perNodeInsetCharts").empty();
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._setNodeInfo = function($contentArea)
{
  var $nodeInfo = $contentArea.find(".nodeInfo");
  $nodeInfo.empty();
  if (!this._selectedNode)
  {
    $nodeInfo.append("No selection.");
    return;
  }

  var template =
      "<% _.forEach(kvs, function(kv) { %><div class='nodeInfoRow'>" +
        "<span class='nodeInfoLabel'><%- kv.label %></span>" +
        "<span class='nodeInfoValue'>" +
          "<%- Utils.formatNumber(kv.value, PerNodeInsets.kDisplayPrecision) %>" +
        "</span>" +
      "</div><% }); %>";
  template = _.template(template);  // Compile

  // Set up the initial nodeInfo that we use to populate the table
  var node = this._selectedNode;
  var nodeInfo = {
    kvs: [
      { label: "Latitude", value: node.latitude },
      { label: "Longitude", value: node.longitude },
      { label: "Altitude", value: node.altitude }
    ]
  };

  // Add static sources to list of info we show
  var sources = this._set.getSources();
  _.forEach(sources, function(source, key)
  {
    if (source.type === "static" && key !== "none")
      nodeInfo.kvs.push({ label: source.friendlyName, value: node[key] });
  });

  $nodeInfo.append(template(nodeInfo));
};

//------------------------------------------------------------------------------
// Returns object { key, SpatialBinary } of channels to include. The option
// nodeInsets.spatialChannels can be "none", "all", or an array of channel keys.
//------------------------------------------------------------------------------
PerNodeInsets.prototype._getChannelList = function()
{
  if (this._opts.spatialChannels === "none") return {};

  var channels = {};
  var sources = this._set.getSources();
  _.forEach(sources, function(source, key)
  {
    if (source.type === "dynamic")
      channels[key] = source.data;
  });

  if (this._opts.spatialChannels === "all") return channels;

  // Keep only the channels specified in the visset
  var instance = this;
  channels = _.filter(channels, function(o, key) {
    return _.indexOf(instance._opts.spatialChannels, key) !== -1;
  });
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._addChart = function($chartArea, series, title, height)
{
  var instance = this;
  var node = this._selectedNode;
  var $chart = $("<div>").attr("data-nodeId", node.nodeId).appendTo($chartArea);
  $chart.css({ "width": "inherit", "height": height + "px"});
  series.color = this._opts.traceColor;
  series.animation = false;
  var startDate = new Date(this._set.startDate);
  var date = new Date();
  var endDate = new Date(date.setTime(startDate.getTime() +
      this._set.timestepCount * 86400000));
  var options = {
    chart: {
      animation: false,
      type: "line",
      events: {
        click: function(evt) { instance._onChartClick(evt); }
      }
    },
    title: {
      text: series.name,
      margin: 0
    },
    legend: { enabled: false },
    tooltip: { enabled: false },
    xAxis: {
      min: startDate.getTime(),
      max: endDate.getTime(),
      crosshair: false,
      type: "datetime",
      title: { text: null },
      dateTimeLabelFormats: {
        millisecond: '%m-%y',
        second: '%m-%y',
        minute: '%m-%y',
        hour: '%m-%y',
        day: '%m-%y',
        week: '%m-%y',
        month: '%m-%y',
        year: '%Y'
      }
    },
    yAxis: { title: null /*{ text: title }*/ },
    series: [ series ],
    credits: { enabled: false }
  };
  var chart = Highcharts.chart($chart[0], options);
  var chartRect = $chart.find("rect.highcharts-plot-background")[0];
  var timebar = chart.renderer.rect(
    chartRect.x.baseVal.value, chartRect.y.baseVal.value, 1,
    chartRect.height.baseVal.value);
  $chart.find(".highcharts-color-0").css("stroke", this._opts.traceColor);
  timebar.attr("class", "timebar");
  timebar.add().toFront();
  $chart.find("rect.timebar").css("fill", this._opts.timeBarColor);
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._createSeries = function(spatialBinary)
{
  var node = this._selectedNode;
  var nodeId = node.nodeId;

  // This is a Highcharts series structure
  var result = {
    name: spatialBinary._friendlyName,
    data: []
  };
  var startDate = new Date(this._set.startDate);
  _.forEach(spatialBinary._timestepRecs, function(timestepRec, timestep)
  {
    var valueAtTimestep = (nodeId in timestepRec) ? timestepRec[nodeId] : 0;
    var date = new Date(startDate);
    date = new Date(date.setTime(date.getTime() + timestep * 86400000));
    result.data.push([ date.getTime(), valueAtTimestep ]);
  });
  return result;
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._updateCharts = function()
{
  if (!this._selectedNode) return;
  var $chartArea = $(this._selector).find(".perNodeInsetCharts");
  $chartArea.empty();

  var chartAreaHeight = $(this._selector).height();
  var channelCount = Object.keys(this._channels).length;
  var chartHeight = chartAreaHeight / channelCount;
  if (chartHeight < PerNodeInsets.kMinInsetChartSize)
    chartHeight = PerNodeInsets.kMinInsetChartSize;

  var instance = this;
  var keys = Object.keys(this._channels).sort();
  _.forEach(keys, function(key)
  {
    var spatialBinary = instance._channels[key];
    var series = instance._createSeries(spatialBinary);
    var source = instance._set.getSource(key);
    instance._addChart($chartArea, series, source.friendlyName, chartHeight);
  })
};

//------------------------------------------------------------------------------
PerNodeInsets.prototype._titleText = function()
{
  return this._selectedNode ?
    "Node " + this._selectedNode.nodeId : "No selection"
};
