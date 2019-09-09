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
AggregateInsets.load = function(visset, callback)
{
  var url = visset.getInsetChartUrl();
  if (url === null)
    callback(null);
  else
  {
    $.getJSON(url)
      .done(function(data, textStatus, jqxhr)
      {
        // Stuff the data back into the visset (note that links.inset used to
        // be a string, but is now a structure, and will have already been
        // upgraded to a structure by the visset loader).
        visset.links.inset.data = data;
        callback(null);
      })
      .fail(function(jqxhr, textStatus, errorThrown)
      {
        // See comment in .done() above.
        visset.links.inset.data = null;
        callback("Couldn't load " + Utils.shortenUrl(url) + ":<br/>" +
            Utils.formatError(jqxhr, errorThrown));
      });
  }
};

//------------------------------------------------------------------------------
AggregateInsets.prototype.initialize = function(selector)
{
  this._selector = selector;

  // The inset chart data was loaded by our load() method previously, and
  // stashed back into the visset.
  if (!this._set.links.inset || typeof this._set.links.inset !== "object" ||
      !("data" in this._set.links.inset))
    return;

  this._data = this._set.links.inset.data;
  this._addUi();
  this._updateChart();
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
  if (!bgRect || !timebar || !chartRect) return;
  var newX = x + parseFloat(bgRect.getAttribute("x"));
  if (!isNaN(newX))
    timebar.setAttribute("x", newX);
  timebar.setAttribute("height",
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
  this._onSelectChange(new Event("change"));    // Because .val does not trigger
};

//------------------------------------------------------------------------------
// Event handlers
//------------------------------------------------------------------------------
AggregateInsets.prototype._onSelectChange = function(evt)
{
  evt.stopPropagation();
  evt.preventDefault();
  var instance = this;
  this._updateChart(function done()
  {
    // Called when the chart is done rendering
    instance.update(instance._lastCurXValue);
  });
};

//------------------------------------------------------------------------------
AggregateInsets.prototype._onLayoutChanged = function()
{
  var $chart = $(this._selector).find("div.chart");
  var chart = $chart.highcharts();
  if (chart)
  {
    chart.reflow();
    this.update(this._lastCurXValue);
  }
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
AggregateInsets.prototype._updateChart = function(doneCallback)
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
      },
      styledMode: true
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
  var chart = Highcharts.chart($chart[0], options, function complete()
  {
    // In this context, 'this' will be the chart
    var chartRect = $chart.find("rect.highcharts-plot-background")[0];
    var timebar = this.renderer.rect(
        chartRect.x.baseVal.value, chartRect.y.baseVal.value, 1,
        chartRect.height.baseVal.value);
    $chart.find(".highcharts-color-0").css("stroke", instance._opts.traceColor);
    timebar.attr("class", "timebar");
    timebar.add().toFront();
    $chart.find("rect.timebar").css("fill", instance._opts.timeBarColor);
    if (doneCallback)
      doneCallback();
  });
};
