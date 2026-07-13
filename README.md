# tree-sitter-extempore

A [tree-sitter](https://tree-sitter.github.io/) grammar for
[Extempore](https://extemporelang.github.io/), the live coding environment for
music, audio, and graphics.

Provides syntax highlighting, code navigation, and structural editing support
for `.xtm` files in editors with tree-sitter integration (Neovim, Helix, Zed,
Emacs).

## Usage

### Neovim

Add the parser to your nvim-treesitter config:

```lua
local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.extempore = {
  install_info = {
    url = "https://github.com/extemporelang/tree-sitter-extempore",
    files = { "src/parser.c" },
  },
  filetype = "extempore",
}

vim.filetype.add({ extension = { xtm = "extempore" } })
```

Then run `:TSInstall extempore` and copy the `queries/` directory to your
nvim-treesitter queries path.

### Helix

Add to `languages.toml`:

```toml
[[language]]
name = "extempore"
scope = "source.extempore"
file-types = ["xtm"]
comment-token = ";"
indent = { tab-width = 2, unit = "  " }

[[grammar]]
name = "extempore"
source = { git = "https://github.com/extemporelang/tree-sitter-extempore", rev = "main" }
```

Then run `hx --grammar fetch` and `hx --grammar build`.

## Development

```bash
npm install
npx tree-sitter generate
npx tree-sitter test
```

Parse a file:

```bash
npx tree-sitter parse path/to/file.xtm
```

Preview highlighting:

```bash
npx tree-sitter highlight path/to/file.xtm
```

## Grammar design

The grammar models Extempore's actual reader, which is s7 Scheme (`src/s7.c`,
with the xtlang adapter in `src/SchemeS7.cpp`). s7 terminates an atom only at
`( ) ; "` and whitespace; every other byte --- brackets, braces, angle brackets,
pipe, colon, star, and even the quote, backquote, comma, and sharp characters
--- is a legal atom constituent. Those last four are special only when they
_begin_ a token, so `c#0` (a note name) and the trailing quote in `'FMSynth'`
(read by s7 as a quoted five-character symbol ending in a quote character) are
both ordinary symbols.

xtlang's type syntax (`x:i64`, `[i64,i64]*`, `<double,double>`, `|4,float|`,
`Pair{!a,!b}`) is read by s7 as ordinary atoms and only interpreted later by the
xtlang compiler. An external scanner (`src/scanner.c`) lifts those type strings
into dedicated `typed_identifier`, `xtlang_type` and `generic_identifier` nodes
so editors can highlight and navigate them. Because type strings never contain
whitespace, the scanner bails the moment it hits a space --- which is also what
stops a bare `<` (as in `<=`) from being mistaken for the start of a tuple type.

### Supported constructs

- lists and dotted pairs
- symbols (broad character set matching Extempore's reader)
- numbers: integers, floats, scientific notation, hex (`#x`), binary (`#b`),
  octal (`#o`), signed radix (`#x-ff`), rationals (`3/4`), typed literals
  (`5:i64`, `3.0:f`)
- strings with escape sequences (any `\<char>` pair, as s7 reads them, plus `\x`
  hex runs and line continuations)
- characters (`#\a`, `#\space`, `#\newline`, `#\tab`, `#\return`, `#\xHH`)
- booleans (`#t`, `#f`)
- sharp constants: any other `#...` atom, per s7's `read_sharp` fallback ---
  `#_format` builtin references, `#true`, `#<eof>`; typed-vector prefixes
  (`#i(...)`, `#u8(...)`) parse as a sharp constant followed by a list
- vectors (`#(1 2 3)`)
- comments: line (`;`), hashbang (`#!`), nestable block (`#| |#`)
- quote forms: `'`, `` ` ``, `,`, `,@`

### Highlight queries

The highlight queries use `#match?` predicates on symbol text to provide
semantic highlighting without grammar rules for every construct. Highlighted
forms include `bind-func`, `bind-type`, `bind-val`, `bind-lib`, `bind-data`,
`bind-alias`, `bind-poly`, `define`, `define-macro`, `lambda`, `let`, `cond`,
`if`, `begin`, `dotimes`, `memzone`, `callback`, and Scheme/xtlang builtins.

Keyword lists are drawn from the
[extempore-emacs-mode](https://github.com/extemporelang/extempore-emacs-mode).

### Coverage

Every `.xtm` file in the Extempore source tree parses without errors, and CI
re-checks this on each change by parsing a fresh checkout (see
`script/parse-corpus.sh`). Symbols containing `'` or `#` --- single-quoted words
like `'FMSynth'` and note/chord names like `c#0`, `^7#4` --- now read as the
single symbols s7 makes them.

### Known limitations

Some of xtlang's syntax is genuinely semantic (resolved by the compiler, not the
reader), so a context-free grammar can only approximate it with heuristics:

- a named type annotation (`x:Point`) is told apart from a namespaced Scheme
  symbol (`sys:platform`) by capitalisation: an uppercase-led name after `:` is
  treated as a type, a lowercase one as part of the symbol. A lowercase type
  alias used as an annotation (e.g. `x:bool`) therefore still parses, but isn't
  lifted to a `type_annotation` node for highlighting.
- a symbol that contains both `#`/`'` and a type annotation (rare) is read as a
  plain symbol rather than a `typed_identifier`.

## Acknowledgements

Number, character, and escape sequence patterns adapted from
[tree-sitter-scheme](https://github.com/6cdh/tree-sitter-scheme) by 6cdh (MIT
licence, vendored in `vendored/tree-sitter-scheme/` for reference).

## Licence

MIT --- see [LICENSE](LICENSE).
