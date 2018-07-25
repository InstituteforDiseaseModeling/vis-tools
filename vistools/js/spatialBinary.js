//==============================================================================
// SpatialChannel object - wraps a spatial binary
//
// This class wraps a spatial channel binary file, reformatting the data into a
// form that allows random access by timestep, then by nodeId. The friendlyName
// is just there for bookkeeping purposes - if you have on in your hand you
// can't tell them apart.
//==============================================================================
function SpatialBinary(friendlyName)
{
  if (friendlyName === undefined) friendlyName = "None";
  this._timestepRecs = [];
  this._valueMin = Number.MAX_VALUE;
  this._valueMax = Number.MIN_VALUE;
  this._friendlyName = friendlyName;
}

//------------------------------------------------------------------------------
SpatialBinary.prototype.setData = function(binData)
{
  var dv = new DataView(binData);
  var nodeCount = dv.getUint32(0, true);
  var timestepCount = dv.getUint32(4, true);
  var i, offset = 8;
  var nodeIds = [];
  this._valueMin = Number.MAX_VALUE;
  this._valueMax = Number.MIN_VALUE;
  this._timestepRecs = [];
  for (i = 0; i < nodeCount; i++)
  {
    nodeIds.push(dv.getUint32(offset, true));
    offset += 4;
  }
  for (i = 0; i < timestepCount; i++)
  {
    var timestepRec = {};
    for (var j = 0; j < nodeCount; j++)
    {
      var value = dv.getFloat32(offset, true);
      timestepRec[nodeIds[j]] = value;
      offset += 4;
      if (value > this._valueMax) this._valueMax = value;
      if (value < this._valueMin) this._valueMin = value;
    }
    this._timestepRecs.push(timestepRec);
  }
};

