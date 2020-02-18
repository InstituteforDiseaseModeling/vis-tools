# Generated by Survey.py

# This script is meant to be run from within the target simulation directory.

import time as tm
from os import path, getcwd
from vis_tools import VisSet, SpatialBinary, SpatialReports

# Constants
k_name = path.basename(getcwd())
k_sim_dir = r'.'
k_sim_output_dir = r'.\output'
k_products_dir = path.join(k_sim_dir, path.relpath(path.dirname(path.abspath(__file__)), getcwd()))
k_demographics_path_or_list = r'.\Bbondo_filled_calib_29.842464_prop.json'
k_sim_url_root = '/' + path.basename(getcwd()) + '/'
k_spatial_report_dir = k_sim_output_dir
k_config_path = r'.\config.json'
k_event_recorder_path = r'.\output\ReportEventRecorder.csv'
k_human_migration_path = r'.\output\ReportHumanMigrationTracking.csv'
k_malaria_filtered_path = r'.\output\ReportMalariaFiltered.json'

# Appearance-related constants
k_icon_duration_days = 2

# ==============================================================================
# Main program
#
# This Vis-Tools preprocessing program contains various useful examples in the
# form of comments. Whenever possible the examples are made to be valid for the
# present simulation, but in some cases you may have to modify the examples to
# be valid in your context. Note that in this script you can override any option
# or default value you see in defaultvisset.json.
# ==============================================================================
if __name__ == '__main__':
    script_start = tm.time()

    # Create a default VisSet
    vis_set = VisSet(k_name)

    # Set up the VisSet
    vis_set.set_target_client('Geospatial')
    vis_set.set_products_directory(k_products_dir)
    vis_set.set_config(k_config_path)
    vis_set.set_demographics(k_demographics_path_or_list)
    vis_set.set_node_vis_type('Points')

    # Remove the 'elsewhere' node from the node stats. This doesn't remove the
    # node, just leaves it out of min/max stats. Do this before adding the
    # spatial binaries, so as to also exclude that node from the spatial stats.
    vis_set.exclude_node_from_stats(1001)

    # Inset chart
    vis_set.set_inset_chart(k_malaria_filtered_path)
    vis_set.options['insetCharts']['defaultChannelName'] = 'Infectious Vectors'

    # Add extra NodeAttribute fields
    vis_set.add_node_field('InitialPopulation')
    # vis_set.add_node_field('BirthRate')

    # Create a SpatialReports object that scans the simulation output directory
    # looking for SpatialReport_*.bin files. Later we'll add this to the VisSet
    # object.
    reports = SpatialReports(k_spatial_report_dir)

    # Example of creating an infected vectors count spatial binary by combining
    # SpatialReport_Adult_Vectors with SpatialReport_Infectious_Vectors. Once
    # created, we manually add the new report to the reports object
    def combine(a, b):
        return int(a * b)
    print('Synthesizing Infectious Vectors Count spatial binary...')
    infected_vectors_count = SpatialBinary.combine(
        path.join(k_spatial_report_dir, 'SpatialReport_Adult_Vectors.bin'),
        path.join(k_spatial_report_dir, 'SpatialReport_Infectious_Vectors.bin'),
        'Infectious Vectors Count',
        combine)
    report_path = path.join(k_products_dir,
        'SpatialReport_Infectious_Vectors_Count.bin')
    infected_vectors_count.write_binary(report_path)
    reports.add(report_path)

    # Add spatial reports (also establishes timestep count)
    vis_set.add_spatial_reports(reports)

    # Include only a subset of available spatial reports. If you have a lot of
    # spatial reports, you may run out of memory on the client side. So here you
    # can easily decide which channels are important and include just those
    # channels. All available channels are shown below, so just delete the lines
    # for channels you don't care about.
    vis_set.include_spatial_channels([
        'SpatialReport_Adult_Vectors',
        'SpatialReport_Daily_Bites_Per_Human',
        'SpatialReport_Daily_EIR',
        'SpatialReport_Human_Infectious_Reservoir',
        'SpatialReport_Infectious_Vectors',
        'SpatialReport_Infectious_Vectors_Count',
        'SpatialReport_Mean_Parasitemia',
        'SpatialReport_New_Clinical_Cases',
        'SpatialReport_New_Diagnostic_Prevalence',
        'SpatialReport_New_Infections',
        'SpatialReport_Population',
        'SpatialReport_Prevalence'
    ])

    # Infected human migration (do this after adding spatial reports)
    vis_set.set_event_recorder(k_event_recorder_path)
    vis_set.add_infected_human_migrations(k_human_migration_path)

    # Add event marker layers
    vis_set.add_marker_layer('Received_Treatment',
                             marker=VisSet.k_marker_shape_cross,
                             color='red')
    vis_set.add_marker_layer('NewInfectionEvent',
                             marker=VisSet.k_marker_shape_triangle,
                             color='black')

    # Other option overrides
    # vis_set.options['defaultBaseLayer'] = 'ESRI National Geographic'
    vis_set.hide_layer('heatmapVis')

    # Example bindings (NOTE: You may or may not have these sources available.
    # You will have to modify these examples to utilize your available sources.)
    vis_set.add_binding('nodeVis', 'pointSize',
                        'InitialPopulation', 'scale(3, 20)')
    vis_set.add_binding('nodeVis', 'pointColor',
                        'SpatialReport_Prevalence', 'sampleGradient()')
    vis_set.add_binding('heatmapVis', 'source',
                        'SpatialReport_Infectious_Vectors_Count', 'none()')

    # Consistency check
    vis_set.validate()

    # Emit VisSet
    vis_set.write_as('visset.json', k_sim_url_root)

    # Emit URL
    visset_path = path.join(k_products_dir, 'visset.json').replace('\\', '/')
    visset_path = visset_path.replace('./', k_sim_url_root)
    print('http://localhost:8000/vistools/geospatial.html?set=%s' % visset_path)

    # Done
    script_end = tm.time()
    print('\nElapsed time %.2f seconds' % float(script_end - script_start))