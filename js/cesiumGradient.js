//==============================================================================
// cesiumGradient - Adds a sampleCesium() method for getting Cesium colors from
//  a Gradient object.
//
// Depends on:
//  gradient.js
//==============================================================================

Gradient.prototype.sampleCesium = function(loc)
{
  var raw = this.sample(loc);
  return new Cesium.Color(raw.red, raw.green, raw.blue, raw.alpha);
};
