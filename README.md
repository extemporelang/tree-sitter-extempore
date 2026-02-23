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

The grammar matches Extempore's actual reader from `src/Scheme.cpp`. The
tokeniser treats only `( ) ; " ' \` , #` and whitespace as special characters
--- everything else (including `[ ] { } < > | : * ! @ /`) is part of an atom.
This means xtlang type annotations like `x:i64` and `<double,double>` are parsed
as atoms separated by commas, matching the reader's behaviour.

### Supported constructs

- lists and dotted pairs
- symbols (broad character set matching Extempore's reader)
- numbers: integers, floats, scientific notation, hex (`#x`), binary (`#b`),
  octal (`#o`), rationals (`3/4`), typed literals (`5:i64`, `3.0:f`)
- strings with escape sequences
- characters (`#\a`, `#\space`, `#\newline`, `#\tab`, `#\return`, `#\xHH`)
- booleans (`#t`, `#f`)
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

### Known limitations

Extempore's tokeniser gives `'` and `#` context-dependent semantics that can't
be fully captured in a context-free grammar:

- single-quoted xtlang strings (`'hello'`) are parsed as a quoted symbol with a
  trailing quote in the name, which can cause parse errors when the trailing `'`
  is interpreted as a new quote form
- `#` inside symbol names (e.g. `c#0` for musical note names) triggers sharp
  constant parsing

These affect about 4% of `.xtm` files in the Extempore repo --- the remaining
96% parse without errors.

## Acknowledgements

Number, character, and escape sequence patterns adapted from
[tree-sitter-scheme](https://github.com/6cdh/tree-sitter-scheme) by 6cdh (MIT
licence, vendored in `vendored/tree-sitter-scheme/` for reference).

## Licence

MIT --- see [LICENSE](LICENSE).
