=============
Prerequisites
=============

|VT|, like many visualization systems, makes relatively high demands on your
computer and video graphics processor (GPU).

.. note::

    |VT| is only tested on the Microsoft Windows platform. It may work on Linux
    and MacOS, but its use on those operating systems is not supported by
    |IDM_s|.

.. ask Bryan about specific version of Windows--same one as EMOD?

Computer requirements
=====================

Minimum configuration
---------------------
* Hardware-accelerated WebGL
* 2 GB RAM

Recommended configuration
-------------------------
* Discrete nVidia or AMD video graphics accelerator
* Hardware-accelerated WebGL2
* 4 GB RAM

.. note::

    One quick way to see if your computer has hardware-accelerated WebGL is to
    run the Chrome web browser and navigate to `chrome://gpu <chrome://gpu>`_.
    In the **Graphics Feature Status** section, look for WebGL and WebGL2.

    .. figure:: images/vt-chrome-gpu.png

Additional software
-------------------

* Google Chrome, Mozilla Firefox, or Opera web browser
* NodeJS


Using |VT| standalone
=====================

To run |VT| on your local computer, there are a few additional prerequisites for
operation of |VT|. If you are already running |EMOD_s|, you likely already meet
the requirements.

Additional software
-------------------

* Python 3.6.3+ with Python in your PATH environment variable

#.  Install |Python_supp|. See |Python_supp_path| for instructions.

    *   In the **Customize Python** dialog box, verify that **Add python.exe to PATH** is selected
        to add Python to the PATH environment variable on your computer.

#.  Open a Command Prompt window and type the following to verify installation::

        python --version

The Python package manager, pip, is installed as part of |Python_supp| and is used to install
other software packages.

* NodeJS

#.  Install NodeJS. See `NodeJS.org <https://nodejs.org/en/>`_.
#.  Open a Command Prompt window and type the following to verify installation::

      node -v
      npm -v

Supported web browsers
======================

|VT| supports the Google Chrome, Mozilla Firefox, and Opera web browsers,
although it has been most extensively tested on Google Chrome. These browsers
can be obtained via the following links.

* To install Google Chrome, see
  `Google Chrome <https://www.google.com/chrome/>`_
* To install Mozilla Firefox, see
  `Mozilla Firefox <https://www.mozilla.org/firefox/>`_
* To install Opera, see
  `Opera <http://www.opera.com/>`_
