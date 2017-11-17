//==============================================================================
// AggregateInsets object
//
// Events:
//  "message": emitted to send messages to the app's message area
//  "seekDate": emitted to cause caller to move to given JS Date argument
//
// Depends on:
//  async
//  lodash
//  Emitter
//  VisSet
//  Highcharts
//==============================================================================
function AggregateInsets(appEmitter, visSet)
{
  // UI-related
  this._selector = "body";
  this._appEmitter = appEmitter;

  // Other data members
  this._set = visSet;
  this._opts = visSet.options.insetCharts;
  this._lastCurXValue = 0;
  this._data = null;    // Inset data

  // Mix-in Emitter to ourselves so we can emit/sink events
  Emitter(this);
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Public functions
//------------------------------------------------------------------------------
AggregateInsets.prototype.initialize = function(selector)
{
  var instance = this;
  this._selector = selector;

  if (!this._set.links.inset || this._set.links.inset.length === 0)
    return;   // Ok to instantiate us with no inset charts...just no UI.

  // This load step should be in VisSet.load. * IMPROVE
  $.getJSON(this._set.links.inset)
    .done(function(data, textStatus, jqxhr)
    {
      instance._data = data;
      instance._addUi();
      instance._updateChart();
    })
    .fail(function(jqxhr, textStatus, errorThrown)
    {
      instance.emit("message", "ERROR: Could not load inset chart data: " +
        errorThrown, "error");
    });
};

//------------------------------------------------------------------------------
AggregateInsets.prototype.update = function(curXValue)
{
  if (this._data === null) return;
  this._lastCurXValue = curXValue;
  var $chart = $(this._selector).find("div.chart");
  var chart = $chart.highcharts();
  var x = chart.xAxis[0].toPixels(curXValue, true); // sense of last parameter is backwards
  var bgRect = $chart.find("rect.highcharts-plot-background")[0];
  var timebar = $chart.find("rect.timebar")[0];
  var chartRect = $chart.find("rect.highcharts-plot-background")[0];
  timebar.setAttributeNS(null, "x", x + parseFloat(bgRect.getAttribute("x")));
  timebar.setAttributeNS(null, "height",
    parseFloat(chartRect.getAttribute("height")));
};

//------------------------------------------------------------------------------
AggregateInsets.prototype.getState = function()
{
  if (this._data === null) return {};
  return { channel: $(this._selector).find("select").val() };
};

//------------------------------------------------------------------------------
AggregateInsets.prototype.setState = function(state)
{
  $(this._selector).find("select").val(state.channel);
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
AggregateInsets.prototype._onSelectChange = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  this._updateChart();
  this.update(this._lastCurXValue);
};

//------------------------------------------------------------------------------
AggregateInsets.prototype._onLayoutChanged = function()
{
  var $chart = $(this._selector).find("div.chart");
  var chart = $chart.highcharts();
  chart.reflow();
  this.update(this._lastCurXValue);
};

//------------------------------------------------------------------------------
AggregateInsets.prototype._onChartClick = function(evt)
{
  var x = evt.xAxis[0].value;
  var d = new Date(x);
  this.emit("seekDate", d);
  evt.stopPropagation();
  evt.preventDefault();
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
AggregateInsets.prototype._addUi = function()
{
  var instance = this;

  var $insets = $(this._selector);
  var $select = $("<select></select>");
  this._populateSelect($select);
  $select.appendTo($insets);
  if ($select.val() === null)
    $select.val($select.find("option").first().text());
  $select.on("change", function(evt)
  {
    instance._onSelectChange(evt);
  });
  $("<div class='chart'></div>").appendTo($insets);

  // Bind layoutchanged so we can update the chart
  this._appEmitter
    .on("layoutchanged", function()
    {
      instance._onLayoutChanged();
    })
    .on("panelschanged", function()
    {
      instance._onLayoutChanged();
    });
};

//------------------------------------------------------------------------------
AggregateInsets.prototype._populateSelect = function($select)
{
  if (this._data === null) return;
  var instance = this;
  var channels = Object.keys(this._data.Channels).sort();
  _.forEach(channels, function(channelName)
  {
    var $option = $("<option>" + channelName + "</option>");
    $option.prop("selected", channelName === instance._opts.defaultChannelName);
    $option.appendTo($select);
  });
};

//------------------------------------------------------------------------------
AggregateInsets.prototype._createSeries = function(channelName, channel)
{
  // This is a Highcharts series structure
  var result = {
    name: channelName,
    data: []
  };
  var startDate = new Date(this._set.startDate);
  _.forEach(channel.Data, function(value, timestep)
  {
    var date = new Date(startDate);
    date = new Date(date.setTime(date.getTime() + timestep * 86400000));
    result.data.push([ date.getTime(), value ]);
  });
  return result;
};

//------------------------------------------------------------------------------
AggregateInsets.prototype._updateChart = function()
{
  var instance = this;
  var channelName = $(this._selector).find("select").val();
  var channel = this._data.Channels[channelName];
  var $chart = $(this._selector).find("div.chart").empty();
  $chart.css({ "width": "100%", "height": "100%" });
  var series = this._createSeries(channelName, channel);
  series.animation = false;
  var startDate = new Date(this._set.startDate);
  var date = new Date();
  var endDate = new Date(date.setTime(startDate.getTime() +
      this._set.timestepCount * 86400000));
  var options = {
    animation: false,
    chart: {
      type: "line",
      events: {
        click: function(evt) { instance._onChartClick(evt); }
      }
    },
    title: { text: null },
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
    yAxis: { title: { text: channel.Units } },
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
