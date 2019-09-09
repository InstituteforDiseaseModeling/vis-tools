import http.server
import socketserver
import subprocess
import socket
import time
import sys

# Constants
k_port = 8000
k_command = [
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "--js-flags='--max_old_space_size=8192'",
    "--max_old_space_size=8192",
    "http://localhost:%d/vistools/geospatial.html?set=/zambia_data/Vis-Tools/shapes_demo/visset.json" % k_port
]

# Fire up an HTTP server serving up the current directory
try:
    # Seems http.server was serving up AJAX script files as text/plain, and
    # newer versions of Chrome would as a result refuse to execute them.
    http.server.SimpleHTTPRequestHandler.extensions_map[".js"] =\
        "application/x-javascript"
    httpd = socketserver.TCPServer(("", k_port),
                                   http.server.SimpleHTTPRequestHandler)
except socket.error:
    print("It appears that some other program is currently using port %d. "\
          "To use a different port, edit server.py and change the k_port "\
          "constant to some other port, such as 8080. Or find and kill the "\
          "program that is currently using port %d." % (k_port, k_port))
except BaseException:
    print("Could not create a server on port %d due to %s exception." %\
          (k_port, sys.exc_info()[0]))
else:
    print("Vis-Tools serving on port %d...\n" % k_port)

    # Fire up chrome with options that allow large memory usage
    time.sleep(2)
    p = subprocess.Popen(k_command)

    # Start serving (yes, possible race condition here)
    httpd.serve_forever()
