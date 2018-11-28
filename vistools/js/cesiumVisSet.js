//==============================================================================
// cesiumVisSet - Adds Cesium-specific methods to VisSet object.
//
// Depends on:
//  visSet.js
//==============================================================================

//------------------------------------------------------------------------------
VisSet.prototype.getCesiumBoundingRectangle = function()
{
  var bbox = this.getBoundingBox();
  if (!bbox) return Cesium.Rectangle.fromDegrees(0, 0, 0, 0);
  return Cesium.Rectangle.fromDegrees(  // wsen
    bbox.longitudeMin,
    bbox.latitudeMin,
    bbox.longitudeMax,
    bbox.latitudeMax);
};

//------------------------------------------------------------------------------
VisSet.prototype.clockToTimestep = function(viewer, time)
{
  var currentTime = (time === undefined) ? viewer.clock.currentTime : time;
  var timestep = this.julianDateToTimestep(viewer, currentTime);
  return timestep;
};

//------------------------------------------------------------------------------
VisSet.prototype.julianDateToTimestep = function(viewer, julDate)
{
  var timestep = Math.floor(Cesium.JulianDate.secondsDifference(
    julDate, viewer.clock.startTime) / Utils.kSecondsInDay);
  if (timestep < 0)
     timestep = 0;
  if (timestep >= this.timestepCount)
     timestep = this.timestepCount - 1;
  return timestep;
};

//------------------------------------------------------------------------------
VisSet.serializeCamera = function(viewer)
{
  var camera = viewer.scene.camera;
  return {
    position: {
      x: camera.positionWC.x,
      y: camera.positionWC.y,
      z: camera.positionWC.z
    },
    orientation: {
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll
    }
  };
};

//------------------------------------------------------------------------------
VisSet.deserializeCamera = function(viewer, state)
{
  viewer.scene.camera.flyTo({
    destination: new Cesium.Cartesian3(
      state.position.x, state.position.y, state.position.z),
    orientation: state.orientation
  });
};

//------------------------------------------------------------------------------
// May return null
//------------------------------------------------------------------------------
VisSet.prototype.getCzmlUrl = function(key)
{
  if (!(key in this.links.czml) || this.links.czml[key] === null)
    return null;

  var result = this.links.czml[key].url;
  if (!Utils.isLocalhost() && "url_asset" in this.links.czml[key])
    result = this.links.czml[key].url_asset;

  return result;
};
