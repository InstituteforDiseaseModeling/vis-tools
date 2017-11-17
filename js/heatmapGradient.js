//==============================================================================
// heatmapGradient - Adds a toHeatmapJsGradient() method for getting an object
// suitable for heatmap.js heatmaps from a Gradient object.
//
// Depends on:
//  gradient.js
//==============================================================================

Gradient.prototype.toHeatmapJsGradient = function()
{
  var result = {};
  var i;
  if (this._prerender && this._prerenderSteps !== Gradient.kDefaultPrerenderSteps &&
    this._prerenderSteps > 1)
  {
    // Emit a quantized gradient
    var denom = this._prerenderArray.length;
    for (i = 0; i < denom; i++)
    {
      var curPos = i / denom;
      var nextPos = (i + 1) / denom;
      var color = this._prerenderArray[i];
      result[curPos.toString()] = Gradient.colorToCSSHashString(color);
      // Extend curPos' color right up to the edge of the next stop
      if (i !== denom - 1)
        nextPos -= 0.0001;
      result[nextPos.toString()] = Gradient.colorToCSSHashString(color);
    }
  }
  else
  {
    // Emit a continuous gradient
    for (i = 0; i < this._stops.length; i++)
    {
      var stop = this._stops[i];
      result[stop.location] = Gradient.colorToCSSHashString(stop.color);
    }
  }
  return result;
};
