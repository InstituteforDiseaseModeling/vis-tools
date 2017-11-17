"use strict";
//==============================================================================
// edgePanel
//==============================================================================

//==============================================================================
// edgePanel - a composite control tha implements a collapsible panel
//
// Target HTML element
//  div
//
// Usage
//  $myDiv.myPanel({ options })
//
// Options
//  initiallyOpen true to have the panel be open when created (default true)
//  location:     "left" or "right" (default "left")
//  marginTop:    top margin for panel (default 0)
//  marginBottom: bottom margin for panel (default 0)
//  minSize:      minimum size for open panel (default 10%)
//  maxSize:      maximum size for open panel (default 48%)
//  size:         size of opened panel
//  tooltip:      tooltip for panel toggle control (default "")
//  changed:      Called when edgePanel changes. Signature:
//                  changed(event, data)
//                Where data is:
//                  {
//                    type: "size"
//                    instance: <edgePanel object>
//                    newValue: <new size, or 0 for closed>
//                  }
//
// Typical HTML + CSS + JS
//  <div class="myPanel"></div>   <!-- parent should be position: relative -->
//
//  div.myPanel { }     /* No styling needed */
//
//  $("div.myPanel").edgePanel({
//    initiallyOpen: false      // Initially closed
//  });
//  var $contentArea = $("div.edgePanel").edgePanel("getContentArea");
//  $contentArea.append(...my HTML content...);
//  $("div.edgePanel").edgePanel("open"); // Open the edgePanel
//
// Public methods
//  getContentArea()
//    Returns a jQuery-wrapped div into which to put your body content.
//
//  getState()
//    Returns an object that represents the state of the control (last opened
//    size, open state).
//
//  setState(state)
//    Given an object obtained from getState(), restores the control to the
//    given state.
//
//  open()
//    Opens the edgePanel.
//
//  close()
//    Closes the edgePanel.
//
//  toggle()
//    Toggles (open->closed or closed->open) the edgePanel.
//
//  isOpen()
//    Returns true if the edgePanel is open, false if it is closed.
//
// Events
//  edgepanelchanged: same as changed callback above, same arguments
//
// Depends on:
//  * jQuery
//  * jQuery UI
//  * FontAwesome
//==============================================================================
$.widget("custom.edgePanel", {
  options: {
    initiallyOpen: true,      // Whether contentArea is open on creation
    location: "left",         // Location of panel
    marginTop: 0,             // Top margin
    marginBottom: 0,          // Bottom margin
    minSize: "10%",           // Minimum open panel size
    maxSize: "48%",           // Maximum open panel size
    tooltip: "",
    changed: null             // Called when edgePanel changes
  },

  //----------------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------------
  kAnimationDuration: 200,
  kClosedSize: "24px",

  //----------------------------------------------------------------------------
  // Data members
  //----------------------------------------------------------------------------
  _lastOpenSize: "50%",
  _dragging: false,
  _startPoint: 0,
  _startSize: 0,

  //----------------------------------------------------------------------------
  // Public methods
  //----------------------------------------------------------------------------
  getContentArea: function()
  {
    return this.element.find("> .contentArea");
  },

  //----------------------------------------------------------------------------
  getContentSelector: function()
  {
    return ".contentArea";
  },

  //----------------------------------------------------------------------------
  getState: function()
  {
    return { open: this.isOpen(), size: this.element.outerWidth() }
  },

  //----------------------------------------------------------------------------
  setState: function(state)
  {
    if (!state) return;   // In case caller gets undefined from Persist
    if (!("open" in state) || !("size" in state)) return; // Check object
    this._lastOpenSize = state.size;
    if (state.open != this.isOpen())
    {
      if (state.open) this.open();
      else this.close();
    }
  },

  //----------------------------------------------------------------------------
  open: function()
  {
    var instance = this;
    if (this.isOpen()) return;
    this.element.removeClass("closed").addClass("open");
    this.element.animate({ width: this._lastOpenSize },
      this.kAnimationDuration,
      function complete()
      {
        instance.element
          .css("minWidth", instance.options.minSize)
          .find("> .contentArea").show();
        instance._fireChanged(null, "size", instance.element.css("width"));
      });
  },

  //----------------------------------------------------------------------------
  close: function()
  {
    var instance = this;
    if (!this.isOpen()) return;
    this._lastOpenSize = this.element.css("width");
    this.element.find("> .contentArea").hide();
    this.element
      .removeClass("open")
      .addClass("closed")
      .css("minWidth", "");    // Temporarily remove restriction
    this.element.animate({ width: this.kClosedSize },
      this.kAnimationDuration,
      function complete()
      {
        instance._fireChanged(null, "size", 0);
      });
  },

  //----------------------------------------------------------------------------
  toggle: function()
  {
    this.element.find(".panelToggle").trigger("click");
  },

  //----------------------------------------------------------------------------
  isOpen: function()
  {
    return this.element.hasClass("open");
  },

  //----------------------------------------------------------------------------
  // Implementation
  //----------------------------------------------------------------------------
  _create: function()
  {
    var isLeft = this.options.location === "left";
    this._lastOpenSize = this.options.maxSize;
    this.element.data("edgePanel", true);
    this.element
      .addClass("edgePanel closed")
      .addClass(isLeft ? "edgePanelLeft" : "")
      .addClass(isLeft ? "" : "edgePanelRight")
      .css({
        top: this.options.marginTop,
        bottom: this.options.marginBottom,
        /*minWidth: this.options.minSize,*/ // Initially closed
        maxWidth: this.options.maxSize,
        width: this.kClosedSize
      });
    this.element.append(
      "<div class='sizeBar'></div>" +
      "<div class='panelToggle' title='" + this.options.tooltip + "'></div>" +
      "<div class='contentArea' style='display: none;'></div>"
    );
    this._bind();
    if (this.options.initiallyOpen)
      this.open();
  },

  //----------------------------------------------------------------------------
  _bind: function()
  {
    var instance = this;
    this.element.find(".panelToggle").on("click", function()
    {
      if (instance.isOpen())
        instance.close();
      else instance.open();
    });
    this.element.find(".sizeBar")
      .on("mousedown", function(evt) { instance._sizeMouseDown(evt); });
  },

  //----------------------------------------------------------------------------
  _sizeMouseDown: function(evt)
  {
    evt.stopPropagation();
    evt.preventDefault();
    if (!this.isOpen()) return;
    if (this._dragging) return;
    var instance = this;
    $("body")
      .on("mouseup.edgePanel", function(evt) { instance._sizeMouseUp(evt); })
      .on("mousemove.edgePanel", function(evt) { instance._sizeMouseMove(evt); });
    this._dragging = true;
    this._startPoint = evt.pageX;
    this._startSize = this.element.outerWidth();
  },

  //----------------------------------------------------------------------------
  _sizeMouseUp: function(evt)
  {
    evt.stopPropagation();
    evt.preventDefault();
    $("body").off("mouseup.edgePanel mousemove.edgePanel");
    if (!this._dragging) return;
    var dx = this.options.location === "left" ?
      evt.pageX - this._startPoint : this._startPoint - evt.pageX;
    this.element.css("width", this._startSize + dx + "px");
    this._dragging = false;
    this._startPoint = 0;
    this._fireChanged(null, "size", this.element.css("width"));
  },

  //----------------------------------------------------------------------------
  _sizeMouseMove: function(evt)
  {
    evt.stopPropagation();
    evt.preventDefault();
    if (!this._dragging) return;
    var dx = this.options.location === "left" ?
      evt.pageX - this._startPoint : this._startPoint - evt.pageX;
    this.element.css("width", this._startSize + dx + "px");
  },

  //----------------------------------------------------------------------------
  _setOption: function(key, value)
  {
    this._super(key, value);
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
