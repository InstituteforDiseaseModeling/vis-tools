===========================
Running |VT| from |COMPS_s|
===========================

This page gives a quick overview of how to run |VT| from within the |COMPS_s|
system.

.. note::

    To access and use |COMPS_s| you must receive approval and credentials from |IDM_s|. Send your request to support@idmod.org.

To use |VT| this way, you'll need to create or otherwise have access to a
spatial simulation, which is to say, a simulation with multiple nodes that have
latitude/longitude geospatial locations.

Locate a target simulation in |COMPS_s|
=======================================

#.  Log into |COMPS_s| using your account credentials
#.  Navigate to Explore > Simulations

    .. figure:: images/vt-comps-navigate-explore.png

#.  Locate a spatial simulation for visualization. When you select such a
    simulation, you'll see the following in the Spatial tab of Explore's
    Details pane.

    .. figure:: images/vt-spatial-tab-needs-preprocessing.png

Preprocess
==========

#.  Click the **Preprocess** button to launch a |COMPS_s| work item to perform
    preprocessing on the simulation. Preprocessing for |VT| will not modify or
    damage the simulation in any way. After you click the Preprocess button, the
    Spatial tab will change to this:

    .. figure:: images/vt-spatial-tab-preprocessing.png

#.  After the preprocessing work item completes successfully, you'll see the
    spatial tab change again:

    .. figure:: images/vt-spatial-tab-ready.png

Visualize
=========

#.  Click the **Visualize** button to launch |VT| on the simulation's data.

    .. figure:: images/vt-launched-from-comps.png

The preprocessing script created a visset that lets us see our nodes
on the map, with no bindings between our simulation's outputs and the visual
parameters of the visualization at all. It's a good starting point for us to
customize the visualization to our needs.

To learn more about the Geospatial visualization client, see :doc:`geospat`.

Re-preprocess
=============

You may find need to "re-preprocess" a simulation. For example, if you've
already run Vis-Tools preprocessing for a "Points"-type visualization, you might
change your mind and want to preprocess for "Shapes."

#.  In the |COMPS_s| Spatial tab, click the **Re-preprocess** button. |COMPS_s|
    will return you to the preprocessing options view, wherein you may
    re-preprocess or upload your own preprocessing script.

    .. figure:: images/vt-spatial-tab-needs-preprocessing-2.png

Using your own preprocessing script
===================================

|COMPS_s| can create default "Points" or "Shapes" preprocessing files for you.
But more advanced users may choose to modify a default script to their liking
and preprocess using that modified script.

#.  In the |COMPS_s| Spatial tab, run **Preprocess** with either "Points" or
    "Shapes" to have a default preprocessing script created for you.

#.  Navigate to the |COMPS_s| Output tab. Therein, find the Vis-Tools folder
    among your simulation's output files and find the vt_preprocess.py script
    that was create by the Preprocess operation.

    .. figure:: images/vt-output-tab-script.png

#.  Right-click the **Download** icon next to that file and choose Save Link
    As... to save it to your local computer.

#.  Open the vt_preprocess.py file in an editor and modify it to your liking.
    For example, you might add default bindings or change the base map. See the
    comments within the vt_preprocess.py file for examples of changes to make.

#.  When you're done making changes, save the file as "my_preprocess.py" to any
    convenient location.

#.  Back in the |COMPS_s| Spatial tab, click **Re-preprocess**.

#.  Click the **Custom script...** button. This will open a file open dialog.
    Locate and open the my_preprocess.py script you saved earlier.

    .. figure:: images/vt-spatial-tab-custom-script.png

#.  Click **Preprocess** to run preprocessing with your custom script.
