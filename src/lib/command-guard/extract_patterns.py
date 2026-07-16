#!/usr/bin/env python3
"""
Extracts all destructive_command_guard pattern packs from Rust source
into a single JSON database: [{id, name, description, keywords, safe_patterns, destructive_patterns}]

Handles multi-line macro calls, raw strings r"...", r#"..."#, and escaped strings "...".
"""
import re, json, sys, glob, os

ROOT = "/home/claude/extract/destructive_command_guard-main/src/packs"

def find_matching_paren(s, start):
    """start points at the '(' right after macro name. Return index of matching ')'."""
    depth = 0
    i = start
    n = len(s)
    while i < n:
        c = s[i]
        if c == '(':
            depth += 1
            i += 1
        elif c == ')':
            depth -= 1
            i += 1
            if depth == 0:
                return i - 1
        elif c == 'r' and i + 1 < n and s[i+1] in ('"', '#'):
            # raw string r"..." or r#"..."# or r##"..."##
            j = i + 1
            hashes = 0
            while j < n and s[j] == '#':
                hashes += 1
                j += 1
            if j < n and s[j] == '"':
                j += 1
                closer = '"' + '#' * hashes
                end = s.find(closer, j)
                if end == -1:
                    i = n
                else:
                    i = end + len(closer)
            else:
                i += 1
        elif c == '"':
            # normal string, handle escapes
            j = i + 1
            while j < n and s[j] != '"':
                if s[j] == '\\':
                    j += 2
                else:
                    j += 1
            i = j + 1
        else:
            i += 1
    return -1

def split_top_level_args(s):
    """Split macro args on top-level commas, respecting strings/parens/brackets."""
    args = []
    depth = 0
    cur = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == 'r' and i + 1 < n and s[i+1] in ('"', '#'):
            j = i + 1
            hashes = 0
            while j < n and s[j] == '#':
                hashes += 1
                j += 1
            if j < n and s[j] == '"':
                start = i
                j += 1
                closer = '"' + '#' * hashes
                end = s.find(closer, j)
                if end == -1:
                    end = n
                    token_end = n
                else:
                    token_end = end + len(closer)
                cur.append(s[start:token_end])
                i = token_end
                continue
            else:
                cur.append(c); i += 1
        elif c == '"':
            start = i
            j = i + 1
            while j < n and s[j] != '"':
                if s[j] == '\\':
                    j += 2
                else:
                    j += 1
            token_end = min(j + 1, n)
            cur.append(s[start:token_end])
            i = token_end
        elif c in '([{':
            depth += 1
            cur.append(c); i += 1
        elif c in ')]}':
            depth -= 1
            cur.append(c); i += 1
        elif c == ',' and depth == 0:
            args.append(''.join(cur).strip())
            cur = []
            i += 1
        else:
            cur.append(c); i += 1
    if ''.join(cur).strip():
        args.append(''.join(cur).strip())
    return args

def parse_rust_string_literal(tok):
    tok = tok.strip()
    if tok.startswith('r'):
        m = re.match(r'^r(#*)"', tok)
        if m:
            hashes = m.group(1)
            inner = tok[len('r')+len(hashes)+1: -(len(hashes)+1)]
            return inner
    if tok.startswith('"') and tok.endswith('"'):
        inner = tok[1:-1]
        # unescape common sequences
        inner = inner.encode().decode('unicode_escape', errors='backslashreplace')
        return inner
    return tok

def strip_comment_lines(tok):
    if '//' not in tok:
        return tok
    lines = [ln for ln in tok.split('\n') if not ln.strip().startswith('//')]
    return '\n'.join(lines).strip()

def extract_macro_calls(text, macro_name):
    results = []
    for m in re.finditer(re.escape(macro_name) + r'!\s*\(', text):
        start = m.end() - 1  # points at '('
        end = find_matching_paren(text, start)
        if end == -1:
            continue
        inner = text[start+1:end]
        args = split_top_level_args(inner)
        args = [strip_comment_lines(a) for a in args]
        results.append(args)
    return results

def parse_pack_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()

    packs = []
    # Find each create_pack-style Pack { ... } block header fields (id/name/description/keywords)
    # Skip matches that are actually function signatures like "-> Pack {"
    for pm in re.finditer(r'Pack\s*\{', text):
        preceding = text[max(0, pm.start()-4):pm.start()].strip()
        if preceding.endswith('->'):
            continue
        block_start = pm.end()
        end = find_matching_paren(text.replace('{','(').replace('}',')'), block_start-1)
        # simpler: just search a window after Pack{ for the metadata fields (they appear first)
        window = text[block_start:block_start+2000]
        idm = re.search(r'id:\s*("(?:[^"\\]|\\.)*")', window)
        namem = re.search(r'name:\s*("(?:[^"\\]|\\.)*")', window)
        descm = re.search(r'description:\s*("(?:[^"\\]|\\.)*"|"""[\s\S]*?"""|\w+\([\s\S]*?\)\.to_string\(\)|[\s\S]*?)\n\s*(?:keywords|version)', window)
        kwm = re.search(r'keywords:\s*&\[([^\]]*)\]', window)
        if not idm:
            continue
        pack_id = parse_rust_string_literal(idm.group(1))
        pack_name = parse_rust_string_literal(namem.group(1)) if namem else pack_id
        keywords = []
        if kwm:
            keywords = [parse_rust_string_literal(t.strip()) for t in kwm.group(1).split(',') if t.strip()]
        packs.append({'id': pack_id, 'name': pack_name, 'keywords': keywords})

    # destructive_pattern! calls
    destructive = []
    for args in extract_macro_calls(text, 'destructive_pattern'):
        vals = [parse_rust_string_literal(a) for a in args]
        if len(vals) == 2:
            name, regex, reason, severity = None, vals[0], vals[1], 'High'
        elif len(vals) >= 3:
            name, regex, reason = vals[0], vals[1], vals[2]
            severity = vals[3] if len(vals) >= 4 and re.match(r'^[A-Za-z]+$', args[3].strip()) else 'High'
        else:
            continue
        destructive.append({'name': name, 'pattern': regex, 'reason': reason, 'severity': severity})

    safe = []
    for args in extract_macro_calls(text, 'safe_pattern'):
        vals = [parse_rust_string_literal(a) for a in args]
        if len(vals) >= 2:
            safe.append({'name': vals[0], 'pattern': vals[1]})

    return packs, destructive, safe

def main():
    all_packs = []
    for path in sorted(glob.glob(os.path.join(ROOT, '**', '*.rs'), recursive=True)):
        base = os.path.basename(path)
        if base in ('mod.rs',) and os.path.dirname(path) == ROOT:
            continue
        if base in ('test_helpers.rs', 'test_template.rs', 'regex_engine.rs'):
            continue
        packs_meta, destructive, safe = parse_pack_file(path)
        if not packs_meta and not destructive and not safe:
            continue
        category = os.path.relpath(os.path.dirname(path), ROOT)
        if packs_meta:
            for pm in packs_meta:
                all_packs.append({
                    'id': pm['id'],
                    'name': pm['name'],
                    'keywords': pm['keywords'],
                    'category': category,
                    'source_file': os.path.relpath(path, ROOT),
                    'destructive_patterns': destructive,
                    'safe_patterns': safe,
                })
        elif destructive or safe:
            all_packs.append({
                'id': category + '.' + os.path.splitext(base)[0],
                'name': os.path.splitext(base)[0],
                'keywords': [],
                'category': category,
                'source_file': os.path.relpath(path, ROOT),
                'destructive_patterns': destructive,
                'safe_patterns': safe,
            })

    # --- Post-process for JS/RegExp compatibility ---
    POSIX = {
        '[:alnum:]': 'A-Za-z0-9', '[:alpha:]': 'A-Za-z', '[:digit:]': '0-9',
        '[:space:]': r'\s', '[:upper:]': 'A-Z', '[:lower:]': 'a-z',
        '[:punct:]': re.escape(r"""!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~"""),
    }
    dropped = 0
    for pack in all_packs:
        for plist in (pack['destructive_patterns'], pack['safe_patterns']):
            for entry in plist:
                pat = entry['pattern']
                if '\n' in pat and '//' in pat:
                    lines = [ln for ln in pat.split('\n') if not ln.strip().startswith('//')]
                    pat = '\n'.join(lines).strip()
                    dropped += 1
                flags = ''
                # Leading whole-pattern inline flags: (?i), (?is), (?s), (?im), etc.
                m = re.match(r'^\(\?([a-zA-Z]+)\)', pat)
                if m and all(c in 'ismx' for c in m.group(1)):
                    rustflags = m.group(1)
                    pat = pat[m.end():]
                    if 'i' in rustflags:
                        flags += 'i'
                    if 's' in rustflags:
                        flags += 's'  # dotAll
                    if 'm' in rustflags:
                        flags += 'm'
                # Scoped inline flags (?i:...) / (?is:...) -> JS has no scoped flags.
                # Approximate by hoisting to the whole pattern (safe for these short,
                # single-purpose command-guard patterns) and turning into a plain group.
                def _scoped_flag(sm):
                    nonlocal flags
                    fl = sm.group(1)
                    if 'i' in fl and 'i' not in flags:
                        flags += 'i'
                    if 's' in fl and 's' not in flags:
                        flags += 's'
                    return '(?:'
                pat = re.sub(r'\(\?([ism]+):', _scoped_flag, pat)
                for k, v in POSIX.items():
                    pat = pat.replace(k, v)
                entry['pattern'] = pat
                entry['flags'] = flags
                if entry.get('reason') and '\n' in entry['reason'] and '//' in entry['reason']:
                    lines = [ln for ln in entry['reason'].split('\n') if not ln.strip().startswith('//')]
                    entry['reason'] = ' '.join(l.strip() for l in lines).strip()

    print(json.dumps(all_packs, indent=2), file=open('/home/claude/dcg_patterns.json', 'w'))
    total_d = sum(len(p['destructive_patterns']) for p in all_packs)
    total_s = sum(len(p['safe_patterns']) for p in all_packs)
    print(f"Extracted {len(all_packs)} packs, {total_d} destructive patterns, {total_s} safe patterns ({dropped} comment-cleanups)")

if __name__ == '__main__':
    main()
