; locals.scm --- Extempore scope and variable tracking

; Scope-creating forms
(list
  .
  (symbol) @_keyword
  (#match? @_keyword "^(lambda|let|let\\*|letrec|letz|do|dolet|dotimes|doloop|memzone)$")) @local.scope

; bind-func creates a scope
(list
  .
  (symbol) @_keyword
  (#match? @_keyword "^(bind-func|definec)$")) @local.scope

; define creates a definition
(list
  .
  (symbol) @_keyword
  .
  (symbol) @local.definition
  (#match? @_keyword "^(define|bind-val)$"))

; bind-func name
(list
  .
  (symbol) @_keyword
  .
  (symbol) @local.definition
  (#match? @_keyword "^(bind-func|definec|bind-macro|define-macro)$"))

; Symbol references
(symbol) @local.reference
