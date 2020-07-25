=============================
Preprocessing simulation data
=============================

Before |VT| can provide a visualization for a simulation's data, a preprocessing
step is required. The purpose of this preprocessing step is:

* To establish the data ranges for various simulation outputs.

* To distill overlarge node information into a form that uses less memory for
  consumption by the HTML visualization client.

* To provide a way to customize what is included in the visualization, bindings
  between visual parameters and simulation data, and styling.

The output of the preprocessing script is a :term:`visset` file. The visset file
contains a subset of the information about the nodes in your simulation along
with links to other related files. The visset file drives the |VT| visualization
client HTML.

The section describes the preprocessing cycle involved in using |VT|, the preprocessing
classes available to use, and the structure of the preprocessing script.


.. toctree::

    preproc-cycle
    preproc-components
    preproc-classes
