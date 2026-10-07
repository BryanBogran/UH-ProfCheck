#!/usr/bin/env python3
"""Build a store ZIP (chrome or firefox) from runtime files only.

Usage: package-release.py [chrome|firefox]   (default: chrome)
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANIFESTS = {'chrome': 'manifest.json', 'firefox': 'manifest.firefox.json'}

def background_files(manifest):
    background = manifest['background']
    return [background['service_worker']] if 'service_worker' in background else background['scripts']

def main(target):
    source_manifest = ROOT / SOURCE_MANIFESTS[target]
    manifest = json.loads(source_manifest.read_text())
    if manifest['manifest_version'] != 3:
        raise ValueError(f'{target} release must use Manifest V3')
    if len(manifest['description']) > 132:
        raise ValueError('Manifest description exceeds 132 characters')
    version = manifest['version']
    if not re.fullmatch(r'\d+(?:\.\d+){0,3}', version):
        raise ValueError('Invalid release version')
    files = []
    for directory in ['src', 'icons', 'options', 'pages']:
        files.extend(p for p in (ROOT / directory).rglob('*') if p.is_file() and p.suffix in {'.js', '.css', '.html', '.png'})
    included = {p.relative_to(ROOT).as_posix() for p in files}
    required = list(manifest['icons'].values()) + background_files(manifest) + [manifest['options_page']]
    for script in manifest['content_scripts']:
        required.extend(script.get('js', []) + script.get('css', []))
    for resource in manifest.get('web_accessible_resources', []):
        required.extend(resource['resources'])
    for path in required:
        if path not in included:
            raise ValueError(f'Missing runtime file: {path}')
    for file in files:
        if file.suffix == '.html':
            for link in re.findall(r'(?:src|href)="([^"#]+)"', file.read_text()):
                if ':' in link or link.startswith('//'):
                    continue
                resolved = (file.parent / link.split('#')[0]).resolve()
                if resolved.relative_to(ROOT).as_posix() not in included:
                    raise ValueError(f'{file.relative_to(ROOT)} links to missing file: {link}')
    output = ROOT / 'dist' / f'UH-ProfCheck-{version}-{target}.zip'
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.write(source_manifest, 'manifest.json')
        for file in sorted(files):
            archive.write(file, file.relative_to(ROOT).as_posix())
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError('ZIP integrity check failed')
        if archive.namelist().count('manifest.json') != 1:
            raise ValueError('ZIP must have a root manifest')
    print(f'Validated {target} release {version}: {len(files) + 1} runtime files, {output.stat().st_size:,} bytes')
    print(output)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'chrome')
