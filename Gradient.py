# ==============================================================================
# Gradient.py - A color gradient class
# ==============================================================================
"""Gradient.py

This file contains classes for doing Python-side color calculations. The
Gradient class is a gradient with an arbitrary number of color stops. Since
Gradient is derived from the Vis-Tools gradient.js, the same style text
representations of gradients can be used.

Classes:

    * Color - a simple RGB color object.
    * NamedColors - the SVG named colors as Color objects.
    * Gradient - a sampleable color gradient.

Usage::

    gradient = Gradient("green@0,orange@0.33,yellow@.66,red@1")
    color = gradient.sample(0.5)

"""
from __future__ import division

# imports
from builtins import str
from builtins import object
from math import floor


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
        _r = a.r + (b.r - a.r) * factor0to1
        _g = a.g + (b.g - a.g) * factor0to1
        _b = a.b + (b.b - a.b) * factor0to1
        return Color(_r, _g, _b)


# ==============================================================================
# NamedColors - a simple RGB color class
# ==============================================================================
class NamedColors(object):
    """Named SVG colors as Color objects.

    This class is a reference data class that contains Color objects for all the
    SVG named colors. These can be used in Gradient stops for better
    readability.

    """
    aliceblue = Color(r=floor(0.941176 * 255), g=floor(0.972549 * 255),
                      b=floor(1 * 255))
    antiquewhite = Color(r=floor(0.980392 * 255), g=floor(0.921569 * 255),
                         b=floor(0.843137 * 255))
    aqua = Color(r=floor(0 * 255), g=floor(1 * 255), b=floor(1 * 255))
    aquamarine = Color(r=floor(0.498039 * 255), g=floor(1 * 255),
                       b=floor(0.831373 * 255))
    azure = Color(r=floor(0.941176 * 255), g=floor(1 * 255), b=floor(1 * 255))
    beige = Color(r=floor(0.960784 * 255), g=floor(0.960784 * 255),
                  b=floor(0.862745 * 255))
    bisque = Color(r=floor(1 * 255), g=floor(0.894118 * 255),
                   b=floor(0.768627 * 255))
    black = Color(r=floor(0 * 255), g=floor(0 * 255), b=floor(0 * 255))
    blanchedalmond = Color(r=floor(1 * 255), g=floor(0.921569 * 255),
                           b=floor(0.803922 * 255))
    blue = Color(r=floor(0 * 255), g=floor(0 * 255), b=floor(1 * 255))
    blueviolet = Color(r=floor(0.541176 * 255), g=floor(0.168627 * 255),
                       b=floor(0.886275 * 255))
    brown = Color(r=floor(0.647059 * 255), g=floor(0.164706 * 255),
                  b=floor(0.164706 * 255))
    burlywood = Color(r=floor(0.870588 * 255), g=floor(0.721569 * 255),
                      b=floor(0.529412 * 255))
    cadetblue = Color(r=floor(0.372549 * 255), g=floor(0.619608 * 255),
                      b=floor(0.627451 * 255))
    chartreuse = Color(r=floor(0.498039 * 255), g=floor(1 * 255),
                       b=floor(0 * 255))
    chocolate = Color(r=floor(0.823529 * 255), g=floor(0.411765 * 255),
                      b=floor(0.117647 * 255))
    coral = Color(r=floor(1 * 255), g=floor(0.498039 * 255),
                  b=floor(0.313725 * 255))
    cornflowerblue = Color(r=floor(0.392157 * 255), g=floor(0.584314 * 255),
                           b=floor(0.929412 * 255))
    cornsilk = Color(r=floor(1 * 255), g=floor(0.972549 * 255),
                     b=floor(0.862745 * 255))
    crimson = Color(r=floor(0.862745 * 255), g=floor(0.078431 * 255),
                    b=floor(0.235294 * 255))
    cyan = Color(r=floor(0 * 255), g=floor(1 * 255), b=floor(1 * 255))
    darkblue = Color(r=floor(0 * 255), g=floor(0 * 255),
                     b=floor(0.545098 * 255))
    darkcyan = Color(r=floor(0 * 255), g=floor(0.545098 * 255),
                     b=floor(0.545098 * 255))
    darkgoldenrod = Color(r=floor(0.721569 * 255), g=floor(0.52549 * 255),
                          b=floor(0.043137 * 255))
    darkgray = Color(r=floor(0.662745 * 255), g=floor(0.662745 * 255),
                     b=floor(0.662745 * 255))
    darkgrey = Color(r=floor(0.662745 * 255), g=floor(0.662745 * 255),
                     b=floor(0.662745 * 255))
    darkgreen = Color(r=floor(0 * 255), g=floor(0.392157 * 255),
                      b=floor(0 * 255))
    darkkhaki = Color(r=floor(0.741176 * 255), g=floor(0.717647 * 255),
                      b=floor(0.419608 * 255))
    darkmagenta = Color(r=floor(0.545098 * 255), g=floor(0 * 255),
                        b=floor(0.545098 * 255))
    darkolivegreen = Color(r=floor(0.333333 * 255), g=floor(0.419608 * 255),
                           b=floor(0.184314 * 255))
    darkorange = Color(r=floor(1 * 255), g=floor(0.54902 * 255),
                       b=floor(0 * 255))
    darkorchid = Color(r=floor(0.6 * 255), g=floor(0.196078 * 255),
                       b=floor(0.8 * 255))
    darkred = Color(r=floor(0.545098 * 255), g=floor(0 * 255), b=floor(0 * 255))
    darksalmon = Color(r=floor(0.913725 * 255), g=floor(0.588235 * 255),
                       b=floor(0.478431 * 255))
    darkseagreen = Color(r=floor(0.560784 * 255), g=floor(0.737255 * 255),
                         b=floor(0.560784 * 255))
    darkslateblue = Color(r=floor(0.282353 * 255), g=floor(0.239216 * 255),
                          b=floor(0.545098 * 255))
    darkslategray = Color(r=floor(0.184314 * 255), g=floor(0.309804 * 255),
                          b=floor(0.309804 * 255))
    darkslategrey = Color(r=floor(0.184314 * 255), g=floor(0.309804 * 255),
                          b=floor(0.309804 * 255))
    darkturquoise = Color(r=floor(0 * 255), g=floor(0.807843 * 255),
                          b=floor(0.819608 * 255))
    darkviolet = Color(r=floor(0.580392 * 255), g=floor(0 * 255),
                       b=floor(0.827451 * 255))
    deeppink = Color(r=floor(1 * 255), g=floor(0.078431 * 255),
                     b=floor(0.576471 * 255))
    deepskyblue = Color(r=floor(0 * 255), g=floor(0.74902 * 255),
                        b=floor(1 * 255))
    dimgray = Color(r=floor(0.411765 * 255), g=floor(0.411765 * 255),
                    b=floor(0.411765 * 255))
    dimgrey = Color(r=floor(0.411765 * 255), g=floor(0.411765 * 255),
                    b=floor(0.411765 * 255))
    dodgerblue = Color(r=floor(0.117647 * 255), g=floor(0.564706 * 255),
                       b=floor(1 * 255))
    firebrick = Color(r=floor(0.698039 * 255), g=floor(0.133333 * 255),
                      b=floor(0.133333 * 255))
    floralwhite = Color(r=floor(1 * 255), g=floor(0.980392 * 255),
                        b=floor(0.941176 * 255))
    forestgreen = Color(r=floor(0.133333 * 255), g=floor(0.545098 * 255),
                        b=floor(0.133333 * 255))
    fuchsia = Color(r=floor(1 * 255), g=floor(0 * 255), b=floor(1 * 255))
    gainsboro = Color(r=floor(0.862745 * 255), g=floor(0.862745 * 255),
                      b=floor(0.862745 * 255))
    ghostwhite = Color(r=floor(0.972549 * 255), g=floor(0.972549 * 255),
                       b=floor(1 * 255))
    gold = Color(r=floor(1 * 255), g=floor(0.843137 * 255), b=floor(0 * 255))
    goldenrod = Color(r=floor(0.854902 * 255), g=floor(0.647059 * 255),
                      b=floor(0.12549 * 255))
    gray = Color(r=floor(0.501961 * 255), g=floor(0.501961 * 255),
                 b=floor(0.501961 * 255))
    grey = Color(r=floor(0.501961 * 255), g=floor(0.501961 * 255),
                 b=floor(0.501961 * 255))
    green = Color(r=floor(0 * 255), g=floor(0.501961 * 255), b=floor(0 * 255))
    greenyellow = Color(r=floor(0.678431 * 255), g=floor(1 * 255),
                        b=floor(0.184314 * 255))
    honeydew = Color(r=floor(0.941176 * 255), g=floor(1 * 255),
                     b=floor(0.941176 * 255))
    hotpink = Color(r=floor(1 * 255), g=floor(0.411765 * 255),
                    b=floor(0.705882 * 255))
    indianred = Color(r=floor(0.803922 * 255), g=floor(0.360784 * 255),
                      b=floor(0.360784 * 255))
    indigo = Color(r=floor(0.294118 * 255), g=floor(0 * 255),
                   b=floor(0.509804 * 255))
    ivory = Color(r=floor(1 * 255), g=floor(1 * 255), b=floor(0.941176 * 255))
    khaki = Color(r=floor(0.941176 * 255), g=floor(0.901961 * 255),
                  b=floor(0.54902 * 255))
    lavender = Color(r=floor(0.901961 * 255), g=floor(0.901961 * 255),
                     b=floor(0.980392 * 255))
    lavenderblush = Color(r=floor(1 * 255), g=floor(0.941176 * 255),
                          b=floor(0.960784 * 255))
    lawngreen = Color(r=floor(0.486275 * 255), g=floor(0.988235 * 255),
                      b=floor(0 * 255))
    lemonchiffon = Color(r=floor(1 * 255), g=floor(0.980392 * 255),
                         b=floor(0.803922 * 255))
    lightblue = Color(r=floor(0.678431 * 255), g=floor(0.847059 * 255),
                      b=floor(0.901961 * 255))
    lightcoral = Color(r=floor(0.941176 * 255), g=floor(0.501961 * 255),
                       b=floor(0.501961 * 255))
    lightcyan = Color(r=floor(0.878431 * 255), g=floor(1 * 255),
                      b=floor(1 * 255))
    lightgoldenrodyellow = Color(r=floor(0.980392 * 255),
                                 g=floor(0.980392 * 255),
                                 b=floor(0.823529 * 255))
    lightgray = Color(r=floor(0.827451 * 255), g=floor(0.827451 * 255),
                      b=floor(0.827451 * 255))
    lightgrey = Color(r=floor(0.827451 * 255), g=floor(0.827451 * 255),
                      b=floor(0.827451 * 255))
    lightgreen = Color(r=floor(0.564706 * 255), g=floor(0.933333 * 255),
                       b=floor(0.564706 * 255))
    lightpink = Color(r=floor(1 * 255), g=floor(0.713725 * 255),
                      b=floor(0.756863 * 255))
    lightsalmon = Color(r=floor(1 * 255), g=floor(0.627451 * 255),
                        b=floor(0.478431 * 255))
    lightseagreen = Color(r=floor(0.12549 * 255), g=floor(0.698039 * 255),
                          b=floor(0.666667 * 255))
    lightskyblue = Color(r=floor(0.529412 * 255), g=floor(0.807843 * 255),
                         b=floor(0.980392 * 255))
    lightslategray = Color(r=floor(0.466667 * 255), g=floor(0.533333 * 255),
                           b=floor(0.6 * 255))
    lightslategrey = Color(r=floor(0.466667 * 255), g=floor(0.533333 * 255),
                           b=floor(0.6 * 255))
    lightsteelblue = Color(r=floor(0.690196 * 255), g=floor(0.768627 * 255),
                           b=floor(0.870588 * 255))
    lightyellow = Color(r=floor(1 * 255), g=floor(1 * 255),
                        b=floor(0.878431 * 255))
    lime = Color(r=floor(0 * 255), g=floor(1 * 255), b=floor(0 * 255))
    limegreen = Color(r=floor(0.196078 * 255), g=floor(0.803922 * 255),
                      b=floor(0.196078 * 255))
    linen = Color(r=floor(0.980392 * 255), g=floor(0.941176 * 255),
                  b=floor(0.901961 * 255))
    magenta = Color(r=floor(1 * 255), g=floor(0 * 255), b=floor(1 * 255))
    maroon = Color(r=floor(0.501961 * 255), g=floor(0 * 255), b=floor(0 * 255))
    mediumaquamarine = Color(r=floor(0.4 * 255), g=floor(0.803922 * 255),
                             b=floor(0.666667 * 255))
    mediumblue = Color(r=floor(0 * 255), g=floor(0 * 255),
                       b=floor(0.803922 * 255))
    mediumorchid = Color(r=floor(0.729412 * 255), g=floor(0.333333 * 255),
                         b=floor(0.827451 * 255))
    mediumpurple = Color(r=floor(0.576471 * 255), g=floor(0.439216 * 255),
                         b=floor(0.847059 * 255))
    mediumseagreen = Color(r=floor(0.235294 * 255), g=floor(0.701961 * 255),
                           b=floor(0.443137 * 255))
    mediumslateblue = Color(r=floor(0.482353 * 255), g=floor(0.407843 * 255),
                            b=floor(0.933333 * 255))
    mediumspringgreen = Color(r=floor(0 * 255), g=floor(0.980392 * 255),
                              b=floor(0.603922 * 255))
    mediumturquoise = Color(r=floor(0.282353 * 255), g=floor(0.819608 * 255),
                            b=floor(0.8 * 255))
    mediumvioletred = Color(r=floor(0.780392 * 255), g=floor(0.082353 * 255),
                            b=floor(0.521569 * 255))
    midnightblue = Color(r=floor(0.098039 * 255), g=floor(0.098039 * 255),
                         b=floor(0.439216 * 255))
    mintcream = Color(r=floor(0.960784 * 255), g=floor(1 * 255),
                      b=floor(0.980392 * 255))
    mistyrose = Color(r=floor(1 * 255), g=floor(0.894118 * 255),
                      b=floor(0.882353 * 255))
    moccasin = Color(r=floor(1 * 255), g=floor(0.894118 * 255),
                     b=floor(0.709804 * 255))
    navajowhite = Color(r=floor(1 * 255), g=floor(0.870588 * 255),
                        b=floor(0.678431 * 255))
    navy = Color(r=floor(0 * 255), g=floor(0 * 255), b=floor(0.501961 * 255))
    oldlace = Color(r=floor(0.992157 * 255), g=floor(0.960784 * 255),
                    b=floor(0.901961 * 255))
    olive = Color(r=floor(0.501961 * 255), g=floor(0.501961 * 255),
                  b=floor(0 * 255))
    olivedrab = Color(r=floor(0.419608 * 255), g=floor(0.556863 * 255),
                      b=floor(0.137255 * 255))
    orange = Color(r=floor(1 * 255), g=floor(0.647059 * 255), b=floor(0 * 255))
    orangered = Color(r=floor(1 * 255), g=floor(0.270588 * 255),
                      b=floor(0 * 255))
    orchid = Color(r=floor(0.854902 * 255), g=floor(0.439216 * 255),
                   b=floor(0.839216 * 255))
    palegoldenrod = Color(r=floor(0.933333 * 255), g=floor(0.909804 * 255),
                          b=floor(0.666667 * 255))
    palegreen = Color(r=floor(0.596078 * 255), g=floor(0.984314 * 255),
                      b=floor(0.596078 * 255))
    paleturquoise = Color(r=floor(0.686275 * 255), g=floor(0.933333 * 255),
                          b=floor(0.933333 * 255))
    palevioletred = Color(r=floor(0.847059 * 255), g=floor(0.439216 * 255),
                          b=floor(0.576471 * 255))
    papayawhip = Color(r=floor(1 * 255), g=floor(0.937255 * 255),
                       b=floor(0.835294 * 255))
    peachpuff = Color(r=floor(1 * 255), g=floor(0.854902 * 255),
                      b=floor(0.72549 * 255))
    peru = Color(r=floor(0.803922 * 255), g=floor(0.521569 * 255),
                 b=floor(0.247059 * 255))
    pink = Color(r=floor(1 * 255), g=floor(0.752941 * 255),
                 b=floor(0.796078 * 255))
    plum = Color(r=floor(0.866667 * 255), g=floor(0.627451 * 255),
                 b=floor(0.866667 * 255))
    powderblue = Color(r=floor(0.690196 * 255), g=floor(0.878431 * 255),
                       b=floor(0.901961 * 255))
    purple = Color(r=floor(0.501961 * 255), g=floor(0 * 255),
                   b=floor(0.501961 * 255))
    red = Color(r=floor(1 * 255), g=floor(0 * 255), b=floor(0 * 255))
    rosybrown = Color(r=floor(0.737255 * 255), g=floor(0.560784 * 255),
                      b=floor(0.560784 * 255))
    royalblue = Color(r=floor(0.254902 * 255), g=floor(0.411765 * 255),
                      b=floor(0.882353 * 255))
    saddlebrown = Color(r=floor(0.545098 * 255), g=floor(0.270588 * 255),
                        b=floor(0.07451 * 255))
    salmon = Color(r=floor(0.980392 * 255), g=floor(0.501961 * 255),
                   b=floor(0.447059 * 255))
    sandybrown = Color(r=floor(0.956863 * 255), g=floor(0.643137 * 255),
                       b=floor(0.376471 * 255))
    seagreen = Color(r=floor(0.180392 * 255), g=floor(0.545098 * 255),
                     b=floor(0.341176 * 255))
    seashell = Color(r=floor(1 * 255), g=floor(0.960784 * 255),
                     b=floor(0.933333 * 255))
    sienna = Color(r=floor(0.627451 * 255), g=floor(0.321569 * 255),
                   b=floor(0.176471 * 255))
    silver = Color(r=floor(0.752941 * 255), g=floor(0.752941 * 255),
                   b=floor(0.752941 * 255))
    skyblue = Color(r=floor(0.529412 * 255), g=floor(0.807843 * 255),
                    b=floor(0.921569 * 255))
    slateblue = Color(r=floor(0.415686 * 255), g=floor(0.352941 * 255),
                      b=floor(0.803922 * 255))
    slategray = Color(r=floor(0.439216 * 255), g=floor(0.501961 * 255),
                      b=floor(0.564706 * 255))
    slategrey = Color(r=floor(0.439216 * 255), g=floor(0.501961 * 255),
                      b=floor(0.564706 * 255))
    snow = Color(r=floor(1 * 255), g=floor(0.980392 * 255),
                 b=floor(0.980392 * 255))
    springgreen = Color(r=floor(0 * 255), g=floor(1 * 255),
                        b=floor(0.498039 * 255))
    steelblue = Color(r=floor(0.27451 * 255), g=floor(0.509804 * 255),
                      b=floor(0.705882 * 255))
    tan = Color(r=floor(0.823529 * 255), g=floor(0.705882 * 255),
                b=floor(0.54902 * 255))
    teal = Color(r=floor(0 * 255), g=floor(0.501961 * 255),
                 b=floor(0.501961 * 255))
    thistle = Color(r=floor(0.847059 * 255), g=floor(0.74902 * 255),
                    b=floor(0.847059 * 255))
    tomato = Color(r=floor(1 * 255), g=floor(0.388235 * 255),
                   b=floor(0.278431 * 255))
    turquoise = Color(r=floor(0.25098 * 255), g=floor(0.878431 * 255),
                      b=floor(0.815686 * 255))
    violet = Color(r=floor(0.933333 * 255), g=floor(0.509804 * 255),
                   b=floor(0.933333 * 255))
    wheat = Color(r=floor(0.960784 * 255), g=floor(0.870588 * 255),
                  b=floor(0.701961 * 255))
    white = Color(r=floor(1 * 255), g=floor(1 * 255), b=floor(1 * 255))
    whitesmoke = Color(r=floor(0.960784 * 255), g=floor(0.960784 * 255),
                       b=floor(0.960784 * 255))
    yellow = Color(r=floor(1 * 255), g=floor(1 * 255), b=floor(0 * 255))
    yellowgreen = Color(r=floor(0.603922 * 255), g=floor(0.803922 * 255),
                        b=floor(0.196078 * 255))


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
            stop = {"color": color, "location": location}
            stops.append(stop)
        return stops
