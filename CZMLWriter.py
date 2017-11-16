# ==============================================================================
# CZMLWriter.py - Python wrapper for writing Cesium CZML animation files.
# ==============================================================================
"""CZMLWriter.py

This class simplifies the writing of Cesium CZML animation output files. It
has methods for writing Vis-Tools-specific animations (migration and marker).
Note that there are high-level methods on VisSet that implicitly create and use
CZMLWriter so in many cases you will not need to directly instantiate/call this
class yourself.

Usage::

    writer = CZMLWriter()
    writer.set_sim_duration(timestep_count)
    writer.add_event_markers(my_event_recorder, my_demographics,
        "New_Infection", "Triangle", "red", "Top", 2)
    writer.write(path.join(my_dir, "New_Infections.czml"))

"""
from __future__ import division
from __future__ import print_function

# imports
from builtins import object
from czml import czml
from datetime import date, timedelta
from Gradient import Gradient, Color, NamedColors


# ==============================================================================
# CZMLWriter - a class for outputting high-level visualizations in CZML format
# ==============================================================================
class CZMLWriter(object):
    """Class for creating high-level visualizations in Cesium CZML format."""

    # --------------------------------------------------------------------------
    # Constants
    # --------------------------------------------------------------------------
    k_default_node_point_size = 8
    k_default_clock_multiplier = 60 * 60 * 4        # four hours in seconds
    k_default_migration_trail_duration = 60 * 60 * 24     # two days in seconds
    k_default_migration_duration_days = 2
    k_default_migration_duration_seconds =\
        k_default_migration_duration_days * 60 * 60 * 24

    # --------------------------------------------------------------------------
    def __init__(self, verbose=False):
        """Construct a CZMLWriter.

        Args:
            verbose (bool): Extra messaging from methods.

        """
        self.doc = czml.CZML()
        self.doc.packets.append(czml.CZMLPacket(id="document", version="1.0"))
        self.timestep_count = 0
        self.sim_end_date = None
        self.sim_start_date = None
        self._verbose = verbose

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of CZMLWriter.

        This method allows the CZMLWriter to report the number of CZML packets
        it contains when it is printed.

        Returns:
            str: String containing number of packets.

        """
        return "CZML: %d packets" % len(self.doc.packets)

    # --------------------------------------------------------------------------
    def set_sim_dates(self, sim_start_date, total_timestep_count):
        """Set the sim start date and total timesteps.

        These are required because all CZML layers are time-synced to the
        Cesium clock. It is possible to use set_sim_duration in lieu of this
        function.

        Returns:
            None

        Args:
            sim_start_date (date): Start date for timestep 0

            total_timestep_count (int): Number of timesteps in simulation data

        """
        self.sim_start_date = sim_start_date
        self.sim_end_date = sim_start_date + timedelta(total_timestep_count)
        if self._verbose:
            print("CZMLWriter.set_sim_dates: Simulation date range set to ")
            "%s - %s" %\
                (self.sim_start_date.isoformat(), self.sim_end_date.isoformat())

    # --------------------------------------------------------------------------
    def set_sim_duration(self, total_timestep_count, timestep_bounds=None,
                         sim_start_date=None, emit_clock=True,
                         anim_step_secs=None):
        """Set the sim duration and time range.

        This function allows you to set the start date and total timesteps, but
        also allows emitting the CZML over a subrange of timesteps less than the
        number of timesteps in total_timestep_count. This is effective for
        trimming migration animations that would otherwise be too big down to
        a workable subset.

        Returns:
            None

        Args:
            total_timestep_count (int): Total timesteps in sim

            timestep_bounds: (list (start, end)): Timestep subrange for
            animation

            sim_start_date (date): Start date for timestep 0

            emit_clock (bool): Whether to emit a CZML Clock packet

            anim_step_secs (int): Clock multiplier for Clock packet

        """
        self.timestep_count = total_timestep_count
        if anim_step_secs is None:
            anim_step_secs = CZMLWriter.k_default_clock_multiplier
        if sim_start_date is None:
            self.sim_end_date = date.today()
            self.sim_start_date = self.sim_end_date -\
                timedelta(total_timestep_count)
        else:
            self.sim_start_date = sim_start_date
            self.sim_end_date = sim_start_date + timedelta(total_timestep_count)
        interval = self.sim_start_date.isoformat() + "/" +\
            self.sim_end_date.isoformat()
        if timestep_bounds is None:
            current_time = self.sim_start_date.isoformat()
        else:
            current_time = (self.sim_start_date +
                            timedelta(timestep_bounds[0])).isoformat()
        if emit_clock:
            clock = czml.Clock(
                currentTime=current_time,
                interval=interval,
                multiplier=anim_step_secs,
                range="LOOP_STOP",
                step="TICK_DEPENDENT"
            )
            for packet in self.doc.packets:
                if packet.id == "document":
                    packet.clock = clock
                    break
        if self._verbose:
            print("CZMLWriter.set_sim_duration: Simulation date range set to ")
            "%s - %s" %\
                (self.sim_start_date.isoformat(), self.sim_end_date.isoformat())

    # --------------------------------------------------------------------------
    def add_nodes(self, demographics, population_as_size=True,
                  with_altitude=False, processor=None, namer=None):
        """Add demographics node data to the CZMLWriter object. DEPRECATED.

        This (DEPRECATED) method allows you to add node representations to a
        CZML output file, where the node point size is relative to the node's
        InitialPopulation. Since the Vis-Tools client does this in a much more
        flexible way, this method is deprecated, but may be educational for
        those looking to extend the CZMLWriter class.

        Returns:
            None

        Args:
            demographics (Demographics) A Demographics object with node data.

            population_as_size (bool): True to scale point size by
            InitialPopulation, fixed size otherwise

            with_altitude: True to emit node coordinates including their
            altitude, false to just emit them with default altitude

            processor: None or a function that processes the node and and the
            czml wrapper into a new CZML packet.

            namer: None or a function that converts a node into a name string

        """
        pop_adjusted_max = demographics.calc_adjusted_pop_max()
        pop_range = pop_adjusted_max - demographics.population_min
        size_px_min = 6
        size_px_max = 32
        size_range = size_px_max - size_px_min
        for node in demographics.Nodes:
            name = repr(node["NodeID"])
            if namer is not None:
                name = namer(node, name)
            attrs = node["NodeAttributes"]
            lon = attrs["Longitude"]
            lat = attrs["Latitude"]
            alt = attrs["Altitude"] if with_altitude else 0
            if processor is None:
                packet = czml.CZMLPacket(id=name, name=name,
                                         position={"cartographicDegrees":
                                                   [lon, lat, alt]})
                size = CZMLWriter.k_default_node_point_size
                if population_as_size:
                    pop = attrs["InitialPopulation"]
                    if pop > pop_adjusted_max:
                        pop = pop_adjusted_max
                    norm_pop = (pop - demographics.population_min) / pop_range
                    size = size_px_min + norm_pop * size_range
                # show=True is required below
                packet.point = czml.Point(pixelSize=size, show=True)
            else:
                packet = processor(self, czml, node)
            self.doc.packets.append(packet)
        if self._verbose:
            print("CZMLWriter.add_nodes: Added %s node%s" %\
                  (len(demographics.Nodes),
                   "" if len(demographics.Nodes) == 1 else "s"))

    # --------------------------------------------------------------------------
    # Returns the number of migration paths emitted.
    # --------------------------------------------------------------------------
    def add_migrations(self, migrations, demographics, with_altitude=False):
        """Adds migration animations to a CZML output.

        This function, given migrations in a particular format and demographics,
        adds "comet" animations for migration events.

        Returns:
            Number of infected human migrations in animation layer

        Args:
            migrations (obj): An object that describes migrations (see below)

            demographics (Demographics): A Demographics object describing nodes

            with_altitude: True to respect the altitude in the node coordinates

        migrations is a dictionary where the keys are <timestep> and the values
        are objects with keys <from_node_id>-<to_node_id> and the values are the
        number of migrations at that timestep from from_node_id to to_node_id.
        See MigrationHelpers.py for more details.

        Todo:
            * Color customization (comet heads, comet tails)
            * Duration customization (comet tails)

        """
        count = 0
        for timestep in list(migrations.keys()):
            timestep_rec = migrations[timestep]
            for migration_key in list(timestep_rec.keys()):
                from_node_id, to_node_id = migration_key.split("-")
                if not (from_node_id in demographics and
                        to_node_id in demographics):
                    continue
                from_node = demographics[from_node_id]
                to_node = demographics[to_node_id]
                availability = self._timestep_to_iso(timestep) + "/" +\
                    self._timestep_to_iso(int(timestep) +
                                 CZMLWriter.k_default_migration_duration_days)
                id_txt = "%s_%d" % (migration_key, count)
                # The thing to remember about paths is that their initial
                # duration is going to be availability, but then they are going
                # to be around for an *additional* trailTime seconds. So the
                # color fade in the path needs to run for dur_seconds +
                # trailTime.
                mig_path = czml.CZMLPacket(id=id_txt,
                                           availability=availability,
                                           position={
                        "epoch": self._timestep_to_iso(timestep),
                        "cartographicDegrees": [
                            0,              # seconds
                            from_node["NodeAttributes"]["Longitude"],
                            from_node["NodeAttributes"]["Latitude"],
                            from_node["NodeAttributes"]["Altitude"]
                            if with_altitude else 0,
                            CZMLWriter.k_default_migration_duration_seconds,
                            to_node["NodeAttributes"]["Longitude"],
                            to_node["NodeAttributes"]["Latitude"],
                            to_node["NodeAttributes"]["Altitude"]
                            if with_altitude else 0
                        ]
                    })
                pt = czml.Point(pixelSize=10, show=True,
                    color={
                        "epoch": self._timestep_to_iso(timestep),
                        "rgba": [ 0, 186, 127, 183, 255,
                          CZMLWriter.k_default_migration_duration_seconds,
                                  186, 127, 183, 0 ]
                    })
                path = czml.Path(leadTime=0, trailTime=60 * 60 * 12, # half-day
                    resolution=CZMLWriter.k_default_clock_multiplier,
                    material={
                        "solidColor": { "color": {
                            "epoch": self._timestep_to_iso(timestep),
                            "rgba": [0, 255, 255, 255, 255,
                              CZMLWriter.k_default_migration_duration_seconds +
                                      60 * 60 * 12, 255, 255, 255, 0]
                        }}
                    },
                    width=2.5)
                mig_path.point = pt
                mig_path.path = path
                self.doc.packets.append(mig_path)
                count += 1
        if self._verbose:
            print("CZMLWriter.add_migrations: %d migrations added." % count)
        return count

    # --------------------------------------------------------------------------
    def add_vector_migrations(self, vector_migrations, demographics,
                              migration_duration_timesteps, dot_color,
                              dot_size_pixels, path_color,
                              path_thickness_pixels,
                              path_trail_time_factor):
        """Adds vector cohort migration animations to a CZML output.

        This function, given vector migrations in a particular format and a
        demographics file, adds "comet" animations for migration events.

        This function expects the following fields in vector_migrations:

            * Time (int): the timestep of the beginning of the migration event
            * FromNodeID (int): the node ID from which the migration emanates
            * ToNodeID (int): the node ID to which the migration completes

        Returns:
            Number of vector cohort migrations in animation layer

        Args:
            vector_migrations (CSVReport): The ReportVectorMigrations.csv
            report.

            demographics (Demographics): The Demographics object describing the
            nodes.

            migration_duration_timesteps (int): The duration of the migration
            animations in timesteps.

            dot_color (string): A CSS #rrggbb color for the comet dot.

            dot_size_pixels (int): Size in pixels of comet dot.

            path_color (string): A CSS #rrggbb color for the comet tail.

            path_thickness_pixels (float): Thickness in pixels of comet tail.

            path_trail_time_factor (float): Length of trail as a multiple of
            the migration_duration. E.g. if this is 1.0, the trail length will
            be the full distance from source node to the destination node. If
            0.5, the trail length will be half the distance between the nodes.

        """
        count = 0
        for row in vector_migrations:
            timestep = int(row["Time"])
            from_node_id = row["FromNodeID"]
            to_node_id = row["ToNodeID"]
            if not (from_node_id in demographics and
                    to_node_id in demographics):
                continue
            from_node = demographics[from_node_id]
            to_node = demographics[to_node_id]
            dur_seconds = migration_duration_timesteps * 60 * 60 * 24
            trail_seconds = dur_seconds * path_trail_time_factor
            availability = self._timestep_to_iso(timestep) + "/" +\
                self._timestep_to_iso(timestep + migration_duration_timesteps)
            id_txt = "%s-%s@%d_%d" % (from_node_id, to_node_id, timestep, count)
            # The thing to remember about paths is that their initial duration
            # is going to be availability, but then they are going to be around
            # for an *additional* trailTime seconds. So the color fade in the
            # path needs to run for dur_seconds + trailTime.
            mig_path = czml.CZMLPacket(id=id_txt,
                                       availability=availability,
                                       position={
                    "epoch": self._timestep_to_iso(timestep),
                    "cartographicDegrees": [
                        0,              # in seconds
                        from_node["NodeAttributes"]["Longitude"],
                        from_node["NodeAttributes"]["Latitude"],
                        0,  # altitude
                        dur_seconds,
                        to_node["NodeAttributes"]["Longitude"],
                        to_node["NodeAttributes"]["Latitude"],
                        0   # altitude
                    ]
                })
            dc = Color.from_html_hash(dot_color)
            pc = Color.from_html_hash(path_color)
            pt = czml.Point(pixelSize=dot_size_pixels, show=True,
                color={
                    "epoch": self._timestep_to_iso(timestep),
                    "rgba": [0, dc.r, dc.g, dc.b, 255,
                            dur_seconds, dc.r, dc.g, dc.b, 0]
                })
            path = czml.Path(leadTime=0,
                             trailTime=trail_seconds,
                resolution=CZMLWriter.k_default_clock_multiplier,
                material={
                    "solidColor": { "color": {
                        "epoch": self._timestep_to_iso(timestep),
                        "rgba": [0,
                                 pc.r, pc.g, pc.b, 255,
                                 dur_seconds + trail_seconds,
                                 pc.r, pc.g, pc.b, 0]
                    }}
                },
                width=path_thickness_pixels)
            mig_path.point = pt
            mig_path.path = path
            self.doc.packets.append(mig_path)
            count += 1
        if self._verbose:
            print("CZMLWriter.add_vector_migrations: %d migrations added." %\
                count)
        return count

    # --------------------------------------------------------------------------
    def add_simplified_vector_migrations(self, vector_migrations, demographics,
                                         migration_duration_timesteps,
                                         arrow_color, arrow_thickness_pixels):
        """Adds vector cohort migration animations to a CZML output.

        This function, given vector migrations in a particular format and a
        demographics file, adds "comet" animations for migration events.

        This function expects the following fields in vector_migrations:

            * Time (int): the timestep of the beginning of the migration event
            * FromNodeID (int): the node ID from which the migration emanates
            * ToNodeID (int): the node ID to which the migration completes

        Returns:
            Number of vector cohort migrations in animation layer

        Args:
            vector_migrations (CSVReport): The ReportVectorMigrations.csv
            report.

            demographics (Demographics): The Demographics object describing the
            nodes.

            migration_duration_timesteps (int): The duration of the migration
            animations in timesteps.

            arrow_color (string): A CSS #rrggbb color for the migration arrow.

            arrow_thickness_pixels (float): Thickness in pixels of comet tail.

        """
        czml.Material._properties=\
            ('grid', 'image', 'stripe', 'solidColor', 'polylineGlow',
             'polylineOutline', 'polylineArrow')
        count = 0
        for row in vector_migrations:
            timestep = int(row["Time"])
            from_node_id = row["FromNodeID"]
            to_node_id = row["ToNodeID"]
            if not (from_node_id in demographics and
                    to_node_id in demographics):
                continue
            from_node = demographics[from_node_id]
            to_node = demographics[to_node_id]
            dur_seconds = migration_duration_timesteps * 60 * 60 * 24
            availability = self._timestep_to_iso(timestep) + "/" +\
                self._timestep_to_iso(timestep + migration_duration_timesteps)
            id_txt = "%s-%s@%d_%d" % (from_node_id, to_node_id, timestep, count)
            ac = Color.from_html_hash(arrow_color)
            packet = czml.CZMLPacket(id=id_txt, availability=availability)
            polyline = czml.Polyline(
                followSurface=False,
                positions={
                   "cartographicDegrees": [
                       from_node["NodeAttributes"]["Longitude"],
                       from_node["NodeAttributes"]["Latitude"],
                       0,  # altitude
                       to_node["NodeAttributes"]["Longitude"],
                       to_node["NodeAttributes"]["Latitude"],
                       0   # altitude
                   ]},
                material={
                   "polylineArrow": {"color": {
                       "epoch": self._timestep_to_iso(timestep),
                       "rgba": [0, ac.r, ac.g, ac.b, 255,
                                dur_seconds + 60 * 60 * 12, ac.r, ac.g, ac.b, 0]
                   }}
                },
                width=arrow_thickness_pixels)
            packet.polyline = polyline
            self.doc.packets.append(packet)
            count += 1
        if self._verbose:
            print("CZMLWriter.add_vector_migrations: %d migrations added." %\
                count)
        return count

    # --------------------------------------------------------------------------
    # Returns number of events emitted.
    # --------------------------------------------------------------------------
    def add_event_markers(self, event_recorder, demographics, event_name,
                          marker, color, placement, duration_days,
                          with_altitude=False):
        """Adds event marker animation to a CZML output.

        This function looks for a particular event in an event recorder report
        and emits an animation that puts a marker somewhere around the node and
        leaves it there for a specified period after the event.

        Returns:
            Number of event markers in animation layer

        Args:
            event_recorder (CSVReport): Event recorder report object

            demographics (Demographics): Demographics object with node data

            event_name (str): Name of event to mark in the animation

            marker (str): Name of a marker icon ("Triangle" or "Cross")

            color (str): Any HTML or SVG named color (e.g. "red") or a CSS
            color string (e.g. "#ff0000")

            placement (str): Placement about the node point ("Top", "Left",
            "Bottom" or "Right")

            duration_days (int): Number of days for which the symbol should
            remain about the node after it fires.

            with_altitude (bool): True to set the symbol elevations to match
            the node altitude, or default altitude otherwise.

        """
        czml.Billboard._properties =\
            ('show', 'image', 'color', 'scale', 'verticalOrigin',
             'horizontalOrigin')
        count = 0
        timestep_offset = int(event_recorder.rows[0]["Time"])
        if color in NamedColors.__dict__:
            color = NamedColors.__dict__[color]
        else:
            color = Color.from_html_hash(color)
        for event in event_recorder:
            if not event["Event_Name"] == event_name: continue
            if event["Node_ID"] in demographics:
                timestep = int(event["Time"]) - timestep_offset
                node = demographics[event["Node_ID"]]
                availability = self._timestep_to_iso(timestep) + "/" +\
                    self._timestep_to_iso(timestep + duration_days)
                attrs = node["NodeAttributes"]
                lon = attrs["Longitude"]
                lat = attrs["Latitude"]
                alt = attrs["Altitude"] if with_altitude else 0
                ni_packet = czml.CZMLPacket(
                    id=repr(count),
                    availability=availability, position={
                        "epoch": self._timestep_to_iso(timestep),
                        "cartographicDegrees": [ lon, lat, alt ]
                    })
                bb = czml.Billboard(image="../../image/" + marker + placement + ".png",
                            color={ "rgba": color.to_rgba_array() })
                bb.verticalOrigin = self._vertical_origin(placement)
                bb.horizontalOrigin = self._horizontal_origin(placement)
                ni_packet.billboard = bb
                self.doc.packets.append(ni_packet)
                count += 1
        if self._verbose:
            print("CZMLWriter.add_event_markers: %d event markers added." %\
                count)
        return count

    # --------------------------------------------------------------------------
    def add_weighted_network(self, demographics, network, gradient_spec,
                             opacity_func):
        """Adds a weighted network visualization layer to a CZML output.

        This method emits a CZML animation that provides a visual representation
        of a weighted network between nodes.

        Returns:
            Number of network segments added

        Args:
            demographics (Demographics): Demographics object for nodes.

            network (array): array of objects::

                {
                    from: <from-node-id>,
                    to: <to-node-id>,
                    weight: <float-weight>
                }

            gradient_spec (str): gradient spec for a gradient with which to
            color the network lines.

            opacity_func (function): function(weight, norm_weight) that returns
            the desired opacity in range [0,1].

        """
        # First pass - collect min/max rate
        min_weight = network[0]["weight"]
        max_weight = network[0]["weight"]
        for segment in network:
            weight = segment["weight"]
            min_weight = weight if weight < min_weight else min_weight
            max_weight = weight if weight > max_weight else max_weight
        weight_range = max_weight - min_weight

        # Second pass - precalculate norm_weight and opacity
        for segment in network:
            weight = segment["weight"]
            norm_weight = (weight - min_weight) / weight_range
            segment["norm_weight"] = norm_weight
            segment["opacity"] = opacity_func(weight, norm_weight)

        # Sort network by opacity, lowest opacity first
        # network.sort(key=lambda seg: seg["opacity"])
        def sort_func(a, b):
            diff = a["opacity"] - b["opacity"]
            if diff < 0: return -1
            elif diff == 0: return 0
            else: return 1

        network = sorted(network, cmp=sort_func)

        gradient = Gradient(gradient_spec)
        count = 0
        for segment in network:
            from_node = demographics[segment["from"]]
            to_node = demographics[segment["to"]]
            color = gradient.sample(segment["norm_weight"]).to_rgba_array()
            color[3] = int(segment["opacity"] * 255)
            # id = repr(segment["from"]) + "-" + repr(segment["to"])
            id = count
            packet = czml.CZMLPacket(id=id)
            positions = {"cartographicDegrees": [
                from_node["NodeAttributes"]["Longitude"],
                from_node["NodeAttributes"]["Latitude"],
                0,
                to_node["NodeAttributes"]["Longitude"],
                to_node["NodeAttributes"]["Latitude"],
                0
            ]}
            line = czml.Polyline(show=True, positions=positions,
                                 width=1, material={
                                     "solidColor": {"color": {"rgba": color}}
                                 })
            packet.polyline = line
            self.doc.packets.append(packet)
            count += 1
        if self._verbose:
            print("CZMLWriter.add_network: %d network segments added." % count)
        return count

    # --------------------------------------------------------------------------
    def write_czml(self, file_path):
        """Write the CZML animation file.

        Returns:
            None

        Args:
            file_path (str): The file path to which to write the CZML animation.

        Raises:
            I/O exceptions.

        """
        try:
            self.doc.write(file_path)
        except BaseException:
            if self._verbose:
                print("CZMLWriter.write_czml: Exception writing to %s" %\
                    file_path)
            raise

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    def _timestep_to_iso(self, timestep):
        return (self.sim_start_date + timedelta(days=int(timestep))).isoformat()

    # --------------------------------------------------------------------------
    @staticmethod
    def _vertical_origin(placement):
        if placement is "Top": return "BOTTOM"
        if placement is "Bottom": return "TOP"
        return "CENTER"

    # --------------------------------------------------------------------------
    @staticmethod
    def _horizontal_origin(placement):
        if placement is "Left": return "RIGHT"
        if placement is "Right": return "LEFT"
        return "CENTER"
