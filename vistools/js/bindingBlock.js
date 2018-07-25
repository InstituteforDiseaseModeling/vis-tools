"use strict";
//==============================================================================
// bindingBlock
//==============================================================================

//==============================================================================
// bindingBlock - a composite control of sinks/sources/functions and related
//
// Target HTML element
//  div
//
// Usage
//  $myDiv.bindingBlock({ options })
//
// Options
//  sinks:        Dictionary of sinks (required)
//  sources:      Dictionary of sources (required)
//  functionExamples: Function examples (array, tab-delimited)
//  changed:      Called when control member has changed. Signature:
//                  changed(event, data)
//                Where data is:
//                  {
//                    type: string - "source"|"function"
//                    sinkKey: string - sink key
//                    sink: sink object
//                    source: string - from set source list
//                    function: array - function specification
//                  }
//  updated:      Called when setState has updated all the bindings. Sig:
//                  updated()
//  dialogUp:     Called when function edit dialog is about to go up
//
// Typical HTML + CSS + JS
//  <div class="bindingBlock"></div>
//
//  div.bindingBlock { }     /* No styling needed */
//
//  $("div.bindingBlock").bindingBlock({
//    sinks: this._set.pointsVis.pointOptions.sinks",
//    sources: this._set.getSources();
//    functionExamples: Binding.kFunctionExamples
//    changed: function(event, type, data) { ... }
//    updated: function() { ... }
//  });
//
// IMPORTANT
//  You pass your sinks into this control, and it keeps them up to date, but
//  this.options.sinks is a CLONE of the sinks you passed in. So you will have
//  to update your bindings when the changed events come in. (The cloning is
//  a jQui thing.)
//
// Depends on:
//  * jQuery
//  * jQuery UI
//  * visSet
//==============================================================================
$.widget("custom.bindingBlock", {
  options: {
    sinks: null,            // No default
    sources: null,          // No default
    functionExamples: null, // No default
    changed: null,          // No change handler
    dialogUp: null          // No dialog-up handler
  },

  //----------------------------------------------------------------------------
  // Internal constants
  //----------------------------------------------------------------------------
  kDfltFunctionDialogWidth: 750,

  //----------------------------------------------------------------------------
  // Public methods
  //----------------------------------------------------------------------------
  getState: function()
  {
    var result = {};
    _.forEach(this.options.sinks, function(sink, sinkKey)
    {
      result[sinkKey] = {
        source: sink.source,
        function: sink.function
      }
    });
    return result;
  },

  //----------------------------------------------------------------------------
  setState: function(state)
  {
    var instance = this;
    _.forEach(state, function(binding, sinkKey)
    {
      if (!(sinkKey in instance.options.sinks))
        return;
      // These two calls do not _fireChanged
      instance._setSource(sinkKey, binding.source);
      instance._setFunction(sinkKey, binding.function);
    });
    this._fireUpdated();
  },

  //----------------------------------------------------------------------------
  // Implementation
  //----------------------------------------------------------------------------
  _create: function()
  {
    var instance = this;
    this.element.data("bindingBlock", true);
    this.element.addClass("bindingBlock");
    if (this.options.sinks === null || this.options.sources === null) return;

    var sinkKeys = Object.keys(this.options.sinks).sort();
    _.forEach(sinkKeys, function(sinkKey)
    {
      var sink = instance.options.sinks[sinkKey];
      var $row = $("<div class='sourceSinkRow'></div>");
      var $label = $("<label></label>").text(sink.friendlyName + ": ");
      var $select = $("<select></select>").attr("data-sink", sinkKey);
      var $button = $("<button></button>")
        .attr("data-sink", sinkKey)
        .text(VisSet.functionToSummary(sink.function) + "...");
      instance._populateSourcesSelect($select, sink.source);
      $label.appendTo($row);
      $select.appendTo($row);
      $button.appendTo($row);
      $row.appendTo(instance.element);
    });

    this._bind();
  },

  //----------------------------------------------------------------------------
  _populateSourcesSelect: function($select, selectedKey)
  {
    var options = [], $option;
    selectedKey = selectedKey ? selectedKey.toLowerCase() : "";
    _.forEach(this.options.sources, function(source, key)
    {
      $option = $("<option>")
        .attr("value", key)
        .attr("data-type", source.type)
        .prop("selected", key.toLowerCase() === selectedKey)
        .html(source.friendlyName);
      options.push($option);
    });
    options = _.sortBy(options, function($opt)
    {
      return $opt.text() === "None" ? "" : $opt.text();
    });
    $select.append(options);
  },

  //----------------------------------------------------------------------------
  _bind: function()
  {
    var instance = this;
    this.element.find("select").on("change", function(evt)
    {
      instance._onSourceChange(evt);
    });
    this.element.find("button").on("click", function(evt)
    {
      instance._onFunctionButtonClick(evt);
    });
  },

  //----------------------------------------------------------------------------
  _onSourceChange: function(evt)
  {
    // Stuff new source back into options
    var $select = $(evt.target).closest("select");
    var sinkKey = $select.attr("data-sink");
    var sink = this.options.sinks[sinkKey];
    var source = $select.val();
    var functionUpdated = false;
    if (source === "none")
    {
      // If none source is chosen, also slam function to none().
      sink.function = "none()";
      functionUpdated = true;
    }
    else
    {
      // If some other source is chosen, and function is none(), apply the
      // default function if one is specified in the sink.
      if (sink.function === "none()" && sink.defaultFunction)
      {
        sink.function = sink.defaultFunction;
        functionUpdated = true;
      }
    }
    if (functionUpdated)
    {
      var $button = $(evt.target).closest(".sourceSinkRow").find("button");
      $button.text(VisSet.functionToSummary(sink.function) + "...");
    }
    sink.source = source;
    this._fireChanged(evt, "source", {
      sinkKey: sinkKey,
      sink: sink,
      source: source,
      function: sink.function
    });
  },

  //----------------------------------------------------------------------------
  _onFunctionButtonClick: function(evt)
  {
    evt.stopPropagation();
    evt.preventDefault();
    var instance = this;
    this._fireDialogUp(evt);
    var $button = $(evt.target);
    var $select = $button.closest(".sourceSinkRow").find("select");
    var sinkKey = $select.attr("data-sink");
    var sink = this.options.sinks[sinkKey];
    var source = this.options.sources[sink.source];
    var funcText = sink.function;
    var $dialog = $("<div class='functionDialog' title='Edit function'></div>");
    var $infoArea = $("<div class='infoArea'></div>");
    $("<div class='infoAreaRow'><dt>Visual element:</dt><dd>" +
      sink.friendlyName + "</dd></div>").appendTo($infoArea);
    $("<div class='infoAreaRow'><dt>Description:</dt><dd>" +
      sink.desc + "</dd></div>").appendTo($infoArea);
    $("<div class='infoAreaRow'><dt>Return type:</dt><dd>" +
      sink.returnDesc + "</dd></div>").appendTo($infoArea);
    $("<div class='infoAreaRow'><dt>Source:</dt><dd>" +
      source.friendlyName + ", values [" + source.min + ", " + source.max + "]</dd></div>").appendTo($infoArea);
    $infoArea.appendTo($dialog);
    $("<label>Function:<span class='message'></span></label>").appendTo($dialog);
    $("<input type='text' spellcheck='false'>")
      .val(funcText)
      .appendTo($dialog)
      .selectAll()
      .on("keyup", function(evt)
      {
        if (evt.keyCode === Utils.keyCodes.kEnter)
        {
          instance._onFunctionDialogOkClick($dialog, sinkKey);
        }
      });
    $("<a href='#'>Examples&nbsp;<i class='fa fa-sort'></i></a>")
      .appendTo($dialog)
      .on("click", function(evt)
      {
        evt.stopPropagation();
        evt.preventDefault();
        $dialog
          .find(".examples")
          .toggleClass("hidden");
        $dialog.dialog("option", "position", { my: "center", at: "center", of: window });
      });
    this._formatExamples().appendTo($dialog);
    this.element.append($dialog);
    $dialog.dialog({
      dialogClass: "no-close",
      buttons: [
        {
          text: "OK",
          click: function()
          {
            instance._onFunctionDialogOkClick($dialog, sinkKey);
          }
        },
        {
          text: "Cancel",
          click: function() { $(this).dialog("close"); }
        }],
      modal: true,
      width: this.kDfltFunctionDialogWidth,
      position: { my: "center center", at: "center center", of: window },
      create: function() {
        var $chrome = $dialog.closest("div[role='dialog']");
        $chrome.find("button").removeClass("ui-corner-all");
        $chrome.find(".ui-dialog-titlebar")
          .css({
            backgroundColor: "transparent",
            borderWidth: "0 0 1px 0"
          })
          .removeClass("ui-corner-all")
      },
      open: function() {
        $dialog.find("input[type=text]").focus();
      },
      close: function() {
        $dialog.remove();
      }
    });
  },

  //----------------------------------------------------------------------------
  _formatExamples: function()
  {
    var result = "<div class='examples hidden'>";
    _.forEach(this.options.functionExamples, function(example)
    {
      var parts = example.split('\t');
      result += "<p>Example: <strong>" + parts[0] + "</strong><br/>" +
        parts[1] + "</p>";
    });
    result += "</div>";
    return $(result);
  },

  //----------------------------------------------------------------------------
  _onFunctionDialogOkClick: function($dialog, sinkKey)
  {
    // Old function, in case validation fails, is still in sink.function
    var funcText = $dialog.find("input[type=text]").val().trim();
    if (funcText.length === 0) funcText = "none()";
    var sink = this.options.sinks[sinkKey];
    if (!sink.binding.setFunction(funcText))
    {
      // Validation failed. Emit message, and leave dialog up.
      $dialog.find(".message").text(sink.binding.error);
    }
    else
    {
      // Validation succeeded, so update sink.function too
      $dialog.find(".message").text("");
      $dialog.dialog("close");
      this._setFunction(sinkKey, funcText);
      this._fireChanged(null, "function", {
        sinkKey: sinkKey,
        sink: sink,
        source: sink.source,
        function: sink.function
      });
    }
  },

  //----------------------------------------------------------------------------
  // Does not _fireChanged.
  //----------------------------------------------------------------------------
  _setFunction: function(sinkKey, funcText)
  {
    var sink = this.options.sinks[sinkKey];
    sink.function = funcText;
    var $button = this.element.find("button[data-sink='" + sinkKey + "']");
    $button.text(VisSet.functionToSummary(funcText) + "...");
  },

  //----------------------------------------------------------------------------
  // Does not _fireChanged.
  //----------------------------------------------------------------------------
  _setSource: function(sinkKey, sourceName)
  {
    var sink = this.options.sinks[sinkKey];
    sink.source = sourceName;
    var $select = this.element.find("select[data-sink='" + sinkKey + "']");
    $select.val(sourceName);
  },

  //----------------------------------------------------------------------------
  _setOption: function(key, value)
  {
    this._super(key, value);
  },

  //---------------------------------------------------------------------------
  _fireChanged: function(evt, type, data)
  {
    this._trigger("changed", evt, _.extend(data, { type: type }));
  },

  //---------------------------------------------------------------------------
  _fireDialogUp: function(evt)
  {
    this._trigger("dialogUp", evt);
  },

  //---------------------------------------------------------------------------
  _fireUpdated: function()
  {
    this._trigger("updated");
  }
});
