# ==============================================================================
# Gradient.py - A color gradient class
# ==============================================================================
"""Gradient.py

This file contains a class for doing Python-side color gradients. The
Gradient class is a gradient with an arbitrary number of color stops. Since
Gradient is derived from the Vis-Tools gradient.js, the same style text
representations of gradients can be used.

Classes:

    * Gradient - a sampleable color gradient.

Usage::

    gradient = Gradient("green@0,orange@0.33,yellow@.66,red@1")
    color = gradient.sample(0.5)

"""

# imports
from __future__ import division
from builtins import str
from builtins import object
from vis_tools import Color, NamedColors


# ==============================================================================
# Gradient - a simple color gradient class
# ==============================================================================
class Gradient(object):
    """Class for sampleable color gradients.

    This class lets you create a color gradient with an arbitrary number of
    color stops on a normalized range from 0 to 1. You then sample the gradient
    with a normalized value from 0 to 1 to get a color out of the gradient.

    This class is based on the Vis-Tools gradient.js. However it does not
    support the ",r" or ",q<steps>" suffixes supported by gradient.js.

    The spec format is:
        <color>@0,[<color>@<loc>,...]<color>@1

    Where:
        * color - Color objects representing the stop colors

        * loc - Ordered values in range(0, 1) representing the normalized
          locations of the gradient stops.

    Raises:
        ValueError: if spec is invalid.

    """
    def __init__(self, spec=""):
        """Construct a Gradient from a text specification.

        Args:
            spec (str): See the class section above for details.

        """
        self.stops = [
            {"color": Color(0, 0, 0), "location": 0.0},
            {"color": Color(255, 255, 255), "location": 1.0}
        ]
        if len(spec) > 0:
            stops = self._parse_spec(spec)
            if len(stops) > 0:
                self.stops = stops

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of a Gradient.

        The returned string is sufficient for recreating the Gradient via the
        constructor.

        Returns:
            str: String representation of gradient.

        Args:
            None.

        """
        result = ""
        stop_index = 0
        for stop in self.stops:
            if stop_index > 0:
                result += ","
            # use str() here, not repr()
            result += str(stop["color"]) + "@" + str(stop["location"])
            stop_index += 1
        return result

    # --------------------------------------------------------------------------
    def sample(self, loc0to1):
        """Sample the gradient to get a color at a particular location.

        Returns:
            obj: A Color object for the color at the sample point.

        Args:
            loc0to1 (float): A normalized value in the range(0, 1) at which
            point to sample the gradient color.

        """
        loc = Gradient._clamp(loc0to1, 0.0, 1.0)
        high_index = 0
        for stop in self.stops:
            if stop["location"] > loc:
                break
            high_index += 1
        if high_index <= 0 or high_index >= len(self.stops):
            high_index = len(self.stops) - 1
        high_stop = self.stops[high_index]
        low_stop = self.stops[high_index - 1]
        rng = high_stop["location"] - low_stop["location"]
        sub_loc = (loc - low_stop["location"]) / rng
        low = low_stop["color"].r
        high = high_stop["color"].r
        red = low + sub_loc * (high - low)
        low = low_stop["color"].g
        high = high_stop["color"].g
        green = low + sub_loc * (high - low)
        low = low_stop["color"].b
        high = high_stop["color"].b
        blue = low + sub_loc * (high - low)
        return Color(int(red), int(green), int(blue))

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    @staticmethod
    def _clamp(x, min_inclusive, max_inclusive):
        if x < min_inclusive:
            x = min_inclusive
        if x > max_inclusive:
            x = max_inclusive
        return x

    # --------------------------------------------------------------------------
    @staticmethod
    def _parse_spec(spec):
        stops = []
        parts = spec.split(",")
        if len(parts) < 2:
            raise ValueError("Minimum two stops required.")
        for part in parts:
            part = part.strip()
            subparts = part.split("@")
            if len(subparts) != 2:
                raise ValueError("Stops require a color and location.")
            if subparts[0][0] == '#':
                # #rrggbb color
                r = int(subparts[0][1:3], 16)
                g = int(subparts[0][3:5], 16)
                b = int(subparts[0][5:7], 16)
                color = Color(r, g, b)
            elif subparts[0] in NamedColors.__dict__:
                # named color
                color = NamedColors.__dict__[subparts[0]]
            else:
                color = Color(0, 0, 0)
            location = float(subparts[1])
            if location < 0.0 or location > 1.0:
                raise ValueError("Location out of range.")
            stop = {"color": color, "location": location}
            stops.append(stop)
        return stops
