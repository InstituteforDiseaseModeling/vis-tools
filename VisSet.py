# ==============================================================================
# VisSet.py - Python wrapper for visset.json vis set
# ==============================================================================
"""VisSet.py

This class generates the visset.json file that is the input for the Vis-Tools
HTML client component. It reads defaults from a file called "defaultvisset.json"
and extends itself with that. The caller fills in some vital information and
then can overrides defaults the object with various method calls, then finally
emits the visset.json file.

Note:

    This file will eternally appear to have PEP errors in it because it makes
    reference to members that are not initially created in the constructor.
    Those members are acquired when then defaultvisset.json is read in and used
    to extend self. So these PEP errors are not actually errors.

Minimal usage::

    vis_set = VisSet("MySim")
    vis_set.set_target_client("Geospatial")
    vis_set.set_node_vis_type("Points")
    vis_set.set_output_directory("my_sim/output/")
    vis_set.set_demographics("my_sim/demographics.json")
    vis_set.add_spatial_reports(SpatialReports("my_sim/output/"))
    vis_set.validate()
    vis_set.write()

"""
from __future__ import print_function

# imports
from builtins import range
from builtins import object
import json
import copy
from os import path
import re
import sys
from Config import Config
from Demographics import Demographics
from SpatialBinary import SpatialBinary, SpatialBinaryHeader
from CSVReport import CSVReport
from CZMLWriter import CZMLWriter
from MigrationHelpers import MigrationHelpers
from datetime import date, timedelta


# ==============================================================================
# VisSet - a wrapper class for visset.json vis set files
# ==============================================================================
class VisSet(object):
    """Class that generates visset.json files.

    This class provides a friendly way to generate a customized visset.json for
    Vis-Tools various HTML clients.

    Rather than incorporating its defaults directly in code, it instead reads
    its defaults from defaultvisset.json. This important, because that same
    file is used by the HTML clients, so that the defaults for both remain in
    sync.

    VisSet extends itself from defaultvisset.json, which is to say, all of the
    fields from defaultvisset.json become part of the VisSet Python object
    itself.

    There are methods to allow easy access to some aspects of the VisSet, such
    as adding bindings, showing/hiding sections, and adding various types of
    visual layers. But the visset data structure is a public part of this object
    and it is allowable for a preprocessing script to directly poke into it
    whatever customizations are required. E.g.::

        vis_set.options["defaultBaseLayer"] = "ESRI National Geographic"
        vis_set.options["insetCharts"]["defaultChannelName"] = "Prevalence"

    Public members:
        name (str): The name (given in the constructor).

        options (obj): The options section based on the targetClient

        all keys found in defaultvisset.json

    """

    # --------------------------------------------------------------------------
    # Constants
    # --------------------------------------------------------------------------
    k_default_visset = "./defaultvisset.json"
    k_visset_file_name = "visset.json"
    k_infected_migrations_file_name = "InfectedMigrations.czml"
    k_vector_migrations_file_name = "VectorMigrations.czml"
    k_network_layer_file_name = "Network.czml"
    k_geospatial = "Geospatial"

    # For set_node_vis_type
    k_nodes_as_points = "Points"
    k_nodes_as_shapes = "Shapes"

    # For options.shapeOptions.defaultShape
    k_node_shape_square = "Square"

    # For add_marker_layer
    k_marker_shape_triangle = "Triangle"
    k_marker_shape_cross = "Cross"
    k_marker_placement_top = "Top"
    k_marker_placement_left = "Left"
    k_marker_placement_bottom = "Bottom"
    k_marker_placement_right = "Right"
    k_default_marker_duration_days = 2

    # --------------------------------------------------------------------------
    def __init__(self, name="Untitled"):
        """Construct a VisSet.

        Args:
            name (str): The name to be associated with this visset. Typically
            something descriptive, such as "Munyumbwe rampup".

        Raises:
            I/O exceptions.

        """
        # Note: If you add new internal members here, update the array of
        # members to be excluded on write in the _create_output_object method
        # at the bottom of the file.
        self._output_dir = None
        self._config = None
        self._demographics = None
        self._event_recorder = None
        self._extra_node_fields = set()
        self._excluded_nodes = set()
        self._verbose = True

        with open(VisSet.k_default_visset, "r") as default_file:
            dflt = json.load(default_file)

        # This tricky bit extends this with the fields from dflt. Since new-
        # style objects' namespace is implemented as a dictionary, we can put
        # stuff in there directly without having to implement __setitem__ etc.
        for key in list(dflt.keys()):
            self.__dict__[key] = dflt[key]
        self.name = name       # set this now, overwriting the default

        # Now set our options based on the default targetClient
        self.options = self.defaultOptions[self.targetClient]

    # --------------------------------------------------------------------------
    # Accessors
    # --------------------------------------------------------------------------
    def set_verbose(self, verbose):
        """Set whether the class emits verbose messages.

        Returns:
            None.

        Args:
            verbose (bool): True for verbose output, False for relative silence.

        """
        self._verbose = verbose
        if self._verbose:
            print("Verbose set to %r" % verbose)

    # --------------------------------------------------------------------------
    def get_output_directory(self):
        """Getter for the output directory, where visset.json will be written.

        Returns:
            str: Currently set output directory or None.

        Args:
            None.

        """
        return self._output_dir

    # --------------------------------------------------------------------------
    def get_config(self):
        """Getter for the config object.

        Returns:
            obj: Currently set Config object or None.

        Args:
            None.

        """
        return self._config

    # --------------------------------------------------------------------------
    def get_demographics(self):
        """Getter for the demographics object.

        Returns:
            obj: Currently set Demographics object or None.

        Args:
            None.

        """
        return self._demographics

    # --------------------------------------------------------------------------
    def get_event_recorder(self):
        """Getter for the event recorder object.

        Returns:
            obj: Currently set CSVReport object for event recorder, or None.

        Args:
            None.

        """
        return self._event_recorder

    # --------------------------------------------------------------------------
    def set_target_client(self, client_name):
        """Setter for the selected target client.

        This method sets the target client for the output visset. This causes
        the public member options to get overwritten with the defaults for the
        new client name. The allowable client names are provided as class
        constants.

        Returns:
            None.

        Args:
            client_name (str): "Geospatial" is the only target right now.

        """
        # Update options with defaults for this client
        self.targetClient = client_name
        self.options = self.defaultOptions[self.targetClient]
        if self._verbose:
            print("Target client set to %s" % client_name)

    # --------------------------------------------------------------------------
    def set_node_vis_type(self, node_vis_type):
        """Setter for the node visualization type.

        For the Geospatial visualization client, there are two fundamental ways
        nodes may be represented: Points and Shapes. The former are 2D dots,
        measured in pixels and always perpendicular to the eye vector, which can
        be sized and styled variously. The latter uses 3D boxes, measured in
        meters, which can be styled as well but differently from Points. This
        setter is where the caller chooses which representation they want for
        their nodes. Each node visualization type has its own suite of settings.

        The allowable node_vis_type values are provided as class constants.

        For:
            Geospatial visualization.

        Returns:
            None.

        Args:
            node_vis_type (str): "Points" or "Shapes". See constants section.

        """
        assert self.targetClient == VisSet.k_geospatial
        self.options["nodeVis"]["visType"] = node_vis_type
        if self._verbose:
            print("Node visualization type set to %s" % node_vis_type)

    # --------------------------------------------------------------------------
    def set_output_directory(self, output_directory):
        """Setter for the output directory.

        This setter must be called before write().

        Returns:
            None.

        Args:
            output_directory (str): the directory in which to write the output
            visset.json file.

        """
        self._output_dir = output_directory
        if self._verbose:
            print("Output directory set to %s" % output_directory)

    # --------------------------------------------------------------------------
    def set_demographics(self, demographics_file_path):
        """Setter for the demographics file path.

        This setter must be called before write(). The Geospatial client
        requires node locations for visualization. An internal Demographics
        object is created using the given path. If it is useful to access that
        object directly it can be obtained using the corresponding getter
        method. Note that if you have multiple demographics files (i.e.
        overlays) you can call set_demographics_files() instead.

        For:
            Geospatial visualization.

        Returns:
            None.

        Args:
            demographics_file_path (str): Path to demographics file.

        Raises:
             I/O and JSON exceptions.

        """
        # Read the demographics file
        try:
            self._demographics = Demographics(demographics_file_path)
            self.update_nodes()
            if self._verbose:
                print("Demographics read from %s with %d nodes" %\
                    (demographics_file_path, len(self._demographics)))
        except BaseException:
            print("Exception while trying to read demographics file %s" %\
                demographics_file_path)
            raise

    # --------------------------------------------------------------------------
    def set_demographics_files(self, demographics_file_list):
        """Setter for demographics from multiple overlay files.

        This setter must be called before write(). The Geospatial client
        requires node locations for visualization. An internal Demographics
        object is created using the given path. If it is useful to access that
        object directly it can be obtained using the corresponding getter
        method. Note that if you have just a single demographics file you can
        call set_demographics() instead.

        For:
            Geospatial visualization.

        Returns:
            None.

        Args:
            demographics_file_list (list): Paths to demographics files.

        Raises:
             I/O and JSON exceptions.

        """
        # Read the demographics files
        try:
            self._demographics = Demographics(demographics_file_list)
            self.update_nodes()
            if self._verbose:
                print("Demographics read from %d files with %d nodes" %\
                    (len(demographics_file_list), len(self._demographics)))
        except BaseException:
            print("Exception while trying to read demographics files.")
            raise

    # --------------------------------------------------------------------------
    def set_config(self, config_file_path):
        """Setter for config file path.

        The VisSet needs to know how many timesteps are in the simulation. This
        can be obtained from any spatial binary, or from the config. This
        method allows you to specify the path to the config.json, and the VisSet
        will read the Simulation_Duration from there. Use this method if your
        simulation does not have any spatial binaries, and you just want to look
        at the nodes.

        Note:
            If you call add_spatial_reports() and there is at least one spatial
            binary, the VisSet will obtain the timestep count from that, and you
            do not need to call set_config at all.

        Returns:
            None.

        Args:
            config_file_path (str): Path to config.json file.

        Raises:
            I/O and JSON exceptions.

        """
        try:
            self._config = Config(config_file_path)
            self.timestepCount = self._config.parameters["Simulation_Duration"]
            if self.startDate == "1970-1-1":
                self.startDate =\
                    (date.today() - timedelta(self.timestepCount)).isoformat()
            if self._verbose:
                print("Config read from %s with %d timesteps" %\
                      (config_file_path, self._config.get_timestep_count()))
        except BaseException:
            print("Exception while trying to read config file %s" %\
                  config_file_path)
            raise

    # --------------------------------------------------------------------------
    def set_event_recorder(self, event_recorder_file_path):
        """Setter for event recorder file path for marker layers.

        This setter must be called before any calls to add_marker_layer(). An
        internal CSVReport object will be created with the data at the given
        path.

        For:
            Geospatial visualization.

        Returns:
            None.

        Args:
            event_recorder_file_path (str): Path to an ReportEventRecorder.csv.

        Raises:
            I/O and csv exceptions.

        """
        try:
            self._event_recorder = CSVReport(event_recorder_file_path)
            if self._verbose:
                print("Event recorder read from %s with %d events" %\
                      (event_recorder_file_path, len(self._event_recorder)))
        except BaseException:
            print("Exception while trying to read event recorder %s" %\
                event_recorder_file_path)
            raise

    # --------------------------------------------------------------------------
    def set_inset_chart(self, inset_chart_file_path):
        """Setter for inset chart data source file.

        The Geospatial Vis-Tools client has an Inset Panel which shows inset
        chart data. Typically that data is sourced from an InsetChart.json file,
        but any file with the same format is allowable, such as
        ReportMalariaFiltered.json. This method allows the user to specify the
        source file for Insets.

        Note:
            If this method is not called with some json file path, the Inset
            Panel will not appear at all in the Geospatial client.

        Returns:
            None.

        Args:
            inset_chart_file_path (str): File path to InsetChart.json or other
            compatible file.

        """
        if not path.isfile(inset_chart_file_path):
            print("Inset file path %s could not be found." %\
                  inset_chart_file_path)
            raise ValueError("Inset file path could not be found.")
        inset_chart_file_path = inset_chart_file_path.replace("\\", "/")
        self.links["inset"] = inset_chart_file_path
        if self._verbose:
            print("Inset chart file set to %s" % inset_chart_file_path)

    # --------------------------------------------------------------------------
    def add_node_field(self, field_name):
        """Allows the caller to pull in additional fields from NodeAttributes.

        The output visset.json contains a summarized version of the nodes that
        are read from the demographics file. By default that summary includes
        latitude, longitude, and altitude if present. This method allows the
        caller to pull in any additional desired fields from NodeAttributes into
        the node summaries in the output visset.json. E.g.::

            vis_set.add_node_field("BirthRate")

        Note:
            Automatically calls update_nodes(). Caller does not need to do that.

        Returns:
            None.

        Args:
            field_name (str): The NodeAttributes field name to pull in.

        """
        self._extra_node_fields.add(field_name)
        self.update_nodes()
        if self._verbose:
            print("Added node field %s" % field_name)

    # --------------------------------------------------------------------------
    def add_spatial_reports(self, spatial_reports):
        """Adds all the spatial reports in the given SpatialReports object.

        This method adds as sources all the spatial report files referenced in
        the given SpatialReports object. Note that the current Geospatial client
        HTML loads *all* the spatial binaries it knows about into memory, so it
        may make sense to edit down the set of reports that are included. That
        can be done (subsequent to calling this method) using
        exclude_spatial_channels().

        Note:
            This method also, as a side effect, determines the number of
            timesteps in the simulation by inspecting the first spatial binary.
            As a result, if spatial binaries are provided, a config.json need
            not be added to the VisSet object.

        Returns:
            None.

        Args:
            spatial_reports (obj): the SpatialReports object to add.

        """
        if self._verbose:
            # trailing comma prevents newline
            print("Reading spatial reports and calculating data ranges: ", end=' ')
        for i in range(0, len(spatial_reports)):
            if self._verbose:
                print(".", end=' ')
            info = spatial_reports.get(i)
            # True below to drop zeros
            spatial_report = SpatialBinary(info["url"], True,
                                           self._excluded_nodes)
            extra_data = {"friendlyName": info["friendlyName"]}
            extra_data.update(spatial_report.value_range(True))  # for_json
            self._add_link("spatial", info["name"], info["url"],
                          extra_data=extra_data)
        if self._verbose:
            print()

        # If there are any spatial reports, pick the first one and read its
        # header so we know how many timesteps the sim has.
        old_timestep_count = self.timestepCount
        keys = list(self.links["spatial"].keys())
        if len(keys) > 0:
            header = SpatialBinaryHeader(self.links["spatial"][keys[0]]["url"])
            self.timestepCount = header.timestep_count
            if old_timestep_count != 0 and\
                    old_timestep_count != self.timestepCount:
                print("Timestep count read from config (%d) does not match "\
                    "timestep count in spatial binary (%d)." %\
                    (old_timestep_count, self.timestepCount))
                raise ValueError(
                    "Timestep count read from config does not "
                    "match timestep count in spatial binary")
            if self.startDate == "1970-1-1":
                self.startDate =\
                    (date.today() - timedelta(self.timestepCount)).isoformat()
        if self._verbose:
            print("Added references to %d spatial report%s" %\
                  (len(spatial_reports),
                   "" if len(spatial_reports) == 1 else "s"))

    # --------------------------------------------------------------------------
    def add_marker_layer(self, event_name, marker=None, color=None,
                         placement=None, duration=None, show=True):
        """Adds a marker animation layer to the output visset.

        This method generates a CZML animation layer that provides visual
        indication of event recorder events.

        Note:
            Call set_output_directory, set_demographics, set_event_recorder, and
            (add_spatial_channels or set_config) before calling this method.

        For:
            Geospatial visualization.

        Returns:
            None. Creates a CZML file in the VisSet's output directory.

        Args:
            event_name (str): The name of the event for which a marker layer is
            desired. It must exactly match the event name in the event
            recorder. E.g. "Received_Treatment".

            marker (str): The name of the marker image to use. "Triangle" or
            "Cross" are allowable (see constants at top of class).

            color (str): An HTML/CSS or SVG named color for the marker. E.g.
            "red" or "#ccff00"

            placement (str): The location, with respect to the node lat/log
            center, for the marker. "Top", "Left", "Bottom", or "Right" are
            allowable (see constants at top of class).

            duration (int): The duration, in timesteps for which the marker will
            remain visible after the event occurs. E.g. 2 will cause the
            marker to appear above the node on the timestep of the event,
            and remain there for two timesteps before disappearing.

            show (bool): Whether this layer will be visible by default when the
            Geospatial client loads this visset. If show is False, the layer
            CZML is still generated and loaded by the client, but the layer
            will have its checkbox unchecked (and therefore not be visible)
            in the client when the page is first loaded.

        """
        # Make sure everything we need is available
        if self.targetClient != VisSet.k_geospatial:
            print("Marker layers are only for the %s client" %\
                  VisSet.k_geospatial)
            raise ValueError("Wrong client for marker layer")
        if self._demographics is None:
            print("Demographics required for marker layer generation. Make "\
                "sure you've called set_demographics before add_marker_layer.")
            raise ValueError("Demographics required for marker layer")
        if self._event_recorder is None:
            print("Event recorder required for marker layer generation. Make "\
                "sure you've called set_event_recorder before add_marker_layer.")
            raise ValueError("Event recorder required for marker layer")
        if self._output_dir is None:
            print("Output directory must be set for marker layer generation. "\
                "Make sure you've called set_output_directory before "\
                "add_marker_layer.")
            raise ValueError("Output directory required for marker layer")
        if self.timestepCount is 0:
            print("Non-zero timestep count is required for marker layer "\
                "generation. Make sure you've called either set_config or "\
                "add_spatial_reports to establish a timestep count before "\
                "calling add_marker_layer.")
            raise ValueError("Zero timestep count generating marker layer")

        # Apply reasonable defaults
        if marker is None:
            marker = VisSet.k_marker_shape_triangle
        if color is None:
            color = "#000000"
        if placement is None:
            placement = VisSet.k_marker_placement_top
        if duration is None:
            duration = VisSet.k_default_marker_duration_days

        # Generate the layer
        try:
            czml_file = CZMLWriter()
            czml_file.set_sim_duration(self.timestepCount, emit_clock=True)
            czml_file.add_event_markers(self._event_recorder, self._demographics,
                                        event_name, marker, color, placement,
                                        duration)
            url = path.join(self._output_dir, event_name + ".czml")
            czml_file.write_czml(url)
            extra_data = {
                "legendSymbol": marker + placement,
                "legendColor": color,
                "show": show
            }
            self._add_link("czml", event_name, url, extra_data=extra_data)
            if self._verbose:
                print("Generated marker layer for event %s" % event_name)
        except BaseException:
            print("Exception generating marker layer for event %s" % event_name)
            raise

    # --------------------------------------------------------------------------
    def add_infected_human_migrations(self, human_migration_file_path):
        """Adds an infected human migrations layer to the output visset.

        Note:
            Call set_output_directory, set_demographics, set_event_recorder, and
            (add_spatial_channels or set_config) before calling this method.

        For:
            Geospatial visualization.

        Returns:
            None. Creates a CZML file in the VisSet's output directory.

        Args:
            human_migration_file_path (str): The file path to the simulation's
            ReportHumanMigrationTracking.csv file.

        To do:
            * Add arg for comet head start color
            * Add arg for comet head end color
            * Add arg for comet tail start color
            * Add arg for comet tail end color
            * Add arg for tail duration in timesteps

        """
        # Make sure everything we need is available
        if self.targetClient != VisSet.k_geospatial:
            print("Migration layer is only for the %s client" %\
                  VisSet.k_geospatial)
            raise ValueError("Wrong client for migration layer")
        if self._demographics is None:
            print("Demographics required for marker layer generation. Make "\
                "sure you've called set_demographics before add_marker_layer.")
            raise ValueError("Demographics required for marker layer")
        if self._event_recorder is None:
            print("Event recorder required for marker layer generation. Make "\
                "sure you've called set_event_recorder before add_marker_layer.")
            raise ValueError("Event recorder required for marker layer")
        if self._output_dir is None:
            print("Output directory must be set for marker layer generation. "\
                "Make sure you've called set_output_directory before "\
                "add_marker_layer.")
            raise ValueError("Output directory required for marker layer")
        if self.timestepCount is 0:
            print("Non-zero timestep count is required for marker layer "\
                "generation. Make sure you've called either set_config or "\
                "add_spatial_reports to establish a timestep count before "\
                "calling add_marker_layer.")
            raise ValueError("Zero timestep count generating marker layer")

        # Read the migration report
        try:
            human_migration = CSVReport(human_migration_file_path)
        except BaseException:
            print("Exception reading migration report %s" %\
                  human_migration_file_path)
            raise

        # Use MigrationHelpers to combine the event recorder and human migration
        # report into a structure that provides infected human migrations.
        #   mig is a Dict<timestep, inf_migs> where
        #       inf_migs is Dict<FromNodeID-ToNodeId, count>
        try:
            mig = MigrationHelpers.collate_infected_human_migrations(
                human_migration, self._event_recorder)
            self.options["migrationsVis"]["maxSimultaneousMigrations"] =\
                mig["aggregate_migrations_max"]
        except BaseException:
            print("Exception from MigrationHelpers creating infected human "\
                "migration structure.")
            raise

        # Generate the layer
        try:
            czml_file = CZMLWriter()
            czml_file.set_sim_duration(
                self.timestepCount, emit_clock=True,
                anim_step_secs=self.options["clockAnimFrameSecs"])
            czml_file.add_migrations(mig["infected_migrations"],
                 self._demographics)
            url = path.join(self._output_dir, VisSet.k_infected_migrations_file_name)
            czml_file.write_czml(url)
            self._add_link("czml", "Infected Human Migrations", url)
            if self._verbose:
                print("Generated infected human migration layer")
        except BaseException:
            print("Exception generating infected human migration layer.")
            raise

    # --------------------------------------------------------------------------
    def add_vector_migrations(self, vector_migration_path,
                              migration_duration_timesteps=2,
                              dot_color="#ba7fb7", dot_size_pixels=10,
                              path_color="#ffffff", path_thickness_pixels=2.5,
                              path_trail_time_factor=0.75):
        """Adds a vector cohort migration layer to the output visset.

        Note:
            Call set_output_directory, set_demographics, and either set_config
            or add_spatial_reports before calling this method.

        For:
            Geospatial visualization.

        Returns:
            None. Creates a CZML file in the VisSet's output directory.

        Args:
            vector_migration_path (str): The path to the
            ReportVectorMigration.csv file.

            migration_duration_timesteps (int): Number of timesteps that the
            migration animation spans.

            dot_color (string): CSS #rrggbb color for migration comet dot.

            dot_size_pixels (int): Size in pixels of comet dot.

            path_color (string): CSS #rrggbb color for migration comet tail.

            path_thickness_pixels (float): Thickness in pixels of comet tail.

            path_trail_time_factor (float): Length of trail as a multiple of
            the migration_duration. E.g. if this is 1.0, the trail length will
            be the full distance from source node to the destination node. If
            0.5, the trail length will be half the distance between the nodes.

        """
        # Make sure everything we need is available
        if self.targetClient != VisSet.k_geospatial:
            print("Migration layer is only for the %s client" %\
                  VisSet.k_geospatial)
            raise ValueError("Wrong client for migration layer")
        if self._demographics is None:
            print("Demographics required for migration layer generation. Make "\
                "sure you've called set_demographics before add_marker_layer.")
            raise ValueError("Demographics required for marker layer")
        if self._output_dir is None:
            print("Output directory must be set for migration layer "\
                "generation.  Make sure you've called set_output_directory "\
                "before add_marker_layer.")
            raise ValueError("Output directory required for migration layer")
        if self.timestepCount is 0:
            print("Non-zero timestep count is required for migration layer "\
                "generation. Make sure you've called either set_config or "\
                "add_spatial_   reports to establish a timestep count before "\
                "calling add_marker_layer.")
            raise ValueError("Zero timestep count generating migration layer")

        # Read the migration report
        try:
            vector_migrations = CSVReport(vector_migration_path)
        except BaseException:
            print("Exception reading migration report %s" %\
                  vector_migration_path)
            raise

        # Generate the layer
        try:
            czml_file = CZMLWriter()
            czml_file.set_sim_duration(self.timestepCount, emit_clock=True,
                anim_step_secs=self.options["clockAnimFrameSecs"])
            czml_file.add_vector_migrations(vector_migrations,
                                            self._demographics,
                                            migration_duration_timesteps,
                                            dot_color, dot_size_pixels,
                                            path_color, path_thickness_pixels,
                                            path_trail_time_factor)
            url = path.join(self._output_dir,
                            VisSet.k_vector_migrations_file_name)
            czml_file.write_czml(url)
            self._add_link("czml", "Vector Cohort Migrations", url)
            if self._verbose:
                print("Generated vector cohort migration layer")
        except BaseException:
            print("Exception generating vector cohort migration layer.")
            raise

    # --------------------------------------------------------------------------
    def add_simplified_vector_migrations(self, vector_migration_path,
                                         migration_duration_timesteps=2,
                                         arrow_color="#ffffff",
                                         arrow_thickness_pixels=2):
        """Adds a simplified vector cohort migration layer to the output visset.

        Note:
            Call set_output_directory, set_demographics, and either set_config
            or add_spatial_reports before calling this method.

        For:
            Geospatial visualization.

        Returns:
            None. Creates a CZML file in the VisSet's output directory.

        Args:
            vector_migration_path (str): The path to the
            ReportVectorMigration.csv file.

            migration_duration_timesteps (int): Number of timesteps that the
            migration animation spans.

            arrow_color (string): CSS #rrggbb color for migration arrow.

            arrow_thickness_pixels (float): Thickness in pixels of arrow.

        """
        # Make sure everything we need is available
        if self.targetClient != VisSet.k_geospatial:
            print("Migration layer is only for the %s client" %\
                  VisSet.k_geospatial)
            raise ValueError("Wrong client for migration layer")
        if self._demographics is None:
            print("Demographics required for migration layer generation. Make "\
                "sure you've called set_demographics before add_marker_layer.")
            raise ValueError("Demographics required for marker layer")
        if self._output_dir is None:
            print("Output directory must be set for migration layer "\
                "generation.  Make sure you've called set_output_directory "\
                "before add_marker_layer.")
            raise ValueError("Output directory required for migration layer")
        if self.timestepCount is 0:
            print("Non-zero timestep count is required for migration layer "\
                "generation. Make sure you've called either set_config or "\
                "add_spatial_   reports to establish a timestep count before "\
                "calling add_marker_layer.")
            raise ValueError("Zero timestep count generating migration layer")

        # Read the migration report
        try:
            vector_migrations = CSVReport(vector_migration_path)
        except BaseException:
            print("Exception reading migration report %s" %\
                  vector_migration_path)
            raise

        # Generate the layer
        try:
            czml_file = CZMLWriter()
            czml_file.set_sim_duration(self.timestepCount, emit_clock=True,
                anim_step_secs=self.options["clockAnimFrameSecs"])
            czml_file.add_simplified_vector_migrations(vector_migrations,
                                            self._demographics,
                                            migration_duration_timesteps,
                                            arrow_color, arrow_thickness_pixels)
            url = path.join(self._output_dir,
                            VisSet.k_vector_migrations_file_name)
            czml_file.write_czml(url)
            self._add_link("czml", "Vector Cohort Migrations", url)
            if self._verbose:
                print("Generated vector cohort migration layer")
        except BaseException:
            print("Exception generating vector cohort migration layer.")
            raise

    # --------------------------------------------------------------------------
    def add_binding(self, vis_section, sink_name, source_name, func):
        """Add a binding between a data source and a visualization sink.

        This method lets you add a binding between a visualization sink (e.g.
        point node color) and a data source (e.g. a spatial report) through a
        binding function (e.g. "scale(3, 20)"). Such bindings will be preset in
        the client page when it is first presented from the visset.

        Note:
            The available sinks vary depending on target client, and within a
            target client, on other factors. For example, there is one set of
            sinks for "Points" node representation, and a different set of sinks
            for "Shapes" node representation. You can see the list of sinks by
            inspecting the defaultvisset.json file.

        Note:
            The correctness of the functions provided in the func argument is
            not validated here. If the caller makes an error in the syntax of
            the function string, the errant string will still end up in the
            output visset.json. When the client loads the visset, the binding
            will throw an exception and the client will show an error message.

        Returns:
            bool: True if the binding was set, or False if the sink could not
            be found.

        Args:
            vis_section (str): The visualization section of the visset.json
            file. For the Geospatial client, valid values for vis_section
            are "nodeVis" or "heatmapVis". Other clients will have other
            visualization sections. See defaultvisset.json.

            sink_name (str): The name of the sink to which to bind. E.g.
            "shapeExtrusion".

            source_name (str): The name of the data source to which to bind.
            E.g. "SpatialReport_Prevalence" or "BirthRate"

            func (str): The function to use on the binding. The details of
            function syntax are documented elsewhere, but in general this
            may be "none()", some built-in function e.g. "scale(3, 20)", or
            a custom Javascript function body, e.g.::

                "{ return 1.0 - binding.value; }"

        """
        sink = None
        opts = self.__dict__["options"]
        if "sinks" in opts[vis_section] and\
                sink_name in opts[vis_section]["sinks"]:
            sink = opts[vis_section]["sinks"][sink_name]
        else:
            keys = list(opts[vis_section].keys())
            for key in keys:
                if "sinks" in opts[vis_section][key] and\
                        sink_name in opts[vis_section][key]["sinks"]:
                    sink = opts[vis_section][key]["sinks"][sink_name]
                    break
        if sink is None:
            print("Sink %s not found in %s." % (sink_name, vis_section))
            return False
        else:
            sink["source"] = source_name
            sink["function"] = func
            if self._verbose:
                print("Binding added for %s.%s" % (vis_section, sink_name))
            return True

    # --------------------------------------------------------------------------
    @staticmethod
    def opacity_one(weight, norm_weight):
        return 1

    # --------------------------------------------------------------------------
    def add_weighted_network_layer(self, network, gradient_spec,
                                   layer_name="Network",
                                   layer_file_name="Network",
                                   opacity_func=opacity_one):
        """Adds a weighted network visualization layer to the output visset.

        This method generates a CZML layer that provides a visual representation
        of a weighted network between nodes.

        Note:
            Call set_output_directory and set_demographics before calling this
            method.

        For:
            Geospatial visualization.

        Returns:
            None. Creates a CZML file in the VisSet's output directory.

        Args:
            network (array): array of objects::

                {
                    from: <from-node-id>,
                    to: <to-node-id>,
                    weight: <float-weight>
                }

            gradient_spec (str): gradient spec for a gradient with which to
            color the network lines.

            layer_name (str): Layer name (to be displayed in the client UI).l

            layer_file_name (str): The layer base name for the output file. For
            example, "Network" results in an output file called "Network.czml".

            opacity_func (function): function(weight, norm_weight) that returns
            the desired opacity in range [0,1].

        """
        # Make sure everything we need is available
        if self._demographics is None:
            print("Demographics required for network layer generation. Make "\
                "sure you've called set_demographics before add_network_layer.")
            raise ValueError("Demographics required for network layer")

        # Generate the layer
        try:
            czml_file = CZMLWriter()
            count = czml_file.add_weighted_network(self._demographics, network,
                                                   gradient_spec, opacity_func)
            url = path.join(self._output_dir, layer_file_name + ".czml")
            czml_file.write_czml(url)
            self._add_link("czml", layer_name, url)
            if self._verbose:
                print("Generated network layer with %d paths." % count)
        except BaseException:
            print("Exception generating network layer.")
            raise

    # --------------------------------------------------------------------------
    def show_layer(self, vis_section):
        """Sets a layer to be shown by default in the output visset.json.

        This method lets the caller set that the particular visualization
        section is shown by default when the visset is loaded by the client.

        Returns:
            None.

        Args:
            vis_section (str): The visualization section of the visset.json
            file. For the Geospatial client, valid values for vis_section
            are "nodeVis" or "heatmapVis". Other clients will have other
            visualization sections. See defaultvisset.json.

        """
        opts = self.__dict__["options"]
        if vis_section in opts:
            opts[vis_section]["show"] = True
        else:
            print("Visualization section %s not found." % vis_section)
        if self._verbose:
            print("Set %s to shown" % vis_section)

    # --------------------------------------------------------------------------
    def hide_layer(self, vis_section):
        """Sets a layer to be hidden by default in the output visset.json.

        This method lets the caller set that the particular visualization
        section is hidden by default when the visset is loaded by the client.
        Note that all the data and bindings for that visualization section are
        still created and emitted to the visset...only their default visibility
        is affected.

        Returns:
            None.

        Args:
            vis_section (str): The visualization section of the visset.json
            file. For the Geospatial client, valid values for vis_section
            are "nodeVis" or "heatmapVis". Other clients will have other
            visualization sections. See defaultvisset.json.

        """
        opts = self.__dict__["options"]
        if vis_section in opts:
            opts[vis_section]["show"] = False
        else:
            print("Visualization section %s not found." % vis_section)
        if self._verbose:
            print("Set %s to hidden" % vis_section)

    # --------------------------------------------------------------------------
    def exclude_spatial_channels(self, spatial_channel_names):
        """Exclude named channels from the list of binding sources.

        Allows caller to exclude a set of spatial channels from showing up as
        sources for visualization bindings. This would primarily be done to
        reduce the memory pressure (or load time) of the client page, since all
        the source spatial binaries have to be loaded into memory on the client
        side. All this really does is set show=False in the link, which excludes
        the source on the client side.

        Note:
            Call add_spatial_reports() before calling this method.

        Returns:
            None.

        Args:
            spatial_channel_names (list): a list or array of spatial channel
            names. If only one channel is to be excluded, enclose it in
            parens or [] so that it is iterable. E.g.::

                exclude_spatial_channels(["SpatialReport_Adult_Vectors"])

        """
        for channel_name in spatial_channel_names:
            self.links["spatial"][channel_name]["show"] = False
        if self._verbose:
            print("Excluding %d spatial channel%s" %\
                  (len(spatial_channel_names),
                   "" if len(spatial_channel_names) == 1 else "s"))

    # --------------------------------------------------------------------------
    def include_spatial_channels(self, spatial_channel_names):
        """Include (only) named channels in the list of binding sources.

        Allows caller to include a subset of the available spatial channels as
        the list of possible sources for visualization bindings. This would
        primarily be done to reduce the memory pressure (or load time) of the
        client page, since all the source spatial binaries have to be loaded
        into memory on the client side. All this really does is set the
        specified channels to show=True and all the rest to show=False.

        Note:
            Call add_spatial_reports() before calling this method.

        Returns:
            None.

        Args:
            spatial_channel_names (list): a list or array of spatial channel
            names. If only one channel is to be excluded, enclose it in
            parens or [] so that it is iterable  e. E.g.::

                include_spatial_channels(["SpatialReport_Adult_Vectors"])

        """
        for channel_name in self.links["spatial"]:
            self.links["spatial"][channel_name]["show"] =\
                channel_name in spatial_channel_names
        if self._verbose:
            print("Including %d spatial channel%s" %\
                  (len(spatial_channel_names),
                   "" if len(spatial_channel_names) == 1 else "s"))

    # --------------------------------------------------------------------------
    # Excludes any number of nodes from min/max stats. This may be used to
    # keep an outlier node from skewing the visuals.
    # --------------------------------------------------------------------------
    def exclude_nodes_from_stats(self, node_id_array):
        """Excludes a set of nodes from node min/max statistics.

        This method lets the caller specify a list of node ids that should be
        excluded from the min/max calculations data channels. This includes both
        static sources (e.g. NodeAttributes.InitialPopulation) and spatial
        reports (e.g. SpatialReport_Population). This is typically used to drop
        an outlier from the data set to avoid visually skewing the output
        visualization. For example, one might exclude the "elsewhere" node,
        which typically has extraordinary population, prevalence, etc. in a
        simulation that incorporates external migration.

        Note:
            The node itself is not eliminated - it will still be visually
            represented, but it will have a value that may lie outside the min/
            max range calculated for a given source. The client will clamp the
            value at visualization time.

        Note:
            This method calls update_nodes...the caller need not do that.

        Returns:
             None.

        Args:
            node_id_array (list): a list or array of node id's to be excluded.
            If only a single node is to be excluded, enclose it in parens or
            [] so that it is iterable, e.g.::

                exclude_nodes_from_stats([10001])

            or just call exclude_node_from_stats()

        """
        self._excluded_nodes.update(node_id_array)
        self.update_ranges()
        if self._verbose:
            print("Excluded %d node%s from statistics" %\
                  (len(node_id_array), "" if len(node_id_array) == 1 else "s"))

    # --------------------------------------------------------------------------
    def exclude_node_from_stats(self, node_id):
        """Exclude a node from node min/max statistics.

        This method is exactly exclude_nodes_from_stats but for a single node
        id. See that method for details.

        Returns:
            None.

        Args:
            node_id (int): Node id to exclude from stats.

        """
        self.exclude_nodes_from_stats([node_id])
        # The above call emits a verbose message so no message is needed here.

    # --------------------------------------------------------------------------
    def update_nodes(self):
        """Updates the local summarized nodes from the Demographics source.

        This method forces the VisSet object to refresh its summarized copy of
        the node data that it will later include in the written visset.json.
        Use this method if you change the data in the Demographics object and
        want those changes reflected in the output visset.json.

        Returns:
            None.

        Args:
            None.

        """
        # Populate nodes
        self.nodes = []
        for node in self._demographics.Nodes:
            local_node = {
                "longitude": node["NodeAttributes"]["Longitude"],
                "latitude": node["NodeAttributes"]["Latitude"],
                "altitude": node["NodeAttributes"]["Altitude"]
                if "Altitude" in node["NodeAttributes"]
                else self.options["defaultAltitudeM"],
                "nodeId": node["NodeID"],
            }
            # Add extra fields
            extra = {}
            for extra_field in self._extra_node_fields:
                # If node has the field, take it from there
                if extra_field in node["NodeAttributes"]:
                    extra[extra_field] = node["NodeAttributes"][extra_field]
                elif extra_field in \
                        self._demographics.Defaults["NodeAttributes"]:
                    extra[extra_field] = self._demographics. \
                        Defaults["NodeAttributes"][extra_field]
            local_node.update(extra)
            self.nodes.append(local_node)

        # Population nodeInfo
        self.update_ranges()
        self.nodeInfo.update(self._demographics.minimum_deltas(True))
        self.nodeInfo.update(self._demographics.bounding_box(True))

    # --------------------------------------------------------------------------
    def update_ranges(self):
        """Updates the local min/max values for extra node fields.

        This method updates the local min/max values that are calculated and
        later emitted into the visset.json file. Use this method if you change
        the values in the Demographics object.

        Returns:
            None.

        Args:
            None.

        """
        ranges = {}
        for extra_field in self._extra_node_fields:
            ranges[extra_field] =\
                {"min": sys.float_info.max, "max": sys.float_info.min}
        for node in self.nodes:
            if node["nodeId"] in self._excluded_nodes:
                continue
            for extra_field in self._extra_node_fields:
                val = node[extra_field]
                ranges[extra_field]["min"] =\
                    val if val < ranges[extra_field]["min"] \
                    else ranges[extra_field]["min"]
                ranges[extra_field]["max"] =\
                    val if val > ranges[extra_field]["max"]\
                    else ranges[extra_field]["max"]
        self.nodeInfo["ranges"].update(ranges)

    # --------------------------------------------------------------------------
    def validate(self):
        """Validate the settings in the visset to ensure their validity.

        This function validates the visset to increase the chances of it working
        correctly when brought into the client.

        Returns:
            None.

        Args:
            None.

        To do:
            * Validate targetClient

            * Validate nodeVis.visType

            * Validate that self.nodes is populated

            * Validate that self.timestepCount and startDate are populated

            * Try to guess whether the list of spatial binaries is too big to
              be loaded on the client side

            * Validate binding sources have show=true

            * Validate binding functions to the extent possible

            * Validate that the inset chart file is a JSON and contains the
              expected keys

        """
        # print "Validate is not implemented."
        pass

    # --------------------------------------------------------------------------
    def write(self):
        """Write the customized VisSet object to a visset.json file in output.

        This method is called after the caller has made all their additions and
        modifications to the default visset to write a visset.json file to the
        output directory.

        Returns:
            None. Writes a "visset.json" file to the VisSet's output directory.

        Args:
            None.

        Raises:
            I/O and JSON exceptions.

        """
        self.write_as(VisSet.k_visset_file_name)
        # The above call emits verbose messages so none are needed here

    # --------------------------------------------------------------------------
    def write_as(self, file_name):
        """Write the customized VisSet object to a specified JSON file.

        This method is called after the caller has made all their additions and
        modifications to the default visset to write a JSON file with the given
        name to the output directory.

        Returns:
            None. Writes a JSON file to the VisSet's output directory.

        Args:
            file_name (str): The file name to use for the output visset JSON
            file.

        Raises:
            I/O and JSON exceptions.

        """
        if self._output_dir is None:
            print("Output directory must be set before write is called.")
            raise ValueError("No output directory at write call")
        try:
            fp = path.join(self._output_dir, file_name)
            output_object = self._create_output_object()
            with open(fp, "w") as json_file:
                json.dump(output_object, json_file, indent=2)
        except BaseException:
            print("Exception writing %s" % file_name)
            raise

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    @staticmethod
    def _make_friendly_name(name):
        uncamel = re.compile("([a-z])([A-Z])")
        name = uncamel.sub("\\1 \\2", name)
        name = name.replace("_", " ")
        return name

    # --------------------------------------------------------------------------
    def _create_output_object(self):
        assert self._output_dir is not None
        excluded_keys = ("_output_dir", "_config", "_demographics",
                         "_event_recorder", "_extra_node_fields",
                         "_excluded_nodes", "_verbose", "defaultOptions")
        keys = list(self.__dict__.keys())
        result = {}
        for key in keys:
            if key not in excluded_keys:
                result[key] = copy.deepcopy(self.__dict__[key])
        return result

    # --------------------------------------------------------------------------
    def _add_link(self, category, name, url, extra_data=None):
        if extra_data is None:
            extra_data = {}
        url = url.replace("\\", "/")
        self.links[category][name] = {"url": url, "show": True}
        if "friendlyName" not in extra_data:
            extra_data["friendlyName"] = self._make_friendly_name(name)
        self.links[category][name].update(extra_data)
