# import sys
from setuptools import setup, find_packages

requires = ['czml>=0.3.3',
            'future>=0.16.0']

long_description = "The Institute for Disease Modeling (IDM) develops complex "\
    "software for disease modeling. The primary software, Epidemiological "\
    "MODeling software (EMOD), helps determine the combination of health "\
    "policies and intervention strategies that can lead to disease "\
    "eradication. The effective use of EMOD requires analysis of simulation "\
    "output. Vis-Tools is a collection of software tools that aids in the "\
    "visualization of geospatial simulation data."

# if sys.version_info[0] == 2:
#     # backport of enum functionality for Python 2
#     requires.append('enum34>=1.1.6')

setup(name='vis-tools',
      version='1.3.1',
      description='Python preprocessing classes for advanced visualization',
      long_description=long_description,
      url='https://github.com/InstituteforDiseaseModeling/vis-tools',
      author='Bryan Ressler',
      author_email='bressler@idmod.org',
      classifiers=[
          'Development Status :: 5 - Production/Stable',
          'Environment :: Win32 (MS Windows)',
          'Intended Audience :: Science/Research',
          'Natural Language :: English',
          'Operating System :: Microsoft :: Windows',
          'Programming Language :: Python :: 2.7',
          'Programming Language :: Python :: 3.6',
          'Programming Language :: JavaScript',
          'Topic :: Scientific/Engineering :: Visualization'
      ],
      entry_points={
        'console_scripts': [
            'survey=vis_tools.Survey:main'
        ]
      },
      install_requires=requires,
      include_package_data=True,
      keywords='vistools vis-tools vis_tools preprocessing visualization ' +
               'idm emod dtk',
      packages=find_packages(exclude=['test']),
      package_data={'vis_tools': ['../vistools/defaultvisset.json']},
      python_requires='>=2.7, >=3.6',
      zip_safe=False)
