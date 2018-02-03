# ==============================================================================
# Survey.py - Survey a folder and create a default preprocessing script.
# ==============================================================================
"""Survey.py

Survey is a Python program that surveys a sim folder and generates a default
Vis-Tools preprocessing program for that sim. Run the output .py file and it
will generate a working (if rather plain) visset.json for the sim as a starting
point for customizations.

Usage::

    python Survey.py -i sim_dir -o prep_file -t [Points|Shapes]

Where:

    directory_containing_sim (str): Required. The directory containing the sim's
    input and output files.

    Points|Shapes (str): Optional. The type of nodes visualization desired.
    Defaults to Points if not specified.

To do:
    * Add a -i that emits detailed information about the sim instead of writing
      the default preprocessing script. (-i and -o are mutually exclusive)

        * Static sources
        * Dynamic sources
        * Inset channels

    * Handle multiple demographics files including overlays

"""

# imports
from __future__ import print_function
from builtins import range
from past.builtins import basestring
from builtins import object
from io import open
from os import path, mkdir
import time as tm
import sys
import argparse
import re
import json
from Config import Config
from Demographics import Demographics
from SpatialReports import SpatialReports
from CSVReport import CSVReport


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

        out_dir (str): output directory if found or None

        assets_dir (str): Assets directory if found or None

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
    def __init__(self, dir_path="", specific_demo_path=None):
        """Construct a Surveyor.

        Args:
            dir_path (str): Path to directory containing sim files.
            specific_demo_path (str): If provided, Surveyor will use the
              specified demographics file instead of the one(s) noted in the
              config.json.

        Raises:
            I/O, csv, JSON exceptions

        """
        # data members with defaults
        self.sim_dir = dir_path if len(dir_path) > 0 else None
        self.out_dir = None
        self.assets_dir = None
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
        if path.isfile(path.join(self.sim_dir, fp)):
            return path.join(self.sim_dir, fp)
        elif path.isfile(path.join(self.sim_dir, fp_stripped)):
            return path.join(self.sim_dir, fp_stripped)
        elif self.assets_dir is not None and \
                path.isfile(path.join(self.assets_dir, fp)):
            return path.join(self.assets_dir, fp)
        elif self.assets_dir is not None and \
                path.isfile(path.join(self.assets_dir, fp_stripped)):
            return path.join(self.assets_dir, fp_stripped)
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

            # SpatialReport_*
            self.spatial_reports = SpatialReports(self.out_dir)

        # Look for a config.json, and if found, read it in
        fp = path.join(self.sim_dir, "config.json")
        if path.isfile(fp):
            self.config_path = fp
            self.config = Config(fp)
            self.timestep_count = self.config.get_timestep_count()

        # Look for demographics based on what we find in config
        if self.config is not None:
            if self.demographics_path_or_list is not None:
                # A demographics path was passed into Surveyor, so use that
                pass
            else:
                dem = self.config.get_demographics_filename_or_list()
                if isinstance(dem, basestring):
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
            mkdir(dr)
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
            print("  Config read, timesteps = %d" % self.timestep_count)
        if self.demographics is not None:
            print("  Demographics read, node count = %d" %\
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
            u"# Generated by Survey.py\n\n",
            u"from __future__ import print_function\n",
            u"import time as tm\n",
            u"from os import path\n",
            u"from VisSet import VisSet\n",
            u"from SpatialBinary import SpatialBinary\n",
            u"from SpatialReports import SpatialReports\n\n",
            u"# Constants\n"
        ]
        constants = [
            u"\n# Appearance-related constants\n"
            u"k_icon_duration_days = 2\n"
        ]
        main_1 = [
            u"\n# =============================================================\
=================\n",
            u"# Main program\n",
            u"#\n"
            u"# This Vis-Tools preprocessing program contains various useful \
examples in the\n"
            u"# form of comments. Whenever possible the examples are made to \
be valid for the\n"
            u"# present simulation, but in some cases you may have to \
modify the examples to\n"
            u"# be valid in your context. Note that in this script \
you can override any option\n"
            u"# or default value you see in defaultvisset.json.\n"
            u"# ===============================================================\
===============\n",
            u"if __name__ == '__main__':\n",
            u"    script_start = tm.time()\n",
            u"\n",
            u"    # Create a default VisSet\n",
            u"    vis_set = VisSet(k_name)\n",
            u"\n",
            u"    # Set up the VisSet\n",
            u"    vis_set.set_target_client('Geospatial')\n",
            u"    vis_set.set_output_directory(k_out_dir)\n",
        ]
        eliminate_elsewhere_node = [
            u"\n    # Remove the 'elsewhere' node from the node stats. This \
doesn't remove the\n",
            u"    # node, just leaves it out of min/max stats. Do this before \
adding the\n",
            u"    # spatial binaries, so as to also exclude that node from the \
spatial stats.\n",
            u"    # vis_set.exclude_node_from_stats(1001)\n"

        ]
        synthesize_spatial_channel = [
            u"\n    # Example of creating an infected vectors count spatial \
binary by combining\n"
            u"    # SpatialReport_Adult_Vectors with SpatialReport_Infectious_\
Vectors\n",
            u"    # def combine(a, b):\n",
            u"    #     return int(a * b)\n",
            u"    # print('Synthesizing Infectious Vectors Count spatial \
binary...')\n",
            u"    # infected_vectors_count = SpatialBinary.combine(\n",
            u"    #     path.join(k_spatial_report_dir, 'SpatialReport_Adult_\
Vectors.bin'),\n",
            u"    #     path.join(k_spatial_report_dir, 'SpatialReport_\
Infectious_Vectors.bin'),\n",
            u"    #     'Infectious Vectors Count',\n",
            u"    #     combine)\n",
            u"    # infected_vectors_count.write_binary(path.join(\
k_spatial_report_dir,\n",
            u"    #     'SpatialReport_Infectious_Vectors_Count.bin'))\n",
        ]
        spatial_reports = [
            u"\n    # Add spatial reports (also establishes timestep count)\n",
            u"    vis_set.add_spatial_reports(SpatialReports(\
k_spatial_report_dir))\n"
        ]
        include_spatial_reports = [
            u"\n    # Include only a subset of available spatial reports. If \
you have a lot of\n",
            u"    # spatial reports, you may run out of memory on the client \
side. So here you\n",
            u"    # can easily decide which channels are important and include \
just those\n",
            u"    # channels. All available channels are shown below, so just \
delete the lines\n",
            u"    # for channels you don't care about.\n",
            u"    vis_set.include_spatial_channels([\n",
        ]
        infected_human_migration = [
            u"\n    # Infected human migration (do this after adding spatial \
reports)\n",
            u"    vis_set.set_event_recorder(k_event_recorder_path)\n"
            u"    vis_set.add_infected_human_migrations(\
k_human_migration_path)\n"
        ]
        other_overrides = [
            u"\n    # Other option overrides\n"
            u"    # vis_set.options['defaultBaseLayer'] = \
'ESRI National Geographic'\n"
            u"    vis_set.hide_layer('heatmapVis')\n"
        ]
        example_bindings = [
            u"\n    # Example bindings (NOTE: You may or may not have these \
sources available.\n",
            u"    # You will have to modify these examples to utilize your \
available sources.)\n"
            u"    # vis_set.add_binding('nodeVis', 'pointSize',\n",
            u"    #                     'InitialPopulation', 'scale(3, 16)')\n",
            u"    # vis_set.add_binding('nodeVis', 'pointColor',\n",
            u"    #                     'SpatialReport_Prevalence', \
'sampleGradient()')\n",
            u"    # vis_set.add_binding('heatmapVis', 'source',\n",
            u"    #                     'SpatialReport_Infectious_Vectors_\
Count', 'none()')\n"
        ]
        writeout = [
            u"\n    # Consistency check\n",
            u"    vis_set.validate()\n",
            u"\n"
            u"    # Emit VisSet\n",
            u"    vis_set.write_as('visset.json')\n",
            u"\n"
        ]
        epilogue = [
            u"\n    # Done\n",
            u"    script_end = tm.time()\n",
            u"    print('\\nElapsed time %.2f seconds' % \
float(script_end - script_start))\n"
        ]
        with open(out_file_path, "w", newline="\r\n", encoding="utf-8") as f:
            f.writelines(preface)

            # Add file path constants
            f.write(u"k_name = r'%s'\n" % survey.sim_dir)
            f.write(u"k_dir = r'%s'\n" % survey.sim_dir)
            f.write(u"k_out_dir = r'%s'\n" % survey.out_dir)
            if isinstance(survey.demographics_path_or_list, basestring):
                f.write(u"k_demographics_path_or_list = r'%s'\n" %
                        survey.demographics_path_or_list)
            else:
                f.write(u"k_demographics_path_or_list = [\n")
                count = len(survey.demographics_path_or_list)
                for i in range(0, count):
                    fp = survey.demographics_path_or_list[i]
                    f.write(u"    r\"%s\"%s\n" %
                            (fp, u"," if i < count - 1 else u""))
                f.write(u"]\n")
            f.write(u"k_spatial_report_dir = k_out_dir\n")

            # Add additional path constants if files are present
            if survey.config is not None:
                f.write(u"k_config_path = r'%s'\n" %
                        survey.config_path)
            if survey.event_recorder_path is not None:
                f.write(u"k_event_recorder_path = r'%s'\n" %
                        survey.event_recorder_path)
            if survey.human_mig_tracking_path is not None:
                f.write(u"k_human_migration_path = r'%s'\n" %
                        survey.human_mig_tracking_path)
            if survey.inset_path is not None:
                f.write(u"k_inset_chart_path = r'%s'\n" %
                        survey.inset_path)
            if survey.malaria_filtered_path is not None:
                f.write(u"k_malaria_filtered_path = r'%s'\n" %
                        survey.malaria_filtered_path)

            # Emit beginning of main program
            f.writelines(constants)
            f.writelines(main_1)

            # Emit code to read config if there is one
            if survey.config is not None:
                f.write(u"    vis_set.set_config(k_config_path)\n")

            # Emit code to set demographics
            if isinstance(survey.demographics_path_or_list, basestring):
                f.write(u"    vis_set.set_demographics(k_demographics_path_or_list)\n")
            else:
                f.write(u"    vis_set.set_demographics_files(k_demographics_path_or_list)\n")

            # Emit the node representation
            f.write(u"    vis_set.set_node_vis_type('%s')\n" % nodes_type)

            # Emit example of omitting an 'elsewhere' node
            f.writelines(eliminate_elsewhere_node)

            # If an inset chart file is available, emit code to set it up.
            if survey.inset_path is not None:
                f.write(u"\n    # Inset chart\n")
                f.write(u"    vis_set.set_inset_chart(k_inset_chart_path)\n")

            # If a malaria filtered file is available, either emit a line to
            # use that as the inset chart (if not inset_path is present) or emit
            # a comment line to easily substitute that for the inset chart.
            if survey.malaria_filtered_path is not None:
                f.write(u"\n    # Inset chart\n")
                if survey.inset_path is not None:
                    # Inset chart is present, just emit a comment
                    f.write(u"    # vis_set.set_inset_chart(\
k_malaria_filtered_path)\n")
                else:
                    # Inset chart isn't present but malaria filtered is, so
                    # just use malaria filtered for inset
                    f.write(u"    vis_set.set_inset_chart(\
k_malaria_filtered_path)\n")

            # If either inset-format file is available, emit an example of
            # changing the default inset channel.
            inset_channels = survey.get_inset_channels()
            if inset_channels is not None:
                f.write(u"    # vis_set.options['insetCharts']\
['defaultChannelName'] =\n")
                f.write(u"    #     '%s'\n" %
                        inset_channels[len(inset_channels) // 2])

            f.write(u"\n    # Add extra NodeAttribute fields\n")
            field_names = survey.get_node_attributes_simple_fields()
            if "InitialPopulation" in field_names:
                f.write(u"    vis_set.add_node_field('InitialPopulation')\n")
            else:
                f.write(u"    # vis_set.add_node_field('InitialPopulation')\n")
            if "BirthRate" in field_names:
                f.write(u"    # vis_set.add_node_field('BirthRate')\n")

            # Emit an example of creating a new spatial channel by combining
            # existing channels with a combiner function.
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
                    f.write(u"        '%s'%s\n" %
                            (channel_name, u"," if i < count - 1 else u""))
                f.write(u"    ])\n")

            # If both human migration tracking and event recorder files are
            # available, emit code to make an Infected Human Migrations layer.
            if survey.human_mig_tracking_path is not None and \
                    survey.event_recorder_path is not None:
                f.writelines(infected_human_migration)

            # If there's an event recorder, get a sample set of event names and
            # emit some commented lines for making marker layers.
            if survey.event_recorder_path is not None:
                event_names = survey.get_event_names()
                if len(event_names) > 0:
                    f.write(u"\n    # Add event marker layers\n")
                    for i in range(0, min(2, len(event_names))):
                        event_name = event_names.pop()
                        f.write(u"    # vis_set.add_marker_layer('%s',\n" %
                                event_name)
                        f.write(u"    #                          marker=\
VisSet.k_marker_shape_triangle,\n")
                        f.write(u"    #                          color=\
'%s')\n" % (u"green" if i == 0 else u"blue"))

            # Emit code to override other visset options
            f.writelines(other_overrides)

            # Emit example bindings
            f.writelines(example_bindings)

            # Emit the writeout section
            f.writelines(writeout)

            # Emit code to print the URL when preprocessing is complete.
            f.write(u"    # Emit URL\n")
            f.write(u"    print('http://localhost:8000/geospatial.html?\
set=%s')\n" % path.join(survey.out_dir, "visset.json").replace('\\', '/'))

            # Emit the epilogue
            f.writelines(epilogue)

        print("Wrote %s" % out_file_path)


# ==============================================================================
# Functions
# ==============================================================================
def usage():
    """Prints a usage string for the program.

    Returns:
        None.

    Args:
        None.

    """
    print("python " + sys.argv[0] + " directory_containing_sim [Points|Shapes]")


# ==============================================================================
# Main program
# ==============================================================================
if __name__ == '__main__':
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
        description="Generate a Vis-Tools preprocessing script.")
    parser.add_argument("-d", "--demographics", dest="demographics_path",
                        help="Optional: Full path to demographics file.")
    parser.add_argument("-i", "--input", dest="sim_dir", required=True,
                        help="Directory containing simulation input \
and output files.")
    parser.add_argument("-o", "--output", dest="out_file",
                        help="Output script path.")
    parser.add_argument("-t", "--type", dest="node_type", default="Points",
                        choices=["Points", "Shapes"],
                        help="Value indicating node representation type.")
    parser.add_argument("-v", "--verbose", dest="verbose", default=False,
                        action="store_true",
                        help="Emit extra messages for debugging and timing.")
    opts = parser.parse_args()

    # Strip trailing '/' from opts.sim_dir if present
    opts.sim_dir = re.sub(r"(.*)/$", "\\1", opts.sim_dir)

    # See what we've got
    svy = Surveyor(opts.sim_dir, opts.demographics_path)
    svy.summary()

    # See if there's enough to continue
    if svy.demographics_path_or_list is None:
        print("ERROR: Valid demographics path required.")
        sys.exit()

    # Emit
    if opts.out_file is None:
        opts.out_file = "preprocess_%s.py" % opts.sim_dir
    PrepMaker.emit(svy, opts.node_type, opts.out_file)

    # Done
    script_end = tm.time()
    if opts.verbose:
        print("Elapsed time " + repr(script_end - script_start) + " seconds.\n")
