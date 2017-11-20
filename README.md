Vis-Tools
=========

The [Institute for Disease Modeling](http://www.idmod.org>) (IDM)  has developed Vis-Tools to aid in the
visualization of geospatial disease simulation data. It is meant to be used as
an adjunct to [EMOD](http://idmod.org/software), IDM's epidemiological modeling
software.

For complete information on the installation and use of Vis-Tools, see the
[documentation](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/index).

V1.0
----

The Vis-Tools 1.0 release is the initial release.

IMPORTANT
---------

Make sure you at last install the two required Python packages before you try
running Vis-Tools python web server:

    pip install czml future

For full details, read the [Prerequisites](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/prereqs.html)
page and [Quick start](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/intro.html)
pages.

Last minute additions
---------------------

There were some last minute additions to Vis-Tools that are only minimally
documented. They are noted here to aid in their discoverablility.

### Weighted network visualization layers
The VisSet Python object can now generate weighted network visualization layers
given a CSV file containing the node-to-node connections and weights. See the
VisSet class documentation for details.

### Vector cohort migration layers
The VisSet Python object can now generate vector cohort migration layers given
a suitable CSV file. See the VisSet class documentation for details.

### Note on Python 3
While the Vis-Tools 1.0 requires the *future* Python package it has only been
tested on Python 2.7.x. Full Python 2 + 3 compatibility is planned for a
subsequent release.

