# ==============================================================================
# Demographics.py - Python wrapper for IDM demographics files
# ==============================================================================
"""Demographics.py

This class is a Python wrapper for the DTK's demographics JSON files.

Usage::
    demographics = Demographics(path.join(my_dir, "Demographics.json"))
    print demographics

"""
from __future__ import print_function

# imports
from builtins import range
from past.builtins import basestring
from builtins import object
import json
import sys
import csv
from itertools import groupby


# ==============================================================================
# Demographics - a class to hold IDM demographics
#
# Besides keeping the raw parts a demographics file, it also keeps a few useful
# collated values, such as the ranges for latitude, longitude, and population,
# and a dictionary of nodes by NodeId.
#
# Demographics looks like an array of Nodes, and you can use demo[NodeId] to get
# a node by ID, and len(demo) to get the node count.
# ==============================================================================
class Demographics(object):
    """Class to hold DTK demographics data.

    The class is constructed with the path to the demographics JSON file.
    Thereafter the public data members described below may be used to directly
    access (and modify, if desired) the resultant Python object. There are also
    accessor methods for commonly needed or calculated values.

    Additionally, since Demographics implements __len__, __iter__, __getitem__,
    and __contains__, the object can be be treated like a dictionary, e.g.::

        node = demographics[my_node_id]    # Obtain a particular node

    Public members:
        source_file (str): The path to the demographics JSON file. If the object
        is initialized from a list of overlays, source_file is the path of the
        base demographics file.

        latitude_min (float): Minimum latitude for all nodes

        latitude_max (float): Maximum latitude for all nodes

        longitude_min (float): Minimum longitude for all nodes

        longitude_max (float): Maximum longitude for all nodes

        latitude_delta_min (float): smallest non-zero difference between node
        latitude coordinates. Used to calculate the size of a bitmap that
        has sufficient resolution to discern between nodes in the vertical
        axis.

        longitude_delta_min (float): smallest non-zero difference between node
        longitude coordinates. Used to calculate the size of a bitmap that
        has sufficient resolution to discern between nodes in the horizontal
        axis.

        population_min (float): Minimum InitialPopulation for all nodes

        population_max (float): Maximum InitialPopulation for all nodes

        nodes_by_id (obj): dictionary keyed on nodeId containing node objects

        adjusted_pop_max (float): population_max but with the highest value
        removed. (DEPRECATED)

        Defaults (obj): The raw Defaults portion of the demographics file

        MetaData (obj): The raw Metadata portion of the demographics file

        NodeProperties (array): The raw NodeProperties portion of the
        demographics file

        Nodes (array): The raw Nodes portion of the demographics file

    """
    def __init__(self, file_path_or_list=None, verbose=False):
        """Construct a Demographics.

        Args:
            file_path_or_list (str|list): If a string the path to the
            demographics JSON file. If a list, the paths to the base
            demographics JSON file (the first element in the list), and paths to
            any overlay demographics files.

            verbose (bool): True for extra messaging from methods.

        Raises:
            I/O or JSON exceptions.

        """
        # data members, some of which are gleaned by processing the nodes
        self.source_file = ""
        self.latitude_min = 0
        self.latitude_max = 0
        self.longitude_min = 0
        self.longitude_max = 0
        self.latitude_delta_min = 0
        self.longitude_delta_min = 0
        self.population_min = 0
        self.population_max = 0
        self.nodes_by_id = {}
        self.adjusted_pop_max = 0

        # the bare parts of the read demographics file
        self.Defaults = {}
        self.Metadata = {}
        self.NodeProperties = []
        self.Nodes = []

        # private members
        self._verbose = verbose

        # read if file path was given
        if file_path_or_list is not None:
            self._read(file_path_or_list)

    # --------------------------------------------------------------------------
    # Constants
    # --------------------------------------------------------------------------
    k_default_node_altitude = 1

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of a Demographics.

        This method allows the Demographics object to report the source file and
        number of nodes when it is printed.

        Returns:
            str: String combining source file and number of nodes.

        """
        if self.Defaults == {}: return "(empty)"
        else: return self.source_file + ": " + repr(len(self.Nodes)) + " nodes"

    # --------------------------------------------------------------------------
    def __len__(self):
        """Returns the number of nodes in the Demographics.

        Returns:
            int: Number of nodes in self.Nodes

        """
        return len(self.Nodes)

    # --------------------------------------------------------------------------
    def __iter__(self):
        """Returns an iterator for the self.Nodes member.

        Returns:
            iterator: Iterator for self.Nodes

        """
        return self.Nodes.__iter__()

    # --------------------------------------------------------------------------
    def __getitem__(self, node_id):
        """Returns node object matching nodeId.

        Returns:
            obj: Node with given nodeId or None

        Args:
            node_id (int or string): Node id to find.

        """
        return self.nodes_by_id[int(node_id)]

    # --------------------------------------------------------------------------
    def __contains__(self, node_id):
        """Returns true if a node with the given id exists.

        Returns:
            bool: True if node with given id exists, false if not.

        Args:
            node_id (int or string): Node id to find.

        """
        return self.nodes_by_id.__contains__(int(node_id))

    # --------------------------------------------------------------------------
    def bounding_box(self, for_json=True):
        """Returns a geospatial bounding box for the nodes.

        Returns:
            obj: bounding box in either Python or Javascript style.

        Args:
            for_json (bool): If true, emits Javascript naming conventions, or
            Python conventions otherwise.

        """
        if for_json:
            return {
                "latitudeMin": self.latitude_min,
                "latitudeMax": self.latitude_max,
                "longitudeMin": self.longitude_min,
                "longitudeMax": self.longitude_max
            }
        else:
            return {
                "latitude_min": self.latitude_min,
                "latitude_max": self.latitude_max,
                "longitude_min": self.longitude_min,
                "longitude_max": self.longitude_max
            }

    # --------------------------------------------------------------------------
    def population_range(self, for_json=True):
        """Returns the range of InitialPopulation for all nodes.

        Returns:
            obj: range of population in either Python or Javascript style.

        Args:
            for_json (bool): If true, emits Javascript naming conventions, or
            Python conventions otherwise.

        """
        if for_json:
            return {
                "populationMin": self.population_min,
                "populationMax": self.population_max
            }
        else:
            return {
                "population_min": self.population_min,
                "population_max": self.population_max
            }

    # --------------------------------------------------------------------------
    def minimum_deltas(self, for_json=True):
        """Returns the minimum non-zero deltas for latitude and longitude.

        Returns:
            obj: minimum non-zero lat/long deltas in either Python or Javascript
            style.

        Args:
            for_json (bool): If true, emits Javascript naming conventions, or
            Python conventions otherwise.

        """
        if for_json:
            return {
                "latitudeDeltaMin": self.latitude_delta_min,
                "longitudeDeltaMin": self.longitude_delta_min
            }
        else:
            return {
                "latitude_delta_min": self.latitude_delta_min,
                "longitude_delta_min": self.longitude_delta_min
            }

    # --------------------------------------------------------------------------
    # Tosses out highest population value. This is super inefficient, but is
    # rarely used, since the better way to exclude the elsewhere node is to use
    # VisSet's exclude_node_from_stats method.
    # --------------------------------------------------------------------------
    def calc_adjusted_pop_max(self):
        """Removes the largest Initial Population value. (DEPRECATED)

        This function can be used to obtain the next-to-highest
        InitialPopulation value. This would be used for removing the "elsewhere"
        node in some simulations. A better way is to use the method
        VisSet.exclude_nodes_from_stats(), which allows multiple nodes and
        ensures the updated min/max are in the VisSet where they are needed.

        Returns:
            int: The adjusted maximum InitialPopulation.

        Args:
            None.

        """
        if self.adjusted_pop_max > 0:
            return self.adjusted_pop_max
        pops = []
        for node in self.Nodes:
            pops.append(node["NodeAttributes"]["InitialPopulation"])
        pops.remove(max(pops))
        self.adjusted_pop_max = max(pops)
        return self.adjusted_pop_max

    # --------------------------------------------------------------------------
    # Returns number of nodes updated with altitude
    # --------------------------------------------------------------------------
    def incorporate_altitudes(self, alt_csv):
        """Retroactively apply altitudes to the nodes.

        This function updates the nodes' altitude attribute using data from a
        CSV file. The file may have other fields, but it needs one column called
        "NodeID" and one column called "Altitude".

        Returns:
            int: number of nodes updated.

        Args:
            alt_csv (str): The file path of the CSV file with altitudes.

        Raises:
            I/O and CSV exceptions.

        """
        count = 0
        try:
            with open(alt_csv, "rb") as csv_file:
                reader = csv.DictReader(csv_file)
                for row in reader:
                    node_id = int(row["NodeID"])
                    if node_id in self.nodes_by_id:
                        self.nodes_by_id[node_id]["NodeAttributes"]["Altitude"] =\
                            float(row["Altitude"])
                        count += 1
        except BaseException:
            if self._verbose:
                print("Demographics.incorporate_altitudes: Exception reading ")
                "altitude CSV %s" % alt_csv
            raise
        return count

    # --------------------------------------------------------------------------
    def emit_nodes(self):
        """Returns an array of node objects suitable for use in the VisSet.

        You can use this function to get a trimmed-down nodes data structure
        from the Demographics object. Normally the VisSet will do this
        encapsulation for you, but this method is present if needed.

        Note that InitialPopulation, if present, is initial-capped. This is
        because users can choose to pull in extra data from NodeAttributes into
        the nodes that are cached in the VisSet, and use those for static visual
        mappings on the client side. Any fields outside of
        [nodeId|latitude|longitude|altitude] are exposed by the client as
        sources. This way the user can use the initial-capped fieldnames they're
        used to.

        Returns:
            array: An array of objects representing the nodes.

        Args:
            None.

        """
        default_initial_population =\
            self.Defaults["NodeAttributes"]["InitialPopulation"]\
                if "InitialPopulation" in self.Defaults["NodeAttributes"]\
                else None
        result = []
        for node in self.Nodes:
            rec = {
                "nodeId": node["NodeID"],
                "latitude": node["NodeAttributes"]["Latitude"],
                "longitude": node["NodeAttributes"]["Longitude"],
                "altitude": node["NodeAttributes"]["Altitude"]
            }
            if "InitialPopulation" in node["NodeAttributes"]:
                rec["InitialPopulation"] =\
                    node["NodeAttributes"]["InitialPopulation"]
            elif default_initial_population is not None:
                rec["InitialPopulation"] = default_initial_population
            result.append(rec)
        if self._verbose:
            print("Demographics.emit_nodes: Emitted %d nodes" % len(result))
        return result

    # --------------------------------------------------------------------------
    def make_index(self, node_attribute_field):
        """Returns an index from node_attribute_field to node id(s).

        This function creates an index on any field within NodeAttributes that
        maps that allows you to look up the nodes that have that node attribute.
        For example, if you nodes have a FacilityName field in NodeAttributes,
        you could do::

            index = demo.make_index("FacilityName")

        then later, to look up the node ids for a given FacilityName::

            node_ids = index["3628"]
            for id in node_ids
                print id

        Returns:
            dict<value, array<node_id>>: index

        Args:
            node_attribute_field (str): field name within NodeAttributes.

        """
        result = {}
        for node in self.Nodes:
            if node_attribute_field in node["NodeAttributes"]:
                na_value = node["NodeAttributes"][node_attribute_field]
                if na_value in result:
                    # key already exist - just add to it
                    result[na_value].add(node["NodeID"])
                else:
                    result[na_value] = [node["NodeID"]]
        return result

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    def _read_json_demographics(self, json_file_path):
        try:
            with open(json_file_path, "r") as demo_file:
                contents = json.load(demo_file)
        except BaseException:
            if self._verbose:
                print("Demographics._read_json_demographics: Exception "\
                        "reading demographics file %s" % json_file_path)
            raise

        # see if it's compiled, and if so, de-compile it
        if "StringTable" in contents:
            try:
                if self._verbose:
                    print("Decompiling compiled demographics file")
                Demographics._fixup_compiled(contents)
            except BaseException:
                if self._verbose:
                    print("Demographics._read_json_demographics: Exception "\
                            "decompiling demographics file %s" % json_file_path)
                raise
        return contents

    # --------------------------------------------------------------------------
    @staticmethod
    def _apply_defaults_to_nodes(demo):
        # Apply defaults to all the nodes in demo
        if "Defaults" not in demo: return
        for node in demo["Nodes"]:
            Demographics._deep_update(node, demo["Defaults"])

    # --------------------------------------------------------------------------
    @staticmethod
    def _make_node_index(demo):
        # Make a dictionary keyed on node ID with the node structure as value
        return {node["NodeID"]: node for node in demo["Nodes"]}

    # --------------------------------------------------------------------------
    @staticmethod
    def _merge_nodes(base, overlay):
        # For any nodes in base that are also in overlay, merge the overlay node
        # fields into the base node fields.
        node_index = Demographics._make_node_index(overlay)
        for node in base["Nodes"]:
            if node.NodeID in node_index:
                Demographics._deep_update(node, node_index[node.NodeID])

    # --------------------------------------------------------------------------
    # DTK node overlay logic:
    #   * Defaults are applied to all nodes in base demographics
    #   * Only nodes present in base demographics are actually processed by DTK
    #   * If an overlay has Defaults but no nodes, those Defaults overlay the
    #     base defaults and apply to all nodes
    #   * If an overlay has Defaults and also has nodes, those defaults only
    #     apply to the nodes in the overlay. Then those nodes overlay the nodes
    #     in the base demographics that have the same NodeIDs
    # Algorithm:
    #   * Read base demographics
    #   * Read all overlays into memory, and make two lists: one containing all
    #     the overlays with nodes, and one with no nodes
    #   * For the list of overlays that have no nodes, _deep_update the base
    #     defaults from the overlay defaults
    #   * For the list of overlays with nodes, overlay demographics to the nodes
    #     in the overlay, then overlay the overlay nodes onto the base nodes for
    #     any nodes that match by NodeID.
    # --------------------------------------------------------------------------
    def _read(self, json_file_path_or_list):
        if isinstance(json_file_path_or_list, basestring):
            # Just one file so easy
            base = self._read_json_demographics(json_file_path_or_list)
            self.source_file = json_file_path_or_list
        else:
            # We've got a list of demographics files. The first file is the base
            # demographics file, and subsequent files are overlays. Start by
            # reading the base file.
            json_file_path_or_list = list(json_file_path_or_list)
            self.source_file = json_file_path_or_list.pop(0)
            base = self._read_json_demographics(self.source_file)

            # Read all the overlays and make two lists, one with nodes, one
            # without
            overlays_with_nodes = []
            overlays_without_nodes = []
            for fp in json_file_path_or_list:
                overlay = self._read_json_demographics(fp)
                if "Nodes" in overlay:
                    overlays_with_nodes.append(overlay)
                else:
                    overlays_without_nodes.append(overlay)

            # For overlays_without_nodes, overlay their defaults over base
            for demo in overlays_without_nodes:
                if "Defaults" in demo:
                    if "Defaults" in base:
                        Demographics._deep_update(base["Defaults"],
                                              demo["Defaults"])
                    else:
                        base["Defaults"] = demo["Defaults"]

            # Now that base's Defaults are overlaid, we can incorporate the
            # defaults into base's nodes
            Demographics._apply_defaults_to_nodes(base)

            # For overlays_with_nodes, apply each overlay's Defaults to its
            # own nodes, then overlay those nodes onto base for any nodes that
            # match by NodeID
            base_node_index = Demographics._make_node_index(base)
            for demo in overlays_with_nodes:
                Demographics._apply_defaults_to_nodes(demo)
                for overlay_node in demo["Nodes"]:
                    overlay_node_id = overlay_node["NodeID"]
                    if overlay_node_id in base_node_index:
                        Demographics._deep_update(
                            base_node_index[overlay_node_id], overlay_node)

        # distribute the parts to our members
        if "Defaults" in base:
            self.Defaults = base["Defaults"]
        if "Metadata" in base:
            self.Metadata = base["Metadata"]
        if "NodeProperties" in base:
            self.NodeProperties = base["NodeProperties"]
        if "Nodes" in base:
            self.Nodes = base["Nodes"]

        # now collect some ranges from the nodes and build nodes_by_id
        first_attr = self.Nodes[0]["NodeAttributes"]
        if "InitialPopulation" in first_attr:
            self.population_min = self.population_max =\
                first_attr["InitialPopulation"]
        else:
            self.population_min = self.population_max = 0
        self.latitude_min = self.latitude_max = first_attr["Latitude"]
        self.longitude_min = self.longitude_max = first_attr["Longitude"]
        for node in self.Nodes:
            if "Altitude" not in node["NodeAttributes"]:
                node["NodeAttributes"]["Altitude"] =\
                    Demographics.k_default_node_altitude
            if "InitialPopulation" in node["NodeAttributes"]:
                pop = node["NodeAttributes"]["InitialPopulation"]
            else:
                pop = 0
            self.population_min = pop if pop < self.population_min else\
                self.population_min
            self.population_max = pop if pop > self.population_max else\
                self.population_max
            lat = node["NodeAttributes"]["Latitude"]
            lon = node["NodeAttributes"]["Longitude"]
            self.latitude_min = lat if lat < self.latitude_min else\
                self.latitude_min
            self.latitude_max = lat if lat > self.latitude_max else\
                self.latitude_max
            self.longitude_min = lon if lon < self.longitude_min else\
                self.longitude_min
            self.longitude_max = lon if lon > self.longitude_max else\
                self.longitude_max
            self.nodes_by_id[int(node["NodeID"])] = node
        self._find_min_node_distance()
        if self._verbose:
            print("Demographics._read: read %d nodes" % len(self.Nodes))

    # --------------------------------------------------------------------------
    def _find_min_node_distance(self):
        # make lists of node latitudes and longitudes. Sort, find minimum
        # non-zero delta from one to next.
        lats = []
        longs = []
        for node in self.Nodes:
            na = node["NodeAttributes"]
            lats.append(na["Latitude"])
            longs.append(na["Longitude"])
        lats.sort()
        longs.sort()
        self.latitude_delta_min = sys.maxsize
        self.longitude_delta_min = sys.maxsize
        for i in range(1, len(lats)):
            delta = abs(lats[i] - lats[i - 1])
            if delta > 0 and delta < self.latitude_delta_min:
                self.latitude_delta_min = delta
            delta = abs(longs[i] - longs[i - 1])
            if delta > 0 and delta < self.longitude_delta_min:
                self.longitude_delta_min = delta

    # --------------------------------------------------------------------------
    # Update base in-place with overlay's values. Does *not* iterate into
    # lists -- lists are replaced whole from the overlay. No return value since
    # it updates base in-place.
    #
    # Note: this method is recursive.
    # --------------------------------------------------------------------------
    @staticmethod
    def _deep_update(base, overlay):
        # Update base keys with values from overlay
        for base_key, base_value in base.items():
            if base_key not in overlay:
                # Overlay doesn't have base_key, so continue
                continue
            elif isinstance(base_value, dict):
                # The value for base_key is a dict, so we need to recurse
                Demographics._deep_update(base_value, overlay[base_key])
            else:
                # Update base's value from the overlay
                base[base_key] = overlay[base_key]
        # Add overlay keys that aren't in base
        for overlay_key, overlay_value in overlay.items():
            if overlay_key not in base:
                base[overlay_key] = overlay_value

    # --------------------------------------------------------------------------
    @staticmethod
    def _inv_map(map):
        return {v: k for k, v in map.items()}

    # --------------------------------------------------------------------------
    # Note: this method is recursive.
    # --------------------------------------------------------------------------
    @staticmethod
    def _substitute_keys(section, string_table):
        for key in list(section.keys()):
            if key in string_table:
                new_key = string_table[key]
                section[new_key] = section[key]
                section.pop(key)
                key = new_key   # So the following recursion check will work
            if isinstance(section[key], dict):
                Demographics._substitute_keys(section[key], string_table)

    # --------------------------------------------------------------------------
    @staticmethod
    def _fixup_compiled(raw):
        # fix up the keys in the object extracted from a compiled demographics
        # file.
        string_table = Demographics._inv_map(raw["StringTable"])

        # collect keys to potentially compiled sections of the demographics file
        sections = list(raw.keys())
        sections.remove("StringTable")

        # do a depth-first traversal of the raw demographics object's sections
        # replacing any keys we find in the string table.
        for section in sections:
            if isinstance(raw[section], dict):
                # Section is itself a dictionary, so recursively substitute
                # keys in there
                Demographics._substitute_keys(raw[section], string_table)
            elif isinstance(raw[section], list) and\
                    not isinstance(raw[section], basestring):
                # Section is a list, so go through all the list elements and
                # do recursive substitutions in each element that is a dict.
                for elem in raw[section]:
                    if isinstance(elem, dict):
                        Demographics._substitute_keys(elem, string_table)
