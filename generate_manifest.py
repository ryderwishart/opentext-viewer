import os
import json

# Directory containing the XML files
xml_dir = "./xml"

# File to write the XML file paths to
output_file = "./generated_xml_manifest.json"

# Find all XML files in the directory and its subdirectories
xml_files = []
for dirpath, dirnames, filenames in os.walk(xml_dir):
    for filename in filenames:
        if filename.endswith(".xml"):
            # Convert the file path to be relative to the xml directory
            relpath = os.path.relpath(dirpath, xml_dir)
            filepath = os.path.join(dirpath, relpath, filename)
            xml_files.append(filepath)

# Write the file paths to the JSON file
with open(output_file, "w") as f:
    json.dump(xml_files, f)
