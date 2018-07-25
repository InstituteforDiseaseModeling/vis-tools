# ==============================================================================
# SpatialReports.py - Python collection wrapper for set of spatial reports
# ==============================================================================
"""SpatialReports.py

This class is a collection class that keeps track of all the SpatialReport_*
files in a given directory. It is used by VisSet.

Usage::

    reports = SpatialReports("output/")
    print reports

"""

# imports
from __future__ import print_function
from future import standard_library
standard_library.install_aliases()
from builtins import range
from builtins import object
from glob import glob
from os import path
import json
import sys


# ==============================================================================
# SpatialReports - a collection class representing set of spatial reports
# ==============================================================================
class SpatialReports(object):
    """Collection class for a set of spatial reports.

    The class is constructed with the directory in which SpatialReport_* files
    reside. Thereafter the public data members described below, and the various
    accessor functions, can be used to get access to the list.

    Additionally, since SpatialReports implements __len__, __iter__, and
        __getitem__, the SpatialReports object can be treated as a list:, e.g.::

            spatial_reports = SpatialReports("/output")
            path = spatial_reports[0]

    Public members:

        source_dir (str): The source directory used to construct the
        SpatialReports object.

        paths (array): Array of strings with paths to the SpatialReport_* files.

        properties (dict): Dictionary<friendlyName, dict<key,value>> of
        additional properties to associate with each SpatialBinary file
        path. Currently these are unused, but will be used in an upcoming
        version.

    """

    # --------------------------------------------------------------------------
    # Constants
    # --------------------------------------------------------------------------
    k_spatial_filename_prefix = "SpatialReport_"

    # --------------------------------------------------------------------------
    def __init__(self, spatial_dir="", verbose=False):
        """Construct a SpatialReports.

        Args:
            spatial_dir (str): The directory path to inspect.

        Raises:
            I/O exceptions.

        """
        # data members
        self.source_dir = spatial_dir
        self.paths = []
        self.properties = {}  # key: friendlyName, value: {} key/value pairs
        self._verbose = verbose

        if not spatial_dir == "":
            self._discover_spatial_reports()

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of a SpatialReports.

        This method allows the SpatialReports object to report the directory and
        number of spatial report files it found in the target directory when it
        is printed.

        Returns:
            str: String containing the number of spatial report files found.

        """
        if len(self.source_dir) == 0:
            return "(empty)"
        else:
            return "%s: %d spatial reports" % (self.source_dir, len(self.paths))

    # --------------------------------------------------------------------------
    def __len__(self):
        """Returns the number of files found in the target directory.

        Returns:
            int: Number of SpatialReport_* files found.

        """
        return len(self.paths)

    # --------------------------------------------------------------------------
    def __iter__(self):
        """Returns an iterator for the SpatialReport list.

        Returns:
            iterator: Iterator for the SpatialReport_* file paths.

        """
        return self.paths.__iter__()

    # --------------------------------------------------------------------------
    def __getitem__(self, index):
        """Returns a spatial binary path by index.

        Returns:
            str: Spatial binary file path.

        Args:
            index (int): Index, 0-based, into path list.

        """
        return self.paths[index]

    # --------------------------------------------------------------------------
    def get(self, index):
        """Returns detailed information on spatial binary by index.

        Returns:
            obj: An object containing the name, friendly name, and path (url) to
            the spatial binary at the provided index.

        Args:
            index (int): Index, 0-based, into path list.

        """
        return {
            "name": path.splitext(path.basename(self.paths[index]))[0],
            "friendlyName": self._friendly_name(self.paths[index]),
            "url": self.paths[index]
        }

    def add(self, report_path):
        """Manually add a spatial binary to the list.

        This method can be used to manually add a spatial binary to the list
        even if it is not in the source_dir where spatial_binaries normally
        live. This is useful for adding a programmatically-generated spatial
        binary to the list. Such generated spatial binaries are generally
        located in the preprocessing script's products directory.

        Example::

            reports = SpatialReports("output/")
            reports.add(path.join(k_products_dir,
                'SpatialReport_Infectious_Vector_Count'))

        Returns:
            None.

        Args:
            report_path (str): The path to the spatial binary. Note that this
            path need not be within source_dir.

        """
        self.paths.append(report_path)

    # --------------------------------------------------------------------------
    def emit_object(self):
        """Emits an object used by VisSet to represent spatial binary channels.

        Result:
            object: A Dictionary<friendly_name, file_path> for the spatial
            binaries found in the target directory.

        Args:
            None.

        """
        result = {}
        for fp in self.paths:
            friendly_name = self._friendly_name(fp)
            result[friendly_name] = fp
        if self._verbose:
            print("SpatialReports.emit_object: emitted object containing %d "
                  "spatial binaries" % len(self.paths))
        return result

    # --------------------------------------------------------------------------
    # Later, when I want more metadata about each spatial report (namely,
    # value min and value max), switch to this, and change the client.
    # def emit_object(self):
    #     result = {}
    #     for fp in self.paths:
    #         friendly_name = self._friendly_name(fp)
    #         result[friendly_name] = {
    #             "path": fp
    #         }
    #         # Add additional properties if any
    #         if friendly_name in self.properties:
    #             result[friendly_name].update(self.properties[friendly_name])
    #     return result
    # --------------------------------------------------------------------------
    def emit_object_json(self):
        """Emits the JSON for the object from emit_object.

        Result:
            str: JSON representation of the emit_object() result.

        Args:
            None.

        """
        return json.dumps(self.emit_object())

    # --------------------------------------------------------------------------
    def remove(self, friendly_name):
        """Removes a spatial binary from the list by friendly name.

        Returns:
            None.

        Args:
            friendly_name (str): The friendly name of the spatial binary path
            to remove. E.g., for SpatialReport_Adult_Vectors, the friendly
            name is "Adult Vectors".

        """
        for a_path in self.paths:
            if self._friendly_name(a_path) == friendly_name:
                self.paths.remove(a_path)
                if friendly_name in self.properties:
                    del self.properties[friendly_name]

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    def _discover_spatial_reports(self):
        try:
            if not path.isdir(self.source_dir):
                raise IOError("Directory %s is missing or inaccessible." %
                              self.source_dir)
            self.paths = glob(path.join(self.source_dir,
                              self.k_spatial_filename_prefix + "*.bin"))
            for i in range(0, len(self.paths)):
                self.paths[i] = self.paths[i].replace("\\", "/")
        except BaseException:
            # print(sys.exc_info()[0])
            if self._verbose:
                print("SpatialReports._discover_spatial_reports: Exception "
                      "discovering spatial binaries", file=sys.stderr)
            raise

    # --------------------------------------------------------------------------
    def _friendly_name(self, fp):
        leaf = path.splitext(path.basename(fp))[0]  # Basename with no ext
        return leaf[len(self.k_spatial_filename_prefix):].replace("_", " ")
