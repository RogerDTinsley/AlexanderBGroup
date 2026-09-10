from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree, indent
from pypdf import PdfReader
import re

source = Path('ALEXANDER_NEW_09_23.pdf')
output = Path('public/ALEXANDER_NEW_09_23.xml')
raw = '\n'.join((page.extract_text() or '') for page in PdfReader(str(source)).pages)

def clean(value):
    value = ' '.join(value.split())
    try:
        repaired = value.encode('cp1252').decode('utf-8')
        if repaired.count('\ufffd') <= value.count('\ufffd'):
            value = repaired
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return value.strip()

lines = [clean(line) for line in raw.splitlines()]
lines = [line for line in lines if line and not re.fullmatch(r'\d+', line)]
city_pattern = r'(Shreveport|Bossier City|Benton|Box Elder),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)'
header_re = re.compile(r'^([A-Z][A-Z ]+?)\s+(.+?)\s+' + city_pattern + r'$')
headers = [(i, header_re.match(line)) for i, line in enumerate(lines) if header_re.match(line)]
phone_re = re.compile(r'(\(\d{3}\)\s*\d{3}[- ]\d{4}|\d{3}[- ]\d{3}[- ]\d{4}|No Phone)', re.I)
date_re = re.compile(r'\d{1,2}/\d{1,2}/\d{2,4}')
email_re = re.compile(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}')
labels = {'employment': 'Occupation', 'employment/retired': 'Occupation', 'employment/ministry': 'Occupation', 'retired': 'Occupation', 'ministry': 'Ministry', 'ministry involvement': 'Ministry', 'fun facts/hobbies': 'funfacts'}

def is_contact(line):
    return bool(phone_re.search(line) or date_re.search(line))

def is_person_start(block, i):
    line = block[i]
    if line.lower() in labels:
        return False
    if is_contact(line):
        prefix = phone_re.split(line, maxsplit=1)[0].strip()
        return bool(prefix and not prefix.lower().startswith(('employment', 'ministry', 'fun facts')))
    return i + 1 < len(block) and is_contact(block[i + 1]) and not line.lower().startswith(('employment', 'ministry', 'fun facts'))

def parse_person(block, start, end):
    person = {'name': block[start], 'phone': '', 'email': '', 'birthday': '', 'Occupation': [], 'Ministry': [], 'funfacts': []}
    first = block[start]
    phone_match = phone_re.search(first)
    if phone_match:
        person['name'] = first[:phone_match.start()].strip()
        contact = first[phone_match.start():]
        cursor = start + 1
    else:
        cursor = start + 1
        contact = block[cursor] if cursor < end and is_contact(block[cursor]) else ''
        if contact:
            cursor += 1
    if contact:
        phone_match = phone_re.search(contact)
        if phone_match:
            person['phone'] = clean(phone_match.group(1))
        email_match = email_re.search(contact)
        if email_match:
            person['email'] = email_match.group(0)
        dates = date_re.findall(contact)
        if dates:
            person['birthday'] = dates[-1]
    current = 'funfacts'
    pending = []
    while cursor < end:
        line = block[cursor]
        key = labels.get(line.lower())
        if key:
            if pending:
                person[current].extend(pending)
                pending = []
            current = key
        elif is_contact(line) and not person['phone']:
            phone_match = phone_re.search(line)
            if phone_match:
                person['phone'] = clean(phone_match.group(1))
            email_match = email_re.search(line)
            if email_match:
                person['email'] = email_match.group(0)
            dates = date_re.findall(line)
            if dates:
                person['birthday'] = dates[-1]
        else:
            pending.append(line)
        cursor += 1
    person[current].extend(pending)
    for key in ('Occupation', 'Ministry', 'funfacts'):
        person[key] = clean(' '.join(person[key]))
    return person

families = []
for pos, (header_index, header) in enumerate(headers):
    next_header = headers[pos + 1][0] if pos + 1 < len(headers) else len(lines)
    surname, street, city, state, zip_code = header.groups()
    block = lines[header_index + 1:next_header]
    starts = [i for i in range(len(block)) if is_person_start(block, i)]
    people = [parse_person(block, start, starts[j + 1] if j + 1 < len(starts) else len(block)) for j, start in enumerate(starts)]
    if not people and block:
        people = [parse_person(block, 0, len(block))]
    families.append((surname.strip(), street, city, state, zip_code, people))

root = Element('Record', {'name': 'Alexander B Group'})
membership = SubElement(root, 'membership')
for surname, street, city, state, zip_code, people in families:
    family = SubElement(membership, 'family', {'name': f"{surname}, {' and '.join(p['name'] for p in people)}"})
    for tag, value in [('Address', street), ('City', city), ('State', state), ('Zip', zip_code), ('Picture', '')]:
        SubElement(family, tag).text = value
    for person in people:
        parts = person['name'].split()
        member = SubElement(family, 'member')
        SubElement(member, 'firstname').text = parts[0] if parts else ''
        SubElement(member, 'lastname').text = ' '.join(parts[1:]) if len(parts) > 1 else surname.title()
        SubElement(member, 'familyrole').text = 'Spouse' if len(people) > 1 else 'Member'
        for tag in ('email', 'phone', 'birthday'):
            SubElement(member, tag).text = person[tag]
        SubElement(member, 'role').text = 'Member'
        SubElement(member, 'Picture').text = ''
        SubElement(member, 'Occupation').text = person['Occupation']
        SubElement(member, 'Ministry').text = person['Ministry']
        SubElement(member, 'funfacts').text = person['funfacts']
security = SubElement(root, 'SecurityRoles')
for role in ('Admin', 'Member', 'Maintainer', 'Interested', 'Withdrawn', 'Guest'):
    SubElement(security, 'Role').text = role
indent(root, space='    ')
ElementTree(root).write(output, encoding='utf-8', xml_declaration=True)
print('families', len(families), 'members', sum(len(f[-1]) for f in families))
