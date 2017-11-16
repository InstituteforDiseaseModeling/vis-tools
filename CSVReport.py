# ==============================================================================
# CSVReport.py - Python wrapper for IDM csv report files
# ==============================================================================
"""CVSReport.py

This class is a simple Python wrapper for csv report files.

Usage::
    report = CSVReport(path.combine(my_dir, "ReportEventRecorder.csv"))
    print report

"""
from __future__ import print_function

# imports
from builtins import range
from builtins import object
import csv


# ==============================================================================
# CSVReport - a class to hold IDM csv report files
# ==============================================================================
class CSVReport(object):
    """Class to hold DTK CSV report data.

    The class is constructed with the path to the report file in question.
    Thereafter the public data members source_file and rows may be used to
    directly access the resultant Python representation of the file.

    Additionally, since CSVReport implements __len__ and __iter__, the report
    object can be treated like a list, e.g.::

        row = report[10]    # Obtain the 11th row

    Public members:
        The following data members are publicly exposed.

        source_file (str): A copy of the file_path that was used to construct
        the CSVReport object.

        rows (array): Array of Python objects made from the input file lines.

        header (array): Array of field names read from top of CSV file.

    """
    def __init__(self, file_path="", verbose=False):
        """Construct a CSVReport.

        Args:
            file_path (str): The path to the CSV report file.
            verbose (bool): True for extra message from methods.

        Raises:
            I/O or csv exceptions.

        """
        # data members
        self.source_file = ""
        self.rows = []
        self.header = []
        self._verbose = verbose

        # read if file path was given
        if not file_path == "":
            self._read_csv(file_path)

    # --------------------------------------------------------------------------
    def __str__(self):
        """Generates a textual representation of a CSVReport.

        This method allows the CSVReport object to report the source
        file and number of rows when it is printed.

        Returns:
            str: String containing source file and row count.

        """
        if len(self.rows) == 0:
            return "(empty)"
        else:
            return self.source_file + ": " + repr(len(self.rows)) + " rows"

    # --------------------------------------------------------------------------
    def __len__(self):
        """Returns the number of rows read from the CSV report.

        Returns:
            int: Number of rows in CSV report.

        """
        return len(self.rows)

    # --------------------------------------------------------------------------
    def __iter__(self):
        """Returns an iterator for the CSV rows.

        Returns:
            iterator: Iterator for CSV report rows.

        """
        return self.rows.__iter__()

    # --------------------------------------------------------------------------
    def make_series(self, name, time_field, data_field):
        """Make a Highcharts-compatible series object from CSV rows.

        Returns:
            obj: Object for use as a Highcharts data series.

        Args:
            name (str): The name that is put into the output series structure.

            time_field (str): The column name for the column representing time.

            data_field (str): The column name for teh data (Y) value.

        Raises:
            Data access exceptions.

        """
        result = {
            "name": name,
            "data": []
        }
        if len(self.rows) == 0 and self._verbose:
            print("CSVReport.make_series called but no rows present")
        for row in self.rows:
            result["data"].append(
                [int(row[time_field]), float(row[data_field])])
        return result

    # --------------------------------------------------------------------------
    def read_partial(self, file_path, row_count):
        """Read the first row_count rows off a CSV.

        To do a partial read of a CSV report, create a CSVReport with the
        default constructor, then call read_partial to read as many rows as
        desired. E.g.::

            report = CSVReport()
            report.read_partial(my_csv_file_path, 100)
            print report.rows[10]

        Returns:
            None.

        Args:
            file_path (str): File path of CSV report.

            row_count: The number of rows to read.

        Raises:
            I/O, csv exceptions.

        """
        self.source_file = file_path
        self._read_csv_partial(file_path, row_count)

    # --------------------------------------------------------------------------
    def missing_columns(self, column_list):
        """Confirms that a given set of columns exists in a CSVReport.

        This function can be used to verify the presence of a set of
        (presumably required) fields in a CSVReport. Typical usage is::

            if (rpt.missing_columns(["Time", "Node_ID"]) is None)
                # All require columns present, so carry on

        Returns:
            List of columns from column_list that are not present, or None if
            all columns are present.

        Args:
            column_list (list): Columns to be tested for.

        """
        if len(self.header) == 0:
            return column_list      # Probably nothing was read
        result = [column for column in column_list if column not in self.header]
        return result if len(result) > 0 else None

    # --------------------------------------------------------------------------
    # Implementation
    # --------------------------------------------------------------------------
    def _read_csv(self, csv_file_path):
        try:
            with open(csv_file_path, "rb") as csv_file:
                # the following is required because some CSVs generated by the
                # reporters have Spaces, In, The, Header, Line.
                # Also, they have "Double", "Quotes" so we strip that too.
                self.header = [h.strip().replace('"', '')
                          for h in csv_file.next().split(',')]
                reader = csv.DictReader(csv_file, fieldnames=self.header)
                self.source_file = csv_file_path
                self.rows = []
                for row in reader:
                    self.rows.append(row)
        except BaseException:
            if self._verbose:
                print("CSVReport._read_csv: Exception reading CSV")
            raise

    # --------------------------------------------------------------------------
    def _read_csv_partial(self, csv_file_path, row_count):
        try:
            with open(csv_file_path, "rb") as csv_file:
                # the following is required because some CSVs generated by the
                # reporters have Spaces, In, The, Header, Line.
                # Also, they have "Double", "Quotes" so we strip that too.
                self.header = [h.strip().replace('"', '')
                          for h in csv_file.next().split(',')]
                reader = csv.DictReader(csv_file, fieldnames=self.header)
                self.source_file = csv_file_path
                self.rows = []
                for row_num in range(0, row_count):
                    self.rows.append(next(reader))
        except BaseException:
            if self._verbose:
                print("CSVReport._read_csv_partial: Exception partial-reading "\
                        "CSV")
            raise
