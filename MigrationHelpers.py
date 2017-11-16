# ==============================================================================
# MigrationHelpers.py - Python helper functions for dealing with human migration
# ==============================================================================
"""MigrationHelpers.py

This class contains static methods that are useful in the composition of
infected migration animations. Namely collate_infected_human_migrations(),
which trawls through a ReportHumanMigrationTracking report and combines that
with a ReportEventRecorder report to find and create a data structure of the
migrations of only infected individuals.

While there is currently only one method in this class, as other forms of
migration culling are developed more methods will be added here as needed.

"""
from __future__ import print_function


# ==============================================================================
# MigrationHelpers - helper functions for human migration
# ==============================================================================
from builtins import object
class MigrationHelpers(object):
    """Helper functions for processing migrations."""

    # --------------------------------------------------------------------------
    # This function combines a ReportHumanMigrationTracking.csv and a
    # ReportEventRecorder.csv to generate a set of *infected* human migrations.
    # * rpt_human_migs
    #   is a CSVReport object read from a ReportHumanMigrationTracking.csv
    # * rpt_evt_rec
    #   is a CSVReport object read from a ReportEventRecorder.csv
    # * returns an object: {
    #     infected_migrations: { ... },
    #     aggregate_migrations_max: n
    #   }
    # * infected_migrations in the result is an dictionary where the keys are
    #   <timestep> and the values are objects with keys
    #   <from_node_id>-<to_node_id> and the values are the number of migrations
    #   at that timestep from from_node_id to to_node_id.
    # * aggregate_migrations_max in the result is the most simultaneous
    #   migrations between any two nodes. This can be used for visualization,
    #   for example using a thicker line for more migrations.
    # --------------------------------------------------------------------------
    @staticmethod
    def collate_infected_human_migrations(rpt_human_migs, rpt_evt_rec):
        """Glean infected human migrations from two source files.

        This function combines a ReportHumanMigrationTracking.csv and a
        ReportEventRecorder.csv to generate a set of *infected* human
        migrations.

        Returns:
            obj::

                {
                  infected_migrations: { ... },
                  aggregate_migrations_max: n
                }

            where:

                * infected_migrations in the result is an dictionary where the
                  keys are <timestep> and the values are objects with keys
                  <from_node_id>-<to_node_id> and the values are the number of
                  migrations at that timestep from from_node_id to to_node_id.

                * aggregate_migrations_max in the result is the most
                  simultaneous migrations between any two nodes. This could be
                  used for visualization, for example using a thicker line for
                  more migrations.

        Args:
            rpt_human_migs (obj): CSVReport of a ReportHumanMigrationTracking.

            rpt_evt_rec (obj): CSVReport of a ReportEventRecorder.

        """
        inf_migs = {}
        agg_max = 0

        evt_required_cols = ["Event_Name", "Time", "Infected", "Individual_ID",\
                             "Node_ID"]
        migs_required_cols = ["Event", "Time", "IndividualID", "From_NodeID",
                              "To_NodeID"]

        # Some validations up front
        missing = rpt_evt_rec.missing_columns(evt_required_cols)
        if missing is not None:
            print("MigrationHelpers.collate_infected_human_migrations: event " \
                  "recorder lacks column(s) %s " % missing)
            raise ValueError("event recorder lacks a required column")
        missing = rpt_human_migs.missing_columns(migs_required_cols)
        if missing is not None:
            print("MigrationHelpers.collate_infected_human_migrations: human " \
                    "migration tracking file column(s) %s " % missing)
            raise ValueError("human migration tracking file lacks a required "
                             "column")

        # Make a set of infected migrations where the elements are in the form
        # Timestep-IndividualId-NodeId for fast search.
        infected_migrations = set()
        timestep_offset = int(rpt_evt_rec.rows[0]["Time"])
        for event in rpt_evt_rec.rows:
            if event["Event_Name"] == "Emigrating" and event["Infected"] == '1':
                timestep = int(event["Time"]) - timestep_offset
                infected_migrations.add(
                    repr(timestep) + "-" + event["Individual_ID"] + "-" +
                    event["Node_ID"])

        # Now go through the human migrations and see if they match an infected
        # migration. If so, emit an output record.
        for trace in rpt_human_migs.rows:
            if not trace["Event"] == "Emigrating":
                continue
            timestep = int(trace["Time"]) - timestep_offset
            inf_mig_key = repr(timestep) + "-" + trace["IndividualID"] + "-" +\
                trace["From_NodeID"]
            if inf_mig_key not in infected_migrations:
                continue

            # Is there a record for this timestep?
            if timestep not in inf_migs:
                inf_migs[timestep] = {}

            # Is there a record for this From_NodeID-To_NodeID migration path?
            migs_for_timestep = inf_migs[timestep]
            key = repr(int(trace["From_NodeID"])) + "-" + repr(int(trace["To_NodeID"]))
            if key not in migs_for_timestep:
                migs_for_timestep[key] = 1
            else:
                migs_for_timestep[key] += 1
                agg_max = migs_for_timestep[key]\
                    if migs_for_timestep[key] > agg_max else agg_max
        return {
            "infected_migrations": inf_migs,
            "aggregate_migrations_max": agg_max
        }
