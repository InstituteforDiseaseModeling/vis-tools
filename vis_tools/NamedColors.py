# ==============================================================================
# NamedColors.py - A class full of named Color objects
# ==============================================================================
"""NamedColors.py

This file contains a class that provides all the SVG color names as Color
objects.

Classes:

    * NamedColors - the SVG named colors as Color objects.

Usage::

    color = NamedColors.coral

"""

# imports
from __future__ import division
from builtins import object
from math import floor
from vis_tools import Color


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