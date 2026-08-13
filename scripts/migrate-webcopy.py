"""One-time migration from archive/webcopy; not needed to develop or build.

Requires beautifulsoup4. Refuses to overwrite the maintained source tree.
"""

from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from bs4 import BeautifulSoup, Comment
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'archive/webcopy'
SRC = ROOT / 'src'
if (SRC / 'layouts/SiteLayout.astro').exists():
    raise SystemExit('src already exists; migration is intentionally one-time.')


def write(path, text):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def local_url(value, route='/'):
    if not value or value.startswith(('data:', '#', 'mailto:', 'tel:')):
        return value
    parsed = urlsplit(urljoin('https://nodcoding.com' + route, value))
    if parsed.netloc != 'nodcoding.com':
        return value
    path = parsed.path
    path = path.replace('/wp-content/uploads/', '/assets/media/')
    path = path.replace('/wp-content/themes/nod/static/', '/assets/')
    path = re.sub(r'index\.htm$', '', path)
    return path + (('#' + parsed.fragment) if parsed.fragment else '')


for folder, target in [('wp-content/uploads', 'media'), ('wp-content/themes/nod/static/images', 'images'),
                       ('wp-content/themes/nod/static/fonts/heywow', 'fonts'), ('wp-content/themes/nod/static/favicon', 'favicon')]:
    shutil.copytree(ARCHIVE / folder, ROOT / 'public/assets' / target, dirs_exist_ok=True)

css = (ARCHIVE / 'wp-content/themes/nod/build/css/no-script.css').read_text(encoding='utf-8-sig')
css = css.replace('../../static/images/', '/assets/images/')
write('src/styles/theme.css', '/* Original Nod visual styles, preserved during migration. See docs/architecture.md. */\n' + css)

forms = {}
sections = {}
pages = {}
downloads = {}


def clean(node, route):
    for comment in node.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()
    for unwanted in node.select('script, noscript, .screen-reader-response, .hidden-fields-container'):
        unwanted.decompose()
    for protected in node.select('[data-cfemail]'):
        encoded = bytes.fromhex(protected['data-cfemail'])
        email = ''.join(chr(c ^ encoded[0]) for c in encoded[1:])
        protected.replace_with(email)
    for el in [node, *node.find_all(True)]:
        if not el.attrs:
            continue
        if el.get('href', '').startswith('/cdn-cgi/l/email-protection#'):
            encoded = bytes.fromhex(el['href'].split('#')[1])
            el['href'] = 'mailto:' + ''.join(chr(c ^ encoded[0]) for c in encoded[1:])
        for key in ['src', 'srcset', 'sizes', 'poster']:
            if el.has_attr('data-' + key):
                el[key] = el['data-' + key]
                del el['data-' + key]
        for key in ['href', 'src', 'poster']:
            if el.has_attr(key):
                el[key] = local_url(el[key], route)
        if el.has_attr('srcset'):
            el['srcset'] = ', '.join(local_url(part.strip().split()[0], route) + ' ' + part.strip().split()[-1]
                                    for part in el['srcset'].split(','))
        if el.has_attr('data-lg-lottie'):
            remote = el['data-lg-lottie']
            el['data-animation'] = local_url(remote, route)
            downloads[remote] = 'public' + el['data-animation']
        for key in list(el.attrs):
            if key.startswith(('data-lg-', 'data-plr-', 'data-wpcf7', 'data-lenis', 'on')):
                del el[key]
        if el.has_attr('style'):
            el['style'] = re.sub(r'opacity:\s*0\s*;?', '', el['style']).strip()
            if not el['style']:
                del el['style']
        if el.name == 'img':
            el.attrs.setdefault('alt', '')
            el['decoding'] = 'async'
            el.attrs.setdefault('loading', 'lazy')
        if el.get('target') == '_blank':
            el['rel'] = 'noopener noreferrer'
        for key in ['src', 'poster']:
            url = el.get(key, '')
            if url.startswith('/assets/') and not (ROOT / ('public' + unquote(url))).exists():
                remote = url.replace('/assets/media/', '/wp-content/uploads/').replace('/assets/', '/wp-content/themes/nod/static/')
                downloads['https://nodcoding.com' + remote] = 'public' + url
    # Restore case-sensitive SVG attributes normalized by the HTML parser on output.
    for form in list(node.select('form')):
        wrapper = form.find_parent(class_='wpcf7')
        form_id = wrapper.get('data-wpcf7-id') if wrapper else None
        # WP numeric IDs are stable across copies; infer from the original wrapper ID.
        match = re.search(r'wpcf7-f(\d+)', wrapper.get('id', '') if wrapper else '')
        form_id = 'form-' + (match.group(1) if match else str(len(forms)))
        if form_id not in forms:
            fields = []
            for field in form.select('input, textarea, select'):
                kind = field.get('type', field.name)
                if kind in ['hidden', 'submit']:
                    continue
                item = {'name': field.get('name', ''), 'type': kind,
                        'label': field.get('placeholder') or field.get('name', '').replace('-', ' ').title(),
                        'required': field.get('aria-required') == 'true'}
                if field.name == 'select':
                    item['label'] = 'Bootcamp' if item['name'] == 'bootcamp' else item['label']
                    item['options'] = [{'value': o.get('value', o.text), 'label': o.text} for o in field.select('option')]
                if kind in ['checkbox', 'radio']:
                    label = field.find_parent('label')
                    item['label'] = label.get_text(' ', strip=True) if label else item['label']
                    item['required'] = True
                fields.append(item)
            submit = form.select_one('[type=submit]')
            forms[form_id] = {'fields': fields, 'submit': (submit.get('value') or submit.get_text(' ', strip=True)) if submit else 'Send'}
        replacement = BeautifulSoup(f'<contact-form-placeholder form-id="{form_id}"></contact-form-placeholder>', 'html.parser')
        (wrapper or form).replace_with(replacement)
    return node


def markup(node):
    text = str(node).replace('{', '&#123;').replace('}', '&#125;')
    for attr in ['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'patternTransform', 'markerWidth', 'markerHeight', 'refX', 'refY', 'clipPathUnits']:
        text = re.sub(r'\b' + attr.lower() + '=', attr + '=', text)
    text = re.sub(r'<contact-form-placeholder form-id="([^"]+)"></contact-form-placeholder>', r'<ContactForm formId="\1" />', text)
    text = re.sub(r'\s+class=""', '', text)
    return text + '\n'


def save_component(relative, text):
    imports = ''
    if '<ContactForm ' in text:
        depth = len(Path(relative).parts) - 2
        imports = "---\nimport ContactForm from '" + '../' * depth + "components/forms/ContactForm.astro';\n---\n\n"
    write(relative, imports + text)


for path in sorted(ARCHIVE.glob('**/index.htm')):
    slug = 'home' if path.parent == ARCHIVE else path.parent.name
    route = '/' if slug == 'home' else '/' + slug + '/'
    soup = BeautifulSoup(path.read_text(encoding='utf-8-sig'), 'html.parser')
    description = soup.select_one('meta[name=description]')
    pages[slug] = {'title': soup.title.text, 'description': description['content'] if description else soup.title.text,
                   'layout': soup.main.get('class', ['l-page'])[0], 'path': route}
    clean(soup.body, route)
    if slug == 'home':
        save_component('src/components/layout/SiteFooter.astro', markup(soup.footer))
        modal = soup.select_one('#apply-now')
        save_component('src/components/forms/ApplicationModal.astro', markup(modal))
    imports = ["import SiteLayout from '../layouts/SiteLayout.astro';", "import { pages } from '../data/pages';"]
    body = []
    counts = {}
    for child in soup.main.children:
        if not child.name:
            continue
        css_class = child.get('class', ['content'])[0]
        base_name = child.get('id') or re.sub(r'^[sb]-', '', css_class)
        name = ''.join(x.title() for x in base_name.split('-'))
        counts[name] = counts.get(name, 0) + 1
        name += str(counts[name]) if counts[name] > 1 else ''
        if css_class == 's-faq':
            # Native details keeps FAQ content accessible with keyboard and without JS.
            for question in child.select('.sb-question'):
                question.name = 'details'
                heading = question.select_one('.sb__question')
                heading.name = 'summary'
        text = markup(child)
        if text in sections:
            component_path = sections[text]
        else:
            component_path = f'src/components/sections/{slug}/{name}.astro'
            sections[text] = component_path
            save_component(component_path, text)
        imports.append(f"import {name} from '../{component_path.removeprefix('src/')}';")
        body.append(f'  <{name} />')
    content = '---\n' + '\n'.join(imports) + '\n---\n\n'
    content += f'<SiteLayout {{...pages["{slug}"]}}>\n' + '\n'.join(body) + '\n</SiteLayout>\n'
    write('src/pages/' + ('index' if slug == 'home' else slug) + '.astro', content)

write('src/data/pages.ts', 'export const pages = ' + json.dumps(pages, ensure_ascii=False, indent=2) + ' as const;\n')
write('src/data/forms.json', json.dumps(forms, ensure_ascii=False, indent=2) + '\n')
write('scripts/asset-downloads.json', json.dumps(downloads, indent=2) + '\n')
print(f'Migrated {len(pages)} pages, {len(sections)} sections, {len(forms)} form definitions. Missing assets: {len(downloads)}.')
