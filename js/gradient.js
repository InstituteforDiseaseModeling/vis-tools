//==============================================================================
// Gradient - a sampleable gradient for visualizations
//
// By default Gradient prerenders gradients to an array of 1000 colors for
// better runtime performance. This can be disabled in the constructor. Stops
// can contain alpha values and will be interpolated along with the other color
// channels.
//
// You can also create quantized gradients by calling setSteps(n) where n is a
// small number.
//
// Text Gradient spec
// ==================
// Gradient spec syntax:
//  <stop>[,<stop>],<stop>[,q<n>]
// Where:
//  <stop>      <colorname|#rrggbb[aa]]@<pos>
//  colorname   any of the named colors above
//  #rrggbb[aa] a CSS Level 4 hexadecimal color (with optional alpha)
//  <pos>       a floating point number from 0.0 to 1.0 inclusive
//  <steps>     number of quantization steps
//
// Stop object
// ===========
// { color: <colorname|#rrggbb[aa]>, position: <float0to1> }
//
// Public functions
// ================
//  Gradient([stops], [prerender])
//    Constructor. Stops can be an array of stop objects as defined above, or it
//    can be a string. If it is a string, it must be a preset name or conform to
//    the syntax above. If a preset name is specified, it is cloned. It is most
//    efficient to pass the stops in at construction time, rather than calling
//    addStops() later. The optional prerender argument controls whether the
//    gradient prerenders to an array for efficiency. If you pass false here,
//    then sample() will return calculated interpolated colors on each call. If
//    you pass an integer, the gradient is prerendered with that many
//    quantization steps.
//
//  addStop(stop)
//    Adds or replaces a gradient color stop, as defined below.
//
//  getStopCount()
//    Returns the number of color stops in the gradient
//
//  getStop(index)
//    Returns the stop at index. If index is out of range, returns null.
//
//  getStopHexColor(index)
//    Returns the color of the stop at index (ignoring alpha) in #rrggbb
//    format. If index is out of range, returns "#000000".
//
//  getPreset()
//    Returns the preset from which this gradient was created or undefined.
//
//  getSteps()
//    Returns the number of quantization steps for this gradient, or 0 if
//    it is continuous.
//
//  hasAlpha()
//    Returns true if any of the color stops have non-opaque alpha values.
//
//  sample(loc)
//    Samples the gradient at the normalized location loc which is 0.0 to 1.0
//    inclusive. Returns a color as defined below.
//
//  sampleCss(loc)
//    Like sample(), but returns a CSS color in the form "rgba(r, g, b, a)".
//
//  setSteps(n)
//    Sets the number of steps in the prerendered gradient. This can be used to
//    create quantized gradients by using a low number for n, such as 16 or 32.
//    Do setSteps(0) to remove quantization.
//
//  toCss()
//    Returns a CSS3 linear gradient definition matching this gradient,
//    including quantization.
//
//  toString()
//    Override returns a textual representation of the Gradient object.
//
//  toHexString()
//    Returns a spec string suitable for the string-type constructor
//
// Public utility functions
// ========================
//  clamp(val, min, max)
//    Returns val clamped to the inclusive range [min, max].
//
//  colorToCssHashString(color)
//    Given a color as defined below, returns a CSS color in the form
//    "#rrggbb".
//
//  colorToCssString(color)
//    Given a color as defined below, returns a CSS color in the form
//    "rgba(r, g, b, a)".
//
// Structure definitions
// =====================
// A colors is defined as
//  {
//    red: <red channel 0.0 to 1.0>
//    green: <green channel 0.0 to 1.0>
//    blue: <blue channel 0.0 to 1.0>
//    alpha: <opacity 0.0 (transparent) to 1.0 (opaque) - reserved for later use>
//  }
//
// A stop is defined as
//  {
//    color: <rgba color as defined above | "namedColor" | "#rrggbb" >
//    location: <stop relative location 0.0 to 1.0>
//  }
//
// Example usage
// =============
//  var gradient = new Gradient([
//    { color: "blue", location: 0 },
//    { color: "#00ff00", location: 0.33 },   // rgb
//    { color: "#88ff0055", location: 0.5 },  // rgba
//    { color: { red: 1, green: 1, blue: 0, alpha: 1 }, location: 0.67 },
//    { color: { red: 1, green: 0, blue: 0, alpha: 1 }, location: 1 }
//  ], Gradient.kDoPrerender);
//  $("#myObject").css("background-color", gradient.sampleCss(0.75));
//
// Depends on
// ==========
//  nothing
//==============================================================================

//==============================================================================
// Polyfills
//==============================================================================
if (!Array.prototype.findIndex)
{
  Array.prototype.findIndex = function(predicate)
  {
    if (this === null)
    {
      throw new TypeError('Array.prototype.findIndex called on null or undefined');
    }
    if (typeof predicate !== 'function')
    {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}

//==============================================================================
// Gradient
//
// Arguments:
//  stops:      <array|string|undefined>
//              If array: an array of GradientStop structures.
//              If string: a gradient spec (preset name or stop spec string)
//              If undefined: default black-to-white gradient is created
//  prerender:  <boolean|number|undefined>
//              If boolean: true to prerender, false to use sample calculation
//              If number: the number of prerender/quantize steps
//              If undefined: implies default 1000 step prerender
//
// Data members:
//  _presetName: The name of the preset, if this Gradient was constructed from
//               a preset, or "" otherwise
//  _prerender:  True if the gradient is prerendered to a color array
//  _prerenderSteps:  The number of prerender steps. The default is 1000, which
//                    is effectively continuous. Small numbers can be used to
//                    create quantized gradients.
//  _prerenderArray:  The array of precalculated colors if _prerender === true
//  _stops:      An array of GradientStop objects that are:
//                 color: a floating point r/g/b[/a] color
//                 location: a floating point location [0,1]
//                 source: [opt] a source string from which color was derived
//  _reversed:   True if the gradient has been reversed
//==============================================================================
function Gradient(stops, prerender)
{
  this._reversed = false;
  this._presetName = "";    // The name of the preset, if we came from one
  if (typeof prerender === "number")
  {
    this._prerender = true;
    this._prerenderSteps = prerender;
  }
  else if (typeof prerender === "boolean")
  {
    this._prerender = prerender;
    this._prerenderSteps = Gradient.kDefaultPrerenderSteps;
  }
  else
  {
    this._prerender = true;
    this._prerenderSteps = Gradient.kDefaultPrerenderSteps;
  }
  if (typeof stops === "string")
  {
    // See if a preset was specified, and if so retrieve its spec (this is a
    // roundabout way to cloning the preset). It is allowed to put a quant
    // spec after the preset name, so we handle that here too. e.g.
    // "WhiteToBlue,q9"
    var parts = stops.split(",");
    var name = parts[0];
    parts.splice(0, 1); // Remove name, so now parts only contains additions
    if (name in Gradient.presets)
    {
      this._presetName = name;
      stops = Gradient.presets[name].toSourceString();
      if (parts.length > 0) stops += "," + parts.join(",");  // e.g., ",q9,r"
    }
    try {
      var parseResult = Gradient._parseStringSpec(stops);
      this._stops = parseResult.stops;
      // If a step count was passed in, _prerenderSteps will already be set -
      // respect that.
      if (this._prerenderSteps === Gradient.kDefaultPrerenderSteps)
        this._prerenderSteps = parseResult.steps;
      this._reversed = parseResult.reversed;
    }
    catch(e)
    {
      console.error("Bad gradient spec: " + e.message);
      this._stops = [
        {color: Gradient.kNamedColors.black, location: 0.0},
        {color: Gradient.kNamedColors.white, location: 1.0}
      ];
    }
  }
  else
  {
    if (stops === undefined)
    {
      this._stops = [
        {color: Gradient.kNamedColors.black, location: 0.0},
        {color: Gradient.kNamedColors.white, location: 1.0}
      ];
    }
    else
    {
      this._stops = [];
      for (var i = 0; i < stops.length; i++)
      {
        this._stops.push(this._parseStop(stops[i]));
      }
    }
  }
  if (this._prerender)
    this._prerenderArray = this._doPrerender();
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
Gradient.kDefaultPrerenderSteps = 1000;
Gradient.kDoPrerender = true;
Gradient.kNoPrerender = false;

Gradient.kNamedColors = {
  aliceblue: { red: 0.941176, green: 0.972549, blue: 1, alpha: 1 },
  antiquewhite: { red: 0.980392, green: 0.921569, blue: 0.843137, alpha: 1 },
  aqua: { red: 0, green: 1, blue: 1, alpha: 1 },
  aquamarine: { red: 0.498039, green: 1, blue: 0.831373, alpha: 1 },
  azure: { red: 0.941176, green: 1, blue: 1, alpha: 1 },
  beige: { red: 0.960784, green: 0.960784, blue: 0.862745, alpha: 1 },
  bisque: { red: 1, green: 0.894118, blue: 0.768627, alpha: 1 },
  black: { red: 0, green: 0, blue: 0, alpha: 1 },
  blanchedalmond: { red: 1, green: 0.921569, blue: 0.803922, alpha: 1 },
  blue: { red: 0, green: 0, blue: 1, alpha: 1 },
  blueviolet: { red: 0.541176, green: 0.168627, blue: 0.886275, alpha: 1 },
  brown: { red: 0.647059, green: 0.164706, blue: 0.164706, alpha: 1 },
  burlywood: { red: 0.870588, green: 0.721569, blue: 0.529412, alpha: 1 },
  cadetblue: { red: 0.372549, green: 0.619608, blue: 0.627451, alpha: 1 },
  chartreuse: { red: 0.498039, green: 1, blue: 0, alpha: 1 },
  chocolate: { red: 0.823529, green: 0.411765, blue: 0.117647, alpha: 1 },
  coral: { red: 1, green: 0.498039, blue: 0.313725, alpha: 1 },
  cornflowerblue: { red: 0.392157, green: 0.584314, blue: 0.929412, alpha: 1 },
  cornsilk: { red: 1, green: 0.972549, blue: 0.862745, alpha: 1 },
  crimson: { red: 0.862745, green: 0.078431, blue: 0.235294, alpha: 1 },
  cyan: { red: 0, green: 1, blue: 1, alpha: 1 },
  darkblue: { red: 0, green: 0, blue: 0.545098, alpha: 1 },
  darkcyan: { red: 0, green: 0.545098, blue: 0.545098, alpha: 1 },
  darkgoldenrod: { red: 0.721569, green: 0.52549, blue: 0.043137, alpha: 1 },
  darkgray: { red: 0.662745, green: 0.662745, blue: 0.662745, alpha: 1 },
  darkgrey: { red: 0.662745, green: 0.662745, blue: 0.662745, alpha: 1 },
  darkgreen: { red: 0, green: 0.392157, blue: 0, alpha: 1 },
  darkkhaki: { red: 0.741176, green: 0.717647, blue: 0.419608, alpha: 1 },
  darkmagenta: { red: 0.545098, green: 0, blue: 0.545098, alpha: 1 },
  darkolivegreen: { red: 0.333333, green: 0.419608, blue: 0.184314, alpha: 1 },
  darkorange: { red: 1, green: 0.54902, blue: 0, alpha: 1 },
  darkorchid: { red: 0.6, green: 0.196078, blue: 0.8, alpha: 1 },
  darkred: { red: 0.545098, green: 0, blue: 0, alpha: 1 },
  darksalmon: { red: 0.913725, green: 0.588235, blue: 0.478431, alpha: 1 },
  darkseagreen: { red: 0.560784, green: 0.737255, blue: 0.560784, alpha: 1 },
  darkslateblue: { red: 0.282353, green: 0.239216, blue: 0.545098, alpha: 1 },
  darkslategray: { red: 0.184314, green: 0.309804, blue: 0.309804, alpha: 1 },
  darkslategrey: { red: 0.184314, green: 0.309804, blue: 0.309804, alpha: 1 },
  darkturquoise: { red: 0, green: 0.807843, blue: 0.819608, alpha: 1 },
  darkviolet: { red: 0.580392, green: 0, blue: 0.827451, alpha: 1 },
  deeppink: { red: 1, green: 0.078431, blue: 0.576471, alpha: 1 },
  deepskyblue: { red: 0, green: 0.74902, blue: 1, alpha: 1 },
  dimgray: { red: 0.411765, green: 0.411765, blue: 0.411765, alpha: 1 },
  dimgrey: { red: 0.411765, green: 0.411765, blue: 0.411765, alpha: 1 },
  dodgerblue: { red: 0.117647, green: 0.564706, blue: 1, alpha: 1 },
  firebrick: { red: 0.698039, green: 0.133333, blue: 0.133333, alpha: 1 },
  floralwhite: { red: 1, green: 0.980392, blue: 0.941176, alpha: 1 },
  forestgreen: { red: 0.133333, green: 0.545098, blue: 0.133333, alpha: 1 },
  fuchsia: { red: 1, green: 0, blue: 1, alpha: 1 },
  gainsboro: { red: 0.862745, green: 0.862745, blue: 0.862745, alpha: 1 },
  ghostwhite: { red: 0.972549, green: 0.972549, blue: 1, alpha: 1 },
  gold: { red: 1, green: 0.843137, blue: 0, alpha: 1 },
  goldenrod: { red: 0.854902, green: 0.647059, blue: 0.12549, alpha: 1 },
  gray: { red: 0.501961, green: 0.501961, blue: 0.501961, alpha: 1 },
  grey: { red: 0.501961, green: 0.501961, blue: 0.501961, alpha: 1 },
  green: { red: 0, green: 0.501961, blue: 0, alpha: 1 },
  greenyellow: { red: 0.678431, green: 1, blue: 0.184314, alpha: 1 },
  honeydew: { red: 0.941176, green: 1, blue: 0.941176, alpha: 1 },
  hotpink: { red: 1, green: 0.411765, blue: 0.705882, alpha: 1 },
  indianred: { red: 0.803922, green: 0.360784, blue: 0.360784, alpha: 1 },
  indigo: { red: 0.294118, green: 0, blue: 0.509804, alpha: 1 },
  ivory: { red: 1, green: 1, blue: 0.941176, alpha: 1 },
  khaki: { red: 0.941176, green: 0.901961, blue: 0.54902, alpha: 1 },
  lavender: { red: 0.901961, green: 0.901961, blue: 0.980392, alpha: 1 },
  lavenderblush: { red: 1, green: 0.941176, blue: 0.960784, alpha: 1 },
  lawngreen: { red: 0.486275, green: 0.988235, blue: 0, alpha: 1 },
  lemonchiffon: { red: 1, green: 0.980392, blue: 0.803922, alpha: 1 },
  lightblue: { red: 0.678431, green: 0.847059, blue: 0.901961, alpha: 1 },
  lightcoral: { red: 0.941176, green: 0.501961, blue: 0.501961, alpha: 1 },
  lightcyan: { red: 0.878431, green: 1, blue: 1, alpha: 1 },
  lightgoldenrodyellow: { red: 0.980392, green: 0.980392, blue: 0.823529, alpha: 1 },
  lightgray: { red: 0.827451, green: 0.827451, blue: 0.827451, alpha: 1 },
  lightgrey: { red: 0.827451, green: 0.827451, blue: 0.827451, alpha: 1 },
  lightgreen: { red: 0.564706, green: 0.933333, blue: 0.564706, alpha: 1 },
  lightpink: { red: 1, green: 0.713725, blue: 0.756863, alpha: 1 },
  lightsalmon: { red: 1, green: 0.627451, blue: 0.478431, alpha: 1 },
  lightseagreen: { red: 0.12549, green: 0.698039, blue: 0.666667, alpha: 1 },
  lightskyblue: { red: 0.529412, green: 0.807843, blue: 0.980392, alpha: 1 },
  lightslategray: { red: 0.466667, green: 0.533333, blue: 0.6, alpha: 1 },
  lightslategrey: { red: 0.466667, green: 0.533333, blue: 0.6, alpha: 1 },
  lightsteelblue: { red: 0.690196, green: 0.768627, blue: 0.870588, alpha: 1 },
  lightyellow: { red: 1, green: 1, blue: 0.878431, alpha: 1 },
  lime: { red: 0, green: 1, blue: 0, alpha: 1 },
  limegreen: { red: 0.196078, green: 0.803922, blue: 0.196078, alpha: 1 },
  linen: { red: 0.980392, green: 0.941176, blue: 0.901961, alpha: 1 },
  magenta: { red: 1, green: 0, blue: 1, alpha: 1 },
  maroon: { red: 0.501961, green: 0, blue: 0, alpha: 1 },
  mediumaquamarine: { red: 0.4, green: 0.803922, blue: 0.666667, alpha: 1 },
  mediumblue: { red: 0, green: 0, blue: 0.803922, alpha: 1 },
  mediumorchid: { red: 0.729412, green: 0.333333, blue: 0.827451, alpha: 1 },
  mediumpurple: { red: 0.576471, green: 0.439216, blue: 0.847059, alpha: 1 },
  mediumseagreen: { red: 0.235294, green: 0.701961, blue: 0.443137, alpha: 1 },
  mediumslateblue: { red: 0.482353, green: 0.407843, blue: 0.933333, alpha: 1 },
  mediumspringgreen: { red: 0, green: 0.980392, blue: 0.603922, alpha: 1 },
  mediumturquoise: { red: 0.282353, green: 0.819608, blue: 0.8, alpha: 1 },
  mediumvioletred: { red: 0.780392, green: 0.082353, blue: 0.521569, alpha: 1 },
  midnightblue: { red: 0.098039, green: 0.098039, blue: 0.439216, alpha: 1 },
  mintcream: { red: 0.960784, green: 1, blue: 0.980392, alpha: 1 },
  mistyrose: { red: 1, green: 0.894118, blue: 0.882353, alpha: 1 },
  moccasin: { red: 1, green: 0.894118, blue: 0.709804, alpha: 1 },
  navajowhite: { red: 1, green: 0.870588, blue: 0.678431, alpha: 1 },
  navy: { red: 0, green: 0, blue: 0.501961, alpha: 1 },
  oldlace: { red: 0.992157, green: 0.960784, blue: 0.901961, alpha: 1 },
  olive: { red: 0.501961, green: 0.501961, blue: 0, alpha: 1 },
  olivedrab: { red: 0.419608, green: 0.556863, blue: 0.137255, alpha: 1 },
  orange: { red: 1, green: 0.647059, blue: 0, alpha: 1 },
  orangered: { red: 1, green: 0.270588, blue: 0, alpha: 1 },
  orchid: { red: 0.854902, green: 0.439216, blue: 0.839216, alpha: 1 },
  palegoldenrod: { red: 0.933333, green: 0.909804, blue: 0.666667, alpha: 1 },
  palegreen: { red: 0.596078, green: 0.984314, blue: 0.596078, alpha: 1 },
  paleturquoise: { red: 0.686275, green: 0.933333, blue: 0.933333, alpha: 1 },
  palevioletred: { red: 0.847059, green: 0.439216, blue: 0.576471, alpha: 1 },
  papayawhip: { red: 1, green: 0.937255, blue: 0.835294, alpha: 1 },
  peachpuff: { red: 1, green: 0.854902, blue: 0.72549, alpha: 1 },
  peru: { red: 0.803922, green: 0.521569, blue: 0.247059, alpha: 1 },
  pink: { red: 1, green: 0.752941, blue: 0.796078, alpha: 1 },
  plum: { red: 0.866667, green: 0.627451, blue: 0.866667, alpha: 1 },
  powderblue: { red: 0.690196, green: 0.878431, blue: 0.901961, alpha: 1 },
  purple: { red: 0.501961, green: 0, blue: 0.501961, alpha: 1 },
  red: { red: 1, green: 0, blue: 0, alpha: 1 },
  rosybrown: { red: 0.737255, green: 0.560784, blue: 0.560784, alpha: 1 },
  royalblue: { red: 0.254902, green: 0.411765, blue: 0.882353, alpha: 1 },
  saddlebrown: { red: 0.545098, green: 0.270588, blue: 0.07451, alpha: 1 },
  salmon: { red: 0.980392, green: 0.501961, blue: 0.447059, alpha: 1 },
  sandybrown: { red: 0.956863, green: 0.643137, blue: 0.376471, alpha: 1 },
  seagreen: { red: 0.180392, green: 0.545098, blue: 0.341176, alpha: 1 },
  seashell: { red: 1, green: 0.960784, blue: 0.933333, alpha: 1 },
  sienna: { red: 0.627451, green: 0.321569, blue: 0.176471, alpha: 1 },
  silver: { red: 0.752941, green: 0.752941, blue: 0.752941, alpha: 1 },
  skyblue: { red: 0.529412, green: 0.807843, blue: 0.921569, alpha: 1 },
  slateblue: { red: 0.415686, green: 0.352941, blue: 0.803922, alpha: 1 },
  slategray: { red: 0.439216, green: 0.501961, blue: 0.564706, alpha: 1 },
  slategrey: { red: 0.439216, green: 0.501961, blue: 0.564706, alpha: 1 },
  snow: { red: 1, green: 0.980392, blue: 0.980392, alpha: 1 },
  springgreen: { red: 0, green: 1, blue: 0.498039, alpha: 1 },
  steelblue: { red: 0.27451, green: 0.509804, blue: 0.705882, alpha: 1 },
  tan: { red: 0.823529, green: 0.705882, blue: 0.54902, alpha: 1 },
  teal: { red: 0, green: 0.501961, blue: 0.501961, alpha: 1 },
  thistle: { red: 0.847059, green: 0.74902, blue: 0.847059, alpha: 1 },
  tomato: { red: 1, green: 0.388235, blue: 0.278431, alpha: 1 },
  turquoise: { red: 0.25098, green: 0.878431, blue: 0.815686, alpha: 1 },
  violet: { red: 0.933333, green: 0.509804, blue: 0.933333, alpha: 1 },
  wheat: { red: 0.960784, green: 0.870588, blue: 0.701961, alpha: 1 },
  white: { red: 1, green: 1, blue: 1, alpha: 1 },
  whitesmoke: { red: 0.960784, green: 0.960784, blue: 0.960784, alpha: 1 },
  yellow: { red: 1, green: 1, blue: 0, alpha: 1 },
  yellowgreen: { red: 0.603922, green: 0.803922, blue: 0.196078, alpha: 1 }
};

//------------------------------------------------------------------------------
Gradient.isSpecValid = function(str, errOut)
{
  try {
    Gradient._parseStringSpec(str);
  }
  catch(e)
  {
    if (errOut !== undefined)
      errOut.message = e.message;
    return false;
  }
  return true;
};

//------------------------------------------------------------------------------
Gradient.prototype.addStop = function(stop)
{
  stop = this._parseStop(stop);
  var index = this._stops.findIndex(function(elem)
  {
    return elem.location === stop.location;
  });
  if (index === -1)
  {
    // New stop
    this._stops.push(stop);
    this._stops.sort(function(a, b)
    {
      return a.location - b.location;
    });
  }
  else
{
    // Replace existing stop (location is already correct)
    this._stops[index].color = stop.color;
  }

  if (this._prerender)
    this._prerenderArray = this._doPrerender();
};

//------------------------------------------------------------------------------
Gradient.prototype.getStopCount = function()
{
  return this._stops.length;
};

//------------------------------------------------------------------------------
Gradient.prototype.getStop = function(index)
{
  if (index < 0 || index >= this._stops.length) return null;
  return this._stops[index];
};

//------------------------------------------------------------------------------
Gradient.prototype.setStops = function(stops)
{
  this._stops = stops;
  if (this._prerender)
    this._prerenderArray = this._doPrerender();
};

//------------------------------------------------------------------------------
Gradient.prototype.getStopHexColor = function(index)
{
  if (index < 0 || index >= this._stops.length) return "#000000";
  return Gradient.colorToCSSHashString(this._stops[index].color);
};

//------------------------------------------------------------------------------
Gradient.prototype.hasAlpha = function()
{
  for (var i = 0; i < this._stops.length; i++)
  {
    if (this._stops[i].color.alpha < 1.0) return true;
  }
  return false;
};

//------------------------------------------------------------------------------
Gradient.prototype.isReversed = function()
{
  return this._reversed;
};

//------------------------------------------------------------------------------
Gradient.prototype.getPreset = function()
{
  return (this._presetName === "") ? undefined : this._presetName;
};

//------------------------------------------------------------------------------
Gradient.prototype.getSteps = function()
{
  return (this._prerenderSteps === Gradient.kDefaultPrerenderSteps) ?
    0 : this._prerenderSteps;
};

//------------------------------------------------------------------------------
Gradient.prototype.isQuantized = function()
{
  return this._prerender &&
    this._prerenderSteps !== Gradient.kDefaultPrerenderSteps;
};

//------------------------------------------------------------------------------
// Return a normalized color in range 0.0 - 1.0 for each component.
//------------------------------------------------------------------------------
Gradient.prototype.sample = function(loc)
{
  if (loc < 0.0) loc = 0.0;
  if (loc > 1.0) loc = 1.0;

  // Prerendered
  if (this._prerender && this._prerenderArray)
    return this._prerenderArray[
      Math.round(loc * (this._prerenderArray.length - 1))];

  // Non-prerendered
  loc = Gradient.clamp(loc, 0.0, 1.0);
  var highIndex = this._stops.findIndex(function(elem)
  {
    return (elem.location > loc);
  });
  if (highIndex <= 0) highIndex = this._stops.length - 1;
  var highStop = this._stops[highIndex];
  var lowStop = this._stops[highIndex - 1];
  var range = highStop.location - lowStop.location;
  var subLoc = (loc - lowStop.location) / range;
  var low, high, red, green, blue, alpha;
  low = lowStop.color.red;
  high = highStop.color.red;
  red = low + subLoc * (high - low);
  low = lowStop.color.green;
  high = highStop.color.green;
  green = low + subLoc * (high - low);
  low = lowStop.color.blue;
  high = highStop.color.blue;
  blue = low + subLoc * (high - low);
  low = lowStop.color.alpha;
  high = highStop.color.alpha;
  alpha = low + subLoc * (high - low);
  return { red: red, green: green, blue: blue, alpha: alpha };
};

//------------------------------------------------------------------------------
Gradient.prototype.sampleCss = function(loc)
{
  var color = this.sample(loc);
  return Gradient.colorToCssString(color);
};

//------------------------------------------------------------------------------
Gradient.prototype.sampleHashCss = function(loc)
{
  var color = this.sample(loc);
  return Gradient.colorToCSSHashString(color);
};

//------------------------------------------------------------------------------
Gradient.prototype.setSteps = function(steps)
{
  if (steps === undefined || steps === 0)
    steps = Gradient.kDefaultPrerenderSteps;
  this._prerenderSteps = steps;
  this._prerenderArray = this._doPrerender();
};

//------------------------------------------------------------------------------
Gradient.prototype.reverse = function()
{
  this.setStops(Gradient._reverseStops(this._stops));
  this._reversed = !this._reversed;
};

//------------------------------------------------------------------------------
Gradient.prototype.toString = function()
{
  var i, result = "Gradient(";
  for (i = 0; i < this._stops.length; i++)
  {
    var stop = this._stops[i];
    if (i > 0) result += ", ";
    result += Gradient.colorToCssString(stop.color) + "@" + stop.location;
  }
  result += ")";
  return result;
};

//------------------------------------------------------------------------------
// This format does not support alpha.
//------------------------------------------------------------------------------
Gradient.prototype.toHexString = function()
{
  var i, result = "";
  for (i = 0; i < this._stops.length; i++)
  {
    var stop = this._stops[i];
    if (i > 0) result += ", ";
    result += Gradient.colorToCSSHashString(stop.color) + "@" + stop.location;
  }
  if (this._prerender && this._prerenderSteps !== Gradient.kDefaultPrerenderSteps)
    result += ",q" + this._prerenderSteps;
  return result;
};

//------------------------------------------------------------------------------
// Returns a string like "YlOrRd,r,q5" or "#000000@0,#ffffff@1"
//------------------------------------------------------------------------------
Gradient.prototype.toSourceString = function()
{
  var result = this.getPreset();
  if (result)
  {
    // If we are from a preset, append reverse and quant onto that
    if (this.isQuantized()) result += ",q" + this.getSteps();
    if (this.isReversed()) result += ",r";
  }
  else
  {
    var i, stop;
    result = "";
    if (this.isReversed())
    {
      // If the gradient has been reversed, the stops are stored in reversed
      // order. We want to emit them in their original order, then add a ",r"
      for (i = this._stops.length - 1; i >= 0 ; i--)
      {
        stop = this._stops[i];
        if (i < this._stops.length - 1) result += ", ";
        if ("source" in stop)
          result += stop.source + "@" + stop.location;
        else result += Gradient.colorToCSSHashString(stop.color) + "@" +
          stop.location;
      }
      result += ",r"
    }
    else
    {
      // Non-reversed, so emit in natural order
      for (i = 0; i < this._stops.length; i++)
      {
        stop = this._stops[i];
        if (i > 0) result += ", ";
        if ("source" in stop)
          result += stop.source + "@" + stop.location;
        else result += Gradient.colorToCSSHashString(stop.color) + "@" +
          stop.location;
      }
    }
    if (this._prerender && this._prerenderSteps !== Gradient.kDefaultPrerenderSteps)
      result += ",q" + this._prerenderSteps;
  }
  return result;
};

//------------------------------------------------------------------------------
Gradient.prototype.toCss = function()
{
  var i, loc, color, result = "linear-gradient(to right";
  if (this._prerender && this._prerenderSteps < 100 && this._prerenderSteps > 1)
  {
    // Emit quantized
    var denom = this._prerenderArray.length;
    for (i = 0; i < denom; i++)
    {
      result += ", ";
      var curPos = i / denom;
      var nextPos = (i + 1) / denom;
      color = this._prerenderArray[i];
      result += Gradient.colorToCssString(color) + " " +
        (curPos * 100) + "%, ";
      result += Gradient.colorToCssString(color) + " " +
        (nextPos * 100) + "%";
    }
    result += ")";
  }
  else
  {
    // Emit continuous
    for (i = 0; i < this._stops.length; i++)
    {
      var stop = this._stops[i];
      result += ", " + Gradient.colorToCssString(stop.color) + " " +
        (stop.location * 100) + "%";
    }
    result += ")";
  }
  return result;
};

//------------------------------------------------------------------------------
// Public utility functions
//------------------------------------------------------------------------------
Gradient.getSortedCategoryNames = function()
{
  return [
    "Monochrome",
    "Polychrome",
    "Heatmap",
    "Birange",
    "Specialized"
  ];
};

//------------------------------------------------------------------------------
Gradient.clamp = function(val, min, max)
{
  var result = val;
  if (result < min) result = min;
  if (result > max) result = max;
  return result;
};

//------------------------------------------------------------------------------
Gradient.colorToCSSHashString = function(color)
{
  var r = Math.round(color.red * 255).toString(16); r = (r.length < 2) ? "0" + r : r;
  var g = Math.round(color.green * 255).toString(16); g = (g.length < 2) ? "0" + g : g;
  var b = Math.round(color.blue * 255).toString(16); b = (b.length < 2) ? "0" + b : b;
  return "#" + r + g + b;
};

//------------------------------------------------------------------------------
Gradient.colorToCssString = function(color)
{
  var r = Math.round(color.red * 255);
  var g = Math.round(color.green * 255);
  var b = Math.round(color.blue * 255);
  return "rgba(" + r + ", " + g + ", " + b + ", " + color.alpha + ")";
};

//------------------------------------------------------------------------------
Gradient.hexToRgb = function(hex)
{
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    red: parseInt(result[1], 16),
    green: parseInt(result[2], 16),
    blue: parseInt(result[3], 16)
  } : null;
};

//------------------------------------------------------------------------------
Gradient.invertColor = function(hexTripletColor) {
    var color = hexTripletColor;
    color = color.substring(1);           // remove #
    color = parseInt(color, 16);          // convert to integer
    color = 0xFFFFFF ^ color;             // invert three bytes
    color = color.toString(16);           // convert to hex
    color = ("000000" + color).slice(-6); // pad with leading zeros
    color = "#" + color;                  // prepend #
    return color;
};

//------------------------------------------------------------------------------
Gradient.translateNameToHashColor = function(name)
{
  if (name in Gradient.kNamedColors)
  {
    return Gradient.colorToCSSHashString(Gradient.kNamedColors[name]);
  }
  else return undefined;
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
Gradient.prototype._doPrerender = function()
{
  // Temporarily turn off the prerender flag so that sample will do the
  // calculations
  this._prerender = false;

  // Generate a prerender array
  var result = [];
  for (var i = 0; i < this._prerenderSteps; i++)
  {
    result.push(this.sample(i / (this._prerenderSteps - 1)));
  }

  // Turn the prerender flag back on. Now sample() will just pluck colors out
  // of the prerender array.
  this._prerender = true;

  return result;
};

//------------------------------------------------------------------------------
Gradient.prototype._parseStop = function(stop)
{
  if (typeof(stop.color) === "string")
  {
    var color = Gradient.kOpaqueBlack;
    if (stop.color.indexOf("#") == 0)
    {
      // HTML #rrggbb[aa] string
      var r = parseInt(stop.color.substr(1,2), 16) / 255;
      var g = parseInt(stop.color.substr(3,2), 16) / 255;
      var b = parseInt(stop.color.substr(5,2), 16) / 255;
      var a = (stop.color.length > 7) ?
        parseInt(stop.color.substr(7,2), 16) / 255 : 1;
      color = { red: r, green: g, blue: b, alpha: a };
    }
    else
    {
      var namedColor = Gradient.kNamedColors[stop.color.toLowerCase()];
      if (namedColor !== undefined) color = namedColor;
    }
    stop.color = color;
  }
  return stop;
};

//------------------------------------------------------------------------------
// Returns a new array.
//------------------------------------------------------------------------------
Gradient._reverseStops = function(stops)
{
  var reversed = [];
  for (var i = 0; i < stops.length; i++)
  {
    var stop = { color: stops[i].color, location: 1.0 - stops[i].location };
    if ("source" in stops[i]) stop.source = stops[i].source;
    reversed.unshift(stop);   // Prepend
  }
  return reversed;
};

//------------------------------------------------------------------------------
// Gradient spec syntax:
//  <stop>[,<stop>],<stop>[,q<n>][,r]
// Where:
//  <stop>      <colorname|#rrggbb[aa]]@<pos>
//  colorname   any of the named colors above
//  #rrggbb[aa] a CSS Level 4 hexadecimal color (with optional alpha)
//  <pos>       a floating point number from 0.0 to 1.0 inclusive
//  <n>         number of quantization steps
//
// A q-stop sets quantization. With no q-stop, gradient is continuous.
// An r-stop reverses the gradient.
//
// Stops must be in ascending order. This function throws if it gets a bad
// format string.
//
// Returns an object:
// {
//   stops: <array of stops>
//   steps: <number of quantization steps>
//   reversed: true/false
// }
//------------------------------------------------------------------------------
Gradient._parseStringSpec = function(str)
{
  var result = {
    stops: [],
    steps: Gradient.kDefaultPrerenderSteps
  };
  var i, reverse = false;
  var parts = str.split(",");
  if (parts < 2) throw { message: "At least two stops required." };
  for (i = 0; i < parts.length; i++)
  {
    // Look for a "q<n>"-type stop
    var stopStr = parts[i].trim();
    var qMatch = stopStr.match(/q(\d+)/);
    if (qMatch)
    {
      result.steps = parseInt(qMatch[1]);
      continue;
    }

    // Look for a "r"-type stop
    if (stopStr === "r")
    {
      reverse = true;
      continue;
    }

    // Regular color stop
    var color, location, source = undefined;
    var subparts = stopStr.split("@");
    if (subparts.length !== 2)
      throw { message: "Stop must have color and location: '" + stopStr + "'." };

    // Color
    if (subparts[0].indexOf("#") === 0)
    {
      // #rrggbb[aa]
      var r = parseInt(subparts[0].substr(1,2), 16) / 255;
      var g = parseInt(subparts[0].substr(3,2), 16) / 255;
      var b = parseInt(subparts[0].substr(5,2), 16) / 255;
      var a = (subparts[0].length > 7) ?
        parseInt(stop.color.substr(7,2), 16) / 255 : 1;
      if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a))
        throw { message: "Invalid color channel value."};
      color = { red: r, green: g, blue: b, alpha: a };
    }
    else
    {
      // named color
      var namedColor = subparts[0].toLowerCase();
      if (namedColor in Gradient.kNamedColors)
      {
        color = Gradient.kNamedColors[namedColor];
        source = namedColor;
      }
      else throw { message: "Unknown color name '" + namedColor + "'." };
    }

    // Position
    location = parseFloat(subparts[1]);
    if (location < 0.0 || location > 1.0)
      throw { message: "Invalid position '" + subparts[1] + "'." };

    // Force
    if (i === 0) location = 0.0;
    if (i === parts.length - 1) location = 1.0;

    if (source !== undefined)
      result.stops.push({ color: color, location: location, source: source });
    else result.stops.push({ color: color, location: location });
  }

  // Reverse if specified
  if (reverse)
  {
    result.stops = Gradient._reverseStops(result.stops);
    result.reversed = true;
  }
  else result.reversed = false;

  return result;
};

//------------------------------------------------------------------------------
// Presets
//
// Note: To the extent possible, the presets are shown here in "spectral order"
// around a hue wheel. More importantly, the are listed in such order in the
// categories arrays. This helps the gradients make sense when shown in to the
// user. If you add a gradient:
//
// 1) Decide on a category for it
// 2) Insert it spectrally (or at least try)
// 3) Insert its name in the same spot in its category array
//
// Avoid adding categories. If you do, make sure to update
// Gradient.getSortedCategoryNames() to include the new category name.
//------------------------------------------------------------------------------
Gradient.presets = {};
Gradient.categories = {
  Monochrome: [],
  Polychrome: [],
  Heatmap: [],
  Birange: [],
  Specialized: []
};

/* -------------------------------------------------------------------------- */
/* Monochrome */
/* -------------------------------------------------------------------------- */
Gradient.presets["WhiteToRed"] = new Gradient([
  { color: "#ffffff", location: 0.0 },
  { color: "#ff0000", location: 1.0 }
]);

Gradient.presets["Reds"] = new Gradient([
  { color: "#fff5f0", location: 0.0 },
  { color: "#fb6a4a", location: 0.5 },
  { color: "#67000d", location: 1.0 }
]);

Gradient.presets["Oranges"] = new Gradient([
  { color: "#fff5eb", location: 0.0 },
  { color: "#fd8d3c", location: 0.5 },
  { color: "#7f2704", location: 1.0 }
]);

Gradient.presets["WhiteToGreen"] = new Gradient([
  { color: "#ffffff", location: 0.0 },
  { color: "#00ff00", location: 1.0 }
]);

Gradient.presets["Greens"] = new Gradient([
  { color: "#f7fcf5", location: 0.0 },
  { color: "#74c476", location: 0.5 },
  { color: "#00441b", location: 1.0 }
]);

Gradient.presets["WhiteToBlue"] = new Gradient([
  { color: "#ffffff", location: 0.0 },
  { color: "#0000ff", location: 1.0 }
]);

Gradient.presets["Blues"] = new Gradient([
  { color: "#f7fbff", location: 0.0 },
  { color: "#6baed6", location: 0.5 },
  { color: "#08306b", location: 1.0 }
]);

Gradient.presets["Purples"] = new Gradient([
  { color: "#fcfbfd", location: 0.0 },
  { color: "#9e9ac8", location: 0.5 },
  { color: "#3f007d", location: 1.0 }
]);

Gradient.presets["WhiteToGray"] = new Gradient([
  { color: "#ffffff", location: 0.0 },
  { color: "#555555", location: 1.0 }
]);

Gradient.presets["Grays"] = new Gradient([
  { color: "#ffffff", location: 0.0 },
  { color: "#969696", location: 0.5 },
  { color: "#000000", location: 1.0 }
]);

Gradient.categories.Monochrome = [
  "WhiteToRed",
  "Reds",
  "Oranges",
  "WhiteToGreen",
  "Greens",
  "WhiteToBlue",
  "Blues",
  "Purples",
  "WhiteToGray",
  "Grays"
];

/* -------------------------------------------------------------------------- */
/* Polychrome */
/* -------------------------------------------------------------------------- */
Gradient.presets["OrRd"] = new Gradient([
  { color: "#fff7ec", location: 0 },
  { color: "#fee8c8", location: 0.125 },
  { color: "#fdd49e", location: 0.25 },
  { color: "#fdbb84", location: 0.375 },
  { color: "#fc8d59", location: 0.5 },
  { color: "#ef6548", location: 0.625 },
  { color: "#d7301f", location: 0.75 },
  { color: "#b30000", location: 0.875 },
  { color: "#7f0000", location: 1 }
]);

Gradient.presets["YlOrRd"] = new Gradient([
  { color: "#ffffcc", location: 0 },
  { color: "#ffeda0", location: 0.125 },
  { color: "#fed976", location: 0.25 },
  { color: "#feb24c", location: 0.375 },
  { color: "#fd8d3c", location: 0.5 },
  { color: "#fc4e2a", location: 0.625 },
  { color: "#e31a1c", location: 0.75 },
  { color: "#bd0026", location: 0.875 },
  { color: "#800026", location: 1 }
]);

Gradient.presets["YlOrBr"] = new Gradient([
  { color: "#ffffe5", location: 0 },
  { color: "#fff7bc", location: 0.125 },
  { color: "#fee391", location: 0.25 },
  { color: "#fec44f", location: 0.375 },
  { color: "#fe9929", location: 0.5 },
  { color: "#ec7014", location: 0.625 },
  { color: "#cc4c02", location: 0.75 },
  { color: "#993404", location: 0.875 },
  { color: "#662506", location: 1 }
]);

Gradient.presets["YlGn"] = new Gradient([
  { color: "#ffffe5", location: 0 },
  { color: "#f7fcb9", location: 0.125 },
  { color: "#d9f0a3", location: 0.25 },
  { color: "#addd8e", location: 0.375 },
  { color: "#78c679", location: 0.5 },
  { color: "#41ab5d", location: 0.625 },
  { color: "#238443", location: 0.75 },
  { color: "#006837", location: 0.875 },
  { color: "#004529", location: 1 }
]);

Gradient.presets["BuGn"] = new Gradient([
  { color: '#f7fcfd', location: 0.0 },
  { color: '#e5f5f9', location: 0.125 },
  { color: '#ccece6', location: 0.25 },
  { color: '#99d8c9', location: 0.375 },
  { color: '#66c2a4', location: 0.5 },
  { color: '#41ae76', location: 0.625 },
  { color: '#238b45', location: 0.75 },
  { color: '#006d2c', location: 0.875 },
  { color: '#00441b', location: 1.0 }
]);

Gradient.presets["PuBuGn"] = new Gradient([
  { color: "#fff7fb", location: 0 },
  { color: "#ece2f0", location: 0.125 },
  { color: "#d0d1e6", location: 0.25 },
  { color: "#a6bddb", location: 0.375 },
  { color: "#67a9cf", location: 0.5 },
  { color: "#3690c0", location: 0.625 },
  { color: "#02818a", location: 0.75 },
  { color: "#016c59", location: 0.875 },
  { color: "#014636", location: 1 }
]);

Gradient.presets["GnBu"] = new Gradient([
  { color: "#f7fcf0", location: 0 },
  { color: "#e0f3db", location: 0.125 },
  { color: "#ccebc5", location: 0.25 },
  { color: "#a8ddb5", location: 0.375 },
  { color: "#7bccc4", location: 0.5 },
  { color: "#4eb3d3", location: 0.625 },
  { color: "#2b8cbe", location: 0.75 },
  { color: "#0868ac", location: 0.875 },
  { color: "#084081", location: 1 }
]);

Gradient.presets["PuBu"] = new Gradient([
  { color: "#fff7fb", location: 0 },
  { color: "#ece7f2", location: 0.125 },
  { color: "#d0d1e6", location: 0.25 },
  { color: "#a6bddb", location: 0.375 },
  { color: "#74a9cf", location: 0.5 },
  { color: "#3690c0", location: 0.625 },
  { color: "#0570b0", location: 0.75 },
  { color: "#045a8d", location: 0.875 },
  { color: "#023858", location: 1 }
]);

Gradient.presets["YlGnBu"] = new Gradient([
  { color: "#ffffd9", location: 0 },
  { color: "#edf8b1", location: 0.125 },
  { color: "#c7e9b4", location: 0.25 },
  { color: "#7fcdbb", location: 0.375 },
  { color: "#41b6c4", location: 0.5 },
  { color: "#1d91c0", location: 0.625 },
  { color: "#225ea8", location: 0.75 },
  { color: "#253494", location: 0.875 },
  { color: "#081d58", location: 1 }
]);

Gradient.presets["PuRd"] = new Gradient([
  { color: "#f7f4f9", location: 0 },
  { color: "#e7e1ef", location: 0.125 },
  { color: "#d4b9da", location: 0.25 },
  { color: "#c994c7", location: 0.375 },
  { color: "#df65b0", location: 0.5 },
  { color: "#e7298a", location: 0.625 },
  { color: "#ce1256", location: 0.75 },
  { color: "#980043", location: 0.875 },
  { color: "#67001f", location: 1 }
]);

Gradient.presets["RdPu"] = new Gradient([
  { color: "#fff7f3", location: 0 },
  { color: "#fde0dd", location: 0.125 },
  { color: "#fcc5c0", location: 0.25 },
  { color: "#fa9fb5", location: 0.375 },
  { color: "#f768a1", location: 0.5 },
  { color: "#dd3497", location: 0.625 },
  { color: "#ae017e", location: 0.75 },
  { color: "#7a0177", location: 0.875 },
  { color: "#49006a", location: 1 }
]);

Gradient.presets["BuPu"] = new Gradient([
  { color: "#f7fcfd", location: 0 },
  { color: "#e0ecf4", location: 0.125 },
  { color: "#bfd3e6", location: 0.25 },
  { color: "#9ebcda", location: 0.375 },
  { color: "#8c96c6", location: 0.5 },
  { color: "#8c6bb1", location: 0.625 },
  { color: "#88419d", location: 0.75 },
  { color: "#810f7c", location: 0.875 },
  { color: "#4d004b", location: 1 }
]);

Gradient.categories.Polychrome = [
  "OrRd",
  "YlOrRd",
  "YlOrBr",
  "YlGn",
  "BuGn",
  "PuBuGn",
  "GnBu",
  "PuBu",
  "YlGnBu",
  "PuRd",
  "RdPu",
  "BuPu"
];

/* -------------------------------------------------------------------------- */
/* Heatmap */
/* -------------------------------------------------------------------------- */
Gradient.presets["Sunrise"] = new Gradient([
  { color: "#ff0000", location: 0 },
  { color: "#ffff00", location: 0.5 },
  { color: "#ffffff", location: 1 }
]);

Gradient.presets["Doppler"] = new Gradient([
  { color: '#ffffff', location: 0.0 },
  { color: '#11fe10', location: 0.0001 },
  { color: '#11af10', location: 0.20 },
  { color: '#117010', location: 0.40 },
  { color: '#feef10', location: 0.60 },
  { color: '#ef8010', location: 0.80 },
  { color: '#df1110', location: 1.0 }
]);

Gradient.presets["Intensity"] = new Gradient([
  { color: "#006600", location: 0.0 },
  { color: "#00ff00", location: 0.25 },
  { color: "#ffff00", location: 0.5 },
  { color: "#ff0000", location: 1.0 }
]);

Gradient.presets["Blue Red"] = new Gradient([
  { color: "#0000ff", location: 0 },
  { color: "#ff0000", location: 1 }
]);

Gradient.presets["Color Spectrum"] = new Gradient([
  { color: "#000080", location: 0 },
  { color: "#0000ff", location: 0.25 },
  { color: "#008000", location: 0.5 },
  { color: "#ffff00", location: 0.75 },
  { color: "#ff0000", location: 1 }
]);

Gradient.presets["Temperature"] = new Gradient([
  { color: '#ffffff', location: 0.00 },
  { color: '#0e0ea3', location: 0.0001 },
  { color: '#1311b0', location: 0.05 },
  { color: '#1918c0', location: 0.10 },
  { color: '#2129d1', location: 0.15 },
  { color: '#2b5def', location: 0.20 },
  { color: '#317ffd', location: 0.25 },
  { color: '#3fafff', location: 0.30 },
  { color: '#57cce6', location: 0.35 },
  { color: '#7cdf9e', location: 0.40 },
  { color: '#9bea60', location: 0.45 },
  { color: '#b5f032', location: 0.50 },
  { color: '#cbf01a', location: 0.55 },
  { color: '#daf00e', location: 0.60 },
  { color: '#e7f009', location: 0.65 },
  { color: '#f1df0a', location: 0.70 },
  { color: '#f5c614', location: 0.75 },
  { color: '#f5a71b', location: 0.80 },
  { color: '#e57016', location: 0.85 },
  { color: '#cb3515', location: 0.90 },
  { color: '#bd1621', location: 0.95 },
  { color: '#c41f64', location: 1.00 }
]);

Gradient.presets["Visible Spectrum"] = new Gradient([
  { color: "#ff00ff", location: 0 },
  { color: "#0000ff", location: 0.25 },
  { color: "#00ff00", location: 0.5 },
  { color: "#ffff00", location: 0.75 },
  { color: "#ff0000", location: 1 }
]);

Gradient.presets["Incandescent"] = new Gradient([
  { color: "#000000", location: 0 },
  { color: "#8b0000", location: 0.3333333333333333 },
  { color: "#ffff00", location: 0.6666666666666666 },
  { color: "#ffffff", location: 1 }
]);

Gradient.presets["Black Aqua White"] = new Gradient([
  { color: "#000000", location: 0 },
  { color: "#00ffff", location: 0.5 },
  { color: "#ffffff", location: 1 }
]);

Gradient.presets["Deep Sea"] = new Gradient([
  { color: "#000000", location: 0 },
  { color: "#183567", location: 0.25 },
  { color: "#2e649e", location: 0.5 },
  { color: "#17adcb", location: 0.75 },
  { color: "#00fafa", location: 1 }
]);

Gradient.presets["Black Spectrum"] = new Gradient([
  { color: "#000000", location: 0 },
  { color: "#0000ff", location: 0.25 },
  { color: "#00ff00", location: 0.55 },
  { color: "#ffff00", location: 0.85 },
  { color: "#ff0000", location: 1.0 }
]);

Gradient.presets["HeatedMetal"] = new Gradient([
	{ color: '#000000', location: 0 },
  { color: '#800080', location: 0.4 },
  { color: '#ff0000', location: 0.6 },
  { color: '#ffff00', location: 0.8 },
  { color: '#ffffff', location: 1 }
]);

Gradient.categories.Heatmap = [
  "Sunrise",
  "Doppler",
  "Intensity",
  "Blue Red",
  "Color Spectrum",
  "Temperature",
  "Visible Spectrum",
  "Incandescent",
  "Black Aqua White",
  "Deep Sea",
  "Black Spectrum",
  "HeatedMetal"
];

/* -------------------------------------------------------------------------- */
/* Birange */
/* -------------------------------------------------------------------------- */
Gradient.presets["RdBu"] = new Gradient([
  { color: "#67001f", location: 0 },
  { color: "#b2182b", location: 0.1 },
  { color: "#d6604d", location: 0.2 },
  { color: "#f4a582", location: 0.3 },
  { color: "#fddbc7", location: 0.4 },
  { color: "#f7f7f7", location: 0.5 },
  { color: "#d1e5f0", location: 0.6 },
  { color: "#92c5de", location: 0.7 },
  { color: "#4393c3", location: 0.8 },
  { color: "#2166ac", location: 0.9 },
  { color: "#053061", location: 1 }
]);

Gradient.presets["RdGy"] = new Gradient([
  { color: "#67001f", location: 0 },
  { color: "#b2182b", location: 0.1 },
  { color: "#d6604d", location: 0.2 },
  { color: "#f4a582", location: 0.3 },
  { color: "#fddbc7", location: 0.4 },
  { color: "#ffffff", location: 0.5 },
  { color: "#e0e0e0", location: 0.6 },
  { color: "#bababa", location: 0.7 },
  { color: "#878787", location: 0.8 },
  { color: "#4d4d4d", location: 0.9 },
  { color: "#1a1a1a", location: 1 }
]);

Gradient.presets["RdYlBu"] = new Gradient([
  { color: "#a50026", location: 0 },
  { color: "#d73027", location: 0.1 },
  { color: "#f46d43", location: 0.2 },
  { color: "#fdae61", location: 0.3 },
  { color: "#fee090", location: 0.4 },
  { color: "#ffffbf", location: 0.5 },
  { color: "#e0f3f8", location: 0.6 },
  { color: "#abd9e9", location: 0.7 },
  { color: "#74add1", location: 0.8 },
  { color: "#4575b4", location: 0.9 },
  { color: "#313695", location: 1 }
]);

Gradient.presets["RdYlGn"] = new Gradient([
  { color: "#a50026", location: 0 },
  { color: "#d73027", location: 0.1 },
  { color: "#f46d43", location: 0.2 },
  { color: "#fdae61", location: 0.3 },
  { color: "#fee08b", location: 0.4 },
  { color: "#ffffbf", location: 0.5 },
  { color: "#d9ef8b", location: 0.6 },
  { color: "#a6d96a", location: 0.7 },
  { color: "#66bd63", location: 0.8 },
  { color: "#1a9850", location: 0.9 },
  { color: "#006837", location: 1 }
]);

Gradient.presets["Spectral"] = new Gradient([
  { color: "#9e0142", location: 0 },
  { color: "#d53e4f", location: 0.1 },
  { color: "#f46d43", location: 0.2 },
  { color: "#fdae61", location: 0.3 },
  { color: "#fee08b", location: 0.4 },
  { color: "#ffffbf", location: 0.5 },
  { color: "#e6f598", location: 0.6 },
  { color: "#abdda4", location: 0.7 },
  { color: "#66c2a5", location: 0.8 },
  { color: "#3288bd", location: 0.9 },
  { color: "#5e4fa2", location: 1 }
]);

Gradient.presets["PuOr"] = new Gradient([
  { color: "#7f3b08", location: 0 },
  { color: "#b35806", location: 0.1 },
  { color: "#e08214", location: 0.2 },
  { color: "#fdb863", location: 0.3 },
  { color: "#fee0b6", location: 0.4 },
  { color: "#f7f7f7", location: 0.5 },
  { color: "#d8daeb", location: 0.6 },
  { color: "#b2abd2", location: 0.7 },
  { color: "#8073ac", location: 0.8 },
  { color: "#542788", location: 0.9 },
  { color: "#2d004b", location: 1 }
]);

Gradient.presets["BrBG"] = new Gradient([
  { color: "#543005", location: 0 },
  { color: "#8c510a", location: 0.1 },
  { color: "#bf812d", location: 0.2 },
  { color: "#dfc27d", location: 0.3 },
  { color: "#f6e8c3", location: 0.4 },
  { color: "#f5f5f5", location: 0.5 },
  { color: "#c7eae5", location: 0.6 },
  { color: "#80cdc1", location: 0.7 },
  { color: "#35978f", location: 0.8 },
  { color: "#01665e", location: 0.9 },
  { color: "#003c30", location: 1 }
]);

Gradient.presets["PiYG"] = new Gradient([
  { color: "#8e0152", location: 0 },
  { color: "#c51b7d", location: 0.1 },
  { color: "#de77ae", location: 0.2 },
  { color: "#f1b6da", location: 0.3 },
  { color: "#fde0ef", location: 0.4 },
  { color: "#f7f7f7", location: 0.5 },
  { color: "#e6f5d0", location: 0.6 },
  { color: "#b8e186", location: 0.7 },
  { color: "#7fbc41", location: 0.8 },
  { color: "#4d9221", location: 0.9 },
  { color: "#276419", location: 1 }
]);

Gradient.presets["PRGn"] = new Gradient([
  { color: "#40004b", location: 0 },
  { color: "#762a83", location: 0.1 },
  { color: "#9970ab", location: 0.2 },
  { color: "#c2a5cf", location: 0.3 },
  { color: "#e7d4e8", location: 0.4 },
  { color: "#f7f7f7", location: 0.5 },
  { color: "#d9f0d3", location: 0.6 },
  { color: "#a6dba0", location: 0.7 },
  { color: "#5aae61", location: 0.8 },
  { color: "#1b7837", location: 0.9 },
  { color: "#00441b", location: 1 }
]);

Gradient.categories.Birange = [
  "RdBu",
  "RdGy",
  "RdYlBu",
  "RdYlGn",
  "Spectral",
  "PuOr",
  "BrBG",
  "PiYG",
  "PRGn"
];

/* -------------------------------------------------------------------------- */
/* Specialized */
/* -------------------------------------------------------------------------- */
Gradient.presets["Vorticity"] = new Gradient([
  { color: "#e0e0e0", location: 0.0 },
  { color: "#101b34", location: 0.157 },
  { color: "#94e1d9", location: 0.41 },
  { color: "#429735", location: 0.551 },
  { color: "#f2f700", location: 0.7 },
  { color: "#c22900", location: 0.857 },
  { color: "#641507", location: 1.0 }
]);

Gradient.presets["Flux"] = new Gradient([
  { color: "#00ffff", location: 0 },
  { color: "#f2ff00", location: 0.5 },
  { color: "#fe00fe", location: 1 }
]);

Gradient.presets["Hue"] = new Gradient([
  { color: '#ff0000', location: 0.0 },
  { color: '#ffff00', location: 0.125 },
  { color: '#80ff00', location: 0.25 },
  { color: '#00ff00', location: 0.375 },
  { color: '#00ffff', location: 0.5 },
  { color: '#0000ff', location: 0.625 },
  { color: '#8a2be2', location: 0.75 },
  { color: '#ff00ff', location: 0.875 },
  { color: '#ff0000', location: 1.0 }
]);

Gradient.categories.Specialized = [
  "Vorticity",
  "Flux",
  "Hue"
];
