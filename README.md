Vis-Tools
=========

The [Institute for Disease Modeling](http://www.idmod.org/) (IDM)  has developed Vis-Tools to aid in the
visualization of geospatial disease simulation data. It is meant to be used as
an adjunct to [EMOD](http://idmod.org/software), IDM's epidemiological modeling
software.

For complete information on the installation and use of Vis-Tools, see the
[documentation](http://idmod.org/docs/vis-tools/).

REQUIREMENTS
------------

1. [Python 3.x](https://www.python.org/downloads/), in PATH
2. [npm 6.x](https://www.npmjs.com/get-npm), in PATH


INSTALLATION
------------

1. Git clone the Vis-Tools repo to some directory ```<dir>```

    ```
    git clone https://github.com/InstituteforDiseaseModeling/vis-tools <dir>
    cd <dir>
    ```

2. Ensure Python is in PATH

    ```
    python --version
    ```

3. Ensure npm is in PATH

    ```
    npm --version        # ensure npm is in PATH, is version 6.x
    ```

4. Install Vis-Tools python package

    ```
    python setup.py install
    ```

5. Install client libraries

    ```
    cd vistools
    npm install
    ```
    
For full details, read the [Prerequisites](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/prereqs.html)
page and [Quick start](https://institutefordiseasemodeling.github.io/Documentation/vis-tools/intro.html)
pages.

V1.4
----

The Vis-Tools 1.4 release:

* Fixes a number of bugs
* Updates third-party libraries to fix bugs and security issues
* Eliminates cached Javascript libraries.
* Drops Python 2.x support. Please use Python 3.x with Vis-Tools.

Please be sure to follow the steps in the Installation section above.


Previous versions
=================

V1.3.1
------

Version 1.3.1 fixes some compatibility problems with Chrome versions 71+.


V1.3
----

The Vis-Tools 1.3 release is a minor bug-fixing update.


V1.2
----

The Vis-Tools 1.2 release brings integration with IDM's COMPS environment.
Additionally, Vis-Tools is now a proper Python package ('vis_tools'), and does a
better job of encapsulation of the work products of its preprocessing phase.

### Breaking changes

If you have created custom preprocessing scripts with an earlier version of
Vis-Tools, you'll need to update them a little to make them work with Vis-Tools
1.2. The easiest way to do this is to generate a new default preprocessing
script with survey:

    cd my_sim
    survey
    

Then use a diff tool such as WinDiff to merge your changes back into the default
preprocessing script.    


### Python package

Vis-Tools is now a proper Python package. After pulling the Vis-Tools repo:

    git clone <Vis-Tools-repo>
    cd Vis-Tools
    python setup.py install
    

Be sure to also do this step any time you update Vis-Tools (with a git pull).


### Command line

Both survey and survey's generated preprocessing scripts are now meant to be run
from within a local simulation directory. For example:

    cd my_sim
    survey
    python ./Vis-Tools/<md5>/preprocess_my_sim.py
    

### Products directories

Vis-Tools survey tool and its generated preprocessing script now live within a
Vis-Tools directory inside the simulation directory. When the preprocessing
script is generated, it is place into a directory under Vis-Tools that is named
after the script's MD5 hash. This allows multiple runs of survey, or multiple
user's Vis-Tools products to be separated from one another. For example:

    cd my_sim
    survey
    ls -la Vis-Tools
      total 4
      drwxr-xr-x 1 user 1049089 0 May 22 12:30 .
      drwxr-xr-x 1 user 1049089 0 May 22 12:30 ..
      drwxr-xr-x 1 user 1049089 0 May 22 12:30 46bbefdf5ec1171d00b9c342fff669bc
    python ./Vis-Tools/46bbefdf5ec1171d00b9c342fff669bc/preprocess_my_sim.py


### Output to stderr/stdout

Vis-Tools python classes now properly output errors to stderr, and send
non-error output to stdout.


### COMPS integration

Vis-Tools preprocessing and visualization can now be accomplished through the
COMPS web UI. For simulations with spatial output, the Spatial tab of the
Explore view. The survey program has new options to support COMPS integration
but they can be largely ignored for local usage of Vis-Tools.


### Geospatial client features

* New "flat mode" flattens globe to an equi-rectangular projection. Toggle with
the "F" key.

* New "presentation mode" hides all user interface controls for recording
videos or use in live presentations. Keys (such as space to start/stop the
animation) still work. Toggle with the "P" key. Also now there are now "start"
and "stop" audio tones that indicate when animation has started and stopped at
the end, for use in recording animations.

* The "Home" and "End" keys now seek the time locator to the beginning and end
of the simulation's time span, respectively.

* Gradients can now be used that have transparency built into their stops in the
form "#rrggbbaa". For example, "#ff000088@0,#ffffffff@1" makes a red-to-white
ramp which goes from half-translucent to fully opaque across its range. Such
gradient specifications can be set in the visset via the preprocessing script.

* The base layer (the map that is used for the globe) can now be a single
custom-made equi-rectangular image. For example:


    # Set custom base layer
    vis_set.set_custom_base_layer("GrayWorld.png")
    

V1.1
----

The Vis-Tools 1.1 release brings Python 2.7.x and Python 3.6.x compatibility.
Additionally there is a new Python unit test suite (not included in the
distribution) that tests the full Python object API.


V1.0
----

The Vis-Tools 1.0 release is the initial release. There were some last minute
additions to Vis-Tools that are only minimally documented. They are noted here
to aid in their discoverablility.

* Weighted network visualization layers:  The VisSet Python object can now
generate weighted network visualization layers given a CSV file containing the
node-to-node connections and weights. See the VisSet class documentation for
details.

* Vector cohort migration layers: The VisSet Python object can now generate
vector cohort migration layers given a suitable CSV file. See the VisSet class
documentation for details.

* Note on Python 3: Vis-Tools 1.0 only works with Python 2.7.x. Use Vis-Tools
1.1 or later for compatibility with both Python 2 and Python 3.
