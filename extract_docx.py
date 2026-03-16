import xml.etree.ElementTree as ET
import os

xml_path = r'c:\Users\Usuario\Desktop\Virtual Office 101\virtual-office\docx_temp\word\document.xml'
output_path = r'c:\Users\Usuario\Desktop\Virtual Office 101\virtual-office\miniverse_content.txt'

if os.path.exists(xml_path):
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text_elements = root.findall('.//w:t', ns)
        # Extract text and handle None values
        text_lines = []
        # Group by paragraph for better readability
        for p in root.findall('.//w:p', ns):
            p_text = ''.join([t.text for t in p.findall('.//w:t', ns) if t.text])
            if p_text:
                text_lines.append(p_text)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(text_lines))
        print(f"Success: Content written to {output_path}")
    except Exception as e:
        print(f"Error: {e}")
else:
    print(f"File not found: {xml_path}")
