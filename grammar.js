// Tree-sitter grammar for Extempore
//
// Models Extempore's actual reader, which is s7 Scheme (src/s7.c, plus the
// xtlang adapter in src/SchemeS7.cpp). s7's char_ok_in_a_name table terminates
// an atom only at ( ) ; " and whitespace/EOF; every other byte --- including
// [ ] { } < > | : * ! @ / \ and even ' ` , # --- is a legal atom constituent.
// The ' ` , # characters are special only when they *begin* a token, so the
// symbol rule allows ' and # in a tail (see the symbol rule for details).
//
// xtlang's type syntax (x:i64, [i64,i64]*, <double,double>, |4,float|,
// Pair{!a,!b}) is read by s7 as ordinary atoms and only interpreted later by
// the xtlang compiler. This grammar lifts those type strings into dedicated
// nodes (typed_identifier / xtlang_type / generic_identifier) via the external
// scanner so editors can highlight and navigate them.
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
        $.sharp_constant,
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

    // s7's read_sharp: a #... atom that isn't a boolean, character, number,
    // vector opener, or comment opener falls through to Token_Sharp_Const and
    // is read to the next delimiter --- #_format (builtin reference, used in
    // init.xtm), #true, #<eof>, and the typed-vector prefixes #i/#r/#u8 (their
    // "(...)" then parses as an ordinary list). The first character after #
    // excludes the openers handled by other rules ( ( \ | ! ' # ). No prec:
    // lexical precedence trumps match *length*, so any nudge here would beat
    // longer matches too. At equal precedence the longest match wins (#true,
    // #x1.8 lex here as the single atoms s7 makes them) and exact-length ties
    // fall to rule order, where boolean and number are defined first (#t stays
    // a boolean, #x1F a number).
    sharp_constant: _ =>
      token(
        seq(
          "#",
          /[^ \r\n\t\f\v()";,`'#!|\\]/,
          repeat(/[^ \r\n\t\f\v()";,`]/))),

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

    // Symbols: everything that isn't a delimiter or token-initiating special.
    //
    // s7's reader (src/s7.c, char_ok_in_a_name) terminates a name only at
    // ( ) ; " and whitespace/EOF. Every other byte --- including ' and # ---
    // is a legal *constituent* of a symbol; ' ` , # are special only when they
    // *begin* a token. So `c#0`, `^7#4` (note/chord names) and the trailing
    // quote in `'FMSynth'` (read as (quote |FMSynth'|)) are all single symbols.
    //
    // We model that by forbidding ' and # as the *first* character (so the
    // quote and sharp rules win at token start) while allowing them in the
    // tail. ` and , stay reserved everywhere as quasiquote/unquote initiators.
    symbol: _ =>
      token(
        seq(
          /[^ \r\n\t\f\v()";,`'#]/,
          repeat(/[^ \r\n\t\f\v()";,`]/))),

    // --- compound data ---

    // Lists support dotted pairs: (a . b)
    // The dot must be followed by whitespace to distinguish from symbols like 1.0
    list: $ =>
      choice(
        seq("(", repeat($._token), ")"),
        seq("(", repeat($._token), ".", repeat1($._token), ")")),

    vector: $ =>
      seq("#(", repeat($._token), ")"),

    // repeat (not optional): whitespace and comments are separate intertoken
    // instances, so '  ;; c
    //                foo
    // needs several of them between the quote mark and the datum.
    quote: $ =>
      seq("'", repeat($._intertoken), $._datum),

    quasiquote: $ =>
      seq("`", repeat($._intertoken), $._datum),

    unquote: $ =>
      seq(",", repeat($._intertoken), $._datum),

    unquote_splicing: $ =>
      seq(",@", repeat($._intertoken), $._datum),
  },
});
