"""
XML processing utilities adapted from the original plenum_first_said bot.
Handles downloading and parsing Bundestag protocol XML files.
"""

import io
import logging
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def get_url_content(url: str) -> Optional[requests.Response]:
    """Get URL content with retry logic."""
    try:
        s = requests.Session()
        retries = Retry(total=5, backoff_factor=1, status_forcelist=[502, 503, 504])
        s.mount('https://', HTTPAdapter(max_retries=retries))
        response = s.get(url, timeout=30)
        return response
    except Exception as e:
        logging.error(f"Error fetching URL {url}: {e}")
        return None


def save_xml(protocol_id: str, content: bytes, archive_dir: Path) -> str:
    """Save XML content to file."""
    archive_dir.mkdir(parents=True, exist_ok=True)
    filename = archive_dir / f"{protocol_id}.xml"

    with open(filename, 'wb') as file:
        file.write(content)

    logging.info(f'XML saved: {filename}')
    return str(filename)


def download_protocol_xml(protocol_id: str, api_key: str, archive_dir: Path) -> Optional[str]:
    """Download protocol XML from Bundestag API."""
    url = f'https://search.dip.bundestag.de/api/v1/plenarprotokoll-text/{protocol_id}?apikey={api_key}&format=xml'

    response = get_url_content(url)

    if response and response.status_code == 200:
        filename = save_xml(protocol_id, response.content, archive_dir)
        return filename
    else:
        logging.warning(f"Failed to download protocol {protocol_id}")
        return None


def parse_xml(filename: str) -> Optional[ET.Element]:
    """Parse XML file and return root element."""
    try:
        tree = ET.parse(filename)
        return tree.getroot()
    except Exception as e:
        logging.error(f"Error parsing XML file {filename}: {e}")
        return None


def get_text(xml_root: ET.Element) -> Optional[str]:
    """
    Extract text from XML root element.
    Handles different formatting styles in Bundestag protocols.
    """
    text_array = []
    klassen = ['J', '1', 'O', 'J_1', 'T']

    # Check for new format and extract text
    for p in xml_root.iter("p"):
        if any(value in p.attrib.values() for value in klassen):
            if p.text:
                text_array.append(p.text)

    # Try old format
    if not text_array:
        if xml_root.findall('text'):
            text_elem = xml_root.find('text')
            if text_elem is not None and text_elem.text:
                text_array.append(text_elem.text)
        if xml_root.findall('TEXT'):
            text_elem = xml_root.find('TEXT')
            if text_elem is not None and text_elem.text:
                text_array.append(text_elem.text)

    if not text_array:
        return None
    else:
        return ''.join(text_array)


def decode_cid_text(text: str) -> str:
    """
    Decode (cid:XX) character references produced by pdfminer for PDFs that use
    a custom CIDFont with a fixed +29 offset from ASCII (common in Bundestag PDFs
    from the early 2000s).  Characters outside printable ASCII are dropped.
    """
    def replace(m):
        ch = chr(int(m.group(1)) + 29)
        return ch if ' ' <= ch <= '~' else ''
    return re.sub(r'\(cid:(\d+)\)', replace, text)


def extract_text_from_pdf_url(pdf_url: str) -> Optional[str]:
    """
    Download a PDF and extract its text using pdfminer.six.
    Returns decoded text or None on failure.
    """
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
    except ImportError:
        logging.warning("pdfminer.six not installed; cannot extract PDF text")
        return None

    try:
        response = get_url_content(pdf_url)
        if not response or response.status_code != 200:
            logging.warning(f"Failed to download PDF: {pdf_url}")
            return None

        raw = pdfminer_extract(io.BytesIO(response.content))

        # Decode CID-encoded text if present
        if '(cid:' in raw:
            raw = decode_cid_text(raw)

        return raw if raw.strip() else None

    except Exception as e:
        logging.error(f"Error extracting text from PDF {pdf_url}: {e}")
        return None


def process_protocol_xml(filename: str) -> Optional[str]:
    """
    Process a protocol XML file and extract text.
    Returns the full text content or None if extraction fails.

    Falls back to PDF extraction when the XML text field is too short
    (< 100 chars), which happens for protocols where the DIP API only
    stores a placeholder instead of the actual transcript.
    """
    root = parse_xml(filename)
    if root is None:
        return None

    text = get_text(root)

    # Fall back to PDF when the XML text is a placeholder / too short
    if not text or len(text.strip()) < 100:
        fundstelle = root.find('fundstelle')
        pdf_url = fundstelle.findtext('pdf_url') if fundstelle is not None else None
        if pdf_url:
            logging.info(f"XML text too short for {filename}; falling back to PDF: {pdf_url}")
            text = extract_text_from_pdf_url(pdf_url)
        if not text:
            logging.warning(f"No text found in {filename}")
            return None

    return text


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test with a local XML file if available
    import sys
    if len(sys.argv) > 1:
        xml_file = sys.argv[1]
        text = process_protocol_xml(xml_file)
        if text:
            print(f"Extracted {len(text)} characters from {xml_file}")
            print(f"First 200 characters: {text[:200]}")
        else:
            print("Failed to extract text")
