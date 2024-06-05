import os
import json

# File to write the XML file paths to
output_file = "./generated_xml_manifest.json"

# Find all XML files in /xml and its subdirectories
xml_files = []
for dirpath, dirnames, filenames in os.walk('xml'):
    for filename in filenames:
        if filename.endswith(".xml"):
            # Get the relative file path
            filepath = os.path.join(dirpath, filename)
            xml_files.append(filepath)

# Write the file paths to the JSON file
with open(output_file, "w") as f:
    json.dump(xml_files, f)