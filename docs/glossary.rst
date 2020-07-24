========
Glossary
========

The following terms are used to describe concepts and processes in |VT|.

.. glossary::

    animation layer
        A layer that visualizes events that occur in time, such as markers for particular events
        in ReportEventRecorder.csv or human migration.

    Geospatial client
        The |VT| client that is primarily designed for the visualization of spatio-temporal
        simulation output.

    heatmap layer
        A layer that provides a way to show aggregated data by populating a heatmap
        image from simulation data then overlaying that onto the map. It makes sense for
        any data that aggregates well, such as populations of humans or vectors.

    nodes layer
        A layer with controls that affect the visual representation of a simulation's
        nodes. The layer provides a set of bindable visual parameters that let you drive
        the visuals using the inputs and outputs of the simulation.

    points
        The visualization output that represents the simulation nodes as two-dimensional circles
        measured in pixels. This is the default representation.

    preprocessing script
        A Python file that runs on your simulation's input and output files to create the visset
        file that indicates how your simulation's data will be visualized in |VT|. This script
        indicates how to represent nodes, whether to include migration, the colors to use, and more.

    shapes
        The visualization output that represents the simulation nodes as three-dimensional
        rectangles measured in meters.

    survey
        The Python program that is included with |VT| and generates a default preprocessing script
        from your simulation data. This preprocessing script can then be further modified.

    visset
        A JSON file that is the input to the |VT| HTML client component and describes how the
        simulation data is to be displayed. It contains a subset of the simulation's demographics
        data (specifically, information about its nodes). The visset file is obtained by running a
        preprocessing script on your simulation's input and output files.
