//==============================================================================
// VtUtils object - Vis-Tools
//
// DO NOT PUT Cesium or other specific vis tech-related dependencies in here.
// This is shared by all the visualization clients, not all of which depend on
// the same base technologies.
//
// Depends on:
//  lodash
//==============================================================================

// Some basic utility code and constants
var Utils = {};

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
Utils.keyCodes = {
  kBackspace:8,
  kTab:9,
  kEnter:13,
  kEscape:27,
  kSpace:32,
  kPageUp:33,
  kPageDown:34,
  kEnd:35,
  kHome:36,
  kLeft:37,
  kUp:38,
  kRight:39,
  kDelete:46,
  kDown:40,
  kNumpadMultiply:106,
  kNumpadAdd:107,
  kNumpadEnter:108,
  kNumpadSubtract:109,
  kNumpadDecimal:110,
  kNumpadDivide:111,
  kComma:188,
  kPeriod:190,
  kDot: 190,
  kSlash: 191,
  k0: 48,
  k1: 49,
  k2: 50,
  k3: 51,
  k4: 52,
  k5: 53,
  k6: 54,
  k7: 55,
  k8: 56,
  k9: 57,
  kNumpad0: 96,
  kNumpad1: 97,
  kNumpad2: 98,
  kNumpad3: 99,
  kNumpad4: 100,
  kNumpad5: 101,
  kNumpad6: 102,
  kNumpad7: 102,
  kNumpad8: 104,
  kNumpad9: 105,
  kSemicolon: 186,
  kEquals: 187,
  kA: 65,
  kB: 66,
  kC: 67,
  kD: 68,
  kE: 69,
  kF: 70,
  kG: 71,
  kH: 72,
  kI: 73,
  kJ: 74,
  kK: 75,
  kL: 76,
  kM: 77,
  kN: 78,
  kO: 79,
  kP: 80,
  kQ: 81,
  kR: 82,
  kS: 83,
  kT: 84,
  kU: 85,
  kV: 86,
  kW: 87,
  kX: 88,
  kY: 89,
  kZ: 90,
  kOpenSquareBracket: 216,
  kBackslash: 220,
  kCloseSquareBracket: 221,
  kBacktick: 192,
  kF1: 112,
  kF2: 113,
  kF3: 114,
  kF4: 115,
  kF5: 116,
  kF6: 117,
  kF7: 118,
  kF8: 119,
  kF9: 120,
  kF10: 121,
  kF11: 122,
  kF12: 123
};

Utils.kBingMapsApiKey =
  "Ak1OcXpB05wY5105UpeBK0jkeog89tc8nQCJLBhSeY5Eh16Cdn6xMGg-wp3O1bTc";
Utils.kMapboxKey =
  "pk.eyJ1IjoiaWRtLW1hcGJveCIsImEiOiJjajF3ZmxmYjIwMDBnMnhwaDM1bGthMHIyIn0.SY_9QXFsEGZYN0CmFBU_rQ";

Utils.kSecondsInDay = 60 * 60 * 24;   // 86400
Utils.kOneMeterInDegrees = 1.0 / 60.0 / 1850.0;

//------------------------------------------------------------------------------
Utils.isLocalhost = function()
{
  // localhost:41523 is our usual self-host IIS, so we treat that as non-local
  // so we'll use asset manager URLs. If a user is using the Vis-Tools Python
  // web server to run local they'll be on port 8000 by default, so in that case
  // we'll report local and try to use local URLs for better performance.
  return (
    (location.hostname === "localhost" && location.port !== "41523") ||  //
    location.hostname === "127.0.0.1" ||
    location.hostname === "");
};

//------------------------------------------------------------------------------
Utils.getParameterByName = function (name, url) {
  if (!url) {
    url = window.location.href;
  }
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

//------------------------------------------------------------------------------
Utils.cleanParseInt = function(str)
{
  return parseInt(str.replace(/[^\d-]/, ""));
};

//------------------------------------------------------------------------------
Utils.formatNumber = function(num, precision)
{
  if (typeof num === "string") return num;
  if (num - Math.floor(num) === 0)
  {
    // Integer
    return num.toString();
  }
  else
  {
    // Non-integer
    return num.toFixed(precision);
  }
};

//------------------------------------------------------------------------------
Utils.metersPerDegreeLatitude = function(atLat)
{
  return Math.abs(111132.954 - 559.822 * Math.cos(2.0 * atLat) +
    1.175 * Math.cos(4.0 * atLat));
};

//------------------------------------------------------------------------------
Utils.metersPerDegreeLongitude = function(atLat)
{
  return Math.abs(111132.954 * Math.cos(atLat));
};

//------------------------------------------------------------------------------
Utils.metersToDegreesLatitude = function(meters, atLat)
{
  return meters / Utils.metersPerDegreeLatitude(atLat);
};

//------------------------------------------------------------------------------
Utils.metersToDegreeLongitude = function(meters, atLat)
{
  return meters / Utils.metersPerDegreeLongitude(atLat);
};

//------------------------------------------------------------------------------
// This function asynchronously loads the specified image, and after load
// returns svg to colorize that image with the color specified. The callback
// signature is:
//  callback(svgText)
// NOTE: If you already know the size of the image, you can use the
// colorizeImageSync below.
//------------------------------------------------------------------------------
Utils.colorizeImage = function(imageUrl, cssColorSpec, callback)
{
  var img = new Image();
  img.onload = function()
  {
    var guid = Math.random() * Number.MAX_VALUE;
    var result =
      "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' width='" +
          this.width + "' height='" + this.height + "'>" +
        "<defs>" +
          "<filter id='colorMask" + guid + "'>" +
            "<feFlood flood-color='" + cssColorSpec + "' result='flood' />" +
            "<feComposite in='SourceGraphic' in2='flood' operator='arithmetic' k1='1' k2='0' k3='0' k4='0' />" +
          "</filter>" +
        "</defs>" +
        "<image width='100%' height='100%' xlink:href='" + imageUrl +
          "' filter='url(#colorMask" + guid + ")' />" +
      "</svg>";
    callback(result);
  };
  img.src = imageUrl;
};

//------------------------------------------------------------------------------
Utils.colorizeImageSync = function(imageUrl, cssColorSpec, width, height)
{
  var guid = Math.random() * Number.MAX_VALUE;
  return "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' width='" +
        width + "' height='" + height + "'>" +
      "<defs>" +
        "<filter id='colorMask" + guid + "'>" +
          "<feFlood flood-color='" + cssColorSpec + "' result='flood' />" +
          "<feComposite in='SourceGraphic' in2='flood' operator='arithmetic' k1='1' k2='0' k3='0' k4='0' />" +
        "</filter>" +
      "</defs>" +
      "<image width='100%' height='100%' xlink:href='" + imageUrl +
        "' filter='url(#colorMask" + guid + ")' />" +
    "</svg>";
};

//------------------------------------------------------------------------------
Utils.getInnerRectangle = function($elem)
{
  var width = $elem.innerWidth();
  var height = $elem.innerHeight();
  var padLeft = parseFloat($elem.css("padding-left"));
  var padRight = parseFloat($elem.css("padding-right"));
  var padTop = parseFloat($elem.css("padding-top"));
  var padBottom = parseFloat($elem.css("padding-bottom"));
  return {
    top: padTop,
    left: padLeft,
    bottom: height - padBottom,
    right: width - padRight
  }
};

//------------------------------------------------------------------------------
Utils.getOuterRectangle = function($elem)   // Of absolutely-positioned $elem
{
  var width = $elem.outerWidth();
  var height = $elem.outerHeight();
  var position = $elem.position();
  return {
    top: position.top,
    left: position.left,
    bottom: position.top + height,
    right: position.left + width
  }
};

//------------------------------------------------------------------------------
Utils.constrainRectWithinRect = function(constrain, within)
{
  var delta;
  var result = _.clone(constrain);
  if (result.right - result.left > within.right - within.left)
  {
    result.right = result.left + (within.right - within.left);
  }
  if (result.bottom - result.top > within.bottom - within.top)
  {
    result.bottom = result.top + (within.bottom - within.top);
  }
  if (result.left < within.left)
  {
    delta = within.left - result.left;
    result.left += delta;
    result.right += delta;
  }
  if (result.right > within.right)
  {
    delta = result.right - within.right;
    result.right -= delta;
    result.left -= delta;
  }
  if (result.top < within.top)
  {
    delta = within.top - result.top;
    result.top += delta;
    result.bottom += delta;
  }
  if (result.bottom > within.bottom)
  {
    delta = result.bottom - result.top;
    result.bottom -= delta;
    result.top -= delta;
  }
  if (result.right < result.left) result.right = result.left;
  if (result.bottom < result.top) result.bottom = result.top;
  return result;
};

//==============================================================================
// jQuery extensions
//==============================================================================
// jQuery extension to make it easier to adjust the selection in input
// type=text and textarea objects.
$.fn.selectRange = function (start, end) {
  return this.each(function () {
    var self = this;
    if (self.setSelectionRange) {
      self.focus();
      self.setSelectionRange(start, end);
    } else if (self.createTextRange) {
      var range = self.createTextRange();
      range.collapse(true);
      range.moveEnd('character', end);
      range.moveStart('character', start);
      range.select();
    }
  });
};

//------------------------------------------------------------------------------
// jQuery extension to select all text in an input type=text/textarea
$.fn.selectAll = function()
{
  return this.each(function() {
    var $this = $(this);
    $this.selectRange(0, $this.val().length);
  });
};
