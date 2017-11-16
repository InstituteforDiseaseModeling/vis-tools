"use strict";
//==============================================================================
// rollup
//==============================================================================

//==============================================================================
// rollup - a composite control with a title bar and a collapsible panel below
//
// Target HTML element
//  div
//
// Usage
//  $myDiv.rollup({ options })
//s
// Options
//  title         Title for legend (default "Untitled")
//  tooltip       Tooltip for legend (default "")
//  checkbox      true to put a checkbox on the title (default true)
//  initiallyChecked  true to have title checkbox pre-checked (default false)
//  initiallyOpen true to have the panel be open when created (default true)
//  titleOnly     true to hide the toggle (for title-only) (default false)
//  changed:      Called when rollup changes. Signature:
//                  changed(event, data)
//                Where data is:
//                  {
//                    type: "checkbox"|"openState"
//                    instance: <rollup object>
//                    newValue: <true/false for openState>
//                              <true/false for checkbox>
//                  }
//
// Typical HTML + CSS + JS
//  <div class="rollup"></div>
//
//  div.rollup { }     /* No styling needed */
//
//  $("div.rollup").rollup({
//    title: "Nodes",           // Title label
//    tooltip: "Toggle nodes",  // Tooltip
//    initiallyOpen: false      // Initially closed
//  });
//  var $contentArea = $("div.rollup").rollup("getContentArea");
//  $contentArea.append(...my HTML content...);
//  $("div.rollup").rollup("open"); // Open the rollup
//
// Public methods
//  getContentArea()
//    Returns a jQuery-wrapped div into which to put your body content.
//
//  getTitleArea()
//    Returns the jQuery-wrapped div that contains the rollup title elements
//
//  open()
//    Opens the rollup.
//
//  close()
//    Closes the rollup.
//
//  isOpen()
//    Returns true if the rollup is open, false if it is closed.
//
//  isChecked()
//    Returns true if title checkbox is checked, false if not.
//
// Events
//  rollupchanged: same as changed callback above, same arguments
//
// Depends on:
//  * jQuery
//  * jQuery UI
//==============================================================================
$.widget("custom.rollup", {
  options: {
    title: "Untitled",        // Default
    tooltip: "",              // No tooltip
    checkbox: true,           // Whether title has a checkbox
    initiallyChecked: false,  // Whether title checkbox is initially checked
    initiallyOpen: true,      // Whether contentArea is open on creation
    titleOnly: false,         // Whether to hide the toggle button
    changed: null             // Called when rollup changes
  },

  //----------------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------------
  kAnimationDuration: 200,

  //----------------------------------------------------------------------------
  // Public methods
  //----------------------------------------------------------------------------
  getContentArea: function()
  {
    return this.element.find("> .contentArea");
  },

  //----------------------------------------------------------------------------
  getTitleArea: function()
  {
    return this.element.find("> .title");
  },

  //----------------------------------------------------------------------------
  open: function()
  {
    var instance = this;
    if (this.isOpen()) return;
    this.element.find(".title").removeClass("closed");
    this.element.find("> .contentArea").show("blind", {
      duration: this.kAnimationDuration,
      easing: "swing",
      complete: function()
      {
        instance._fireChanged(null, "openState", true);
      }
    });
  },

  //----------------------------------------------------------------------------
  close: function()
  {
    var instance = this;
    if (!this.isOpen()) return;
    this.element.find(".title").addClass("closed");
    this.element.find("> .contentArea").hide("blind", {
      duration: this.kAnimationDuration,
      easing: "swing",
      complete: function()
      {
        instance._fireChanged(null, "openState", false);
      }
    });
  },

  //----------------------------------------------------------------------------
  isOpen: function()
  {
    return !this.element.find("> .contentArea").is(":hidden");
  },

  //----------------------------------------------------------------------------
  isChecked: function()
  {
    return this.element.find(".title input[type=checkbox]").is(":checked");
  },

  //----------------------------------------------------------------------------
  setChecked: function(checked)
  {
    this.element.find(".title input[type=checkbox]").prop("checked", checked);
    this._fireChanged(null, "checkbox", this.isChecked());
  },

  //----------------------------------------------------------------------------
  // Implementation
  //----------------------------------------------------------------------------
  _create: function()
  {
    var instance = this;
    this.element.data("rollup", true);
    this.element
      .addClass("rollup")
      .append(
        "<div class='title'>" +
          "<label title='" + this.options.tooltip + "'>" +
            "<input type='checkbox'>" +
            "<span class='titleText nosel'></span>" +
          "</label>" +
          "<div class='toggle' title='Expand/collapse'><i class='fa fa-sort'></i></div>" +
        "</div>" +
        "<div class='contentArea'></div>"
    );
    this.element.find(".title .titleText").html(this.options.title);
    this.element.find(".title input[type=checkbox]")
      .prop("checked", this.options.initiallyChecked)
      .addClass(this.options.checkbox ? "" : "hidden");
    this.element.find(".title input[type=checkbox]").on("change", function(evt)
    {
      instance._fireChanged(evt, "checkbox", instance.isChecked());
    });
    this.element.find(".title .toggle").on("click", function()
    {
      if (instance.isOpen())
        instance.close();
      else instance.open();
    });
    if (!this.options.initiallyOpen)
      this.close();
    if (this.options.titleOnly)
    {
      this.element
        .find(".title")
          .addClass("closed")
        .end()
        .find(".toggle")
          .hide()
        .end()
        .find("> .contentArea").hide();
    }
  },

  //----------------------------------------------------------------------------
  _setOption: function(key, value)
  {
    this._super(key, value);
    if (key === "title")
      this.element.find(".title .titleText").html(this.options.title);
    if (key === "tooltip")
      this.element.find(".title label").attr("title", this.options.tooltip);
  },

  //----------------------------------------------------------------------------
  _fireChanged: function(evt, type, newValue)
  {
    this._trigger("changed", evt, {
      type: type,
      instance: this,
      newValue: newValue
    });
  }
});
