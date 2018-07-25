//==============================================================================
// binding - Visualization sink-source binding object Vis-Tools
//
// Depends on:
//  lodash
//==============================================================================

//==============================================================================
// Binding object
//
// A Binding object lives inside a sink's structure. It connects the sink to
// a source through a function. Bindings/functions that are null in the visset
// are fixed up at runtime by _fixupBindings() to point to the "None" source and
// use the none() function.
//
// Below there is a set of fields marked "Fields that get fixed up at runtime."
// Those fields are updated by whoever is using the bindings before calling
// binding.evaluate. The frequency of update of the various fields vary.
//
// Binding functions are cooked from the visset text syntax into the fn and args
// fields by setFunction(). That function either vectors work to built-in
// functions or creates an eval'd function to do the job and hooks it to this.
// You don't call fn yourself, you use Binding.evaluate(), which also calls the
// returnConversion function if the sink requires one.
//
// NOTE: Do NOT put visualization-tech-specific dependencies in this file. E.g.
// do NOT put Cesium references in here. If you need to extend Binding for
// Cesium, add a cesiumBinding.js file that extends the prototype.
//==============================================================================

//------------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------------
Binding = function(returnType, returnConversion)
{
  this.source = "None";
  this.data = null;
  this.min = 0;                   // These are required so we can normalize
  this.max = 0;
  this.error = null;
  this.returnConversion = this._parseConversion(returnConversion);
  this.returnType = returnType;

  // The cooked binding function. See applyFunctionArray(). Note that whoever
  // calls this.fn needs to pass this (the Binding object) to the function.
  this.args = [];    // Arguments for fn available to fn as binding.args
  this.fn = function(binding) { return binding.value; };

  // Fields that get fixed up at runtime
  this.gradient = new Gradient();   // Update when gradient changes
  this.gradientLow = 0;             // Update when gradientBlock range changes
  this.gradientHigh = 1;
  this.node = null;                 // Update when processing a different node
  this.value = 0;                   // Update with raw data value
  this.timestep = 0;                // Update when timestep changes
  this.timestepCount = 0;           // Fill in once with timestep count
};

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
Binding.kFunctionExamples = [
  "scale(3, 16)\tNormalize value, then scale into interval [3, 16].",
  "normalize()\tNormalize value, return value in interval [0,1].",
  "sampleGradient()\tNormalize value, sample gradient for color.",
  "if('>=', 0.2, 'red', 'blue')\tIf value is ≥ 0.2, return 'red' else 'blue'. Operator can be ==, !=, <, <=, >, >=.",
  "inRange(0.2, 0.6, '#cc0000', 'black')\tIf 0.2 ≤ value ≤ 0.6, return '#cc0000' else 'black'.",
  "stepwise(0.2, 'red', 0.75, 'yellow', ..., 'else', 'green')\tIf value < 0.2, returns 'red', if < 0.75, returns 'yellow', ..., else returns 'green'.",
  "fixed('#ffff00')\tReturn invariant value '#ffff00'.",
  "add(-0.5)\tReturn value + -0.5.",
  "multiply(2)\tReturn value * 2.0.",
  "none()\tNo function - value is used as-is.",
  "{ var x = Binding.normalize(binding); return 1.0 - x; }\tCustom function body - see documentation for details."
];

//------------------------------------------------------------------------------
// Operations
//------------------------------------------------------------------------------
Binding.prototype.evaluate = function()
{
  try
  {
    this.error = null;
    if (!this.returnConversion)
    {
      // Sink requires no return-value conversion
      return this.fn(this);
    }
    else
    {
      // Sink requires return-value conversion, so invoke that on the fn result.
      return _.invoke(this.returnConversion.obj, this.returnConversion.path,
        this.fn(this));
    }
  }
  catch (e)
  {
    this.error = typeof e === "object" && "message" in e ? e.message : e;
    return this.value;
  }
};

//------------------------------------------------------------------------------
// Accessors
//------------------------------------------------------------------------------
Binding.prototype.setSource = function(sourceName, data, min, max)
{
  this.source = sourceName;
  this.data = data;
  this.min = min;
  this.max = max;
};

//------------------------------------------------------------------------------
// Returns true on success, false on error. Error message at binding.error.
// This function's job is to set this.fn, this.args, and if needed this.error.
//------------------------------------------------------------------------------
Binding.prototype.setFunction = function(funcText)
{
  this.error = null;
  if (!funcText || funcText.length === 0)
  {
    // Function is empty. Shouldn't actually happen, so I spew to the console,
    // but I treat it as none/none binding.
    this.fn = Binding.none;
    this.args = [];
    this.error = "Missing function text. Use 'none()' instead.";
    console.warn("Binding.setFunction missing funcText: '" + funcText + "'.");
    return false;
  }
  if (funcText[0] === "{")
  {
    // funcText is a custom function body. Cook it and put the resulting
    // function into this.fn.
    try
    {
      // If you want eval() to give you a function result, you put the function
      // in parens. Dunno why, but that's how it is.
      this.fn = eval("(function(binding) " + funcText + ")");
      this.args = [];
    }
    catch(e)
    {
      this.fn = Binding.none;
      this.args = [];
      this.error = e.message;
      return false;
    }
  }
  else
  {
    var matches = funcText.match(/(.*)\((.*)\)/);
    if (!matches)
    {
      this.fn = Binding.none;
      this.args = [];
      this.error = "Could not parse funcText: '" + funcText + "'.";
      return false;
    }
    else
    {
      switch(matches[1])
      {
        case "scale": this.fn = Binding.scale; break;
        case "normalize": this.fn = Binding.normalize; break;
        case "sampleGradient": this.fn = Binding.sampleGradient; break;
        case "if": this.fn = Binding.if; break;
        case "inRange": this.fn = Binding.inRange; break;
        case "stepwise": this.fn = Binding.stepwise; break;
        case "fixed": this.fn = Binding.fixed; break;
        case "add": this.fn = Binding.add; break;
        case "multiply": this.fn = Binding.multiply; break;
        case "none": this.fn = Binding.none; break;
        default:
          this.fn = Binding.none;
          this.args = [];
          this.error = "Unknown function name '" + matches[1] + "'";
          return false;
          break;
      }
      try
      {
        // This groovy trick makes JS do the hard work of parsing the arguments.
        this.args = eval("[" + matches[2] + "]");
      }
      catch(e)
      {
        this.args = [];
        this.error = "Unable to parse arguments " + matches[2] + ".";
        return false;
      }

      // If we made it this far without an error, let's make sure the type
      // returned by the function matches the type required by the sink.
      if (this.fn !== Binding.none)
      {
        var returnType = "";
        try
        {
          returnType = typeof this.fn(this);
          if (returnType !== this.returnType)
          {
            this.fn = Binding.none;
            this.args = [];
            this.error = "Function must return type '" + this.returnType + "'.";
            return false;
          }
        }
        catch (e)
        {
          this.fn = Binding.none;
          this.args = [];
          this.error = typeof e === "object" && "message" in e ? e.message : e;
          return false;
        }
      }
    }
  }
  return true;
};

//------------------------------------------------------------------------------
// Built-in functions
//------------------------------------------------------------------------------
Binding.normalize = function(binding)
{
  // This normalize avoids dividing by zero if min == max. In such (undefined)
  // cases it returns 0.0.
  var divisor = binding.max - binding.min;
  if (divisor === 0.0) return 0.0;
  var norm = (binding.value - binding.min) / divisor;
  return Math.min(1.0, Math.max(0.0, norm));  // Force normalized range
};

//------------------------------------------------------------------------------
// binding.args[0]: low (number)
// binding.args[1]: high (number)
//------------------------------------------------------------------------------
Binding.scale = function(binding)
{
  return Binding.normalize(binding) * (binding.args[1] - binding.args[0]) +
    binding.args[0];
};

//------------------------------------------------------------------------------
// binding.args[0]: doNormalize (bool)
// Note: This will malfunction if doNormalize is false but gradientHigh/Low are
// set to something. * IMPROVE
//------------------------------------------------------------------------------
Binding.sampleGradient = function(binding)
{
  var doNorm = (binding.args.length > 0) ? binding.args[0] : true;
  var value = doNorm ? Binding.normalize(binding) : binding.value;
  if (binding.gradientLow !== 0 || binding.gradientHigh !== 1)
  {
    // Clamp to gradientLow/High, then normalize in gradient range
    value = Math.min(binding.gradientHigh, Math.max(binding.gradientLow, value));
    value = (value - binding.gradientLow) /
      (binding.gradientHigh - binding.gradientLow);
  }
  return binding.gradient.sampleRgbaCss(value);
};

//------------------------------------------------------------------------------
// binding.args[0]: operator (string)
// binding.args[1]: compValue (number)
// binding.args[2]: ifTrue (any type)
// binding.args[3]: ifFalse (any type)
//------------------------------------------------------------------------------
Binding.if = function(binding)
{
  // This is pretty inefficient. It would be better to create the text for a
  // custom function and eval it once, then call that repeatedly. * IMPROVE
  switch (binding.args[0])
  {
    case "<": return binding.value < binding.args[1] ?
      binding.args[2] : binding.args[3];
    case ">": return binding.value > binding.args[1] ?
      binding.args[2] : binding.args[3];
    case "<=": return binding.value <= binding.args[1] ?
      binding.args[2] : binding.args[3];
    case ">=": return binding.value >= binding.args[1] ?
      binding.args[2] : binding.args[3];
    case "==": case "=": return binding.value === binding.args[1] ?
      binding.args[2] : binding.args[3];
    case "!=": case "<>": return binding.value !== binding.args[1] ?
      binding.args[2] : binding.args[3];
    default:
      return binding.args[3]; // ifFalse on invalid operator
  }
};

//------------------------------------------------------------------------------
// binding.args[0]: low (number)
// binding.args[1]: high (number)
// binding.args[2]: ifTrue (any type)
// binding.args[3]: ifFalse (any type)
//------------------------------------------------------------------------------
Binding.inRange = function(binding)
{
  return (binding.value >= binding.args[0] && binding.value <= binding.args[1]) ?
    binding.args[2] : binding.args[3];
};

//------------------------------------------------------------------------------
// binding.args[0]: step0 (number)
// binding.args[1]: value0 (any type)
// (and optionally...)
// binding.args[2]: step1 (number)
// binding.args[3]: value1 (any type)
// ...
// binding.args[n]: "else"
// binding.args[n+1]]: elseValue (any type)
//------------------------------------------------------------------------------
Binding.stepwise = function(binding)
{
  for (var i = 0; i < binding.args.length; i += 2)
  {
    var step = binding.args[i];
    var value = binding.args[i + 1];
    if (step === "else") return value;
    else if (binding.value < step) return value;
  }
};

//------------------------------------------------------------------------------
// binding.args[0]: fixedValue (any type)
//------------------------------------------------------------------------------
Binding.fixed = function(binding)
{
  return binding.args[0];
};

//------------------------------------------------------------------------------
// binding.args[0]: value to add (any type)
//------------------------------------------------------------------------------
Binding.add = function(binding)
{
  return binding.value + binding.args[0];
};

//------------------------------------------------------------------------------
// binding.args[0]: value by which to multiply
//------------------------------------------------------------------------------
Binding.multiply = function(binding)
{
  return binding.value * binding.args[0];
};

//------------------------------------------------------------------------------
Binding.none = function(binding)
{
  return binding.value;
};

//------------------------------------------------------------------------------
// Implementation
//------------------------------------------------------------------------------
Binding.prototype._parseConversion = function(conversion)
{
  if (!conversion) return null;
  var dot = conversion.indexOf(".");
  if (dot === -1) return null;
  return {
    obj: window[conversion.substr(0, dot)],   // Resolve to actual object
    path: conversion.substr(dot + 1)
  }
};

