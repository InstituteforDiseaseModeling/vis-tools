"use strict";
//==============================================================================
// labeledSlider
//==============================================================================

//==============================================================================
// labeledSlider - a composite control of a slider, label, and value
//
// Target HTML element
//  div
//
// Usage
//  $myDiv.labeledSlider({ options })
//s
// Options
//  title         Title for legend (default none)
//  suffix        Suffix for displayed values, e.g. "px" (default none)
//  sliderOptions Object full of options for the noUiSlider. Default:
//                  { start: 0, step: 0.01, range: { min: 0, max: 1 } }
//  changed:      Called when slider value changed. Signature:
//                  changed(event, newValue)
//
// Typical HTML + CSS + JS
//  <div class="labeledSlider"></div>
//
//  div.labeledSlider { }     /* No styling needed */
//
//  $("div.labeledSlider").labeledSlider({
//    title: "Prevalence",  // Title label
//    sliderOptions: {
//      start: 50,
//      range: { min: 0, max: 100 },
//      step: 1,
//    },
//    changed: function(event, newValue) { ... }
//  });
//
// Slider events
//  You can also directly attach events to the slider. Use getSlider() to get
//  the underlying noUiSlider, then attach events directly to it, like this:
//
//  var slider = $("div.labeledSlider").labeledSlider("getSlider");
//  slider.on("change", function(values, handle, unencoded, tap, positions)
//    { ... });
//
// Depends on:
//  * jQuery
//  * jQuery UI
//  * noUiSlider
//==============================================================================
$.widget("custom.labeledSlider", {
  options: {
    title: "",                // No title by default
    suffix: "",               // No suffix by default
    sliderOptions: {          // Normalized slider by default
      start: 0,
      step: 0.01,
      range: { min: 0, max: 1 }
    },
    changed: null              // No change handler
  },

  //----------------------------------------------------------------------------
  // Internal constants
  //----------------------------------------------------------------------------
  kNoUpdateOptions: false,
  kUpdateOptions: true,

  //----------------------------------------------------------------------------
  // Public methods
  //----------------------------------------------------------------------------
  getSlider: function()
  {
    return this.element.find(".slider")[0].noUiSlider;
  },

  //----------------------------------------------------------------------------
  // Implementation
  //----------------------------------------------------------------------------
  _create: function()
  {
    var instance = this;
    this.element.data("labeledSlider", true);
    this.element
      .addClass("labeledSlider")
      .append(
        "<div class='title'></div>" +
        "<div class='slider'></div>" +
        "<div class='value'></div>"
    );
    var $slider = this.element.find(".slider");
    noUiSlider.create($slider[0],
      this.options.sliderOptions);
    $slider[0].noUiSlider.on("update", function(values)
    {
      instance.element.find(".value").html(instance._format(values[0]) +
        instance.options.suffix);
      instance._fireChanged(null, parseFloat(values[0]));
    });
    this._update(this.kNoUpdateOptions);
  },

  //----------------------------------------------------------------------------
  _update: function(updateOptions)
  {
    if (updateOptions === undefined) updateOptions = true;
    this.element.find(".title")
      .html(this.options.title);
    if (updateOptions)
      this.element.find(".slider")[0].noUiSlider.updateOptions(
        this.options.sliderOptions, true);
    this.element.find(".value")
      .html(this._format(this.element.find(".slider")[0].noUiSlider.get()) +
        this.options.suffix);
  },

  //----------------------------------------------------------------------------
  _format: function(value)
  {
    if (typeof value === "string") value = parseFloat(value);
    if (value - Math.floor(value) === 0)
      return value.toString();
    else return value.toFixed(2);
  },

  //----------------------------------------------------------------------------
  _setOption: function(key, value)
  {
    this._super(key, value);
    this._update();
  },

  //---------------------------------------------------------------------------
  _fireChanged: function(evt, newValue)
  {
    this._trigger("changed", evt, newValue);
  }
});
