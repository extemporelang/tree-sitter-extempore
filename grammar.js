// Tree-sitter grammar for Extempore
//
// Matches Extempore's actual reader from src/Scheme.cpp.
// Atom delimiters are: ( ) ; " ' ` , # and whitespace/control chars.
// Everything else (including [ ] { } < > | : * ! @ / \) is part of an atom.
//
// Number, character, and escape sequence patterns adapted from
// tree-sitter-scheme (https://github.com/6cdh/tree-sitter-scheme) by 6cdh
// (MIT licence).

const PREC = {
  first: $ => prec(100, $),
};

module.exports = grammar({
  name: "extempore",

  externals: $ => [$.xtlang_type, $._typed_name, $.type_annotation, $.generic_identifier],

  extras: _ => [],

  rules: {
    program: $ => repeat($._token),

    _token: $ =>
      choice(
        $._intertoken,
        $._datum),

    typed_identifier: $ =>
      seq(alias($._typed_name, $.symbol), $.type_annotation),

    _intertoken: $ =>
      choice(
        token(repeat1(/[ \r\n\t\f\v]/)),
        $.comment,
        $.block_comment),

    comment: _ =>
      choice(
        /;.*/,
        seq("#!", /.*/)),

    block_comment: $ =>
      seq("#|",
        repeat(
          choice(
            PREC.first($.block_comment),
            /.|[\r\n]/)),
        PREC.first("|#")),

    _datum: $ =>
      choice(
        $.boolean,
        $.character,
        $.string,
        $.number,
        $.xtlang_type,
        $.typed_identifier,
        $.generic_identifier,
        $.symbol,
        $.list,
        $.vector,
        $.quote,
        $.quasiquote,
        $.unquote,
        $.unquote_splicing),

    // --- simple data ---

    boolean: _ =>
      token(
        seq("#", /[tTfF]/)),

    // numbers: Extempore uses standard Scheme numeric prefixes plus typed
    // literals (e.g. 5:i64, 3.0:f). The tokenizer reads atoms up to
    // delimiters and then calls mk_number/mk_sharp_const, so the grammar
    // needs to match those atom strings.
    number: _ => {
      const sign = optional(/[+-]/);
      const digits10 = /[0-9]/;
      const digits16 = /[0-9a-fA-F]/;

      // typed suffix for xtlang literals: :i1, :i8, :i16, :i32, :i64,
      // :f, :float, :double, :f32, :f64
      const type_suffix = optional(seq(":", /[a-zA-Z][a-zA-Z0-9]*/));

      const integer = seq(sign, repeat1(digits10), type_suffix);
      const float_num = choice(
        seq(sign, repeat1(digits10), ".", repeat(digits10), optional(seq(/[eE]/, sign, repeat1(digits10))), type_suffix),
        seq(sign, ".", repeat1(digits10), optional(seq(/[eE]/, sign, repeat1(digits10))), type_suffix),
        seq(sign, repeat1(digits10), /[eE]/, sign, repeat1(digits10), type_suffix));
      const rational = seq(sign, repeat1(digits10), "/", repeat1(digits10));

      const hex = seq("#", /[xX]/, repeat1(digits16));
      const binary = seq("#", /[bB]/, repeat1(/[01]/));
      const octal = seq("#", /[oO]/, repeat1(/[0-7]/));
      const decimal_prefix = seq("#", /[dD]/, repeat1(digits10));

      return token(choice(hex, binary, octal, decimal_prefix, float_num, rational, integer));
    },

    character: _ =>
      token(
        seq(
          //#\
          "#",
          "\\",
          choice(
            "space",
            "newline",
            "return",
            "tab",
            seq("x", /[0-9a-fA-F]+/),
            /[^\s]/))),

    string: $ =>
      seq(
        '"',
        repeat(
          choice(
            $.escape_sequence,
            /[^"\\]+/)),
        '"'),

    escape_sequence: _ =>
      token(
        choice(
          "\\\"",
          "\\\\",
          "\\n",
          "\\t",
          "\\r",
          seq("\\x", /[0-9a-fA-F]{2}/),
          seq("\\X", /[0-9a-fA-F]{2}/))),

    // Symbols: everything that isn't a delimiter or special character.
    // Extempore's atom delimiters from readstr_upto: ( ) ; \t \n \r space
    // Additional token chars handled separately: " ' ` , #
    // So a symbol is anything not in that set --- including [ ] { } < > | : * ! @ /
    symbol: _ =>
      token(
        repeat1(/[^ \r\n\t\f\v()"',;`#]/)),

    // --- compound data ---

    // Lists support dotted pairs: (a . b)
    // The dot must be followed by whitespace to distinguish from symbols like 1.0
    list: $ =>
      choice(
        seq("(", repeat($._token), ")"),
        seq("(", repeat($._token), ".", repeat1($._token), ")")),

    vector: $ =>
      seq("#(", repeat($._token), ")"),

    quote: $ =>
      seq("'", optional($._intertoken), $._datum),

    quasiquote: $ =>
      seq("`", optional($._intertoken), $._datum),

    unquote: $ =>
      seq(",", optional($._intertoken), $._datum),

    unquote_splicing: $ =>
      seq(",@", optional($._intertoken), $._datum),
  },
});
