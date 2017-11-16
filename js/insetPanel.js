"use strict";
//==============================================================================
// insetPanel
//==============================================================================

//==============================================================================
// insetPanel - a widget for putting inset content on the screen
//
// Target HTML element
//  div           NOTE: Parent should be position: relative
//
// Usage
//  $myDiv.insetPanel({ options })
//
// Options
//  initialLocation:  String "TL"|"TC"|"TR"|"BL"|"BC"|"BR" (default "BC")
//  initialWidth:     Initial width in CSS format (default 25%)
//  initialHeight:    Initial height in CSS format (default 33%)
//  minWidth:         Minimum width in CSS format (default 250px)
//  minHeight:        Minimum height in CSS format (default 180px)
//  containment:      Containment for Draggable/Resizable (default "parent")
//  changed:          Called when insetPanel changes. Signature:
//                      changed(event, data)
//                    Where data is:
//                      {
//                        type: "dimensions"
//                        instance: <insetPanel object>
//                        newValue: { top: top, left: left,
//                          width: outerWidth, height: outerHeight }
//                      }
//
// Typical HTML + CSS + JS
//  <div class="myDiv"></div>
//
//  div.myDiv { }     /* No styling needed */
//
//  $("div.myDiv").insetPanel({});
//  var $contentArea = $("div.myDiv").insetPanel("getContentArea");
//  $contentArea.append(...my HTML content...);
//
// Public methods
//  getContentArea()
//    Returns a jQuery-wrapped div into which to put your body content.
//
//  getContentSelector()
//    Returns a string to find the content area within the target element
//
//  setLocation(loc)
//    Lets you programmatically move the panel to any of the locations allowed
//    in the initialLocation option
//
//  layoutChanged()
//    Call this when the container's shape changes, due to a window resize,
//    for example. Reverts the panel to default size and location within its
//    specified containment.
//
// Events
//  insetpanelchanged: same as changed callback above, same arguments
//
// Depends on:
//  * jQuery
//  * jQuery UI
//  * lodash
//==============================================================================
$.widget("custom.insetPanel", {
  options: {
    initialLocation: "BC",    // Initial location of inset panel
    initialWidth: "25%",      // Initial width
    initialHeight: "33%",     // Initial height
    minWidth: "250px",        // Minimum inset panel width
    minHeight: "180px",       // Minimum inset panel height
    containment: "parent",    // Containment for resize/drag
    changed: null             // Called when insetPanel changes
  },

  //----------------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------------

  //----------------------------------------------------------------------------
  // Public methods
  //----------------------------------------------------------------------------
  getContentArea: function ()
  {
    return this.element.find(".contentArea");
  },

  //----------------------------------------------------------------------------
  getContentSelector: function ()
  {
    return ".contentArea";
  },

  //----------------------------------------------------------------------------
  setLocation: function (loc)
  {
    this._applyLocation(loc);
  },

  //----------------------------------------------------------------------------
  layoutChanged: function ()
  {
    // It's not simple to ensure the panel is onscreen after a resize, so we
    // revert its size and location to the defaults on a window resize
    this.element.css({
      width: this.options.initialWidth,
      height: this.options.initialHeight
    });
    this._applyLocation(this.options.initialLocation);
  },

  //----------------------------------------------------------------------------
  getState: function()
  {
    return {
      show: this.element.is(":visible"),
      bounds: this._getBounds()
    }
  },

  //----------------------------------------------------------------------------
  setState: function(state)
  {
    // Get a boundary rectangle for the inset area and inset panel
    var areaRect = this._elementToBounds(this.element.parent());
    areaRect = this._offsetRect(areaRect, -areaRect.left, -areaRect.top);
    var insetRect = _.clone(state.bounds);

    // Constrain insetRect to be with and no larger than areaRect
    if (insetRect.right - insetRect.left > areaRect.right - areaRect.left)
      insetRect.right = insetRect.left + (areaRect.right - areaRect.left);
    if (insetRect.bottom - insetRect.top > areaRect.bottom - areaRect.top)
      insetRect.bottom = insetRect.top + (areaRect.bottom - areaRect.top);
    if (insetRect.left < areaRect.left)
      insetRect = this._offsetRect(insetRect, areaRect.left - insetRect.left, 0);
    if (insetRect.right > areaRect.right)
      insetRect = this._offsetRect(insetRect, areaRect.right - insetRect.right, 0);
    if (insetRect.top < areaRect.top)
      insetRect = this._offsetRect(insetRect, 0, areaRect.top - insetRect.top);
    if (insetRect.bottom > areaRect.bottom)
      insetRect = this._offsetRect(insetRect, 0, areaRect.bottom - insetRect.bottom);

    this.element.css({
      top: insetRect.top + "px",
      left: insetRect.left + "px",
      width: (insetRect.right - insetRect.left) + "px",
      height: (insetRect.bottom - insetRect.top) + "px"
    });

    if (state.show !== this.element.is(":visible"))
    {
      if (state.show) this.element.show();
      else this.element.hide();
    }

    this._fireChanged(null, "dimensions", {
      top: insetRect.top,
      left: insetRect.left,
      width: insetRect.right - insetRect.left,
      height: insetRect.bottom - insetRect.top
    });
  },

  //----------------------------------------------------------------------------
  // Event handlers
  //----------------------------------------------------------------------------
  _onResizableStop: function (evt, ui)
  {
    this._fireChanged(evt, "dimensions", {
      top: ui.position.top,
      left: ui.position.left,
      width: ui.size.width,
      height: ui.size.height
    });
  },

  //----------------------------------------------------------------------------
  _onDraggableStop: function(evt, ui)
  {
    this._fireChanged(evt, "dimensions", {
      top: ui.position.top,
      left: ui.position.left,
      width: this.element.outerWidth(),
      height: this.element.outerHeight()
    });
  },

  //----------------------------------------------------------------------------
  // Implementation
  //----------------------------------------------------------------------------
  _create: function()
  {
    var instance = this;
    this.element.data("insetPanel", true);
    this.element
      .addClass("insetPanel")
      .css({
        width: this.options.initialWidth,
        height: this.options.initialHeight,
        minWidth: this.options.minWidth,
        minHeight: this.options.minHeight
      })
      .append("<div class='contentArea'></div>");
    this.element.resizable({
      handles: "all",
      containment: this.options.containment,
      stop: function(evt, ui) { instance._onResizableStop(evt, ui); }
    });
    this.element.draggable({
      containment: this.options.containment,
      stop: function(evt, ui) { instance._onDraggableStop(evt, ui); }
    });
    this._applyLocation(this.options.initialLocation);
  },

  //----------------------------------------------------------------------------
  _getBounds: function()
  {
    return this._elementToBounds(this.element);
  },

  //----------------------------------------------------------------------------
  _elementToBounds: function($elem)
  {
    var visible = $elem.is(":visible");
    if (!visible) $elem.show();
    var pos = $elem.position();
    var h = $elem.outerHeight();
    var w = $elem.outerWidth();
    var result = {
      top: pos.top,
      left: pos.left,
      bottom: pos.top + h,
      right: pos.left + w
    };
    if (!visible) $elem.hide();
    return result;
  },

  //----------------------------------------------------------------------------
  _offsetRect: function(bounds, x, y)
  {
    return {
      top: bounds.top + y,
      left: bounds.left + x,
      bottom: bounds.bottom + y,
      right: bounds.right + x
    };
  },

  //----------------------------------------------------------------------------
  _applyLocation: function(loc)
  {
    var $par = this.element.parent();
    var myAt = "center center";
    switch (loc)
    {
      default:
      case "TL": myAt = "left top"; break;
      case "TC": myAt = "center top"; break;
      case "TR": myAt = "right top"; break;
      case "BL": myAt = "left bottom"; break;
      case "BC": myAt = "center bottom"; break;
      case "BR": myAt = "right bottom";break;
    }
    this.element.position({ my: myAt, at: myAt, of: $par, within: $par });
  },

  //----------------------------------------------------------------------------
  _setOption: function(key, value)
  {
    this._super(key, value);
    if (key === "location")
      if (this.isOpen()) this._applyLocation();
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
