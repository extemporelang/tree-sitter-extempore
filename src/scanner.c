#include "tree_sitter/parser.h"

enum TokenType {
  XTLANG_TYPE,
  TYPED_NAME,
  TYPE_ANNOTATION,
  GENERIC_IDENTIFIER,
};

static bool is_delimiter(int32_t c) {
  return c == 0 || c == ' ' || c == '\t' || c == '\n' || c == '\r' ||
         c == '\f' || c == '\v' || c == '(' || c == ')' || c == '"' ||
         c == '\'' || c == '`' || c == ',' || c == ';' || c == '#';
}

static bool is_symbol_char(int32_t c) {
  return !is_delimiter(c) && c != 0;
}

static bool match_keyword(TSLexer *lexer, const char *keyword) {
  for (const char *p = keyword; *p; p++) {
    if (lexer->lookahead != *p) return false;
    lexer->advance(lexer, false);
  }
  return true;
}

static bool scan_simple_type(TSLexer *lexer) {
  int32_t c = lexer->lookahead;
  bool matched = false;

  if (c == 'i') {
    lexer->advance(lexer, false);
    c = lexer->lookahead;
    if (c == '1') {
      lexer->advance(lexer, false);
      c = lexer->lookahead;
      if (c == '6') { lexer->advance(lexer, false); matched = true; }
      else if (c == '*' || is_delimiter(c)) { matched = true; }
    } else if (c == '8') {
      lexer->advance(lexer, false);
      matched = true;
    } else if (c == '3') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '2') { lexer->advance(lexer, false); matched = true; }
    } else if (c == '6') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '4') { lexer->advance(lexer, false); matched = true; }
    }
  } else if (c == 'f') {
    lexer->advance(lexer, false);
    if (lexer->lookahead == 'l') {
      matched = match_keyword(lexer, "loat");
    } else if (lexer->lookahead == '3') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '2') { lexer->advance(lexer, false); matched = true; }
    } else if (lexer->lookahead == '6') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '4') { lexer->advance(lexer, false); matched = true; }
    } else {
      matched = true;
    }
  } else if (c == 'd') {
    lexer->advance(lexer, false);
    if (lexer->lookahead == 'o') {
      matched = match_keyword(lexer, "ouble");
    } else {
      matched = true;
    }
  } else if (c == 'v') {
    matched = match_keyword(lexer, "void");
  }

  if (!matched) return false;

  while (lexer->lookahead == '*') {
    lexer->advance(lexer, false);
  }

  return is_delimiter(lexer->lookahead);
}

static int32_t closing_bracket(int32_t open) {
  switch (open) {
    case '[': return ']';
    case '<': return '>';
    case '|': return '|';
    case '/': return '/';
    default: return 0;
  }
}

static bool scan_bracket_type(TSLexer *lexer) {
  int32_t open = lexer->lookahead;
  int32_t close = closing_bracket(open);
  if (!close) return false;

  lexer->advance(lexer, false);

  if (open == '|' || open == '/') {
    if (lexer->lookahead < '0' || lexer->lookahead > '9') return false;
  } else {
    if (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
        lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
        lexer->lookahead == 0) return false;
  }

  bool found_comma = false;
  bool found_nested = false;
  int depth = 1;

  while (depth > 0) {
    int32_t c = lexer->lookahead;
    if (c == 0) return false;

    if (c == open && open != close) {
      depth++;
      lexer->advance(lexer, false);
    } else if (c == close) {
      depth--;
      lexer->advance(lexer, false);
    } else if (c == ',' && depth == 1) {
      found_comma = true;
      lexer->advance(lexer, false);
    } else if (c == '[' || c == '<') {
      if (depth == 1) found_nested = true;
      int32_t inner_close = closing_bracket(c);
      int inner_depth = 1;
      lexer->advance(lexer, false);
      while (inner_depth > 0) {
        int32_t ic = lexer->lookahead;
        if (ic == 0) return false;
        if (ic == c && c != inner_close) {
          inner_depth++;
        } else if (ic == inner_close) {
          inner_depth--;
        }
        lexer->advance(lexer, false);
      }
    } else if (c == '|' || c == '/') {
      lexer->advance(lexer, false);
      if (lexer->lookahead >= '0' && lexer->lookahead <= '9') {
        if (depth == 1) found_nested = true;
        int32_t ic = closing_bracket(c);
        while (lexer->lookahead != 0 && lexer->lookahead != ic) {
          lexer->advance(lexer, false);
        }
        if (lexer->lookahead == ic) {
          lexer->advance(lexer, false);
        } else {
          return false;
        }
      }
    } else {
      lexer->advance(lexer, false);
    }
  }

  if (!found_comma && !found_nested) return false;

  while (lexer->lookahead == '*') {
    lexer->advance(lexer, false);
  }

  return is_delimiter(lexer->lookahead);
}

static bool check_type_after_colon(TSLexer *lexer) {
  int32_t after_colon = lexer->lookahead;
  if (after_colon == '[' || after_colon == '<' || after_colon == '|' ||
      after_colon == '/') {
    return scan_bracket_type(lexer);
  }
  return scan_simple_type(lexer);
}

void *tree_sitter_extempore_external_scanner_create(void) { return NULL; }
void tree_sitter_extempore_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_extempore_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_extempore_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

bool tree_sitter_extempore_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  int32_t first = lexer->lookahead;

  if (first == '[' || first == '<') {
    if (valid_symbols[XTLANG_TYPE]) {
      lexer->result_symbol = XTLANG_TYPE;
      return scan_bracket_type(lexer);
    }
    return false;
  }

  if (first == '|' || first == '/') {
    if (valid_symbols[XTLANG_TYPE]) {
      lexer->result_symbol = XTLANG_TYPE;
      return scan_bracket_type(lexer);
    }
    return false;
  }

  if (first == ':' && valid_symbols[TYPE_ANNOTATION]) {
    lexer->advance(lexer, false);
    if (check_type_after_colon(lexer)) {
      lexer->result_symbol = TYPE_ANNOTATION;
      return true;
    }
    return false;
  }

  if (is_symbol_char(first) && first != '[' && first != '<' && first != '|' &&
      first != '/' && first != '{' && first != ':' &&
      !(first >= '0' && first <= '9') && first != '.' &&
      first != '+' && first != '-') {
    bool has_chars = false;

    while (is_symbol_char(lexer->lookahead) && lexer->lookahead != ':' &&
           lexer->lookahead != '{') {
      lexer->advance(lexer, false);
      has_chars = true;
    }

    if (!has_chars) return false;

    if (lexer->lookahead == ':' && valid_symbols[TYPED_NAME]) {
      lexer->mark_end(lexer);
      lexer->advance(lexer, false);
      if (check_type_after_colon(lexer)) {
        lexer->result_symbol = TYPED_NAME;
        return true;
      }
      return false;
    }

    if (lexer->lookahead == '{' && valid_symbols[GENERIC_IDENTIFIER]) {
      lexer->advance(lexer, false);
      int depth = 1;
      bool found_content = false;

      while (depth > 0) {
        int32_t c = lexer->lookahead;
        if (c == 0) return false;
        if (c == '{') {
          depth++;
        } else if (c == '}') {
          depth--;
        } else {
          found_content = true;
        }
        lexer->advance(lexer, false);
      }

      if (!found_content) return false;

      while (lexer->lookahead == '*') {
        lexer->advance(lexer, false);
      }

      if (is_delimiter(lexer->lookahead)) {
        lexer->result_symbol = GENERIC_IDENTIFIER;
        return true;
      }
      return false;
    }

    return false;
  }

  return false;
}
