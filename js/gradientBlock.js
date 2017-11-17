"use strict";
//==============================================================================
// gradientBlock
//==============================================================================

//==============================================================================
// gradientBlock - a composite control for a group of gradient-related UI
//
// Target HTML element
//  div
//
// Usage
//  $myDiv.gradientBlock({ options })
//
// Options
//  title        Title for legend (default none)
//  gradientSpec Preset name or a gradient spec string (default "BlackToWhite")
//  steps        Number of quantization steps or 0 for unquantized (default none)
//  minValue     Min value for range slider, shown under gradient (default 0)
//  maxValue     Max value for range slider, shown under gradient (default 1)
//  rangeStep    Step for range slider (default 0.01)
//  changed:     Called when some aspect of gradientBlock has been changed.
//               Signature:
//                 changed(event, data)
//               Where data is:
//                 {
//                   type: "gradient"|"quantization"|"range"
//                   instance: <gradientBlock object>
//                   newValue: <a gradient for type "gradient">
//                             <int quant steps for "quantization">
//                             <[low, high] for "range">
//                 }
//
// Events
//  gradientblockchanged: same as changed callback above, same arguments
//
// Typical HTML + CSS + JS
//  <div class="gradientBlock"></div>
//
//  div.gradientBlock { }     /* No styling needed */
//
//  $("div.gradientBlock").gradientBlock({
//    title: "Prevalence",  // Title label
//    minValue: 2,          // Value shown under left side of gradient
//    maxValue: 32767,      // Value shown under right side of gradient
//    gradientSpec: "BuGn"  // A Gradient object
//  });
//
// Depends on:
//  * jQuery
//  * jQuery UI
//  * Gradient
//  * noUiSlider
//==============================================================================
$.widget("custom.gradientBlock", {
  options: {
    title: "",                // Hides the span
    gradientSpec: Object.keys(Gradient.presets).sort()[0],
    steps: 0,                 // No quantization
    minValue: 0,              // Range slider min, left value under gradient
    maxValue: 1,              // Range slider max, right value under gradient
    rangeStep: 0.01,          // Range slider step
    changed: null             // changed(event, data) see above
  },

  //----------------------------------------------------------------------------
  // Data members
  //----------------------------------------------------------------------------
  _gradient: new Gradient(),

  //----------------------------------------------------------------------------
  // Public methods
  //----------------------------------------------------------------------------
  getGradient: function()
  {
    return this._gradient;
  },

  //----------------------------------------------------------------------------
  getState: function()
  {
    var rangeElem = this.element.find(".rangeSlider")[0];
    var values = rangeElem.noUiSlider.get();
    return {
      gradient: this._gradient.toSourceString(), // Includes reverse, quantize
      rangeLow: parseFloat(values[0]),
      rangeHigh: parseFloat(values[1])
    };
  },

  //----------------------------------------------------------------------------
  setState: function(state)
  {
    var rangeElem = this.element.find(".rangeSlider")[0];
    rangeElem.noUiSlider.set([state.rangeLow, state.rangeHigh]);
    this._setOption("gradientSpec", state.gradient);
    this._fireChanged(null, "gradient", this._gradient);
  },

  //----------------------------------------------------------------------------
  // Implementation
  //----------------------------------------------------------------------------
  _create: function()
  {
    this.element.data("gradientBlock", true);
    this.element
      .addClass("gradientBlock")
      .append(
        "<div class='title'></div>" +
        "<div class='blockRow'>" +
          "<div class='reverseButton' title='Reverse gradient'><i class='fa fa-sort fa-rotate-90'></i></div>" +
          "<div class='gradientArea'>" +
            "<div class='gradient'></div>" +
            "<span class='minValue'>&nbsp;</span><span class='maxValue'>&nbsp;</span>" +
          "</div>" +
          "<div class='menuButton' title='Gradient menu'><i class='fa fa-caret-down'></i></div>" +
          "<label class='quantLabel'>Quant:<select></select></label>" +
        "</div>" +
        "<div class='rangeSlider'></div>");
    noUiSlider.create(this.element.find(".rangeSlider")[0], {
      start: [ this.options.minValue, this.options.maxValue ],
      connect: true,
      step: this.options.rangeStep,
      range: {
        min: 0,
        max: 1
      }
    });

    // Clean options
    if (this.options.steps === 1) this.options.steps = 0;

    this._populate();
    this._bind();
  },

  //----------------------------------------------------------------------------
  _populate: function()
  {
    this._populateSelect();
    this._setOption("title", this.options.title);
    this._setOption("gradientSpec", this.options.gradientSpec);
    if (this.options.steps !== 0)
      this._setOption("steps", this.options.steps);
    // The following call updates min, max and step, and the text spans too.
    this._setOption("minValue", this.options.minValue);
  },

  //----------------------------------------------------------------------------
  _populateSelect: function()
  {
    var presets = [ 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 30, 45 ];
    var $select = this.element.find("select");
    $select.empty();
    for (var i = 0; i < presets.length; i++)
    {
      $select.append("<option value='" + presets[i] + "'>" +
        (presets[i] === 0 ? "None" : presets[i]) + "</option>");
    }
  },

  //----------------------------------------------------------------------------
  _bind: function()
  {
    var instance = this;

    // Quantization select
    this.element.find("select").on("change", function(evt)
    {
      evt.stopPropagation();
      evt.preventDefault();
      var val = parseInt($(this).val());
      instance._setOption("steps", val);
      instance._fireChanged(null, "quantization", val);
    });

    // Range slider thumbs
    var rangeElem = this.element.find(".rangeSlider")[0];
    rangeElem.noUiSlider.on("update", function(values)
    {
      instance.element.find(".minValue").text(parseFloat(values[0]));
      instance.element.find(".maxValue").text(parseFloat(values[1]));
      instance._updateRangeSliderBackground(values);
      instance._fireChanged(null, "range", values);
    });

    // Menu button. For now, also binding the gradient itself, since I don't
    // have anything better for clicks there to do.
    this.element.find(".menuButton, .gradient").on("click", function(evt)
    {
      evt.stopPropagation();
      evt.preventDefault();
      instance._showGradientMenu();
    });

    // Reverse button
    this.element.find(".reverseButton").on("click", function(evt)
    {
      evt.stopPropagation();
      evt.preventDefault();
      instance._onReverseButtonClick();
    })
  },

  //----------------------------------------------------------------------------
  _showGradientMenu: function()
  {
    // Make sure it's not already there
    this._removeGradientMenu();

    // Create the mask and menu within it
    var $mask = $(
      "<div class='gradientMenuMask'></div>")
      .appendTo(this.element);

    var $table = $("<table><tr></tr></table>");
    //  .css({ left: ofs.left + "px", top: (ofs.top + ht - 1) + "px" });
    var cats = Gradient.getSortedCategoryNames();

    // Add the content
    var instance = this;
    var $row = $table.find("tr");
    _.forEach(cats, function(catName)
    {
      // Add heading
      var $td = $("<td></td>").attr("data-category", catName);
      $("<div class='title'></div>").text(catName).appendTo($td);

      // Calculate a curGradSpec that doesn't have any ,r or ,q<n> modifiers
      var curGradSpec = instance._gradient.toSourceString().split(",")[0]; //instance.options.gradientSpec.split(",")[0];

      // Add gradients. Leave these in their natural order.
      var $ul = $("<ul></ul>");
      _.forEach(Gradient.categories[catName], function(presetName)
      {
        var preset = Gradient.presets[presetName];
        $ul.append(
          "<li class='" +
            (curGradSpec === presetName ? "active" : "") +
          "'>" +
            "<div style='" +
              "background: " + preset.toCss() + ";" +
            "'></div>" +
            "<span>" + presetName + "</span>" +
          "</li>");
      });
      $ul.appendTo($td);
      $td.appendTo($row);
    });
    $table.appendTo($mask);
    $table.position({
      my: "left top",
      at: "left bottom",
      of: this.element.find(".gradient"),
      collision: "fit"
    });

    $row.find("li").on("click", function(evt)
    {
      var presetName = $(evt.target).closest("li").find("span").text();
      instance._onGradientMenuClick(presetName);
      // Don't stop propagation, so click will cause menu to be torn down
    });

    this.element.find(".gradientMenuMask")
      .on("click", function(evt)
      {
        // Click on mask tears down menu with no selection
        evt.stopPropagation();
        evt.preventDefault();
        instance._removeGradientMenu();
      })
      .on("mousewheel", function(evt)
      {
        // Eat mouse wheel events
        evt.stopPropagation();
        evt.preventDefault();
      })
  },

  //----------------------------------------------------------------------------
  _onReverseButtonClick: function()
  {
    this._gradient.reverse();
    this._setOption("gradientSpec", this._gradient.toSourceString());
    this._fireChanged(null, "gradient", this._gradient);
  },

  //----------------------------------------------------------------------------
  _removeGradientMenu: function()
  {
    this.element.find(".gradientMenuMask").remove();  // Takes ul with it
  },

  //----------------------------------------------------------------------------
  _onGradientMenuClick: function(presetName)
  {
    this._setOption("gradientSpec", presetName);
    this._fireChanged(null, "gradient", this._gradient);
  },

  //----------------------------------------------------------------------------
  _updateRangeSliderBackground: function(values)
  {
    var $rangeSlider = this.element.find(".rangeSlider");
    var $base = $rangeSlider.find(".noUi-base");
    var normLow = (values[0] - this.options.minValue) /
      (this.options.maxValue - this.options.minValue);
    var normHigh = (values[1] - this.options.minValue) /
      (this.options.maxValue - this.options.minValue);
    var normMid = (normLow + normHigh) / 2.0;
    var startColor = this._gradient.sample(0.0);
    var endColor = this._gradient.sample(1.0);
    var g = new Gradient([
      { color: startColor, location: 0.0 },
      { color: startColor, location: normMid },
      { color: endColor, location: normMid },
      { color: endColor, location: 1.0 }],
      false);
    $base.css("background", g.toCss());
  },

  //----------------------------------------------------------------------------
  _setOption: function(key, value)
  {
    var steps, css, rangeElem, $opt, values, updateSteps = false;
    this._super(key, value);
    switch (key)
    {
      case "title":
        this.element.find(".title").html(this.options.title);
        break;

      case "gradientSpec":
        this._gradient = new Gradient(this.options.gradientSpec);
        steps = this._gradient.getSteps();
        if (steps === 0 && this.options.steps !== 0)
        {
          // Selected gradient is continuous. However, if the user has chosen
          // some quantization, respect that and apply it to this new preset.
          this._gradient.setSteps(this.options.steps);
          this._setOption("steps", this.options.steps);
        }
        else this._setOption("steps", steps); // Apply steps specified in spec
        break;

      case "steps":
        this._gradient.setSteps(this.options.steps);
        css = this._gradient.toCss();
        this.element.find(".gradient").css("background", css);
        this.element.find(".rangeSlider .noUi-connect").css("background", css);
        rangeElem = this.element.find(".rangeSlider")[0];
        values = rangeElem.noUiSlider.get();
        this._updateRangeSliderBackground(values);
        $opt = this.element.find("option[value='" + this.options.steps + "']");
        if ($opt.length === 0)
        {
          this.element.find("select").append("<option value='" +
            this.options.steps + "' selected>" + this.options.steps +
            "</option>");
        }
        else $opt.prop("selected", true);
        break;

      case "rangeStep":
        rangeElem = this.element.find(".rangeSlider")[0];
        rangeElem.noUiSlider.updateOptions({
          step: this.options.rangeStep
        });
        break;

      case "minValue":
      case "maxValue":
        rangeElem = this.element.find(".rangeSlider")[0];
        rangeElem.noUiSlider
          .set([ this.options.minValue, this.options.maxValue ]);
        values = rangeElem.noUiSlider.get();
        this.element.find(".minValue").text(parseFloat(values[0]));
        this.element.find(".maxValue").text(parseFloat(values[1]));
        this._updateRangeSliderBackground(values);
        break;

      default:
        break;
    }
  },

  //----------------------------------------------------------------------------
  _fireChanged: function(evt, type, newValue)
  {
    this._trigger("changed", evt,
      {
        type: type,
        instance: this,
        newValue: newValue
      });
  }
});
