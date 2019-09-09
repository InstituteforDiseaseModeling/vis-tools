# ==============================================================================
# SpatialBinary.py - python wrapper for IDM spatial binary reports
# ==============================================================================
"""SpatialBinary.py

This file contains:

    * SpatialBinary - a wrapper for SpatialReport DTK output files.

SpatialBinary is a Python wrapper for DTK SpatialReport_* files. It can both
read and write them, and can combine them using combiner functions to make new
SpatialReports.

Usage::

    spatial_binary = SpatialBinary(path.combine(my_dir,
        "SpatialReport_Prevalence.bin"))
    print spatial_binary

"""

# imports
from builtins import range
from builtins import object
import struct
import os
import array
import copy
import math
import sys


# ==============================================================================
# SpatialBinary - a class to hold IDM spatial binary report
# ==============================================================================
class SpatialBinary(object):
    """Class to hold DTK spatial binary report data.

    The class is constructed with the path to the report file in question.
    Thereafter the public data members described below may be used to directly
    access (or change) the data.

    Additionally, since SpatialBinary implements __len__, __iter__, and
    __getitem__, the object can be treated like an array on timestep, e.g.::

        timestep_rec = spatial_binary[timestep]     # Obtain one timestep

    The resulting timestep_rec is a dictionary<node_id, channel_value>.

    Public members:
        drop_zeros (bool): True: drop zero values from in-memory representation.

        source_file (str): A copy of the file_path that was used to construct
        the SpatialBinary object.

        channel_name (str): The channel name, pulled from source_file.

        node_count (int): The number of nodes in the SpatialBinary's node table.

        value_min (float): The minimum value for all nodes * timesteps.

        value_max (float): The maximum value for all nodes * timesteps.

        timesteps (array): Array of dictionaries containing the spatial report's
        data.

    """
    def __init__(self, file_path="", drop_zeros=False, excluded_node_ids=None,
                 verbose=False):
        """Construct a SpatialBinary.

        Args:
            file_path (str): The path to the SpatialReport file.

            drop_zeros (bool): If true, zero values will not appear in the
            timestep dictionaries. This can dramatically reduce the in-
            memory size of the object, but requires an extra step on
            retrieval of doing node_id in timestep_rec to avoid an
            exception.

            excluded_node_ids (list): An iterable (e.g. array or list) of
            node_ids that should be excluded from the min/max statistics for
            this spatial binary. Note that these nodes are still present in
            the timesteps array, they just do not influence min/max. This is
            typically used for removing outlier nodes, such as the
            "elsewhere" node in simulations involving external migration.

            verbose (bool)

        Raises:
            I/O and other exceptions.

        """
        # data members, some of which are gleaned by processing the data
        self.drop_zeros = drop_zeros
        self.source_file = ""
        self.channel_name = ""
        self.node_count = 0
        self.value_min = sys.float_info.max
        self.value_max = sys.float_info.min
        self._excluded_node_ids = set()
        if excluded_node_ids is not None:
            self._excluded_node_ids = set(excluded_node_ids)
        self._verbose = verbose

        # pythonized contents of spatial file
        # each element of timesteps is a dictionary<nodeId, float>
        self.timesteps = []

        # read if file path was given
        if not file_path == "":
            self._read_binary(file_path)

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of a SpatialBinary.

        This method allows the SpatialBinary object to report the source file
        and number of timesteps when it is printed.

        Returns:
            str: String containing source file and timestep count.

        """
        if len(self.timesteps) == 0:
            return "(empty)"
        else:
            return self.source_file + ": " + repr(len(self.timesteps)) +\
                " timesteps"

    # --------------------------------------------------------------------------
    def __len__(self):
        """Returns the number of timesteps in the timesteps array.

        Returns:
            int: The number of timesteps in the spatial binary data.

        """
        return len(self.timesteps)

    # --------------------------------------------------------------------------
    def __iter__(self):
        """Returns an iterator for the timesteps array.

        Returns:
            iterator: Iterator for timesteps array.

        """
        return self.timesteps.__iter__()

    # --------------------------------------------------------------------------
    def __getitem__(self, timestep_index):
        """Returns the timestep record for a given timestep index.

        Returns:
            obj: Dictionary<node_id, spatial_value> for given timestep.

        Raises:
            IndexError.

        """
        return self.timesteps[timestep_index]

    # --------------------------------------------------------------------------
    def value_range(self, for_json=False):
        """Returns an object with the value range of the data.

        Returns:
            obj: An object with the min/max values of the data, with either
            Python or Javascript naming conventions.

        Args:
            for_json (bool): If true, emit an object using Javascript naming
            conventions, otherwise use Python naming conventions.

        """
        if for_json:
            return {
                "min": self.value_min,
                "max": self.value_max
            }
        else:
            return {
                "value_min": self.value_min,
                "value_max": self.value_max
            }

    # --------------------------------------------------------------------------
    def write_binary(self, bin_file_path):
        """Writes the SpatialBinary to a given file path.

        This function write out the spatial data in the object to a
        SpatialReport-format binary file. Typically this is used when the caller
        has modified the data in a SpatialBinary object or used combine() to
        create a new one. Note that if zeros were dropped, write_binary will
        throw an exception.

        Returns:
            None.

        Args:
            bin_file_path (str): The file path to which to write.

        Raises:
            ValueError: if the SpatialBinary used drop_zeros on construction.

        To do:
            * Make it work even for sparse spatial binaries. The zero values are
              implied in by missing keys in the timestep records, so no actual
              data is missing.

        """
        # We can't write zero-dropped (sparse) spatial binary representations
        # because we may not have all the nodes anymore.
        if self.drop_zeros:
            raise ValueError("Can't write sparse spatial binaries")

        # Collect all the node ids
        node_ids_array = list(self.timesteps[0].keys())
        node_ids_array.sort()
        node_ids = array.array("I", node_ids_array)

        try:
            with open(bin_file_path, "wb") as bin_file:
                # Write out the two counts
                bin_file.write(struct.pack("<i", len(node_ids)))
                bin_file.write(struct.pack("<i", len(self.timesteps)))

                # Write out the node IDs
                node_ids.tofile(bin_file)

                # Write out the values for each timestep
                for values_dict in self.timesteps:
                    values = array.array("f")
                    for node_id in node_ids_array:
                        values.append(values_dict[node_id])
                    values.tofile(bin_file)
        except BaseException:
            if self._verbose:
                print("SpatialBinary.write_binary: Exception writing spatial "
                      "binary %s" % bin_file_path, file=sys.stderr)
            raise
        self.source_file = bin_file_path

    # --------------------------------------------------------------------------
    def clone(self):
        """Returns a copy of this SpatialBinary in a new SpatialBinary object.

        Returns:
            obj: A new SpatialBinary object populated from self.

        Args:
            None.

        """
        return copy.deepcopy(self)

    # --------------------------------------------------------------------------
    def print(self):
        """Prints the entire contents of the spatial binary. Can be lengthy.

        Returns:
            None.

        Args:
            None.

        """
        for timestep in range(0, len(self.timesteps)):
            ts_rec = self.timesteps[timestep]
            for node_id in ts_rec:
                print("Timestep %08d, node %08d, value = %f" %
                      (timestep, node_id, ts_rec[node_id]))

    # --------------------------------------------------------------------------
    # Where combine_func is float combineFunc(float src1, float src2)
    # --------------------------------------------------------------------------
    @staticmethod
    def combine(bin_file_path_1, bin_file_path_2, channel_name, combine_func):
        """Combine two SpatialBinary objects into a new SpatialBinary object.

        This function takes two SpatialBinary objects (of the same exact
        dimensions in both timesteps and nodes) and combines them through a
        "combine function" to make an entirely new in-memory SpatialBinary. That
        resulting SpatialBinary would then typically be written out using
        write_binary().

        There are four simple arithmetic static combine functions built into
        SpatialBinary, but the user may pass in any valid combine function that
        has a compatible signature. (See Usage below.) For operations that are
        not commutative such as division, let it be known that argument value1
        in the combine function comes from bin_file_path1, and value2 comes from
        bin_file_path2.

        Beware: temporarily has all three SpatialBinaries in memory.

        Usage::

            def rounded_multiply_combiner(value1, value2):
                return round(value1 * value2)
            inf_vec_count = SpatialBinary.combine(
                "output/SpatialReport_Adult_Vectors",
                "output/SpatialReport_Infected_Vectors",
                "Infected Vector Count", rounded_multiply_combiner)
            inf_vec_count.write_binary("SpatialReport_Infected_Vector_Count")

        Returns:
            obj: A new SpatialBinary object combining sources 1 and 2

        Args:
            bin_file_path_1 (str): File path of first spatial binary file.

            bin_file_path_2 (str): File path of second spatial binary file.

            channel_name (str): Channel name to assign to the result binary.

            combine_func (function): A function that combines the values from
            the two spatial binary inputs, one at a time. The signature of
            the combine_func is::

                combine_func(value1, value2)
                    return value1 + value2      # for example

        Raises:
            ValueError: if SpatialBinary ofbjects don't have same dimensions or
            nodes

        """
        sb1 = SpatialBinary(bin_file_path_1)
        sb2 = SpatialBinary(bin_file_path_2)

        # Do some validation
        if sb1.drop_zeros or sb2.drop_zeros:
            raise ValueError("One or more inputs to combine have drop_zeros "
                             "set which makes them inappropriate for combine.")
        if sb1.node_count != sb2.node_count:
            raise ValueError("Combine's inputs do not represent the same "
                             "number of nodes.")
        if len(sb1.timesteps) != len(sb2.timesteps):
            raise ValueError("Combine's inputs do not represent the same "
                             "number of timesteps.")
        sb1_nodes = list(sb1.timesteps[0].keys())
        sb2_nodes = list(sb2.timesteps[0].keys())
        if sb1_nodes != sb2_nodes:
            raise ValueError("Combine's inputs do not represent the same node "
                             "ids.")

        try:
            sb1.value_min = sys.float_info.max
            sb1.value_max = sys.float_info.min
            sb1.source_file = ""
            sb1.channel_name = channel_name
            for i in range(0, len(sb1.timesteps)):
                ts1 = sb1.timesteps[i]
                ts2 = sb2.timesteps[i]
                for nodeId in list(ts1.keys()):
                    new_value = combine_func(ts1[nodeId], ts2[nodeId])
                    sb1.value_min =\
                        new_value if new_value < sb1.value_min else sb1.value_min
                    sb1.value_max =\
                        new_value if new_value > sb1.value_max else sb1.value_max
                    ts1[nodeId] = new_value
            sb1.value_min = SpatialBinary._condition_value(sb1.value_min)
            sb1.value_max = SpatialBinary._condition_value(sb1.value_max)
        except(BaseException):
            # print(sys.exc_info()[0])
            raise
        return sb1

    # --------------------------------------------------------------------------
    # Simple arithmetic combiner functions
    # --------------------------------------------------------------------------
    @staticmethod
    def multiply_combiner(value1, value2):
        """Combiner function that multiplies channel values.

        Returns:
            float: new value.

        Args:
            value1 (float): Value from input file 1.

            value2 (float): Value from input file 2.

        """
        return value1 * value2

    # --------------------------------------------------------------------------
    @staticmethod
    def add_combiner(value1, value2):
        """Combiner function that adds channel values.

        Returns:
            float: new value.

        Args:
            value1 (float): Value from input file 1.

            value2 (float): Value from input file 2.

        """
        return value1 + value2

    # --------------------------------------------------------------------------
    @staticmethod
    def subtract_combiner(value1, value2):
        """Combiner function that subtracts channel values.

        Returns:
            float: new value.

        Args:
            value1 (float): Value from input file 1.

            value2 (float): Value from input file 2.

        """
        return value1 - value2

    # --------------------------------------------------------------------------
    @staticmethod
    def divide_combiner(value1, value2):
        """Combiner function that divides channel values.

        Returns:
            float: new value.

        Args:
            value1 (float): Value from input file 1.

            value2 (float): Value from input file 2.

        """
        return value1 / value2

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    def _read_binary(self, bin_file_path):
        try:
            with open(bin_file_path, "rb") as bin_file:
                self.source_file = bin_file_path
                self.channel_name = os.path.splitext(
                    os.path.basename(bin_file_path)[len("SpatialReport_"):])[0]

                # read counts
                counts = bin_file.read(8)
                self.node_count, = struct.unpack("<i", counts[0:4])
                timestep_count, = struct.unpack("<i", counts[4:8])

                # read node IDs
                node_ids_data = bin_file.read(self.node_count * 4)
                node_ids = array.array("i")
                node_ids.frombytes(node_ids_data)

                # read timestep data
                self.timesteps = []
                for timestep in range(timestep_count):
                    entries = {}
                    values = array.array("f")
                    values_data = bin_file.read(self.node_count * 4)
                    values.frombytes(values_data)
                    for i in range(self.node_count):
                        value = values[i]
                        # Note: set value_min/value_max BEFORE zero check.
                        node_id = node_ids[i]
                        if node_id not in self._excluded_node_ids:
                            if value < self.value_min: self.value_min = value
                            if value > self.value_max: self.value_max = value
                        if self.drop_zeros and value == 0.0:
                            continue
                        entries[node_ids[i]] = values[i]
                    self.timesteps.append(entries)

                # make sure we didn't end up with infinities or NaNs
                self.value_min = SpatialBinary._condition_value(self.value_min)
                self.value_max = SpatialBinary._condition_value(self.value_max)
        except BaseException:
            if self._verbose:
                print("SpatialBinary._read_binary: Exception reading spatial "
                      "binary %s" % bin_file_path, file=sys.stderr)
            raise

    # --------------------------------------------------------------------------
    @staticmethod
    def _condition_value(value):
        if math.isnan(value):
            value = 0
        elif value == math.inf:
            value = sys.float_info.max
        elif value == -math.inf:
            value = sys.float_info.min
        return value
