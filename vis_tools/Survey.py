# ==============================================================================
# Survey.py - Survey a folder and create a default preprocessing script.
# ==============================================================================
"""Survey.py

Survey is a Python program that surveys a sim folder and generates a default
Vis-Tools preprocessing program for that sim. Run the output .py file and it
will generate a working (if rather plain) visset.json for the sim as a starting
point for customizations.

Note that both Survey and its generated preprocessing script is meant to be run
*from the simulation directory*.

Typical Usage::

    cd <my_sim_directory>
    survey -t [Points|Shapes]

Where:

    This usage defaults the simulation directory (-i) to . (the current
    directory). It defaults the products directory (-p) to
    ./Vis-Tools/<md5_of_script>/

    Points|Shapes (str): Optional. The type of nodes visualization desired.
    Defaults to Points if not specified.

    The resulting preprocessing script will be written to
    <my_sim_directory>/Vis-Tools/<md5_of_script>/preprocess_sim.py

    To run the preprocessing script you'd do
    cd <my_sim_directory> # if not already there
    ./Vis-Tools/<md5_of_script>/preprocess_sim.py

"""

# imports
from math import cos, pi
from builtins import range
from builtins import object
from glob import glob
from io import open
from os import path, makedirs, renames, getcwd, chdir
from shutil import rmtree
import hashlib
import time as tm
import sys
import argparse
import re
import json
from vis_tools import VisSet, Config, Demographics, SpatialReports, CSVReport


# ==============================================================================
# Surveyor
# ==============================================================================
class Surveyor(object):
    """Class to survey a sim directory for inputs and outputs.

    This class looks at a given directory that includes simulation inputs and
    outputs and collects file paths and in some cases reads the files there to
    determine key parameters such as number of timesteps and demographics.

    Public members:
        sim_dir (str): dir_path if len(dir_path) > 0 else None

        sim_id (str): simulation id if given in constructor else  None

        out_dir (str): simulation output directory if found or None

        assets_dir (str): Assets directory if found or None

        asset_map_path (str): Path to VtAssetMap.json file if found or None

        config_path (str): Config path if found or None

        config (obj): Config object read from config_path if found or None

        demographics_path_or_list (str|list): If a string, the single
        demographics file path. If a list, the array of demographics files
        referenced in the config.json.

        demographics (obj): Demographics object read from
        demographics_path_or list if found or None. If there are overlays, they
        are already applied here.

        inset_path (str): InsetChart.json path if found or None

        malaria_filtered_path (str): ReportMalariaFiltered.json path if found or
        None

        human_mig_tracking_path (str): ReportHumanMigrationTracking.csv path if
        found or None

        event_recorder_path (str): ReportEventRecorder.csv path if found or None

        spatial_reports (obj): SpatialReports object if out_dir is found or None

        timestep_count (int): Timestep count read from config.json if found or
        None

    """

    # --------------------------------------------------------------------------
    # Constants
    # --------------------------------------------------------------------------
    k_default_cesium_view_margin_fraction = 0.28
    k_min_shape_px = 2.0    # Two pixels minimum shape size by default

    # --------------------------------------------------------------------------
    def __init__(self, dir_path="", specific_demo_path=None, sim_id=None):
        """Construct a Surveyor.

        Args:
            dir_path (str): Path to directory containing sim files.
            specific_demo_path (str): If provided, Surveyor will use the
              specified demographics file instead of the one(s) noted in the
              config.json.
            sim_id (str): If provided, a simulation ID (a GUID)

        Raises:
            I/O, csv, JSON exceptions

        """
        # data members with defaults
        self.sim_dir = dir_path if len(dir_path) > 0 else None
        self.sim_id = sim_id
        self.out_dir = None
        self.assets_dir = None
        self.asset_map_path = None
        self.config_path = None
        self.config = None
        self.demographics_path_or_list = specific_demo_path
        self.demographics = None
        self.inset_path = None
        self.malaria_filtered_path = None
        self.human_mig_tracking_path = None
        self.event_recorder_path = None
        self.spatial_reports = None
        self.timestep_count = None

        # if given a directory, survey it
        if len(dir_path) > 0:
            self.survey(dir_path)

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of a Survey.

        This method allows the Survey object to report the source dir when it
        is printed.

        Returns:
            str: String containing survey directory.

        """
        return "Survey for dir '%s'" % self.sim_dir

    # --------------------------------------------------------------------------
    def _confirm_demographics_file(self, fp):
        fp_stripped = path.basename(fp)
        paths = [
            path.join(self.sim_dir, fp),
            path.join(self.sim_dir, fp_stripped)
        ]
        if self.assets_dir is not None:
            paths = paths + [
                path.join(self.assets_dir, fp),
                path.join(self.assets_dir, fp_stripped),
                path.join(self.assets_dir, "input", fp_stripped)
            ]
        for p in paths:
            if path.isfile(p):
                return p
        return None

    # --------------------------------------------------------------------------
    def survey(self, dir_path):
        """Survey the given simulation directory for input and output files.

        If a Surveyor object is passed a dir_path at construction, this method
        is called automatically. If you construct a Surveyor with no dir_path,
        you can use this method to later associate a dir_path with the Surveyor
        and cause that directory to be surveyed.

        Returns:
            None.

        Args:
            dir_path (str): Directory path to survey.

        Raises:
            I/O, csv, JSON, and custom exceptions.

        """
        if not path.isdir(dir_path):
            raise Exception("Can't survey '%s' - not a directory" % dir_path)
        self.sim_dir = dir_path

        # Look for output dir
        dr = path.join(self.sim_dir, "output")
        if path.isdir(dr):
            self.out_dir = dr

        # Look for assets dir
        dr = path.join(self.sim_dir, "Assets")
        if path.isdir(dr):
            self.assets_dir = dr

        # Look for VtAssetMap.json
        fp = path.join(self.sim_dir, "VtAssetMap.json")
        if path.isfile(fp):
            self.asset_map_path = fp

        # Look for things inside output dir
        if self.out_dir is not None:
            # InsetChart.json
            fp = path.join(self.out_dir, "InsetChart.json")
            if path.isfile(fp):
                self.inset_path = fp

            # ReportMalariaFiltered.json
            fp = path.join(self.out_dir, "ReportMalariaFiltered.json")
            if path.isfile(fp):
                self.malaria_filtered_path = fp

            # ReportHumanMigrationTracking.csv
            fp = path.join(self.out_dir, "ReportHumanMigrationTracking.csv")
            if path.isfile(fp):
                self.human_mig_tracking_path = fp

            # ReportEventRecorder.csv
            fp = path.join(self.out_dir, "ReportEventRecorder.csv")
            if path.isfile(fp):
                self.event_recorder_path = fp

            # SpatialReport*_*
            self.spatial_reports = SpatialReports(self.out_dir)

        # Look for a config.json, and if found, read it in
        fp = path.join(self.sim_dir, "config.json")
        if path.isfile(fp):
            self.config_path = fp
        elif self.assets_dir is not None:
            fp = path.join(self.assets_dir, "config.json")
            if path.isfile(fp):
                self.config_path = fp
            else:
                # Can't find a typically-named config, so use a glob and try the
                # first one we find
                configs = glob(path.join(self.sim_dir, "*config*.json"))
                if len(configs) > 0:
                    self.config_path = configs[0]
                if len(configs) > 1:
                    print("WARNING: Multiple config files found, using %s" %
                          configs[0])
        if self.config_path is not None:
            self.config = Config(self.config_path)
            self.timestep_count = self.config.get_timestep_count()

        # Look for demographics based on what we find in config
        if self.config is not None:
            if self.demographics_path_or_list is not None:
                # A demographics path was passed into Surveyor, so use that
                pass
            else:
                dem = self.config.get_demographics_filename_or_list()
                if isinstance(dem, str):
                    # Only a single demographics file is specified in the config
                    self.demographics_path_or_list =\
                        self._confirm_demographics_file(dem)
                else:
                    # A list of demographics files are specified in the config
                    self.demographics_path_or_list = []
                    for fp in dem:
                        fp = self._confirm_demographics_file(fp)
                        if fp is not None:
                            self.demographics_path_or_list.append(fp)
            if self.demographics_path_or_list is not None:
                self.demographics = Demographics(self.demographics_path_or_list)

        # If there's no output directory, make one, because lots of stuff
        # depends on its existence
        if self.out_dir is None:
            dr = path.join(self.sim_dir, "output")
            makedirs(dr)
            self.out_dir = dr

    # --------------------------------------------------------------------------
    def summary(self):
        """Print a text summary of the Surveyor object.

        This method prints a summary of the Surveyor object that includes the
        source directory, number of timesteps (if found), and number of nodes
        (if found).

        Returns:
             None. Prints to stdout.

        Args:
            None.

        """
        print("Survey of directory '%s':" % self.sim_dir)
        if self.config is not None:
            print("  Config read, timesteps = %d" %
              (self.timestep_count if self.timestep_count is not None else 0))
        if self.demographics is not None:
            print("  Demographics read, node count = %d" %
                  len(self.demographics))

    # --------------------------------------------------------------------------
    def get_event_names(self):
        """Gets a sample set of event names from the ReportEventRecorder.csv.

        This method reads the first 100 lines off the ReportEventRecorder.csv
        and returns a list of the unique event names therein. This is *not* a
        comprehensive list of all the event types in the file.

        Returns:
            set: a set of event names, or None.

        Args:
            None.

        Raises:
            I/O and csv exceptions.

        """
        if self.event_recorder_path is None:
            return None
        report = CSVReport()
        report.read_partial(self.event_recorder_path, 100)
        events = set()
        if "Event_Name" in report.header:
            for row in report.rows:
                events.add(row["Event_Name"])
        return events

    # --------------------------------------------------------------------------
    def get_node_attributes_simple_fields(self):
        """Gets the set of non-object field names from NodeAttributes,

        This method looks at the first node in the demographics file and
        collects all the field names that are simple key-value pairs. So it gets
        fields like InitialPopulation and BirthRate, but doesn't get
        InitialVectorsPerSpecies, since its value is an object. Only looks at
        the first node, so it is not technically comprehensive. It also removes
        the "known" fields of Latitude, Longitude, and Altitude.

        Returns:
            set: a set of simple field names from NodeAttributes or None.

        Args:
            None.

        """
        if self.demographics is None:
            return None
        known_fields = ("Latitude", "Longitude", "Altitude")
        node_attrs = self.demographics.Nodes[0]["NodeAttributes"]
        field_names = set()
        for key in list(node_attrs.keys()):
            if key not in known_fields and type(node_attrs[key]) is not "dict":
                field_names.add(key)
        return field_names

    # --------------------------------------------------------------------------
    def get_inset_channels(self):
        """Returns a list of channel names for inset/malaria filtered files.

        This method looks opens the InsetChart.json (if present) or the
        ReportMalariaFiltered.json (if present) and returns a list of the
        channel names that are available in the file.
        
        Returns:
            list: Channel names read from one of the inset-format files, sorted
            into alphabetical order, or None.

        Args:
            None.

        Raises:
            I/O and json exceptions.

        """
        source = self.inset_path
        if source is None:
            source = self.malaria_filtered_path
            if source is None:
                # No inset source is available
                return None
        with open(source, "r") as inset_file:
            contents = json.load(inset_file)
        return sorted(contents["Channels"].keys())

    # --------------------------------------------------------------------------
    def calc_default_shape_size(self):
        """Returns a default size for shape-based visualizations.

        For shape-based geospatial visualizations, this method calculates a
        default size in meters that will hopefully make the nodes visible at
        the default zoom in the geospatial client.

        Returns:
            float: size in meters

        Args:
            None.

        """
        if self.demographics is None:
            return 1    # No demographics, so default to 1 meter
        bbox = self.demographics.bounding_box()
        # Expand the bounding box size by the margins that the client will put
        # around the bounding box at the point of the inital zoom. We use this
        # larger bounding box to calculate the default node size.
        m_size = self._calc_bound_box_size_in_meters(bbox)
        m_size["m_width"] += m_size["m_width"] *\
            Surveyor.k_default_cesium_view_margin_fraction
        m_size["m_height"] += m_size["m_height"] *\
            Surveyor.k_default_cesium_view_margin_fraction

        # We don't know how big of a window our client will be displayed in, so
        # we can't definitively calculate meters/pixel. The smallest viewport
        # at which the client was tested is 1024x768, so we will use that for
        # our calculation.
        h_m_per_px = m_size["m_width"] / 1024.0
        v_m_per_px = m_size["m_height"] / 768.0
        m_per_px = max(h_m_per_px, v_m_per_px)
        return m_per_px * Surveyor.k_min_shape_px

    # --------------------------------------------------------------------------
    @staticmethod
    def _calc_bound_box_size_in_meters(bbox):
        lat_diff = bbox["latitudeMax"] - bbox["latitudeMin"]
        lon_diff = bbox["longitudeMax"] - bbox["longitudeMin"]
        # This is approximate, since the earth is really an oblate spheroid, and
        # this is not a true geodesic distance. But it is close enough for this
        # application.
        m_high = lat_diff * 111.32 * 1000.0     # 111.32 km/deg
        avg_lat = bbox["latitudeMin"] + lat_diff / 2.0
        avg_lat_radians = avg_lat * pi / 180.0
        m_wide = lon_diff * (40075.0 * 1000.0 * cos(avg_lat_radians) / 360.0)
        return {"m_width": m_wide, "m_height": m_high}


# ==============================================================================
# PrepMaker
# ==============================================================================
class PrepMaker(object):
    """Class to emit a preprocessor script given a Surveyor object.

    This class generates a default text python preprocessing script that
    includes sections various sections based on the surveyed contents of a
    simulation directory.

    """

    @staticmethod
    def emit(survey, nodes_type, out_file_path):
        """Emits a default text python preprocessing script.

        This method generates a default text python preprocessing script that
        includes sections various sections based on the surveyed contents of a
        simulation directory.

        Returns:
            None.

        Args:
            survey (obj): A Surveyor object for sim directory.

            nodes_type (str): "Points" or "Shapes" - nodes type to emit.

            out_file_path (str): Output python script file path.

        Raises:
            I/O exceptions.

        """
        preface = [
            "# Generated by Survey.py\n\n",
            "# This script is meant to be run from within the target \
simulation directory.\n\n",
            "import time as tm\n",
            "from os import path, getcwd\n",
            "from vis_tools import VisSet, SpatialBinary, SpatialReports\n\n",
            "# Constants\n"
        ]
        constants = [
            "\n# Appearance-related constants\n",
            "k_icon_duration_days = 2\n"
        ]
        main_1 = [
            "\n# =============================================================\
=================\n",
            "# Main program\n",
            "#\n"
            "# This Vis-Tools preprocessing program contains various useful \
examples in the\n"
            "# form of comments. Whenever possible the examples are made to \
be valid for the\n"
            "# present simulation, but in some cases you may have to \
modify the examples to\n"
            "# be valid in your context. Note that in this script \
you can override any option\n"
            "# or default value you see in defaultvisset.json.\n"
            "# ===============================================================\
===============\n",
            "if __name__ == '__main__':\n",
            "    script_start = tm.time()\n",
            "\n",
            "    # Create a default VisSet\n",
            "    vis_set = VisSet(k_name)\n",
            "\n",
            "    # Set up the VisSet\n",
            "    vis_set.set_target_client('Geospatial')\n",
            "    vis_set.set_products_directory(k_products_dir)\n",
        ]
        eliminate_elsewhere_node = [
            "\n    # Remove the 'elsewhere' node from the node stats. This \
doesn't remove the\n",
            "    # node, just leaves it out of min/max stats. Do this before \
adding the\n",
            "    # spatial binaries, so as to also exclude that node from the \
spatial stats.\n",
            "    # vis_set.exclude_node_from_stats(1001)\n"

        ]
        find_spatial_reports = [
            "\n    # Create a SpatialReports object that scans the simulation \
output directory\n",
            "    # looking for SpatialReport*_*.bin files. Later we'll add \
this to the VisSet\n",
            "    # object.\n",
            "    reports = SpatialReports(k_spatial_report_dir)\n"
        ]
        synthesize_spatial_channel = [
            "\n    # Example of creating an infected vectors count spatial \
binary by combining\n"
            "    # SpatialReport_Adult_Vectors with SpatialReport_Infectious_\
Vectors. Once\n",
            "    # created, we manually add the new report to the reports \
object\n",
            "    # def combine(a, b):\n",
            "    #     return int(a * b)\n",
            "    # print('Synthesizing Infectious Vectors Count spatial \
binary...')\n",
            "    # infected_vectors_count = SpatialBinary.combine(\n",
            "    #     path.join(k_spatial_report_dir, 'SpatialReport_Adult_\
Vectors.bin'),\n",
            "    #     path.join(k_spatial_report_dir, 'SpatialReport_\
Infectious_Vectors.bin'),\n",
            "    #     'Infectious Vectors Count',\n",
            "    #     combine)\n",
            "    # report_path = path.join(k_products_dir,\n",
            "    #     'SpatialReport_Infectious_Vectors_Count.bin')\n",
            "    # infected_vectors_count.write_binary(report_path)\n",
            "    # reports.add(report_path)\n"
        ]
        spatial_reports = [
            "\n    # Add spatial reports (also establishes timestep count)\n",
            "    vis_set.add_spatial_reports(reports)\n"
        ]
        include_spatial_reports = [
            "\n    # Include only a subset of available spatial reports. If \
you have a lot of\n",
            "    # spatial reports, you may run out of memory on the client \
side. So here you\n",
            "    # can easily decide which channels are important and include \
just those\n",
            "    # channels. All available channels are shown below, so just \
delete the lines\n",
            "    # for channels you don't care about.\n",
            "    vis_set.include_spatial_channels([\n",
        ]
        infected_human_migration = [
            "\n    # Infected human migration (do this after adding spatial \
reports)\n",
            "    vis_set.set_event_recorder(k_event_recorder_path)\n"
            "    vis_set.add_infected_human_migrations(\
k_human_migration_path)\n"
        ]
        other_overrides = [
            "\n    # Other option overrides\n"
            "    # vis_set.options['defaultBaseLayer'] = \
'ESRI National Geographic'\n"
            "    vis_set.hide_layer('heatmapVis')\n"
        ]
        example_bindings = [
            "\n    # Example bindings (NOTE: You may or may not have these \
sources available.\n",
            "    # You will have to modify these examples to utilize your \
available sources.)\n"
            "    # vis_set.add_binding('nodeVis', 'pointSize',\n",
            "    #                     'InitialPopulation', 'scale(3, 16)')\n",
            "    # vis_set.add_binding('nodeVis', 'pointColor',\n",
            "    #                     'SpatialReport_Prevalence', \
'sampleGradient()')\n",
            "    # vis_set.add_binding('heatmapVis', 'source',\n",
            "    #                     'SpatialReport_Infectious_Vectors_\
Count', 'none()')\n"
        ]
        writeout = [
            "\n    # Consistency check\n",
            "    vis_set.validate()\n",
            "\n"
            "    # Emit VisSet\n",
            "    vis_set.write_as('visset.json', k_sim_url_root)\n",
            "\n"
        ]
        epilogue = [
            "\n    # Done\n",
            "    script_end = tm.time()\n",
            "    print('\\nElapsed time %.2f seconds' % \
float(script_end - script_start))\n"
        ]
        with open(out_file_path, "w", newline="\r\n", encoding="utf-8") as f:
            f.writelines(preface)

            # Add file path constants
            f.write("k_name = path.basename(getcwd())\n")
            f.write("k_sim_dir = r'%s'\n" % survey.sim_dir)
            f.write("k_sim_output_dir = r'%s'\n" % survey.out_dir)
            f.write("k_products_dir = path.join(k_sim_dir, \
path.relpath(path.dirname(path.abspath(__file__)), getcwd()))\n")
            if isinstance(survey.demographics_path_or_list, str):
                f.write("k_demographics_path_or_list = r'%s'\n" %
                        survey.demographics_path_or_list)
            else:
                f.write("k_demographics_path_or_list = [\n")
                count = len(survey.demographics_path_or_list)
                for i in range(0, count):
                    fp = survey.demographics_path_or_list[i]
                    f.write("    r\"%s\"%s\n" %
                            (fp, "," if i < count - 1 else ""))
                f.write("]\n")
            f.write("k_sim_url_root = '/' + path.basename(getcwd()) + '/'\n")
            f.write("k_spatial_report_dir = k_sim_output_dir\n")
            if survey.asset_map_path is not None:
                f.write("k_asset_map_path = r'%s'\n" % survey.asset_map_path)
            if survey.sim_id is not None:
                f.write("k_sim_id = r'%s'\n" % survey.sim_id)

            # Add additional path constants if files are present
            if survey.config is not None:
                f.write("k_config_path = r'%s'\n" %
                        survey.config_path)
            if survey.event_recorder_path is not None:
                f.write("k_event_recorder_path = r'%s'\n" %
                        survey.event_recorder_path)
            if survey.human_mig_tracking_path is not None:
                f.write("k_human_migration_path = r'%s'\n" %
                        survey.human_mig_tracking_path)
            if survey.inset_path is not None:
                f.write("k_inset_chart_path = r'%s'\n" %
                        survey.inset_path)
            if survey.malaria_filtered_path is not None:
                f.write("k_malaria_filtered_path = r'%s'\n" %
                        survey.malaria_filtered_path)

            # Emit beginning of main program
            f.writelines(constants)
            f.writelines(main_1)

            # Emit code to set the sim_id if there is one
            if survey.sim_id is not None:
                f.write("    vis_set.set_sim_id(k_sim_id)\n")

            # Emit code to set the asset map if there is one
            if survey.asset_map_path is not None:
                f.write("    vis_set.set_asset_map_path(k_asset_map_path)\n")

            # Emit code to read config if there is one
            if survey.config is not None:
                f.write("    vis_set.set_config(k_config_path)\n")

            # Emit code to set demographics
            if isinstance(survey.demographics_path_or_list, str):
                f.write("    vis_set.set_demographics("
                        "k_demographics_path_or_list)\n")
            else:
                f.write("    vis_set.set_demographics_files("
                        "k_demographics_path_or_list)\n")

            # Emit the node representation
            f.write("    vis_set.set_node_vis_type('%s')\n" % nodes_type)

            # Emit example of omitting an 'elsewhere' node
            f.writelines(eliminate_elsewhere_node)

            # If an inset chart file is available, emit code to set it up.
            if survey.inset_path is not None:
                f.write("\n    # Inset chart\n")
                f.write("    vis_set.set_inset_chart(k_inset_chart_path)\n")

            # If a malaria filtered file is available, either emit a line to
            # use that as the inset chart (if not inset_path is present) or emit
            # a comment line to easily substitute that for the inset chart.
            if survey.malaria_filtered_path is not None:
                f.write("\n    # Inset chart\n")
                if survey.inset_path is not None:
                    # Inset chart is present, just emit a comment
                    f.write("    # vis_set.set_inset_chart(\
k_malaria_filtered_path)\n")
                else:
                    # Inset chart isn't present but malaria filtered is, so
                    # just use malaria filtered for inset
                    f.write("    vis_set.set_inset_chart(\
k_malaria_filtered_path)\n")

            # If either inset-format file is available, emit an example of
            # changing the default inset channel.
            inset_channels = survey.get_inset_channels()
            if inset_channels is not None:
                f.write("    # vis_set.options['insetCharts']\
['defaultChannelName'] =\n")
                f.write("    #     '%s'\n" %
                        inset_channels[len(inset_channels) // 2])

            f.write("\n    # Add extra NodeAttribute fields\n")
            field_names = survey.get_node_attributes_simple_fields()
            if "InitialPopulation" in field_names:
                f.write("    vis_set.add_node_field('InitialPopulation')\n")
            else:
                f.write("    # vis_set.add_node_field('InitialPopulation')\n")
            if "BirthRate" in field_names:
                f.write("    # vis_set.add_node_field('BirthRate')\n")

            # Emit code to find the spatial reports
            f.writelines(find_spatial_reports)

            # Emit an example of creating a new spatial channel by combining
            # existing channels with a combiner function, then manually adding
            # that spatial report to the reports object.
            f.writelines(synthesize_spatial_channel)

            # Emit code to add the spatial reports
            f.writelines(spatial_reports)

            # Emit example code to include specific reports. The emitted code
            # includes *all* the available reports, so the user can easily
            # delete the reports they don't want.
            if survey.spatial_reports is not None:
                f.writelines(include_spatial_reports)
                count = len(survey.spatial_reports)
                for i in range(0, count):
                    channel_name = path.splitext(path.basename(
                        survey.spatial_reports[i]))[0]
                    f.write("        '%s'%s\n" %
                            (channel_name, "," if i < count - 1 else ""))
                f.write("    ])\n")

            # If both human migration tracking and event recorder files are
            # available, emit code to make an Infected Human Migrations layer.
            if survey.human_mig_tracking_path is not None and \
                    survey.event_recorder_path is not None:
                f.writelines(infected_human_migration)

            # If there's an event recorder, get a sample set of event names and
            # emit some commented lines for making marker layers.
            if survey.event_recorder_path is not None:
                event_names = sorted(survey.get_event_names())
                if len(event_names) > 0:
                    f.write("\n    # Add event marker layers\n")
                    for i in range(0, min(2, len(event_names))):
                        event_name = event_names.pop()
                        f.write("    # vis_set.add_marker_layer('%s',\n" %
                                event_name)
                        f.write("    #                          marker=\
VisSet.k_marker_shape_triangle,\n")
                        f.write("    #                          color=\
'%s')\n" % ("green" if i == 0 else "blue"))

            # Emit code to override other visset options
            f.writelines(other_overrides)

            # Emit example bindings
            f.writelines(example_bindings)

            # Emit a default shape size binding that is enough to at least make
            # the shapes be visible (bug 3363).
            if nodes_type == "Shapes":
                f.write("    vis_set.add_binding('nodeVis', 'shapeSize',\n"
                        "                        None, 'fixed(%f)')\n" %
                        survey.calc_default_shape_size())

            # Emit the writeout section
            f.writelines(writeout)

            # Emit code to print the local URL when preprocessing is complete.
            f.write("    # Emit URL\n")
            f.write("    print('When using the standalone Vis-Tools server, \
use the following URL:')\n")
            f.write("    visset_path = path.join(k_products_dir, \
'visset.json').replace('\\\\', '/')\n")
            f.write("    visset_path = visset_path.replace('./', \
k_sim_url_root)\n")
            f.write("    print('http://localhost:8000/vistools/\
geospatial.html?set=%s' % visset_path)\n")

            # Emit the epilogue
            f.writelines(epilogue)


# ==============================================================================
# Functions
# ==============================================================================
def update_visset(visset_path, asset_map_path):
    """Updates a visset with COMPS Asset Manager URLs from an asset map.

    Returns:
        None.

    Args:
        visset_path (str): Path to visset.json file
        asset_map_path (str): Path to VtAssetMap.json file

    """
    try:
        with open(visset_path, "r") as visset_file:
            visset = json.load(visset_file)
        with open(asset_map_path, "r") as asset_map_file:
            asset_map = json.load(asset_map_file)
        VisSet.update_urls(visset, asset_map)
        with open(visset_path, "w") as visset_file:
            json.dump(visset, visset_file, indent=2)

    except BaseException:
        print("Exception adding adding asset manager URLs to visset.")
        raise


# ------------------------------------------------------------------------------
def main():
    """Main program

    Overview:
        * Parse arguments
        * Fixup sim_dir if needed
        * Make a Surveyor to survey the sim directory
        * Ensure we got node information
        * Use PrepMaker to emit the preprocessing Python program.

    """
    script_start = tm.time()

    # Parse command line
    parser = argparse.ArgumentParser(
        description="Survey generates Vis-Tools preprocessing scripts or "
                    "updates existing visset.json files with COMPS Asset "
                    "Manager URLs.",
                    usage="\n\nTo create a preprocessing script for a "
                    "simulation:\nsurvey -i <sim_dir> -o <out_py_file> -t "
                    "<Points|Shapes>\n\nTo update an existing visset.json with "
                    "Asset Manager URLS:\nsurvey -i <visset_path> -a "
                    "<asset_map_path>")
    parser.add_argument("-a", "--assetmap", dest="asset_map_path",
                        help="Path to a VtAssetMap.json file.")
    parser.add_argument("-d", "--demographics", dest="demographics_path",
                        help="Full path to demographics file.")
    parser.add_argument("-f", "--force", dest="force", default=False,
                        action="store_true",
                        help="Write new preprocessing script even if one"
                             "already exists with the same MD5.")
    parser.add_argument("-i", "--input", dest="sim_dir", default=".",
                        help="Directory containing simulation input and "
                        "output files, or to a visset.json for update.")
    parser.add_argument("-o", "--output", dest="out_file",
                        help="Output script path.")
    parser.add_argument("-p", "--products", dest="products_dir",
                        help="Directory to be used for preprocessing output "
                        "products. If not specified, <sim_dir>/output/ "
                        "will be used.")
    parser.add_argument("-s", "--simid", dest="sim_id",
                        help="Simulation ID.")
    parser.add_argument("-t", "--type", dest="node_type", default="Points",
                        choices=["points", "Points", "shapes", "Shapes"],
                        help="Value indicating node representation type.")
    parser.add_argument("-v", "--verbose", dest="verbose", default=False,
                        action="store_true",
                        help="Emit extra messages for debugging and timing.")
    parser.add_argument("-vv", "--verbose-debug", dest="debug", default=False,
                        action="store_true", help="Extra debug output.")
    opts = parser.parse_args()

    # Strip trailing '/' from opts.sim_dir if present
    opts.sim_dir = re.sub(r"(.*)/$", "\\1", opts.sim_dir)

    if opts.sim_dir is not None and opts.asset_map_path is not None:
        # Update visset.json with Asset Manager URLs
        update_visset(opts.sim_dir, opts.asset_map_path)
    else:
        # If a sim directory was provided in -i and it's not ".", then change
        # into that directory - survey is meant to be run from a sim dir.
        if opts.sim_dir is None:
            opts.sim_dir = "."
        if opts.sim_dir != ".":
            chdir(opts.sim_dir)
            opts.sim_dir = "."

        # Fix up node_type
        opts.node_type = opts.node_type.title()

        # Create a preprocessing script for a simulation
        svy = Surveyor(opts.sim_dir, opts.demographics_path,
                       opts.sim_id)
        svy.summary()

        # See if there's enough to continue
        if svy.config is None:
            print("ERROR: Valid config path required.", file=sys.stderr)
            sys.exit()
        if svy.demographics_path_or_list is None:
            print("ERROR: Valid demographics path required.", file=sys.stderr)
            sys.exit()
        if svy.timestep_count is None:
            print("ERROR: Timestep count not established.", file=sys.stderr)
            sys.exit()

        # If not otherwise provided set products dir to an isolation directory.
        # Later, after the preprocess script is generated and MD5'd we'll rename
        # the "MD5" part of the directory to have the actual MD5.
        if opts.products_dir is None:
            opts.products_dir = "./Vis-Tools/MD5"
        if not path.isdir(opts.products_dir):
            makedirs(opts.products_dir)

        # Determine output path and directory
        if opts.out_file is None:
            sim_name = opts.sim_dir
            if opts.sim_dir.startswith("."):
                sim_name = "sim"
            opts.out_file = "preprocess_%s.py" % sim_name
        if path.dirname(opts.out_file) == "":
            # If no directory was provided in -o, use the products dir
            opts.out_file = path.join(opts.products_dir, opts.out_file)

        # Emit
        if opts.out_file is None:
            sim_name = opts.sim_dir
            if opts.sim_dir.startswith("."):
                sim_name = "sim"
            opts.out_file = "preprocess_%s.py" % sim_name
        if path.dirname(opts.out_file) == "":
            # If no directory was provided in -o, use the products dir
            opts.out_file = path.join(opts.products_dir, opts.out_file)
        PrepMaker.emit(svy, opts.node_type, opts.out_file)

        # Extra debug spew
        if opts.debug:
            print("DEBUG: Survey options:")
            print(opts)
            print("DEBUG: Survey CWD: %s" % getcwd())
            print("DEBUG: Survey sim_dir: %s" % opts.sim_dir)
            print("DEBUG: Survey products_dir: %s" % opts.products_dir)
            print("DEBUG: Survey out_file: %s" % opts.out_file)
            print("DEBUG: Survey sim_dir relative to output script: %s" %
                  path.relpath(opts.sim_dir, opts.out_file))

        # Calculate MD5 and rename products directory if needed
        # IMPORTANT: The strings below that start with "Wrote:" and "Existing:"
        # must not be changed - the Worker depends on the string formats as
        # they are written here.
        hash_md5 = hashlib.md5()
        with open(opts.out_file, "rb") as script:
            for chunk in iter(lambda: script.read(1024*1024), b""):
                hash_md5.update(chunk)
        hex_digest = hash_md5.hexdigest()
        print("Script MD5: %s" % hex_digest)
        if "MD5" in opts.products_dir:
            new_products_dir = opts.products_dir.replace("MD5", hex_digest)
            if path.isdir(new_products_dir):
                if opts.force:
                    # -f option given, so nuke existing dir and use ours
                    print("Overwriting existing %s dir due to -f option." %
                          new_products_dir)
                    rmtree(new_products_dir)
                    renames(opts.products_dir, new_products_dir)
                    print("Wrote: '%s'" % path.join(new_products_dir,
                          path.basename(opts.out_file)))
                else:
                    print("WARNING: Matching vis-tools preprocessing script is "
                          "already present. Leaving existing script untouched.")
                    print("Existing: '%s'" %
                          path.join(new_products_dir,
                                    path.basename(opts.out_file)))
                    rmtree(opts.products_dir)
            else:
                renames(opts.products_dir, new_products_dir)
                print("Wrote: '%s'" % path.join(new_products_dir,
                      path.basename(opts.out_file)))
        else:
            print("Wrote: '%s'" % opts.out_file)

    # Done
    script_end = tm.time()
    if opts.verbose:
        print("Elapsed time " + repr(script_end - script_start) + " seconds.\n")


# ==============================================================================
# Main program
# ==============================================================================
if __name__ == '__main__':
    main()
