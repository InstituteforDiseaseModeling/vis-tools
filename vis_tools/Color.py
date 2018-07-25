# ==============================================================================
# Color.py - a simple RGB color class
# ==============================================================================
"""Color.py

This file contains a simple RGB color class that uses normalized channel values
in the range of 0-1.

Classes:

    * Color - a simple RGB color object.

Usage::

    color = Color(1.0, 0.5, 0.0)    # Equivalent to #ff7f00 in CSS

"""

# imports
from __future__ import division
from builtins import object
import vis_tools

# ==============================================================================
# Color - a simple RGB color class
# ==============================================================================
class Color(object):
    """Class that encapsulates an RGB color.

    Public members:
        r (int): Red channel value in range(0, 255)

        g int): Green channel value in range(0, 255)

        b (int): Blue channel value in range(0, 255)

    """
    def __init__(self, r=0, g=0, b=0):
        """Construct an RGB.

        Args:
            r: the initial red channel value in range(0, 255)

            g: the initial green channel value in range(0, 255)

            b: the initial blue channel value in range(0, 255)

        """
        self.r = r
        self.g = g
        self.b = b

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of an RGB in #rrggbb format.

        Returns:
            str: Color as "#rrggbb" as in HTML/CSS.

        Args:
            None.

        """
        return "#" + ("%0.2X" % self.r) + ("%0.2X" % self.g) +\
               ("%0.2X" % self.b)

    # --------------------------------------------------------------------------
    def to_rgba_array_str(self):
        """Returns the color as a string representation of an RGBA array.

        This is used by CZMLWriter and other classes that need to emit colors
        into Javascript formats.

        Returns:
            str: "[r, g, b, 255]" where r, g, and b are the channel values.

        """
        return "[%d,%d,%d,255]" % (self.r, self.g, self.b)

    # --------------------------------------------------------------------------
    def to_rgba_array(self):
        """Returns the color as an RGBA array.

        Returns:
            array: [r, g, b, 255] where r, g, and b are the channel values.

        """
        return [self.r, self.g, self.b, 255]

    # --------------------------------------------------------------------------
    @staticmethod
    def from_html_hash(html_color):
        """Returns an RGB from an HTML/CSS #rrggbb-format string.

        Returns:
            obj: an RGB initialized with the colors from html_color

        Args:
            html_color: A string in the format "#rrggbb" where rr, gg, and bb
            are the channel values in hex.

        """
        r = int(html_color[1:3], 16)
        g = int(html_color[3:5], 16)
        b = int(html_color[5:7], 16)
        return Color(r=r, g=g, b=b)

    # --------------------------------------------------------------------------
    @staticmethod
    def lerp(a, b, factor0to1):
        """Returns an interpolated color.

        This function calculates a color that is between colors a and b using
        the factor0to1 argument to calculate the mix. If factor0to1 is zero, the
        resulting color is a. If factor0to1 is 1, the resulting color is b. For
        values of factor0to1 between 0 and 1, the resulting color is a linearly
        interpolated mix of colors a and b.

        Returns:
            obj: An RGB initialized with the interpolated color.

        Args:
            a (obj): An RGB representing the start color.

            b (obj): An RGB representing the end color.

            factor0to1 (float): A value in range(0,1) specifying the desired mix
            between colors a and b.

        """
        _r = int(a.r + (b.r - a.r) * factor0to1)
        _g = int(a.g + (b.g - a.g) * factor0to1)
        _b = int(a.b + (b.b - a.b) * factor0to1)
        return Color(_r, _g, _b)
