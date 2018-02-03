Vis-Tools
=========

The [Institute for Disease Modeling](http://www.idmod.org>) (IDM)  has developed Vis-Tools to aid in the
visualization of geospatial disease simulation data. It is meant to be used as
an adjunct to [EMOD](http://idmod.org/software), IDM's epidemiological modeling
software.

For complete information on the installation and use of Vis-Tools, see the
[documentation](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/index).


IMPORTANT
---------

Make sure you at least install the two required Python packages before you try
running Vis-Tools python web server:

    pip install czml future

For full details, read the [Prerequisites](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/prereqs.html)
page and [Quick start](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/intro.html)
pages.


V1.1
----

The Vis-Tools 1.1 release brings Python 2.7.x and Python 3.6.x compatibility.
Additionally there is a new Python unit test suite (not included in the
distribution) that tests the full Python object API.


Previous versions
=================


V1.0
----

The Vis-Tools 1.0 release is the initial release.


### Last minute additions

There were some last minute additions to Vis-Tools that are only minimally
documented. They are noted here to aid in their discoverablility.

* Weighted network visualization layers:  The VisSet Python object can now
generate weighted network visualization layers given a CSV file containing the
node-to-node connections and weights. See the VisSet class documentation for
details.

* Vector cohort migration layers: The VisSet Python object can now generate
vector cohort migration layers given a suitable CSV file. See the VisSet class
documentation for details.

* Note on Python 3: Vis-Tools 1.0 only works with Python 2.7.x. Use Vis-Tools
1.1 or later for compatibility with both Python 2 and Python 3.
