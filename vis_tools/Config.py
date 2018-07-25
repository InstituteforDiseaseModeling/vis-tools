# ==============================================================================
# Config.py - Python wrapper for IDM config.json files
# ==============================================================================
"""Config.py

This class is a simple Python wrapper for the config.json file used to configure
the DTK.

Usage::
    config = Config(path.join(my_dir, "config.json"))
    print config

"""

# imports
from __future__ import print_function
from builtins import object
import json
import sys


# ==============================================================================
# Config - a class to hold DTK config.json
# ==============================================================================
class Config(object):
    """Class to hold DTK config.json data.

    The class is constructed with the path to the config.json file. Thereafter
    the public data members source_file, timestamp_count, and parameters may be
    used to directly access the resultant Python object. There are also accessor
    methods for the most commonly needed parameters.

    Public members:
        The following data members are publicly exposed.

        source_file (str): A copy of the file_path used to construct the Config
        object.

        timestep_count (int): The Simulation_Duration parameter.

        parameters (obj): The entire config.json as a Python object.

    """
    def __init__(self, file_path="", verbose=False):
        """Construct a Config.

        Args:
            file_path (str): The path to the config.json file.
            verbose (bool): True for extra messaging from methods.

        Raises:
            I/O or JSON exceptions.

        """
        # data members, some of which are gleaned by processing the nodes
        self.source_file = ""
        self.timestep_count = 0
        self._verbose = verbose

        # the bare parts of the read config file
        self.parameters = {}

        # read if file path was given
        if not file_path == "":
            self._read_json(file_path)

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generate a textual representation of a Config.

        This method allows the Config object to report the source file
        and number of timesteps when it is printed.

        Returns:
            str: String containing source file and timestep count.

        """
        if self.parameters == {}:
            return "(empty)"
        else:
            return self.source_file + ": " +\
                repr(int(self.parameters["Simulation_Duration"])) + " timesteps"

    # --------------------------------------------------------------------------
    # Accessors
    # --------------------------------------------------------------------------
    def get_demographics_filenames(self):
        """Return the value of Parameters > Demographics_Filenames.

        Returns:
            list(str): List of demographics filenames.

        Args:
            None.

        """
        return self.parameters["Demographics_Filenames"]

    # --------------------------------------------------------------------------
    def get_first_demographics_filename(self):
        """Returns the first (or only) demographics file from the config.

        This function understands the presence of Demographics_Filename with a
        single path, Demographics_Filename with multiple paths delimited by ';',
        and Demographics_Filenames as an array of paths.

        Returns:
            str: Demographics file name from Demographics_Filenames or
                Demographics_Filename, or None.

        Args:
            None.

        """
        if "Demographics_Filenames" in self.parameters:
            return self.parameters["Demographics_Filenames"][0]
        elif "Demographics_Filename" in self.parameters:
            parts = self.parameters["Demographics_Filename"].split(";")
            if len(parts) == 1:
                return self.parameters["Demographics_Filename"]
            else:
                return parts[0]
        else:
            return None

    # --------------------------------------------------------------------------
    def get_demographics_filename_or_list(self):
        """Returns a string or list of demographics filenames, or None.

        This function understands the presence of Demographics_Filename with a
        single path, Demographics_Filename with multiple paths delimited by ';',
        and Demographics_Filenames as an array of paths.

        Returns:
            str|list: if a single demographics file is specified in the config,
            returns it as a string. If an array is specified, returns an array
            of filenames. Otherwise returns None.

        Args:
            None.

        """
        if "Demographics_Filenames" in self.parameters:
            if len(self.parameters["Demographics_Filenames"]) == 1:
                return self.parameters["Demographics_Filenames"][0]
            else:
                return self.parameters["Demographics_Filenames"]
        elif "Demographics_Filename" in self.parameters:
            parts = self.parameters["Demographics_Filename"].split(";")
            if len(parts) == 1:
                return self.parameters["Demographics_Filename"]
            else:
                return [fp.strip() for fp in parts]
        else:
            return None

    # --------------------------------------------------------------------------
    def get_timestep_count(self):
        """Return the value of Parameters > Simulation_Duration.

        Returns:
            int: Timestep count.

        Args:
            None.

        """
        return self.parameters["Simulation_Duration"]

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    def _read_json(self, json_file_path):
        with open(json_file_path, "r") as config_file:
            self.source_file = json_file_path
            raw = json.load(config_file)

        # distribute the parts to our members
        if "parameters" in raw:
            self.parameters = raw["parameters"]
            self.timestep_count = self.parameters["Simulation_Duration"]
            if self._verbose:
                print("Config._read_json: Config read, simulation duration %d "
                      "timesteps" % self.timestep_count)
        elif self._verbose:
            print("Config._read_json: Parameters key not found in config file.",
                  file=sys.stderr)
