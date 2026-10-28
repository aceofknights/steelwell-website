"""Discover and audit every HTML/CSS/JS URL without third-party dependencies."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor
import json,re,argparse
ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://chriswellsdev.com'
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.refs=[];self.ids=[];self.title='';self.canonical=None;self.base=None;self.t=False;self.feed(text)
 def add(self,tag,attr,value):
  if value:self.refs.append(dict(tag=tag,attribute=attr,value=value,line=self.getpos()[0]))
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='title':self.t=True
  if tag=='base':self.base=a.get('href');return
  if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href')
  for attr in ['href','src','action','poster','data','xlink:href']:
   if attr in a:self.add(tag,attr,a[attr])
  for attr in ['srcset']:
   if attr in a:
    for candidate in a[attr].split(','):self.add(tag,attr,candidate.strip().split()[0])
  if tag=='meta' and a.get('property',a.get('name')) in ['og:image','og:url','twitter:image','twitter:url']:self.add('meta',a.get('property',a.get('name')),a.get('content'))
  if 'style' in a:
   for value in css_refs(a['style']):self.add('css','url',value)
 def handle_endtag(self,tag):
  if tag=='title':self.t=False
 def handle_data(self,data):
  if self.t:self.title+=data

def css_refs(text):
 return re.findall(r'url\(\s*[\"\x27]?([^\s)\"\x27]+)',text)+re.findall(r'@import\s+[\"\x27]([^\"\x27]+)',text)
def resolve(source,value):
 return urlsplit(urljoin(ORIGIN+source,value))
def target(url):
 p=ROOT/unquote(url.path).lstrip('/')
 return p/'index.html' if p.is_dir() else p

def build(check_external=False):
 files=sorted(p for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts)
 exact={p.relative_to(ROOT).as_posix() for p in files};htmls={p:Page(p.read_text(encoding='utf-8')) for p in files if p.suffix=='.html'}
 routes=json.loads((ROOT/'data/routes.json').read_text(encoding='utf-8'))['routes'];known={r['file'] for r in routes}|{r['old'].lstrip('/') for r in routes if r['old']}
 refs=[];external={};failures=[]
 for p in files:
  source='/'+p.relative_to(ROOT).as_posix();text=None;items=[]
  if p in htmls:
   text=p.read_text(encoding='utf-8');items=list(htmls[p].refs)
   for value in css_refs(text):items.append(dict(tag='inline-css',attribute='url',value=value))
   for script in re.findall(r'<script\b[^>]*>(.*?)</script>',text,re.S|re.I):
    for value in re.findall(r'[\"\x27]((?:/|\.\./)[^\"\x27\s<>]+)[\"\x27]',script):
     if value.endswith(('.json','.js','.css','.jpg','.png','.pdf','.html')):items.append(dict(tag='inline-js',attribute='static-url',value=value))
   # Literal inline navigation and statically discoverable file URLs.
   for value in re.findall(r'(?:location\.href\s*=\s*)[\"\x27]([^\"\x27]+)',text):items.append(dict(tag='inline-js',attribute='destination',value=value))
  elif p.suffix=='.svg':
   text=p.read_text(encoding='utf-8');items=Page(text).refs
  elif p.name=='sitemap.xml':
   text=p.read_text(encoding='utf-8');items=[dict(tag='sitemap',attribute='loc',value=v) for v in re.findall(r'<loc>(.*?)</loc>',text)]
  elif p.name=='robots.txt':
   text=p.read_text(encoding='utf-8');items=[dict(tag='robots',attribute='sitemap',value=v) for v in re.findall(r'Sitemap:\s*(\S+)',text)]
  elif p.relative_to(ROOT).as_posix()=='data/projects.json':
   for project in json.loads(p.read_text(encoding='utf-8'))['projects']:
    for value in [project['showcase'],*[x['url'] for x in project['links']],*([('/'+project['preview']['src'])] if project['preview'] else [])]:items.append(dict(tag='project-metadata',attribute='url',value=value))
  elif p.suffix=='.css':
   text=p.read_text(encoding='utf-8');items=[dict(tag='css',attribute='url',value=v) for v in css_refs(text)]
  elif p.suffix=='.js':
   text=p.read_text(encoding='utf-8')
   values=re.findall(r'[\"\x27]((?:/|\.\./)[^\"\x27\s<>]+)[\"\x27]',text)
   # Ignore regexes, selectors, extension tests and incomplete string-building prefixes.
   for value in values:
    if value in ['../','../../','/','/projects/','/tools-games/','/hex-math/','/feedback/','/seating-chart/','/sort-the-numbers/','/resume/'] or value.endswith(('.html','.js','.json','.jpg','.png','.css','.pdf')) or re.fullmatch(r'/[a-z0-9/-]+/',value):
     if value not in ['../','../../']:items.append(dict(tag='js',attribute='static-url',value=value))
  if text:
   for value in re.findall(r'sourceMappingURL=([^\s*]+)',text):items.append(dict(tag='source-map',attribute='url',value=value))
  for item in items:
   v=item['value'];record={'source':source,**item}
   if v.startswith(('data:','blob:','javascript:')):record['result']='inline-or-runtime';refs.append(record);continue
   u=resolve(htmls[p].base or source if p in htmls else source,v)
   if u.netloc and u.netloc!=urlsplit(ORIGIN).netloc or u.scheme not in ['http','https']:
    record['result']='external';external.setdefault(u.geturl(),dict(url=u.geturl(),status='unverified',sources=[]))['sources'].append(source);refs.append(record);continue
   file=target(u);record['resolved']=u.path+('?' +u.query if u.query else '')+('#'+u.fragment if u.fragment else '');record['target']=file.relative_to(ROOT).as_posix() if file.is_relative_to(ROOT) else str(file)
   ok=file.is_file() and record['target'] in exact
   if ok and u.fragment:
    ids=htmls[file].ids if file in htmls else re.findall(r'\bid=[\"\x27]([^\"\x27]+)',file.read_text(encoding='utf-8')) if file.suffix=='.svg' else []
    ok=unquote(u.fragment) in ids
   record['result']='pass' if ok else 'fail'
   if ok and item['tag']=='a' and urlsplit(v).path.endswith('.html'):
    record['result']='fail';record['reason']='Unexpected HTML navigation'
   if record['result']=='fail':failures.append(record)
   refs.append(record)
 # Titles/canonicals and all discovered pages, including utilities and compatibility documents.
 pages=[]
 for p,info in htmls.items():
  source='/'+p.relative_to(ROOT).as_posix();pages.append(dict(file=source,title=info.title,canonical=info.canonical,cleanRoute=urlsplit(info.canonical or '').path,legacyCompatibility=[r['old'] for r in routes if r['canonical']==info.canonical and r['old']],ids=info.ids,references=len(info.refs)))
  if p.relative_to(ROOT).as_posix() not in known:failures.append(dict(source=source,reason='Discovered HTML is missing from the route inventory'))
  if not info.canonical:failures.append(dict(source=source,reason='Missing canonical'))
 if check_external:
  def check(entry):
   url=entry['url']
   if not url.startswith(('http:','https:')):entry['detail']='Non-HTTP scheme; not contacted';return
   try:
    with urlopen(Request(url,method='HEAD',headers={'User-Agent':'ChrisWellsDev-local-link-audit/1.0'}),timeout=7) as r:
     entry.update(status='redirected' if r.url!=url else 'verified',httpStatus=r.status,finalURL=r.url)
   except HTTPError as e:entry.update(status='blocked' if e.code in [401,403,405,429] else 'unavailable',httpStatus=e.code)
   except Exception as e:entry.update(status='unverified',detail=str(e))
  with ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(check,external.values()))
 report=dict(pages=pages,references=refs,external=list(external.values()),failures=failures,scope='Every discovered HTML and CSS file; literal static URLs and source maps in every JS file. Runtime-generated URLs additionally checked by browser scenarios.',totals=dict(pagesDiscovered=len(pages),references=len(refs),internalReferences=sum(r['result'] in ['pass','fail'] for r in refs),assetsChecked=len(set(r.get('target') for r in refs if r.get('target') and not r['target'].endswith('.html'))),externalLinks=len(external),brokenReferences=len(failures),unexpectedHtmlNavigation=sum(r.get('reason')=='Unexpected HTML navigation' for r in refs)))
 return report
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--external',action='store_true');parser.add_argument('--output',default='docs/migration-reference-audit.json');args=parser.parse_args()
 dest=ROOT/args.output;dest.parent.mkdir(exist_ok=True,parents=True)
 if not dest.exists():dest.write_text('{}',encoding='utf-8')
 previous=json.loads(dest.read_text(encoding='utf-8'));report=build(args.external)
 if not args.external:
  cached={x['url']:x for x in previous.get('external',[])}
  for entry in report['external']:
   if entry['url'] in cached:entry.update({k:v for k,v in cached[entry['url']].items() if k!='sources'})
 dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report['totals']));print(json.dumps(report['failures'][:20],ensure_ascii=False));raise SystemExit(bool(report['failures']))
