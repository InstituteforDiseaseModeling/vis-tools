# ==============================================================================
# SpatialBinaryHeader.py - python wrapper for IDM spatial binary report header
# ==============================================================================
"""SpatialBinaryHeader.py

This file contains:

    * SpatialBinaryHeader - a class for extracting just the header from
      SpatialReport files.

SpatialBinaryHeader is a class that allows access to the dimensions of a
spatial report without actually reading the entire file.

"""

# imports
from __future__ import print_function
from builtins import object
import struct
import sys

k_python3 = sys.version_info.major == 3


# ==============================================================================
# SpatialBinary - a class to read header from spatial binary
# ==============================================================================
class SpatialBinaryHeader(object):
    """Class to read header off a spatial binary without reading the contents.

    Usage::

        bin_header = SpatialBinaryHeader("output/SpatialReport_Prevalence")
        print bin_header

    """
    def __init__(self, file_path="", verbose=False):
        """Construct a SpatialBinaryHeader.

        Args:
            file_path (str): Path to SpatialReport file.

        Raises:
            I/O exceptions.

        """
        self.source_file = ""
        self.node_count = 0
        self.timestep_count = 0
        self._verbose = verbose

        if file_path != "":
            try:
                with open(file_path, "rb") as bin_file:
                    self.source_file = file_path
                    counts = bin_file.read(8)
                    self.node_count, = struct.unpack("<i", counts[0:4])
                    self.timestep_count, = struct.unpack("<i", counts[4:8])
            except BaseException:
                if self._verbose:
                    print("SpatialBinaryHeader.__init__: Exception reading "
                          "spatial binary %s" % file_path, file=sys.stderr)
                raise

    def __str__(self):
        """Generates a textual representation of a SpatialBinaryHeader.

        This method allows the SpatialBinaryHeader object to report the source
        file, number of nodes, and number of timesteps when it is printed.

        Returns:
            str: String containing source file name, number of nodes and number
            of timesteps.

        """
        return "Spatial binary %s: %d nodes and %d timesteps" %\
               (self.source_file, self.node_count, self.timestep_count)
